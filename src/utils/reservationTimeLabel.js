import { addDays, format, isSameDay, startOfDay } from 'date-fns';

// 예약 시각의 공용 표기. 하단 바·확인 모달·/check·마이페이지·문의 예약 선택과 스냅샷 파서가 쓰고,
// 서버가 문의에 남기는 예약 스냅샷(ReservationTimeLabel)과 같은 규칙이다.
// - 종료가 시작과 같은 날이면 'HH:mm'
// - 정확히 다음 날 00:00 이면 '24:00'
// - 그보다 뒤면 그 시각 'HH:mm'('23:30~01:30'). '익일' 같은 말을 붙이지 않는다.
// 이 표기를 쓰는 화면은 시작일을 시각 옆에 함께 보인다. 날짜 없이 하루만 보이는 목록이
// 전날 시작한 예약을 담으면 그 행의 시작 시각 앞에 시작일을 붙인다(옛 관리자 예약 현황).
// 끝을 '00:00' 으로 적지 않는다. 날짜 없는 00:00 은 그날 새벽으로 읽힌다.
// 날짜는 화면의 다른 표기처럼 기기 시간대로 읽는다(학생 기기는 KST).

export const MIDNIGHT_LABEL = '24:00';

export const clockLabel = value => format(new Date(value), 'HH:mm');

// 종료 표기와 자정을 넘는지(nextDay)를 함께 준다. 24:00 에 끝나면 넘지 않는 것으로 본다.
// 확인 모달이 nextDay 로 끝나는 날을 따로 적는다.
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

export const endTimeLabel = (start, end) => endTimeParts(start, end).time;

// '23:00~01:00', '23:30~24:00', '10:00~11:00'
export const timeRangeLabel = (start, end) =>
  `${clockLabel(start)}~${endTimeLabel(start, end)}`;

// 정책·일정 목록의 종료 시각. 자정 정책이면 '24:00', 아니면 서버 값 그대로 적는다.
// 자정 정책의 저장 종료(23:30:00)는 옛 화면용 대체값이라 그대로 보이면 23:30 에 닫는 것으로 읽힌다.
export const operationEndTimeLabel = item =>
  item?.endsAtMidnight === true ? MIDNIGHT_LABEL : item?.operationEndTime;
