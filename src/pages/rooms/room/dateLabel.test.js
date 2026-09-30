import { format } from 'date-fns';
import {
  dateChipLabel,
  dayOfMonthLabel,
  monthDayLabel,
  shortDateLabel,
  weekdayDateLabel,
} from './dateLabel';

describe('shortDateLabel', () => {
  it('오늘이면 뒤에 (오늘) 을 붙인다', () => {
    expect(shortDateLabel(new Date())).toBe(`${formatToday()} (오늘)`);
  });

  it('오늘이 아니면 아무것도 붙이지 않는다', () => {
    expect(shortDateLabel(new Date('2020-01-15T10:00:00'))).toBe('1월 15일');
  });

  it('한 자리 월·일도 앞에 0을 붙이지 않는다', () => {
    // 실제로 돌아가는 날과 절대 겹치지 않도록 10년 뒤로 고정한다
    const future = new Date();
    future.setFullYear(future.getFullYear() + 10, 2, 7);
    future.setHours(10, 0, 0, 0);
    expect(shortDateLabel(future)).toBe('3월 7일');
  });

  // 프로덕션에서 selectedDate 는 useUrlQuery 가 돌려주는 'yyyy-MM-dd' 문자열이다.
  // Date 객체만 넣어 본 위 시험들은 이 타입을 검증하지 못한다.
  it("문자열('yyyy-MM-dd')을 넣어도 9월 4일로 시작한다", () => {
    expect(shortDateLabel('2026-09-04').startsWith('9월 4일')).toBe(true);
  });

  it('오늘 날짜 문자열을 넣으면 (오늘) 이 붙는다', () => {
    const todayString = format(new Date(), 'yyyy-MM-dd');
    expect(shortDateLabel(todayString)).toBe(`${formatToday()} (오늘)`);
  });
});

describe('익일 꼬리와 다른 날 표에 쓰는 날짜', () => {
  const day = new Date('2026-10-21T00:30:00');

  it('접근 이름은 월·일만 적는다', () => {
    expect(monthDayLabel(day)).toBe('10월 21일');
  });

  it('다른 날 표 링크는 요일을 붙인다', () => {
    expect(weekdayDateLabel(day)).toBe('10월 21일(수)');
  });

  it('머리글 날짜 칩은 점으로 줄여 적는다', () => {
    expect(dateChipLabel(day)).toBe('10.21(수)');
    expect(dateChipLabel(new Date('2027-01-05T00:00:00'))).toBe('1.5(화)');
  });

  it('확인 모달의 종료 캡션은 일과 요일이다', () => {
    expect(dayOfMonthLabel(day)).toBe('21일(수)');
  });
});

// 테스트를 실제로 언제 돌리든 오늘 날짜의 기대값을 스스로 계산한다
function formatToday() {
  const now = new Date();
  return `${now.getMonth() + 1}월 ${now.getDate()}일`;
}
