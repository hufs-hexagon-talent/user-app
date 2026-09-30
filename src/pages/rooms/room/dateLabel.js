import { format, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';

// 예약 확인 모달의 짧은 날짜 라벨. 오늘이면 뒤에 "(오늘)" 을 붙인다.
export const shortDateLabel = date => {
  const label = format(date, 'M월 d일');
  return isToday(date) ? `${label} (오늘)` : label;
};

// 익일 꼬리 칸의 접근 이름에 넣는 날짜. '10월 21일'
export const monthDayLabel = date => format(date, 'M월 d일');

// 요일을 붙인 날짜. 다른 날 표로 가는 링크가 쓴다. '10월 21일(수)'
export const weekdayDateLabel = date =>
  format(date, 'M월 d일(EEE)', { locale: ko });

// 예약표 꼬리 첫 머리글의 날짜 칩. '10.21(수)'
export const dateChipLabel = date => format(date, 'M.d(EEE)', { locale: ko });

// 확인 모달의 종료 캡션에 붙이는 날. '21일(수)'
export const dayOfMonthLabel = date => format(date, 'd일(EEE)', { locale: ko });
