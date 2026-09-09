import { format, isToday } from 'date-fns';

// 예약 확인 모달의 짧은 날짜 라벨. 오늘이면 뒤에 "(오늘)" 을 붙인다.
export const shortDateLabel = date => {
  const label = format(date, 'M월 d일');
  return isToday(date) ? `${label} (오늘)` : label;
};
