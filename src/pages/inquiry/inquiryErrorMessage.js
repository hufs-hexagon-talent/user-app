// 문의 접수·수정·삭제 실패를 학생용 문구로 바꾼다. 서버 원문(data.message)은 쓰지 않는다.
const INQUIRY_ERROR_MESSAGES = {
  'INQUIRY-001': '문의를 찾을 수 없습니다. 목록을 새로 고쳤습니다.',
  'INQUIRY-002':
    '선택한 예약을 찾을 수 없습니다. 본인 예약만 선택할 수 있습니다.',
  'INQUIRY-003': '처리 완료된 문의는 수정하거나 삭제할 수 없습니다.',
  'AUTH-002': '본인 문의만 수정하거나 삭제할 수 있습니다.',
  'CLIENT-008': '문의 접수가 너무 많습니다. 잠시 뒤 다시 시도해 주세요.',
};

export const INQUIRY_FAILED_MESSAGE =
  '문의 처리에 실패했습니다. 잠시 뒤 다시 시도해 주세요.';

// CLIENT-001 + errors[].field 로 오는 입력값 오류. @AssertTrue 는 is 를 뗀 파생 프로퍼티명으로 온다
// (reservationIdPresentForAttendance·occurredAtInRange — 서버에서 실측). 매핑이 없으면 기본 문구.
const FIELD_MESSAGES = {
  reservationId: '예약을 선택해 주세요.',
  reservationIdPresentForAttendance: '예약을 선택해 주세요.',
  roomId: '선택한 방을 찾을 수 없습니다. 목록을 새로 고쳐 주세요.',
  occurredAtInRange: '발생 시각은 최근 30일 안이고 미래가 아니어야 합니다.',
};

const fieldMessage = errors => {
  if (!Array.isArray(errors)) return null;
  const known = errors.find(item => FIELD_MESSAGES[item?.field]);
  return known ? FIELD_MESSAGES[known.field] : null;
};

// 인터셉터가 세션 만료로 확정한 오류는 SessionExpiryWatcher 가 안내하므로 null 을 돌려
// 스낵바를 생략하게 한다.
// 서버 코드 문자열에 앞뒤 공백이 섞여 오는 경우가 있어 정리해서 비교한다.
export const inquiryErrorMessage = error => {
  if (error?.sessionExpired) return null;

  const code = error?.response?.data?.code;
  const normalized = typeof code === 'string' ? code.trim() : null;

  if (normalized === 'CLIENT-001') {
    const message = fieldMessage(error?.response?.data?.errors);
    if (message) return message;
  }

  return INQUIRY_ERROR_MESSAGES[normalized] || INQUIRY_FAILED_MESSAGE;
};
