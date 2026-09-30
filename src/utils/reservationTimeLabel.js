import { addDays, format, isSameDay, startOfDay } from 'date-fns';

// 예약 시각의 공용 표기. 하단 바·확인 모달·/check·마이페이지·문의 예약 선택과 스냅샷 파서가 쓰고,
// 서버가 문의에 남기는 예약 스냅샷(ReservationTimeLabel)과 같은 규칙이다.
// - 종료가 시작과 같은 날이면 'HH:mm'
// - 정확히 다음 날 00:00 이면 '24:00'
// - 그보다 뒤면 '익일 HH:mm'
// 끝을 '00:00' 으로 적지 않는다. 날짜 없는 00:00 은 그날 새벽으로 읽힌다.
// 날짜는 화면의 다른 표기처럼 기기 시간대로 읽는다(학생 기기는 KST).

export const MIDNIGHT_LABEL = '24:00';
export const NEXT_DAY_LABEL = '익일';

export const clockLabel = value => format(new Date(value), 'HH:mm');

// 종료 표기를 두 조각으로 준다. /check 처럼 '익일' 을 시각 위 작은 글씨로 적는 화면이 쓴다.
export const endTimeParts = (start, end) => {
  const startAt = new Date(start);
  const endAt = new Date(end);
  if (isSameDay(startAt, endAt)) {
    return { nextDay: false, time: clockLabel(endAt) };
  }
  if (endAt.getTime() === startOfDay(addDays(startAt, 1)).getTime()) {
    return { nextDay: false, time: MIDNIGHT_LABEL };
  }
  return { nextDay: true, time: clockLabel(endAt) };
};

export const endTimeLabel = (start, end) => {
  const { nextDay, time } = endTimeParts(start, end);
  return nextDay ? `${NEXT_DAY_LABEL} ${time}` : time;
};

// '23:00~익일 01:00', '23:30~24:00', '10:00~11:00'
export const timeRangeLabel = (start, end) =>
  `${clockLabel(start)}~${endTimeLabel(start, end)}`;

// 정책·일정 목록의 종료 시각. 자정 정책이면 '24:00', 아니면 서버 값 그대로 적는다.
// 자정 정책의 저장 종료(23:30:00)는 옛 화면용 대체값이라 그대로 보이면 23:30 에 닫는 것으로 읽힌다.
export const operationEndTimeLabel = item =>
  item?.endsAtMidnight === true ? MIDNIGHT_LABEL : item?.operationEndTime;
