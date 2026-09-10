import { summarizeUsage } from './usageSummary';

const reservation = (overrides = {}) => ({
  reservationId: 1,
  reservationState: 'VISITED',
  reservationStartTime: '2026-09-10T01:00:00Z',
  reservationEndTime: '2026-09-10T02:30:00Z',
  ...overrides,
});

test('전체 예약에서 출석만 합산하고 미출석·처리됨·미래 미출석은 제외한다', () => {
  const records = [
    reservation(),
    reservation({ reservationState: 'NOT_VISITED' }),
    reservation({ reservationState: 'PROCESSED' }),
    reservation({ reservationState: 'UNKNOWN' }),
    ...Array.from({ length: 6 }, (_, i) =>
      reservation({ reservationId: i + 2 }),
    ),
  ];
  const before = JSON.stringify(records);
  expect(summarizeUsage(records)).toEqual({ totalMinutes: 630, visitCount: 7 });
  expect(JSON.stringify(records)).toBe(before);
});

test('조기 출석과 이용 중에도 출석한 예약의 전체 시간을 포함한다', () => {
  expect(
    summarizeUsage([
      reservation({
        reservationStartTime: '2099-01-01T10:00:00+09:00',
        reservationEndTime: '2099-01-01T11:00:00+09:00',
      }),
      reservation(),
    ]),
  ).toEqual({ totalMinutes: 150, visitCount: 2 });
});

test('자정을 넘거나 UTC·KST 표기가 달라도 실제 시각 차이로 계산한다', () => {
  expect(
    summarizeUsage([
      reservation({
        reservationStartTime: '2026-09-09T23:30:00+09:00',
        reservationEndTime: '2026-09-09T16:00:00Z',
      }),
    ]),
  ).toEqual({ totalMinutes: 90, visitCount: 1 });
});

test('출석 기록 없음과 조회 전을 구분한다', () => {
  expect(summarizeUsage([])).toEqual({ totalMinutes: 0, visitCount: 0 });
  expect(
    summarizeUsage([reservation({ reservationState: 'NOT_VISITED' })]),
  ).toEqual({ totalMinutes: 0, visitCount: 0 });
  expect(summarizeUsage(undefined)).toBeNull();
  expect(summarizeUsage(null)).toBeNull();
});

test.each([
  { reservationStartTime: null },
  { reservationEndTime: 'invalid' },
  { reservationEndTime: '2026-09-10T00:00:00Z' },
  { reservationEndTime: '2026-09-10T01:00:00Z' },
])(
  '잘못된 출석 시각을 일부 집계나 0시간으로 표시하지 않는다: %j',
  overrides => {
    expect(summarizeUsage([reservation(), reservation(overrides)])).toBeNull();
  },
);
