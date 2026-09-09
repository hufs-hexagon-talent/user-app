import {
  INQUIRY_FAILED_MESSAGE,
  inquiryErrorMessage,
} from './inquiryErrorMessage';

const httpError = (status, code, errors) => ({
  response: { status, data: { code, message: '서버 원문', errors } },
});

describe('inquiryErrorMessage', () => {
  it('업무 규칙 코드는 학생용 문구로 바꾼다', () => {
    expect(inquiryErrorMessage(httpError(404, 'INQUIRY-001'))).toBe(
      '문의를 찾을 수 없습니다. 목록을 새로 고쳤습니다.',
    );
    expect(inquiryErrorMessage(httpError(400, 'INQUIRY-002'))).toBe(
      '선택한 예약을 찾을 수 없습니다. 본인 예약만 선택할 수 있습니다.',
    );
    expect(inquiryErrorMessage(httpError(400, 'INQUIRY-003'))).toBe(
      '처리 완료된 문의는 수정하거나 삭제할 수 없습니다.',
    );
    expect(inquiryErrorMessage(httpError(403, 'AUTH-002'))).toBe(
      '본인 문의만 수정하거나 삭제할 수 있습니다.',
    );
  });

  it('접수 상한 초과(CLIENT-008, 429)는 잠시 뒤 다시 시도하라고 안내한다', () => {
    const message = inquiryErrorMessage(httpError(429, 'CLIENT-008'));

    expect(message).toBe(
      '문의 접수가 너무 많습니다. 잠시 뒤 다시 시도해 주세요.',
    );
    expect(message).not.toBe(INQUIRY_FAILED_MESSAGE);
  });

  it('코드 앞뒤 공백은 무시한다', () => {
    expect(inquiryErrorMessage(httpError(404, ' INQUIRY-001'))).toBe(
      '문의를 찾을 수 없습니다. 목록을 새로 고쳤습니다.',
    );
  });

  it('ATTENDANCE 예약 미선택(CLIENT-001)은 field 가 reservationId 여도 예약 선택을 안내한다', () => {
    const message = inquiryErrorMessage(
      httpError(400, 'CLIENT-001', [{ field: 'reservationId' }]),
    );

    expect(message).toBe('예약을 선택해 주세요.');
  });

  it('ATTENDANCE 예약 미선택(CLIENT-001)은 실제 field 인 reservationIdPresentForAttendance 도 같은 문구로 잡는다', () => {
    const message = inquiryErrorMessage(
      httpError(400, 'CLIENT-001', [
        { field: 'reservationIdPresentForAttendance' },
      ]),
    );

    expect(message).toBe('예약을 선택해 주세요.');
  });

  it('CLIENT-001 roomId 는 방을 다시 고르라는 문구로 푼다', () => {
    expect(
      inquiryErrorMessage(httpError(400, 'CLIENT-001', [{ field: 'roomId' }])),
    ).toBe('선택한 방을 찾을 수 없습니다. 목록을 새로 고쳐 주세요.');
  });

  it('CLIENT-001 occurredAtInRange 는 발생 시각 범위 문구로 푼다', () => {
    expect(
      inquiryErrorMessage(
        httpError(400, 'CLIENT-001', [{ field: 'occurredAtInRange' }]),
      ),
    ).toBe('발생 시각은 최근 30일 안이고 미래가 아니어야 합니다.');
  });

  it('CLIENT-001 이어도 예약 관련 field 가 아니면 일반 실패 문구를 돌려준다', () => {
    const message = inquiryErrorMessage(
      httpError(400, 'CLIENT-001', [{ field: 'content' }]),
    );

    expect(message).toBe(INQUIRY_FAILED_MESSAGE);
  });

  it('세션 만료로 확정된 오류는 스낵바를 생략한다', () => {
    const error = httpError(401, 'AUTH-013');
    error.sessionExpired = true;

    expect(inquiryErrorMessage(error)).toBeNull();
  });

  it('미매핑 코드·응답 없음·5xx 는 일반 실패 문구이고 서버 원문은 쓰지 않는다', () => {
    expect(inquiryErrorMessage(httpError(500, 'SERVER-001'))).toBe(
      INQUIRY_FAILED_MESSAGE,
    );
    expect(inquiryErrorMessage(new Error('Network Error'))).toBe(
      INQUIRY_FAILED_MESSAGE,
    );
  });

  it('매핑된 코드여도 서버 원문을 그대로 돌려주지 않는다', () => {
    expect(inquiryErrorMessage(httpError(404, 'INQUIRY-001'))).not.toContain(
      '서버 원문',
    );
    expect(inquiryErrorMessage(httpError(500, 'SERVER-001'))).not.toContain(
      '서버 원문',
    );
  });
});
