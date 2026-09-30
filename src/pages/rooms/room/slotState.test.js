import { buildSlots } from './operationWindow';
import { getSlotState, initialScrollIndex } from './slotState';

const room = (over = {}) => ({
  partitionId: 1,
  roomName: '세미나실',
  partitionNumber: 1,
  operationStartTime: '09:00:00',
  operationEndTime: '18:00:00',
  eachMaxMinute: 120,
  reservationTimeRanges: [],
  ...over,
});

const at = hm => new Date(`2026-09-03T${hm}:00`);

describe('getSlotState 상태 우선순위', () => {
  it('예약된 칸은 지난 시간이어도 reserved 로 본다', () => {
    const r = room({
      reservationTimeRanges: [
        {
          startDateTime: '2026-09-03T10:00:00',
          endDateTime: '2026-09-03T11:00:00',
        },
      ],
    });
    const s = getSlotState({
      slotStart: at('10:00'),
      now: at('17:00'),
      room: r,
      selection: null,
    });
    expect(s.status).toBe('reserved');
    expect(s.selectable).toBe(false);
  });

  it('지난 칸은 선택 표시보다 잠금이 우선이다', () => {
    const s = getSlotState({
      slotStart: at('10:00'),
      now: at('17:00'),
      room: room(),
      selection: { partitionId: 1, from: at('10:00'), to: at('10:30') },
    });
    expect(s.status).toBe('past');
  });

  it('운영 종료 시각과 같은 칸은 closed 다', () => {
    const s = getSlotState({
      slotStart: at('18:00'),
      now: at('08:00'),
      room: room(),
      selection: null,
    });
    expect(s.status).toBe('closed');
  });

  it('호실마다 운영시간이 다르면 같은 시각도 갈린다', () => {
    const open = getSlotState({
      slotStart: at('17:00'),
      now: at('08:00'),
      room: room({ operationEndTime: '22:00:00' }),
      selection: null,
    });
    const shut = getSlotState({
      slotStart: at('17:00'),
      now: at('08:00'),
      room: room({ partitionId: 2, operationEndTime: '18:00:00' }),
      selection: null,
    });
    expect(open.status).toBe('free');
    expect(shut.status).toBe('free');

    const late = getSlotState({
      slotStart: at('19:00'),
      now: at('08:00'),
      room: room({ partitionId: 2, operationEndTime: '18:00:00' }),
      selection: null,
    });
    expect(late.status).toBe('closed');
  });
});

describe('getSlotState 내 예약', () => {
  const range = (over = {}) => ({
    startDateTime: '2026-09-03T10:00:00',
    endDateTime: '2026-09-03T11:00:00',
    ...over,
  });

  it('isMine 이 true 면 mine 이고 고를 수 없다', () => {
    const s = getSlotState({
      slotStart: at('10:00'),
      now: at('08:00'),
      room: room({ reservationTimeRanges: [range({ isMine: true })] }),
      selection: null,
    });
    expect(s.status).toBe('mine');
    expect(s.selectable).toBe(false);
  });

  it('내 예약은 지난 시간이어도 mine 이다', () => {
    const s = getSlotState({
      slotStart: at('10:00'),
      now: at('17:00'),
      room: room({ reservationTimeRanges: [range({ isMine: true })] }),
      selection: null,
    });
    expect(s.status).toBe('mine');
  });

  it('선택 범위와 겹쳐도 mine 이다', () => {
    const s = getSlotState({
      slotStart: at('10:00'),
      now: at('08:00'),
      room: room({ reservationTimeRanges: [range({ isMine: true })] }),
      selection: { partitionId: 1, from: at('10:00'), to: at('10:30') },
    });
    expect(s.status).toBe('mine');
  });

  it('isMine 이 없으면 reserved 다', () => {
    const s = getSlotState({
      slotStart: at('10:00'),
      now: at('08:00'),
      room: room({ reservationTimeRanges: [range()] }),
      selection: null,
    });
    expect(s.status).toBe('reserved');
  });

  it('isMine 이 false 면 reserved 다', () => {
    const s = getSlotState({
      slotStart: at('10:00'),
      now: at('08:00'),
      room: room({ reservationTimeRanges: [range({ isMine: false })] }),
      selection: null,
    });
    expect(s.status).toBe('reserved');
  });

  it('같은 칸을 덮는 예약이 남의 것과 내 것 둘이면 mine 이다', () => {
    const s = getSlotState({
      slotStart: at('10:00'),
      now: at('08:00'),
      room: room({
        reservationTimeRanges: [
          range({ isMine: false }),
          range({ isMine: true }),
        ],
      }),
      selection: null,
    });
    expect(s.status).toBe('mine');
  });
});

