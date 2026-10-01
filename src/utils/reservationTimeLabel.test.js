import {
  clockLabel,
  endTimeLabel,
  endTimeParts,
  operationEndTimeLabel,
  timeRangeLabel,
} from './reservationTimeLabel';

// 서버는 절대 시각을 준다. 픽스처는 KST 로 적는다. 표기는 기기 시간대를 따르고,
// 테스트는 jest.globalSetup 이 TZ 를 Asia/Seoul 로 맞춘다.
const at = value => new Date(`${value}+09:00`);

describe('endTimeLabel', () => {
  it('같은 날에 끝나면 HH:mm 이다', () => {
    expect(
      endTimeLabel(at('2026-10-20T10:00:00'), at('2026-10-20T11:30:00')),
    ).toBe('11:30');
  });

  it('정확히 다음 날 00:00 에 끝나면 24:00 이다', () => {
    expect(
      endTimeLabel(at('2026-10-20T23:30:00'), at('2026-10-21T00:00:00')),
    ).toBe('24:00');
  });

  // 시작일은 화면이 시각 옆에 따로 보인다. '익일' 같은 말을 붙이지 않는다.
  it('다음 날 00:00 보다 뒤에 끝나면 그 시각 HH:mm 만 적는다', () => {
    const label = endTimeLabel(
      at('2026-10-20T23:00:00'),
      at('2026-10-21T01:00:00'),
    );
    expect(label).toBe('01:00');
    expect(label).not.toMatch(/익일|전날/);
  });

  it('서버 문자열(UTC)도 그대로 받는다', () => {
    expect(endTimeLabel('2026-10-20T14:30:00Z', '2026-10-20T15:00:00Z')).toBe(
      '24:00',
    );
  });
});

describe('endTimeParts', () => {
  it('자정을 넘으면 nextDay 와 그 시각을 준다', () => {
    expect(
      endTimeParts(at('2026-10-20T23:00:00'), at('2026-10-21T01:00:00')),
    ).toEqual({ nextDay: true, time: '01:00' });
  });

  it('24:00 과 같은 날은 자정을 넘지 않는다', () => {
    expect(
      endTimeParts(at('2026-10-20T23:30:00'), at('2026-10-21T00:00:00')),
    ).toEqual({ nextDay: false, time: '24:00' });
    expect(
      endTimeParts(at('2026-10-20T10:00:00'), at('2026-10-20T11:00:00')),
    ).toEqual({ nextDay: false, time: '11:00' });
  });
});

describe('timeRangeLabel / clockLabel', () => {
  it('시작 HH:mm 과 공용 종료 표기를 ~ 로 잇는다', () => {
    expect(clockLabel(at('2026-10-20T09:30:00'))).toBe('09:30');
    expect(
      timeRangeLabel(at('2026-10-20T10:00:00'), at('2026-10-20T11:00:00')),
    ).toBe('10:00~11:00');
    expect(
      timeRangeLabel(at('2026-10-20T23:30:00'), at('2026-10-21T00:00:00')),
    ).toBe('23:30~24:00');
    expect(
      timeRangeLabel(at('2026-10-20T23:00:00'), at('2026-10-21T01:00:00')),
    ).toBe('23:00~01:00');
    expect(
      timeRangeLabel(at('2026-09-30T23:30:00'), at('2026-10-01T01:30:00')),
    ).toBe('23:30~01:30');
  });
});

describe('operationEndTimeLabel', () => {
  it('자정 정책이면 24:00, 아니면 서버 값 그대로다', () => {
    expect(
      operationEndTimeLabel({
        operationEndTime: '23:30:00',
        endsAtMidnight: true,
      }),
    ).toBe('24:00');
    expect(
      operationEndTimeLabel({
        operationEndTime: '23:30:00',
        endsAtMidnight: false,
      }),
    ).toBe('23:30:00');
    // 필드가 없는 옛 서버 응답
    expect(operationEndTimeLabel({ operationEndTime: '23:59:59' })).toBe(
      '23:59:59',
    );
  });
});
