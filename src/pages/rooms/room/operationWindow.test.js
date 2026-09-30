import {
  buildSlots,
  dayStartOf,
  endMinuteLabel,
  isSlotClosedForRoom,
  isSlotInsideWindow,
  minuteLabel,
  MINUTES_PER_DAY,
  overnightUntilMinute,
  roomOpenWindow,
  roomOperationWindow,
  tableOperationWindow,
  toMinutes,
} from './operationWindow';

const room = (over = {}) => ({
  partitionId: 1,
  roomName: '306',
  partitionNumber: 1,
  operationStartTime: '09:00:00',
  operationEndTime: '22:00:00',
  eachMaxMinute: 120,
  reservationTimeRanges: [],
  ...over,
});

// 새 서버가 자정 정책에 주는 값: 저장 종료 23:30:00 과 플래그
const midnightRoom = (over = {}) =>
  room({
    operationStartTime: '00:00:00',
    operationEndTime: '23:30:00',
    endsAtMidnight: true,
    ...over,
  });

describe('toMinutes', () => {
  it('HH:mm·HH:mm:ss 를 그날 0시부터의 분으로 바꾼다', () => {
    expect(toMinutes('09:00:00')).toBe(540);
    expect(toMinutes('23:30')).toBe(1410);
    expect(toMinutes('23:59:59')).toBe(1439);
    expect(toMinutes(90)).toBe(90);
  });

  it('읽을 수 없으면 null', () => {
    expect(toMinutes(undefined)).toBeNull();
    expect(toMinutes('24:00:00')).toBeNull();
    expect(toMinutes('9시')).toBeNull();
  });
});

describe('roomOperationWindow', () => {
  it('endsAtMidnight 가 true 면 종료분은 1440 이다', () => {
    expect(roomOperationWindow(midnightRoom())).toEqual({
      startMinute: 0,
      endMinute: MINUTES_PER_DAY,
    });
  });

  it('플래그 없는 23:59:59(옛 정책 7)는 1410(23:30)이다', () => {
    expect(roomOperationWindow(room({ operationEndTime: '23:59:59' }))).toEqual(
      { startMinute: 540, endMinute: 1410 },
    );
  });

  it('필드가 없는 옛 응답과 false 는 종료 시각을 30분 격자로 내린 값이다', () => {
    expect(roomOperationWindow(room())).toEqual({
      startMinute: 540,
      endMinute: 1320,
    });
    expect(
      roomOperationWindow(midnightRoom({ endsAtMidnight: false })),
    ).toEqual({ startMinute: 0, endMinute: 1410 });
    expect(roomOperationWindow(room({ operationEndTime: '22:15:00' }))).toEqual(
      { startMinute: 540, endMinute: 1320 },
    );
  });

  it('운영시간을 읽을 수 없으면 null', () => {
    expect(roomOperationWindow(room({ operationStartTime: null }))).toBeNull();
    expect(
      roomOperationWindow(room({ operationEndTime: undefined })),
    ).toBeNull();
  });
});

describe('isSlotInsideWindow', () => {
  const range = { startMinute: 540, endMinute: 1320 };

  it('칸 전체가 창 안일 때만 참이다', () => {
    expect(isSlotInsideWindow(540, range)).toBe(true);
    expect(isSlotInsideWindow(1290, range)).toBe(true);
    expect(isSlotInsideWindow(510, range)).toBe(false);
    expect(isSlotInsideWindow(1320, range)).toBe(false);
  });

  it('자정 정책의 23:30 칸은 창 안이다', () => {
    expect(
      isSlotInsideWindow(1410, { startMinute: 0, endMinute: MINUTES_PER_DAY }),
    ).toBe(true);
  });
});

describe('tableOperationWindow', () => {
  it('00:00 에 여는 자정 호실과 09:00~22:00 호실이 섞이면 00:00~24:00 이다', () => {
    expect(tableOperationWindow([midnightRoom(), room()])).toEqual({
      startMinute: 0,
      endMinute: MINUTES_PER_DAY,
    });
  });

  it('시작이 격자에 맞지 않으면 그 아래 격자부터 그린다', () => {
    expect(
      tableOperationWindow([room({ operationStartTime: '09:15:00' })]),
    ).toEqual({ startMinute: 540, endMinute: 1320 });
  });

  it('읽을 수 있는 호실이 없으면 null', () => {
    expect(tableOperationWindow([])).toBeNull();
    expect(tableOperationWindow(undefined)).toBeNull();
    expect(
      tableOperationWindow([room({ operationStartTime: undefined })]),
    ).toBeNull();
  });
});

