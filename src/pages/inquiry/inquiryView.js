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

// 행에 찍는 시각과 정렬 키는 같은 값이어야 목록이 뒤죽박죽으로 보이지 않는다. 답변 완료 구획은
// 답변 시각으로 정렬하는데 행에는 접수 시각만 찍혀 있어, 8/1 접수 건에 오늘 답이 오면 맨 위에
// 오면서 날짜는 8/1 로 보였다. 라벨 없이 찍으면 접수일을 답변일로 읽는다(admin-app 의 rowDate 와
// 같은 규칙. 라벨이 '처리' 가 아니라 '답변' 인 것은 학생이 기다리는 게 답변이기 때문이다).
export const rowDate = inquiry =>
  inquiry.status === 'RESOLVED' && inquiry.resolvedAt
    ? { label: '답변', at: inquiry.resolvedAt }
    : { label: '접수', at: inquiry.createAt };

// 답변 완료는 답변한 순서로 — 새 답변이 맨 위. 서버는 접수일 내림차순만 준다.
const answeredAt = inquiry => new Date(rowDate(inquiry).at);

// stale 배너의 다시 시도 버튼 상태. 눌러도 화면이 안 바뀌면 고장으로 보고 연타하는데, 연타는
// 진행 중인 재시도 체인을 취소하고 처음부터 다시 돌려(최악 67초) 체감을 더 나쁘게 한다. 진행 중에는
// 잠그고 라벨로 알린다. 오프라인이면 요청이 나가지도 않으므로(react-query paused) 그것도 알린다.
// 배너 문구 자체는 바꾸지 않는다 — role="status" 영역이라 바꿀 때마다 다시 읽힌다.
export const retryState = ({ isFetching = false, isPaused = false } = {}) => {
  if (isPaused) return { label: '연결을 기다리는 중', disabled: true };
  if (isFetching) return { label: '다시 불러오는 중', disabled: true };
  return { label: '다시 시도', disabled: false };
};

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
