import { format } from 'date-fns';

import { linkedReservationLabel } from './reservationView';

// 내 문의 목록 카드의 표시 규칙. 컴포넌트는 그리기만 한다.

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
