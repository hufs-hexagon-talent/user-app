import {
  addMinutes,
  areIntervalsOverlapping,
  differenceInMinutes,
  format,
} from 'date-fns';

import { isOutsideOperationHours } from './reservationSlot';

export const SLOT_INTERVAL_MINUTE = 30;

// 칸 하나의 상태를 낸다. 시각 표현은 하지 않고 판정만 한다.
export const getSlotState = ({ slotStart, now, room, selection }) => {
  const slotEnd = addMinutes(slotStart, SLOT_INTERVAL_MINUTE);

  const closed = isOutsideOperationHours(
    format(slotStart, 'HH:mm'),
    room.operationStartTime,
    room.operationEndTime,
  );
  const past = now > slotEnd;
  // 이 칸을 덮는 예약들. 한 칸을 덮는 예약이 여럿일 수 있어 목록으로 둔다.
  const covering = (room.reservationTimeRanges ?? []).filter(reservation => {
    const start = new Date(reservation.startDateTime);
    const end = new Date(reservation.endDateTime);
    return slotStart >= start && slotStart < end;
  });
  // isMine 이 없거나 false 면 reserved 로 본다(옛 서버 응답 호환).
  const mine = covering.some(reservation => reservation.isMine === true);
  const reserved = covering.length > 0;

  const hasSelection = !!(
    selection?.partitionId &&
    selection.from &&
    selection.to
  );
  const sameRoom = hasSelection && selection.partitionId === room.partitionId;
  const selected =
    sameRoom &&
    areIntervalsOverlapping(
      { start: selection.from, end: selection.to },
      { start: slotStart, end: slotEnd },
    );

  // 지난 칸은 선택 표시보다 잠금 표시가 우선이다.
  // 내 예약이 지난 시간이어도 mine 이 우선이다. 내 것이라는 사실이 먼저 보여야 한다.
  const status = mine
    ? 'mine'
    : reserved
      ? 'reserved'
      : past
        ? 'past'
        : selected
          ? 'selected'
          : closed
            ? 'closed'
            : 'free';

  // 연장 가능한 범위: 같은 호실이면서 선택 시작부터 최대 예약 시간 안
  const withinExtend =
    sameRoom &&
    differenceInMinutes(slotEnd, selection.from) > 0 &&
    differenceInMinutes(slotEnd, selection.from) <= room.eachMaxMinute;

  return {
    status,
    selectable: !past && !reserved && !closed,
    outOfExtendRange: hasSelection && !withinExtend,
  };
};

// 표를 열었을 때 가로 스크롤이 향할 열. 오늘이면 현재 시각 한 칸 앞, 아니면 처음.
export const initialScrollIndex = ({ times, now, selectedDate }) => {
  if (!times?.length) return 0;
  if (selectedDate !== format(now, 'yyyy-MM-dd')) return 0;

  const nowHm = format(now, 'HH:mm');
  let current = -1;
  for (let i = 0; i < times.length; i += 1) {
    if (times[i] <= nowHm) current = i;
  }
  if (current < 0) return 0;
  return Math.min(Math.max(0, current - 1), Math.max(0, times.length - 2));
};
