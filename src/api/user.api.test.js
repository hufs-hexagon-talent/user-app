import { vi } from 'vitest';
import axios from 'axios';
import { apiClient } from './client';
import {
  fetchBlockedPeriod,
  isAuthError,
  passwordChangeErrorMessage,
} from './user.api';
vi.mock('./session', () => ({
  handleSessionExpired: vi.fn(),
}));
vi.mock('../config', () => ({
  default: { API_URL: 'http://api.test' },
}));
const httpError = (config, status, data) =>
  new axios.AxiosError(`HTTP ${status}`, 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
const ok = (config, data) => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
  data,
});
describe('fetchBlockedPeriod', () => {
  test('제한 기간이 있으면 응답 본문을 그대로 돌려준다', async () => {
    const body = {
      isSuccess: true,
      data: {
        startBlockedDate: '2026-08-01',
        endBlockedDate: '2026-09-01',
      },
    };
    apiClient.defaults.adapter = vi.fn(async config => ok(config, body));
    await expect(fetchBlockedPeriod()).resolves.toEqual(body);
  });
  test('제한 상태가 아니면(USER-009) 오류가 아니라 null 을 돌려준다', async () => {
    apiClient.defaults.adapter = vi.fn(async config => {
      throw httpError(config, 400, {
        isSuccess: false,
        code: 'USER-009',
        message: '현재 유저는 블락 상태가 아닙니다.',
      });
    });
    await expect(fetchBlockedPeriod()).resolves.toBeNull();
  });
  test('그 밖의 실패는 그대로 던져 화면이 조회 실패를 알 수 있게 한다', async () => {
    apiClient.defaults.adapter = vi.fn(async config => {
      throw httpError(config, 502, {
        code: 'SYS-001',
        message: '서버 오류',
      });
    });
    const error = await fetchBlockedPeriod().catch(e => e);
    expect(error.response.status).toBe(502);
  });
});
describe('passwordChangeErrorMessage', () => {
  it('응답이 없으면(네트워크·타임아웃) 영문 원문 대신 연결 안내', () => {
    expect(passwordChangeErrorMessage(new Error('Network Error'))).toBe(
      '서버에 연결하지 못했습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.',
    );
    expect(
      passwordChangeErrorMessage(new Error('timeout of 15000ms exceeded')),
    ).not.toContain('timeout');
  });
  it('5xx 는 서버 문제 안내', () => {
    expect(
      passwordChangeErrorMessage({
        response: {
          status: 502,
          data: {
            message: 'Bad Gateway',
          },
        },
      }),
    ).toBe(
      '서버에 문제가 있어 비밀번호를 변경하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
    );
  });
  it('4xx 는 에러 코드로 매핑하고 서버 원문은 쓰지 않는다', () => {
    expect(
      passwordChangeErrorMessage({
        response: {
          status: 400,
          data: {
            code: 'USER-006',
            message: '현재 비밀번호가 일치하지 않습니다.',
          },
        },
      }),
    ).toBe('현재 비밀번호가 맞지 않습니다. 다시 확인해 주세요.');
    expect(
      passwordChangeErrorMessage({
        response: {
          status: 400,
          data: {
            code: 'USER-007',
            message: '원문',
          },
        },
      }),
    ).toBe('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
    expect(
      passwordChangeErrorMessage({
        response: {
          status: 400,
        },
      }),
    ).toBe('비밀번호 변경에 실패했습니다. 다시 시도해 주세요.');
  });
  it('규칙에 걸린 새 비밀번호는 규칙을 알려 준다', () => {
    expect(
      passwordChangeErrorMessage({
        response: {
          status: 400,
          data: {
            code: 'CLIENT-001',
            message: '잘못된 요청입니다.',
            errors: [
              {
                message: '새 비밀번호는 8자 이상이어야 합니다.',
              },
            ],
          },
        },
      }),
    ).toBe('새 비밀번호는 8자 이상이고 영문과 숫자를 포함해야 합니다.');
  });
  it('인터셉터가 세션 만료로 바꾼 오류는 재로그인 안내를 그대로 쓴다', () => {
    const error = new Error('로그인이 만료되었습니다. 다시 로그인해 주세요.');
    error.sessionExpired = true;
    error.response = {
      status: 401,
      data: {
        code: 'AUTH-013',
        message: '로그인이 만료되었습니다. 다시 로그인해 주세요.',
      },
    };
    expect(passwordChangeErrorMessage(error)).toBe(
      '로그인이 만료되었습니다. 다시 로그인해 주세요.',
    );
  });
});
describe('isAuthError', () => {
  const withCode = (status, code) => ({
    response: {
      status,
      data: {
        code,
      },
    },
  });
  it('401/403 은 코드와 상관없이 인증 오류', () => {
    expect(isAuthError(withCode(401, 'AUTH-013'))).toBe(true);
    expect(
      isAuthError({
        response: {
          status: 403,
        },
      }),
    ).toBe(true);
  });
  it('4xx 의 AUTH-*, USER-001 은 인증 오류', () => {
    expect(isAuthError(withCode(400, 'AUTH-008'))).toBe(true);
    expect(isAuthError(withCode(404, 'USER-001'))).toBe(true);
  });
  it('5xx 는 AUTH-* 코드라도 인증 오류가 아니다', () => {
    expect(isAuthError(withCode(500, 'AUTH-015'))).toBe(false);
    expect(isAuthError(withCode(503, 'AUTH-018'))).toBe(false);
  });
  it('응답이 없거나 다른 코드면 인증 오류가 아니다', () => {
    expect(isAuthError(new Error('Network Error'))).toBe(false);
    expect(isAuthError(withCode(412, 'RESERVATION-012'))).toBe(false);
  });
});
