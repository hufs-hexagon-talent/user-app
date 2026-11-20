import { vi } from 'vitest';
import axios from 'axios';
import { apiClient, SESSION_EXPIRED_MESSAGE } from './client';
import { handleSessionExpired } from './session';
vi.mock('./session', () => ({
  handleSessionExpired: vi.fn(),
}));
vi.mock('../config', () => ({
  default: { API_URL: 'http://api.test' },
}));

// 어댑터를 바꿔 실제 인터셉터 흐름(401 → refresh → 재시도/거부)을 그대로 태운다.
const httpError = (config, status, data) =>
  new axios.AxiosError(`HTTP ${status}`, 'ERR_BAD_REQUEST', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data,
  });
const AUTH_013 = {
  isSuccess: false,
  code: 'AUTH-013',
  message: '쿠키에 refreshToken 이 없습니다.',
};
const AUTH_001 = {
  isSuccess: false,
  code: 'AUTH-001',
  message: '[사용자 인증에 실패] 아이디 혹은 비밀번호를 확인해주세요.',
};
const ok = config => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  config,
  data: {
    isSuccess: true,
  },
});

// refresh 응답을 정해 두고, 그 외 요청은 URL 별 첫 호출 401 → 재시도 200 으로 돈다.
// (axios 는 재시도 때 config 를 새 객체로 병합하므로 객체 동일성으로 세면 안 된다)
const useAdapter = ({ refresh }) => {
  const calls = [];
  apiClient.defaults.adapter = vi.fn(async config => {
    calls.push(config.url);
    if (config.url === '/auth/refresh') return refresh(config);
    if (config.url === '/auth/login') throw httpError(config, 401, AUTH_001);
    if (calls.filter(u => u === config.url).length === 1) {
      throw httpError(config, 401, AUTH_001);
    }
    return ok(config);
  });
  return calls;
};
beforeEach(() => {
  handleSessionExpired.mockClear();
});
describe('토큰 갱신 실패', () => {
  test('refresh 가 401 이면 호출자는 서버 원문 대신 재로그인 안내를 받는다', async () => {
    useAdapter({
      refresh: c => Promise.reject(httpError(c, 401, AUTH_013)),
    });
    const error = await apiClient.get('/reservations').catch(e => e);
    expect(error.sessionExpired).toBe(true);
    expect(error.message).toBe(SESSION_EXPIRED_MESSAGE);
    expect(error.response.status).toBe(401);
    expect(error.response.data.message).toBe(SESSION_EXPIRED_MESSAGE);
    // 원인 추적용으로 서버 코드는 남긴다
    expect(error.response.data.code).toBe('AUTH-013');
    expect(handleSessionExpired).toHaveBeenCalledTimes(1);
  });
  test('refresh 가 403 이어도 세션 만료로 다룬다', async () => {
    useAdapter({
      refresh: c => Promise.reject(httpError(c, 403, AUTH_013)),
    });
    const error = await apiClient.get('/reservations').catch(e => e);
    expect(error.sessionExpired).toBe(true);
    expect(handleSessionExpired).toHaveBeenCalledTimes(1);
  });
  test('갱신 중 큐에 쌓인 요청도 같은 재로그인 안내를 받는다', async () => {
    let rejectRefresh;
    const calls = useAdapter({
      refresh: () => new Promise((_, reject) => (rejectRefresh = reject)),
    });
    const first = apiClient.get('/reservations').catch(e => e);
    const second = apiClient.delete('/reservations/me/1').catch(e => e);
    await new Promise(r => setTimeout(r, 0));
    rejectRefresh(
      httpError(
        {
          url: '/auth/refresh',
        },
        401,
        AUTH_013,
      ),
    );
    const [a, b] = await Promise.all([first, second]);
    expect(a.response.data.message).toBe(SESSION_EXPIRED_MESSAGE);
    expect(b.response.data.message).toBe(SESSION_EXPIRED_MESSAGE);
    expect(calls.filter(u => u === '/auth/refresh')).toHaveLength(1);
    expect(handleSessionExpired).toHaveBeenCalledTimes(1);
  });
  test('refresh 가 네트워크 오류면 세션을 정리하지 않고 그 오류를 그대로 넘긴다', async () => {
    const networkError = new axios.AxiosError('Network Error', 'ERR_NETWORK', {
      url: '/auth/refresh',
    });
    useAdapter({
      refresh: () => Promise.reject(networkError),
    });
    const error = await apiClient.get('/reservations').catch(e => e);
    expect(error).toBe(networkError);
    expect(error.sessionExpired).toBeUndefined();
    expect(handleSessionExpired).not.toHaveBeenCalled();
  });
  test('refresh 가 5xx 면 세션을 정리하지 않는다', async () => {
    useAdapter({
      refresh: c =>
        Promise.reject(
          httpError(c, 502, {
            code: 'SYS-001',
            message: '서버 내부 오류',
          }),
        ),
    });
    const error = await apiClient.get('/reservations').catch(e => e);
    expect(error.response.status).toBe(502);
    expect(error.sessionExpired).toBeUndefined();
    expect(handleSessionExpired).not.toHaveBeenCalled();
  });
});
describe('갱신을 시도하지 않는 경우', () => {
  test('/auth/login 401 은 원래 오류를 그대로 넘긴다', async () => {
    const calls = useAdapter({
      refresh: c => Promise.resolve(ok(c)),
    });
    const error = await apiClient.post('/auth/login', {}).catch(e => e);
    expect(error.response.data).toEqual(AUTH_001);
    expect(calls).not.toContain('/auth/refresh');
    expect(handleSessionExpired).not.toHaveBeenCalled();
  });
  test('/users/reset-password 401 은 갱신 없이 원래 오류를 그대로 넘긴다', async () => {
    const calls = [];
    apiClient.defaults.adapter = vi.fn(async config => {
      calls.push(config.url);
      throw httpError(config, 401, {
        code: 'AUTH-007',
        message: '비밀번호 리셋 토큰의 유효기간이 만료되었습니다.',
      });
    });
    const error = await apiClient
      .post('/users/reset-password', {})
      .catch(e => e);
    expect(error.response.data.code).toBe('AUTH-007');
    expect(error.sessionExpired).toBeUndefined();
    expect(calls).not.toContain('/auth/refresh');
    expect(handleSessionExpired).not.toHaveBeenCalled();
  });
  test('401 이 아닌 오류는 손대지 않는다', async () => {
    const calls = useAdapter({
      refresh: c => Promise.resolve(ok(c)),
    });
    apiClient.defaults.adapter = vi.fn(async config => {
      calls.push(config.url);
      throw httpError(config, 412, {
        code: 'RESERVATION-012',
        message: '지난 시간대',
      });
    });
    const error = await apiClient.post('/reservations', {}).catch(e => e);
    expect(error.response.data.code).toBe('RESERVATION-012');
    expect(calls).not.toContain('/auth/refresh');
  });
});
describe('갱신 성공', () => {
  test('원래 요청을 한 번 재시도해 그 결과를 돌려준다', async () => {
    const calls = useAdapter({
      refresh: c => Promise.resolve(ok(c)),
    });
    const response = await apiClient.get('/reservations');
    expect(response.status).toBe(200);
    expect(calls).toEqual(['/reservations', '/auth/refresh', '/reservations']);
    expect(handleSessionExpired).not.toHaveBeenCalled();
  });
});
