import { addMinutes, isValid, parse } from 'date-fns';

// 예약표의 운영창을 분 단위 숫자로 다룬다. 칸 목록과 호실별 잠금이 이 한 곳의 규칙을 쓴다.
//
// 분은 선택한 날짜 D 의 0시부터 센다. 24:00 은 1440 이다. 서버는 24:00 을 TIME 값으로 적지
// 못해서(24:00:00 은 읽기 실패) 자정까지 여는 정책을 endsAtMidnight=true 와 저장 종료 23:30:00
// 으로 준다. 그래서 종료분은 endsAtMidnight 가 true 일 때만 1440 이고, 아니면 operationEndTime 을
// 30분 격자 아래로 내린 값이다. 플래그 없는 23:59:59(옛 정책 7)는 1410(23:30)이 된다.
// 필드가 없는 옛 서버 응답은 false 로 본다.
//
// 칸 시각은 'D 00:00 + 분' 으로 만든 Date 다. 'HH:mm' 문자열을 D 와 붙여 다시 읽지 않는다.
// 그렇게 읽으면 24:00 이나 다음 날로 넘어가는 칸이 D 의 시각이 된다.

export const SLOT_MINUTES = 30; // 분, 예약 칸 하나
export const MINUTES_PER_DAY = 1440; // 분

const HM_PATTERN = /^(\d{2}):(\d{2})$/;

const pad = value => String(value).padStart(2, '0');

// 서버는 운영시간을 "HH:mm:ss" 로 준다(초가 0 이면 "HH:mm"). 표는 분 단위라 초를 떼어 낸다.
export const normalizeOperationTime = time => {
  if (typeof time !== 'string') return null;
  return time.slice(0, 5);
};

// "HH:mm"·"HH:mm:ss" 를 그날 0시부터의 분으로 바꾼다. 숫자는 이미 분이라 그대로 둔다.
// 읽을 수 없으면 null.
export const toMinutes = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const matched = HM_PATTERN.exec(normalizeOperationTime(value) ?? '');
  if (!matched) return null;
  const hour = Number(matched[1]);
  const minute = Number(matched[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
};

const floorToSlot = minutes => minutes - (minutes % SLOT_MINUTES);

// 호실(파티션) 한 행의 운영창 { startMinute, endMinute }. 운영시간을 읽을 수 없으면 null.
export const roomOperationWindow = room => {
  const startMinute = toMinutes(room?.operationStartTime);
  if (startMinute === null) return null;
  if (room.endsAtMidnight === true) {
    return { startMinute, endMinute: MINUTES_PER_DAY };
  }
  const end = toMinutes(room.operationEndTime);
  if (end === null) return null;
  return { startMinute, endMinute: floorToSlot(end) };
};

// 칸 전체가 운영창 안에 있을 때만 연다. 칸 시작이 창 시작보다 이르거나 칸 끝이 창 끝을 넘으면 닫는다.
export const isSlotInsideWindow = (slotStartMinute, range) =>
  slotStartMinute >= range.startMinute &&
  slotStartMinute + SLOT_MINUTES <= range.endMinute;

// 표 전체의 범위. 가장 이른 시작(30분 격자로 내림)부터 가장 늦은 종료까지다.
// 호실마다 다른 부분은 칸 잠금이 가린다.
export const tableOperationWindow = rooms => {
  const ranges = (Array.isArray(rooms) ? rooms : [])
    .map(roomOperationWindow)
    .filter(Boolean);
  if (ranges.length === 0) return null;
  const startMinute = floorToSlot(
    Math.min(...ranges.map(range => range.startMinute)),
  );
  const endMinute = Math.max(...ranges.map(range => range.endMinute));
  return endMinute > startMinute ? { startMinute, endMinute } : null;
};

// [startMinute, endMinute] 사이의 칸 경계(분). 마지막 경계는 칸이 아니라 앞 칸의 오른쪽 끝이다.
// 끝이 간격에 맞지 않으면 그 아래 경계까지만 만든다.
export const slotBoundaries = (
  startMinute,
  endMinute,
  intervalMinute = SLOT_MINUTES,
) => {
  const boundaries = [];
  for (
    let minute = startMinute;
    minute <= endMinute;
    minute += intervalMinute
  ) {
    boundaries.push(minute);
  }
  return boundaries;
};

// 칸 시작 라벨. 다음 날로 넘어간 분도 그 날의 시각으로 적는다(1470 → '00:30').
export const minuteLabel = minute => {
  const inDay = minute % MINUTES_PER_DAY;
  return `${pad(Math.floor(inDay / 60))}:${pad(inDay % 60)}`;
};

// 칸 끝 라벨. 정확히 자정에 끝나는 칸은 '24:00' 이다.
export const endMinuteLabel = minute =>
  minute === MINUTES_PER_DAY ? '24:00' : minuteLabel(minute);

// 선택한 날짜('yyyy-MM-dd')의 0시. 화면의 다른 날짜처럼 기기 시간대(학생 기기는 KST)로 읽는다.
export const dayStartOf = date => {
  if (typeof date !== 'string') return null;
  const day = parse(date, 'yyyy-MM-dd', new Date());
  return isValid(day) ? day : null;
};

// 칸 시각. D 0시에 분을 더한다. 1440 이면 D+1 00:00 이다.
export const slotDate = (dayStart, minute) => addMinutes(dayStart, minute);

// 응답의 호실들로 표의 칸 목록을 만든다. 칸마다 분과 절대 시각을 함께 갖고 있어서
// 표·선택·전송이 문자열을 다시 읽지 않는다.
export const buildSlots = (rooms, date) => {
  const range = tableOperationWindow(rooms);
  const dayStart = dayStartOf(date);
  if (!range || !dayStart) return [];

  const boundaries = slotBoundaries(range.startMinute, range.endMinute);
  return boundaries.slice(0, -1).map((startMinute, index) => {
    const endMinute = boundaries[index + 1];
    return {
      index,
      startMinute,
      endMinute,
      startAt: slotDate(dayStart, startMinute),
      endAt: slotDate(dayStart, endMinute),
      label: minuteLabel(startMinute),
      endLabel: endMinuteLabel(endMinute),
    };
  });
};
