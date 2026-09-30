import {
  addMinutes,
  areIntervalsOverlapping,
  differenceInMinutes,
  format,
} from 'date-fns';

import { SLOT_MINUTES } from './operationWindow';
import { isOutsideOperationHours } from './reservationSlot';

// 오늘이 아닌 날의 첫 화면. 00:00 부터 여는 날에 첫 칸부터 보이면 393px 에서 18칸(약 790px)을
// 밀어야 해서, 표가 이보다 일찍 시작하는 날에는 이 칸에서 시작한다.
export const FIRST_VISIBLE_MINUTE = 9 * 60; // 분, 09:00

// 칸 하나의 상태를 낸다. 시각 표현은 하지 않고 판정만 한다.
// slotMinute 은 칸 시작이 선택한 날 0시부터 몇 분인지다. 주지 않으면 slotStart 의 시각으로 본다.
export const getSlotState = ({
  slotStart,
  slotMinute,
  now,
  room,
  selection,
}) => {
  const slotEnd = addMinutes(slotStart, SLOT_MINUTES);

  // 칸 전체가 그 호실의 운영창 안일 때만 연다. 표의 공통 범위가 아니라 호실별로 본다.
  const closed = isOutsideOperationHours(
    slotMinute ?? slotStart.getHours() * 60 + slotStart.getMinutes(),
    room.operationStartTime,
    room.operationEndTime,
    room.endsAtMidnight,
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

// 표를 열었을 때 가로 스크롤이 향할 칸.
// 오늘이면 현재 칸의 한 칸 앞이다. 운영이 끝났으면 마지막 칸이다.
// 오늘이 아니면 표가 09:00 전부터 시작하는 날만 09:00 칸이고, 그 밖에는 처음이다.
// 칸의 절대 시각으로 비교하므로 자정에 끝나는 날에도 경계 문자열 때문에 끝으로 가지 않는다.
export const initialScrollIndex = ({ slots, now, selectedDate }) => {
  if (!slots?.length) return 0;

  if (selectedDate !== format(now, 'yyyy-MM-dd')) {
    if (slots[0].startMinute >= FIRST_VISIBLE_MINUTE) return 0;
    const index = slots.findIndex(
      slot => slot.startMinute >= FIRST_VISIBLE_MINUTE,
    );
    return index < 0 ? 0 : index;
  }

  let current = -1;
  slots.forEach((slot, index) => {
    if (slot.startAt <= now) current = index;
  });
  if (current < 0) return 0;
  // 마지막 칸까지 지났으면 표 끝 경계를 현재로 본다. 그 한 칸 앞이 마지막 칸이다.
  if (slots[slots.length - 1].endAt <= now) current = slots.length;
  return Math.min(Math.max(0, current - 1), slots.length - 1);
};
