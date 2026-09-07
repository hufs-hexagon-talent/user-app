import { format } from 'date-fns';

import { linkedReservationLabel } from './reservationView';

// 내 문의 목록·상세의 표시 규칙. 컴포넌트는 그리기만 한다.

// 캐시를 쥔 채 재조회만 실패했을 때의 문구. 목록과 상세가 같은 말을 해야 한다.
export const STALE_MESSAGE = '최신 상태를 못 받아왔습니다.';

// 방은 삭제될 수 있고(FK SET NULL) 이름 스냅샷만 남는다 — 예약의 "취소된 예약" 과 같은 규칙.
export const DELETED_ROOM_SUFFIX = '(삭제된 방)';

const reservationMeta = inquiry => {
  const label = linkedReservationLabel(inquiry);
  return label ? `예약 ${label}` : null;
};

const facilityMeta = inquiry => {
  const parts = [];
  if (inquiry.roomName) {
    parts.push(
      inquiry.roomId == null
        ? `${inquiry.roomName}${DELETED_ROOM_SUFFIX}`
        : inquiry.roomName,
    );
  }
  if (inquiry.occurredAt) {
    parts.push(
      `발생 ${format(new Date(inquiry.occurredAt), 'yyyy-MM-dd HH:mm')}`,
    );
  }
  return parts.length > 0 ? parts.join(' · ') : null;
};

// 카드의 메타 한 줄. 시설 문의는 방·발생 시각, 그 외는 연결 예약. 시설 문의에 방·시각이
// 없으면(서버 필드가 생기기 전에 접수된 문의, 구 폼) 연결 예약으로 대신한다. 없으면 null — 줄을 생략한다.
export const metaLabel = inquiry => {
  if (!inquiry) return null;
  if (inquiry.category === 'FACILITY') {
    return facilityMeta(inquiry) ?? reservationMeta(inquiry);
  }
  return reservationMeta(inquiry);
};

// 답변 완료는 답변한 순서로 — 새 답변이 맨 위. 서버는 접수일 내림차순만 준다.
const answeredAt = inquiry => new Date(inquiry.resolvedAt ?? inquiry.createAt);

export const sortResolvedLatestFirst = list =>
  [...list].sort((a, b) => answeredAt(b) - answeredAt(a));

// 관리자 답변은 status 가 아니라 adminMemo 의 존재로 판정한다. 관리자가 재오픈하면 status 는
// OPEN 으로 돌아오지만 답변은 남는다 — status 로 판정하면 학생이 받은 답변을 화면에서 잃는다.
export const hasAnswer = inquiry => Boolean(inquiry?.adminMemo);

// 답변 박스 제목. 재오픈 답변에는 시각을 붙이지 않는다 — 답변 시각을 담는 필드가 resolvedAt
// 하나뿐인데 재오픈하면 그 값이 이번 답변의 것이라는 보장이 없다(updateAt 은 마지막 수정 시각).
export const answerTitle = inquiry => {
  if (inquiry?.status !== 'RESOLVED') return '이전 답변';
  return inquiry.resolvedAt
    ? `관리자 답변 · ${format(new Date(inquiry.resolvedAt), 'yyyy-MM-dd HH:mm')}`
    : '관리자 답변';
};