describe('getSlotState 연장 범위', () => {
  const selection = { partitionId: 1, from: at('10:00'), to: at('10:30') };

  it('선택 호실의 최대 시간 안은 범위 안이다', () => {
    const s = getSlotState({
      slotStart: at('11:30'),
      now: at('08:00'),
      room: room(),
      selection,
    });
    expect(s.outOfExtendRange).toBe(false);
  });

  it('선택 호실의 최대 시간을 넘으면 범위 밖이다', () => {
    const s = getSlotState({
      slotStart: at('12:00'),
      now: at('08:00'),
      room: room(),
      selection,
    });
    expect(s.outOfExtendRange).toBe(true);
  });

  it('다른 호실은 범위 밖으로 표시된다', () => {
    const s = getSlotState({
      slotStart: at('10:00'),
      now: at('08:00'),
      room: room({ partitionId: 2 }),
      selection,
    });
    expect(s.outOfExtendRange).toBe(true);
  });

  it('선택이 없으면 범위 밖이 아니다', () => {
    const s = getSlotState({
      slotStart: at('10:00'),
      now: at('08:00'),
      room: room(),
      selection: null,
    });
    expect(s.outOfExtendRange).toBe(false);
  });
});

describe('initialScrollIndex', () => {
  // 09:00, 09:30, 10:00, 10:30 네 칸
  const slots = buildSlots(
    [room({ operationEndTime: '11:00:00' })],
    '2026-09-03',
  );

  it('오늘이면 현재 시각 한 칸 앞을 가리킨다', () => {
    expect(
      initialScrollIndex({
        slots,
        now: new Date('2026-09-03T10:10:00'),
        selectedDate: '2026-09-03',
      }),
    ).toBe(1);
  });

  it('오늘이 아니면 0 이다', () => {
    expect(
      initialScrollIndex({
        slots,
        now: new Date('2026-09-03T10:10:00'),
        selectedDate: '2026-09-04',
      }),
    ).toBe(0);
  });

  it('운영 시작 전이면 0 이다', () => {
    expect(
      initialScrollIndex({
        slots,
        now: new Date('2026-09-03T07:00:00'),
        selectedDate: '2026-09-03',
      }),
    ).toBe(0);
  });

  it('운영이 끝난 뒤면 마지막 칸을 가리킨다', () => {
    expect(
      initialScrollIndex({
        slots,
        now: new Date('2026-09-03T23:00:00'),
        selectedDate: '2026-09-03',
      }),
    ).toBe(3);
  });
});

describe('getSlotState 자정 정책과 섞인 날', () => {
  const midnight = room({
    operationStartTime: '00:00:00',
    operationEndTime: '23:30:00',
    endsAtMidnight: true,
  });
  const plain = room({ partitionId: 2, operationEndTime: '22:00:00' });
  const state = (r, hm, slotMinute) =>
    getSlotState({
      slotStart: at(hm),
      slotMinute,
      now: at('00:00'),
      room: r,
      selection: null,
    }).status;

  it('자정 정책 호실은 23:30 칸을 연다', () => {
    expect(state(midnight, '23:30', 1410)).toBe('free');
  });

  it('같은 표의 평상 호실은 22:00 뒤와 09:00 앞 칸을 잠근다', () => {
    expect(state(plain, '23:30', 1410)).toBe('closed');
    expect(state(plain, '22:00', 1320)).toBe('closed');
    expect(state(plain, '08:30', 510)).toBe('closed');
    expect(state(plain, '09:00', 540)).toBe('free');
  });

  it('필드가 없는 옛 응답의 00:00~23:30 은 23:30 칸을 잠근다', () => {
    expect(
      state({ ...midnight, endsAtMidnight: undefined }, '23:30', 1410),
    ).toBe('closed');
  });
});

describe('initialScrollIndex 자정까지 여는 날', () => {
  const allDay = buildSlots(
    [
      room({
        operationStartTime: '00:00:00',
        operationEndTime: '23:30:00',
        endsAtMidnight: true,
      }),
    ],
    '2026-10-20',
  );
  const plainDay = buildSlots(
    [room({ operationEndTime: '22:00:00' })],
    '2026-10-20',
  );

  it('오늘 00:10 이면 첫 칸이다', () => {
    expect(
      initialScrollIndex({
        slots: allDay,
        now: new Date('2026-10-20T00:10:00'),
        selectedDate: '2026-10-20',
      }),
    ).toBe(0);
  });

  // 옛 코드는 경계를 'HH:mm' 문자열로 비교해 끝이 '00:00' 인 날 늘 마지막으로 갔다
  it('오늘 23:50 이면 23:30 칸의 한 칸 앞(23:00)이다', () => {
    expect(
      initialScrollIndex({
        slots: allDay,
        now: new Date('2026-10-20T23:50:00'),
        selectedDate: '2026-10-20',
      }),
    ).toBe(46);
  });

  it('오늘이 아닌 날은 09:00 칸에서 시작한다', () => {
    const index = initialScrollIndex({
      slots: allDay,
      now: new Date('2026-10-19T12:00:00'),
      selectedDate: '2026-10-20',
    });
    expect(index).toBe(18);
    expect(allDay[index].label).toBe('09:00');
  });

  it('09:00 에 여는 평상 날은 오늘이 아니면 처음이다', () => {
    expect(
      initialScrollIndex({
        slots: plainDay,
        now: new Date('2026-10-19T12:00:00'),
        selectedDate: '2026-10-20',
      }),
    ).toBe(0);
  });
});