describe('minuteLabel / endMinuteLabel', () => {
  it('칸 시작은 그 날의 시각으로, 자정에 끝나는 칸 끝은 24:00 으로 적는다', () => {
    expect(minuteLabel(0)).toBe('00:00');
    expect(minuteLabel(1410)).toBe('23:30');
    expect(endMinuteLabel(1410)).toBe('23:30');
    expect(endMinuteLabel(MINUTES_PER_DAY)).toBe('24:00');
  });
});

describe('buildSlots', () => {
  it('자정 정책이면 48칸이고 마지막 칸은 23:30~24:00, 끝은 다음 날 00:00 이다', () => {
    const slots = buildSlots([midnightRoom()], '2026-10-20');

    expect(slots).toHaveLength(48);
    expect(slots[0]).toMatchObject({
      index: 0,
      startMinute: 0,
      endMinute: 30,
      label: '00:00',
      endLabel: '00:30',
    });
    const last = slots[47];
    expect(last).toMatchObject({
      index: 47,
      startMinute: 1410,
      endMinute: MINUTES_PER_DAY,
      label: '23:30',
      endLabel: '24:00',
    });
    // KST 10-21 00:00 은 UTC 10-20 15:00 이다
    expect(last.startAt.toISOString()).toBe('2026-10-20T14:30:00.000Z');
    expect(last.endAt.toISOString()).toBe('2026-10-20T15:00:00.000Z');
  });

  it('필드가 없는 옛 응답의 00:00~23:30 은 47칸이다', () => {
    const slots = buildSlots(
      [midnightRoom({ endsAtMidnight: undefined })],
      '2026-10-20',
    );

    expect(slots).toHaveLength(47);
    expect(slots[46].label).toBe('23:00');
    expect(slots[46].endLabel).toBe('23:30');
  });

  it('평상 날 09:00~22:00 은 26칸이고 칸 시각은 그날이다', () => {
    const slots = buildSlots([room()], '2026-10-20');

    expect(slots).toHaveLength(26);
    expect(slots[0].startAt.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    expect(slots[25].label).toBe('21:30');
    expect(slots[25].endAt.toISOString()).toBe('2026-10-20T13:00:00.000Z');
  });

  it('호실이 섞인 날은 가장 이른 시작부터 가장 늦은 끝까지 그린다', () => {
    const slots = buildSlots(
      [room({ operationEndTime: '18:00:00' }), midnightRoom()],
      '2026-10-20',
    );

    expect(slots).toHaveLength(48);
  });

  it('날짜나 운영시간을 읽을 수 없으면 빈 목록이다', () => {
    expect(buildSlots([room()], '2026-13-40')).toEqual([]);
    expect(buildSlots([room()], undefined)).toEqual([]);
    expect(buildSlots([], '2026-10-20')).toEqual([]);
  });
});

// 공개 예약표 응답의 overnightUntil(A2): 자정 정책 호실의 다음 날이 00:00 에 열리면 서버가 준다.
// 10-20 표에서 '2026-10-20T16:30:00Z' 는 10-21 01:30 KST 이고, D 0시부터 1530분이다.
describe('익일 꼬리(overnightUntil)', () => {
  const D = '2026-10-20';
  const dayStart = dayStartOf(D);
  const tailRoom = (over = {}) =>
    midnightRoom({ overnightUntil: '2026-10-20T16:30:00Z', ...over });

  describe('overnightUntilMinute', () => {
    it('ISO 시각을 D 0시부터의 분으로 바꾼다', () => {
      expect(overnightUntilMinute(tailRoom(), dayStart)).toBe(1530);
      expect(
        overnightUntilMinute(
          tailRoom({ overnightUntil: '2026-10-20T17:30:00Z' }),
          dayStart,
        ),
      ).toBe(1590);
    });

    it('값이 없거나 null 이거나 D+1 00:00 보다 늦지 않으면 null 이다', () => {
      expect(overnightUntilMinute(midnightRoom(), dayStart)).toBeNull();
      expect(
        overnightUntilMinute(tailRoom({ overnightUntil: null }), dayStart),
      ).toBeNull();
      expect(
        overnightUntilMinute(
          tailRoom({ overnightUntil: '2026-10-20T15:00:00Z' }),
          dayStart,
        ),
      ).toBeNull();
      expect(
        overnightUntilMinute(tailRoom({ overnightUntil: '내일' }), dayStart),
      ).toBeNull();
    });

    it('자정 플래그가 없는 호실의 값은 보지 않는다', () => {
      expect(
        overnightUntilMinute(
          room({ overnightUntil: '2026-10-20T16:30:00Z' }),
          dayStart,
        ),
      ).toBeNull();
      expect(
        overnightUntilMinute(tailRoom({ endsAtMidnight: false }), dayStart),
      ).toBeNull();
    });

    it('날짜를 모르면 null 이다', () => {
      expect(overnightUntilMinute(tailRoom(), null)).toBeNull();
    });

    it('30분 격자 아래로 내리고 D+2 00:00 을 넘기지 않는다', () => {
      expect(
        overnightUntilMinute(
          tailRoom({ overnightUntil: '2026-10-20T16:45:00Z' }),
          dayStart,
        ),
      ).toBe(1530);
      expect(
        overnightUntilMinute(
          tailRoom({ overnightUntil: '2026-10-22T03:00:00Z' }),
          dayStart,
        ),
      ).toBe(2 * MINUTES_PER_DAY);
    });
  });

  describe('roomOpenWindow / isSlotClosedForRoom', () => {
    it('꼬리가 있으면 창 끝이 overnightUntil 이다', () => {
      expect(roomOpenWindow(tailRoom(), dayStart)).toEqual({
        startMinute: 0,
        endMinute: 1530,
      });
      expect(roomOpenWindow(midnightRoom(), dayStart)).toEqual({
        startMinute: 0,
        endMinute: MINUTES_PER_DAY,
      });
    });

    it('꼬리 칸은 overnightUntil 안에서만 연다', () => {
      expect(isSlotClosedForRoom(tailRoom(), 1440, dayStart)).toBe(false);
      expect(isSlotClosedForRoom(tailRoom(), 1500, dayStart)).toBe(false);
      expect(isSlotClosedForRoom(tailRoom(), 1530, dayStart)).toBe(true);
    });

    it('overnightUntil 이 null 인 호실은 꼬리 칸을 잠근다', () => {
      expect(isSlotClosedForRoom(midnightRoom(), 1440, dayStart)).toBe(true);
      expect(isSlotClosedForRoom(room(), 1440, dayStart)).toBe(true);
      expect(isSlotClosedForRoom(midnightRoom(), 1410, dayStart)).toBe(false);
    });

    it('운영창을 읽을 수 없거나 칸 분이 없으면 닫지 않는다', () => {
      expect(
        isSlotClosedForRoom(room({ operationStartTime: null }), 0, dayStart),
      ).toBe(false);
      expect(isSlotClosedForRoom(room(), null, dayStart)).toBe(false);
    });
  });

  describe('tableOperationWindow / buildSlots', () => {
    it('호실 하나라도 꼬리가 있으면 가장 늦은 overnightUntil 까지 그린다', () => {
      expect(
        tableOperationWindow(
          [
            tailRoom(),
            tailRoom({ overnightUntil: '2026-10-20T17:30:00Z' }),
            room(),
          ],
          dayStart,
        ),
      ).toEqual({ startMinute: 0, endMinute: 1590 });
      // 날짜를 넘기지 않으면 꼬리를 모른다(옛 호출)
      expect(tableOperationWindow([tailRoom()])).toEqual({
        startMinute: 0,
        endMinute: MINUTES_PER_DAY,
      });
    });

    it('120분 정책이면 23:30 칸 뒤에 1440·1470·1500 세 칸을 붙인다', () => {
      const slots = buildSlots([tailRoom(), room()], D);

      expect(slots).toHaveLength(51);
      expect(slots[47]).toMatchObject({
        startMinute: 1410,
        endLabel: '24:00',
        nextDay: false,
      });
      expect(slots.slice(48).map(slot => slot.startMinute)).toEqual([
        1440, 1470, 1500,
      ]);
      expect(slots.slice(48).map(slot => slot.label)).toEqual([
        '00:00',
        '00:30',
        '01:00',
      ]);
      expect(slots.slice(48).map(slot => slot.endLabel)).toEqual([
        '00:30',
        '01:00',
        '01:30',
      ]);
      expect(slots.slice(48).every(slot => slot.nextDay)).toBe(true);
      // 칸 시각은 D+1 새벽이다(10-21 00:00 KST = 10-20 15:00Z)
      expect(slots[48].startAt.toISOString()).toBe('2026-10-20T15:00:00.000Z');
      expect(slots[50].endAt.toISOString()).toBe('2026-10-20T16:30:00.000Z');
    });

    it('180분 정책이면 00:00~02:30 다섯 칸이다', () => {
      const slots = buildSlots(
        [tailRoom({ overnightUntil: '2026-10-20T17:30:00Z' })],
        D,
      );
      expect(slots).toHaveLength(53);
      expect(slots.at(-1).endLabel).toBe('02:30');
    });

    it('꼬리가 없으면 nextDay 칸이 없다', () => {
      expect(buildSlots([midnightRoom()], D).some(slot => slot.nextDay)).toBe(
        false,
      );
      expect(buildSlots([room()], D).some(slot => slot.nextDay)).toBe(false);
    });
  });
});
