import {
  MIDNIGHT_NOT_CLEARED_MESSAGE,
  MIDNIGHT_UNSUPPORTED_MESSAGE,
  midnightMismatchMessage,
  POLICY_FORBIDDEN_MESSAGE,
  POLICY_NETWORK_MESSAGE,
  POLICY_SERVER_MESSAGE,
  POLICY_UNAUTHORIZED_MESSAGE,
  policyErrorMessage,
} from './policyErrorMessage';

const FALLBACK = '정책 생성 중 오류가 발생하였습니다.';

// 서버 실제 응답 모양: { isSuccess, code, message, errors: [{ field, message }] }
const httpError = (status, data) => ({ response: { status, data } });

describe('policyErrorMessage', () => {
  it('30분 격자 거절 사유를 어느 칸이 걸렸는지까지 알려준다', () => {
    const message = policyErrorMessage(
      httpError(400, {
        code: 'CLIENT-001',
        message: '잘못된 요청입니다. 요청 내용을 다시 확인해주세요.',
        errors: [
          {
            field: 'operationEndTime',
            message: '운영 시간은 30분 단위로만 지정할 수 있습니다.',
          },
        ],
      }),
      FALLBACK,
    );

    expect(message).toContain('종료 시각');
    expect(message).toContain('30분 단위');
  });

  it('시작·종료가 함께 걸리면 두 칸을 모두 안내한다', () => {
    const message = policyErrorMessage(
      httpError(400, {
        code: 'CLIENT-001',
        errors: [
          {
            field: 'operationStartTime',
            message: '운영 시간은 30분 단위로만 지정할 수 있습니다.',
          },
          {
            field: 'operationEndTime',
            message: '운영 시간은 30분 단위로만 지정할 수 있습니다.',
          },
        ],
      }),
      FALLBACK,
    );

    expect(message).toContain('시작 시각');
    expect(message).toContain('종료 시각');
  });

  it('같은 칸이 여러 규칙에 걸려도 한 번만 안내한다', () => {
    const message = policyErrorMessage(
      httpError(400, {
        code: 'CLIENT-001',
        errors: [
          {
            field: 'operationStartTime',
            message: '운영 시간은 30분 단위로만 지정할 수 있습니다.',
          },
          // 시작>=종료는 operationStartTime 한 필드로만 온다(ChronologicalTimeValidator)
          {
            field: 'operationStartTime',
            message: '유효하지 않은 운영시간 입니다.',
          },
        ],
      }),
      FALLBACK,
    );

    expect(message.match(/시작 시각/g)).toHaveLength(1);
  });

  it('경로 변수 검증의 메서드 경로가 화면에 새지 않는다', () => {
    const message = policyErrorMessage(
      httpError(400, {
        code: 'CLIENT-001',
        errors: [
          {
            field: 'deletePolicy.roomOperationPolicyId',
            message: '해당 정책은 존재하지 않습니다.',
          },
        ],
      }),
      '정책 삭제 중 오류가 발생하였습니다.',
    );

    expect(message).toBe(
      '해당 정책을 찾을 수 없습니다. 목록을 새로 고쳐 주세요.',
    );
    expect(message).not.toContain('deletePolicy');
  });

  it('프레임워크 기본 문구(@Positive)를 그대로 띄우지 않는다', () => {
    const message = policyErrorMessage(
      httpError(400, {
        code: 'CLIENT-001',
        errors: [{ field: 'eachMaxMinute', message: 'must be greater than 0' }],
      }),
      FALLBACK,
    );

    expect(message).toBe('최대 이용 시간은 1분 이상으로 지정해 주세요.');
    expect(message).not.toContain('must be greater than');
  });

  it('401 은 서버 원문 대신 재로그인 안내', () => {
    const message = policyErrorMessage(
      httpError(401, {
        code: 'AUTH-013',
        message: '쿠키에 refreshToken 이 없습니다.',
      }),
      FALLBACK,
    );

    expect(message).toBe(POLICY_UNAUTHORIZED_MESSAGE);
    expect(message).not.toContain('refreshToken');
  });

  it('403 은 권한 문구', () => {
    expect(
      policyErrorMessage(
        httpError(403, {
          code: 'CLIENT-003',
          message: '접근이 거부되었습니다.',
        }),
        FALLBACK,
      ),
    ).toBe(POLICY_FORBIDDEN_MESSAGE);
  });

  it('errors 가 없는 400 은 코드 매핑으로 안내한다', () => {
    expect(
      policyErrorMessage(httpError(400, { code: 'CLIENT-001' }), FALLBACK),
    ).toBe('입력한 값의 형식을 확인해 주세요.');
    expect(
      policyErrorMessage(
        httpError(404, {
          code: 'POLICY-001',
          message: '해당 정책은 존재하지 않습니다.',
        }),
        FALLBACK,
      ),
    ).toBe('해당 정책을 찾을 수 없습니다. 목록을 새로 고쳐 주세요.');
  });

  it('응답이 없으면 네트워크 안내', () => {
    expect(policyErrorMessage(new Error('Network Error'), FALLBACK)).toBe(
      POLICY_NETWORK_MESSAGE,
    );
  });

  it('5xx 는 서버 문구로 덮는다', () => {
    expect(
      policyErrorMessage(
        httpError(500, { code: 'SYS-001', message: '서버 내부 오류' }),
        FALLBACK,
      ),
    ).toBe(POLICY_SERVER_MESSAGE);
  });

  it('세션 만료는 null 이라 스낵바를 겹쳐 띄우지 않는다', () => {
    expect(policyErrorMessage({ sessionExpired: true }, FALLBACK)).toBeNull();
  });

  it('코드도 errors 도 없으면 호출부 문구를 그대로 쓴다', () => {
    expect(policyErrorMessage(httpError(400, {}), FALLBACK)).toBe(FALLBACK);
  });

  it('옛 코드가 TypeError 로 죽던 입력에도 던지지 않는다', () => {
    expect(() => policyErrorMessage(httpError(400, {}), 'x')).not.toThrow();
    expect(() => policyErrorMessage(undefined, 'x')).not.toThrow();
    expect(() =>
      policyErrorMessage({ response: { status: 400 } }, 'x'),
    ).not.toThrow();
  });
});

describe('policyErrorMessage 참조 충돌', () => {
  it('스케줄이 붙은 정책 삭제(409 CLIENT-009)를 정체불명 오류로 두지 않는다', () => {
    // 서버가 정책 삭제를 미리 막지 않아 DB FK 위반이 409 CLIENT-009 로 온다.
    // 이 매핑이 없으면 같은 PR 이 500 을 409 로 바꿔 놓고도 화면 문구는 그대로 fallback 이다.
    const message = policyErrorMessage(
      {
        response: {
          status: 409,
          data: { code: 'CLIENT-009', message: 'Duplicate entry ...' },
        },
      },
      '정책 삭제 중 오류가 발생하였습니다.',
    );

    expect(message).toContain('운영 스케줄');
    expect(message).not.toContain('Duplicate entry');
  });
});

describe('midnightMismatchMessage', () => {
  it('보내지 않았으면 확인하지 않는다', () => {
    expect(midnightMismatchMessage(undefined, {})).toBeNull();
    expect(midnightMismatchMessage(undefined, undefined)).toBeNull();
  });

  it('켰는데 응답이 true 면 통과, 필드가 없거나 false 면 지원하지 않는다고 알린다', () => {
    expect(midnightMismatchMessage(true, { endsAtMidnight: true })).toBeNull();
    expect(midnightMismatchMessage(true, {})).toBe(
      MIDNIGHT_UNSUPPORTED_MESSAGE,
    );
    expect(midnightMismatchMessage(true, { endsAtMidnight: false })).toBe(
      MIDNIGHT_UNSUPPORTED_MESSAGE,
    );
  });

  it('껐는데 응답이 여전히 true 면 알린다. 필드가 없으면 꺼진 것으로 본다', () => {
    expect(
      midnightMismatchMessage(false, { endsAtMidnight: false }),
    ).toBeNull();
    expect(midnightMismatchMessage(false, {})).toBeNull();
    expect(midnightMismatchMessage(false, { endsAtMidnight: true })).toBe(
      MIDNIGHT_NOT_CLEARED_MESSAGE,
    );
  });

  it('POLICY-005 는 자정 운영을 먼저 끄라고 안내한다', () => {
    expect(
      policyErrorMessage(httpError(400, { code: 'POLICY-005' }), FALLBACK),
    ).toContain('자정 운영을 먼저 끄세요');
  });
});
