import {
  createTimeTable,
  normalizeOperationTime,
  isOutsideOperationHours,
  hasReservedSlotInRange,
  formatMaxMinutes,
  maxMinutesExceededMessage,
  normalizeErrorCode,
  getReserveErrorMessage,
  RESERVE_FAILED_MESSAGE,
} from './reservationSlot';

describe('normalizeOperationTime', () => {
  it('HH:mm:ss 를 HH:mm 으로 줄인다', () => {
    expect(normalizeOperationTime('18:00:00')).toBe('18:00');
    expect(normalizeOperationTime('09:30')).toBe('09:30');
  });

  it('문자열이 아니면 null', () => {
    expect(normalizeOperationTime(undefined)).toBeNull();
    expect(normalizeOperationTime(null)).toBeNull();
  });
});

describe('isOutsideOperationHours', () => {
  it('운영 시작 전 칸은 잠근다', () => {
    expect(isOutsideOperationHours('08:30', '09:00:00', '18:00:00')).toBe(true);
  });

  it('운영 종료 시각과 같은 칸은 잠근다', () => {
    expect(isOutsideOperationHours('18:00', '09:00:00', '18:00:00')).toBe(true);
  });

  it('운영 종료 직전 칸은 연다', () => {
    expect(isOutsideOperationHours('17:30', '09:00:00', '18:00:00')).toBe(
      false,
    );
  });

  it('운영 시작 칸은 연다', () => {
    expect(isOutsideOperationHours('09:00', '09:00:00', '18:00:00')).toBe(
      false,
    );
  });

  it('운영시간 정보가 없으면 잠그지 않는다', () => {
    expect(isOutsideOperationHours('09:00', undefined, '18:00:00')).toBe(false);
  });
});

describe('hasReservedSlotInRange', () => {
  const ranges = [
    {
      startDateTime: '2026-08-28T10:30:00',
      endDateTime: '2026-08-28T11:00:00',
    },
  ];
  const at = hm => new Date(`2026-08-28T${hm}:00`);

  it('연장 범위 안에 남의 예약이 있으면 true', () => {
    expect(hasReservedSlotInRange(ranges, at('10:00'), at('11:30'))).toBe(true);
  });

  it('연장 범위가 예약 앞에서 끝나면 false', () => {
    expect(hasReservedSlotInRange(ranges, at('10:00'), at('10:30'))).toBe(
      false,
    );
  });

  it('연장 범위가 예약 뒤에서 시작하면 false', () => {
    expect(hasReservedSlotInRange(ranges, at('11:00'), at('12:00'))).toBe(
      false,
    );
  });

  it('입력이 비어 있으면 false', () => {
    expect(hasReservedSlotInRange(undefined, at('10:00'), at('11:00'))).toBe(
      false,
    );
    expect(hasReservedSlotInRange(ranges, null, at('11:00'))).toBe(false);
  });
});

describe('formatMaxMinutes / maxMinutesExceededMessage', () => {
  it('분을 시간 문구로 바꾼다', () => {
    expect(formatMaxMinutes(60)).toBe('1시간');
    expect(formatMaxMinutes(90)).toBe('1시간 30분');
    expect(formatMaxMinutes(30)).toBe('30분');
  });

  it('값이 없으면 일반 문구', () => {
    expect(formatMaxMinutes(undefined)).toBeNull();
    expect(maxMinutesExceededMessage(undefined)).toBe(
      '최대 예약 시간을 넘어 선택할 수 없습니다.',
    );
  });

  it('안내 문구에 최대 시간을 넣는다', () => {
    expect(maxMinutesExceededMessage(120)).toBe(
      '최대 2시간까지 예약할 수 있습니다.',
    );
  });
});

describe('getReserveErrorMessage', () => {
  it('선행 공백이 있는 코드도 매핑한다', () => {
    expect(normalizeErrorCode(' RESERVATION-006')).toBe('RESERVATION-006');
    expect(getReserveErrorMessage(' RESERVATION-006')).toBe(
      '최대 예약 시간을 넘었습니다. 시간을 다시 선택해 주세요.',
    );
  });

  it('업무 규칙 코드를 학생용 문구로 바꾼다', () => {
    expect(getReserveErrorMessage('RESERVATION-007')).toBe(
      '출석하지 않은 예약이 있습니다. 해당 예약에 출석한 뒤 다시 예약해 주세요.',
    );
    expect(getReserveErrorMessage('RESERVATION-009')).toBe(
      '선택한 시간에 이미 다른 예약이 있습니다. 시간을 다시 선택해 주세요.',
    );
    expect(getReserveErrorMessage('RESERVATION-012')).toBe(
      '이미 지난 시간대는 예약할 수 없습니다. 시간을 다시 선택해 주세요.',
    );
    expect(getReserveErrorMessage('RESERVATION-013')).toBe(
      '예약은 30분 단위로만 할 수 있습니다. 시간을 다시 선택해 주세요.',
    );
    expect(getReserveErrorMessage('POLICY-003')).toBe(
      '선택한 시간은 해당 세미나실의 운영시간이 아닙니다. 다른 시간을 선택해 주세요.',
    );
    expect(getReserveErrorMessage('POLICY-001')).toBe(
      '선택한 날짜에는 세미나실 운영 정책이 없습니다. 다른 날짜를 선택해 주세요.',
    );
  });

  it('노쇼 차단은 해제일이 있으면 날짜를 넣는다', () => {
    expect(
      getReserveErrorMessage('RESERVATION-004', { blockedUntil: '2026-09-05' }),
    ).toBe('미출석이 누적되어 2026-09-05까지 예약이 제한됩니다.');
    expect(getReserveErrorMessage('RESERVATION-004')).toBe(
      '미출석이 누적되어 예약이 제한되었습니다.',
    );
  });

  it('모르는 코드나 코드가 없으면 일반 문구', () => {
    expect(getReserveErrorMessage('RESERVATION-999')).toBe(
      RESERVE_FAILED_MESSAGE,
    );
    expect(getReserveErrorMessage(undefined)).toBe(RESERVE_FAILED_MESSAGE);
  });
});

describe('createTimeTable', () => {
  it('운영 종료가 23:59 여도 30분 격자 라벨을 빠뜨리지 않는다', () => {
    const times = createTimeTable({
      startTime: { hour: 9, minute: 0 },
      endTime: { hour: 23, minute: 59 },
      intervalMinute: 30,
    });

    expect(times[0]).toBe('09:00');
    expect(times).toContain('23:30');
    expect(times[times.length - 1]).toBe('23:30');
    // 표 본문은 마지막 라벨을 렌더하지 않으므로 마지막 칸은 23:00~23:30 이다
    expect(times[times.length - 2]).toBe('23:00');
  });

  it('운영 종료가 격자에 맞으면 종료 시각이 마지막 라벨이 된다', () => {
    const times = createTimeTable({
      startTime: { hour: 9, minute: 0 },
      endTime: { hour: 22, minute: 0 },
      intervalMinute: 30,
    });

    expect(times[times.length - 1]).toBe('22:00');
    expect(times).toHaveLength(27);
  });
});

describe('createTimeTable 자정', () => {
  it('종료가 24:00 이면 48칸이고 마지막 칸은 23:30~24:00 이다', () => {
    const times = createTimeTable({
      startTime: { hour: 0, minute: 0 },
      endTime: { hour: 24, minute: 0 },
      intervalMinute: 30,
    });

    // 경계 49개 = 칸 48개
    expect(times).toHaveLength(49);
    expect(times[times.length - 1]).toBe('24:00');
    expect(times[times.length - 2]).toBe('23:30');
  });

  it('00:00~23:59 는 지금처럼 47칸이다', () => {
    const times = createTimeTable({
      startTime: { hour: 0, minute: 0 },
      endTime: { hour: 23, minute: 59 },
      intervalMinute: 30,
    });

    expect(times).toHaveLength(48);
    expect(times[times.length - 1]).toBe('23:30');
  });
});

describe('isOutsideOperationHours 자정 정책', () => {
  it('endsAtMidnight 면 저장 종료 23:30 이어도 23:30 칸을 연다', () => {
    expect(isOutsideOperationHours('23:30', '00:00:00', '23:30:00', true)).toBe(
      false,
    );
  });

  it('플래그가 없으면 23:30 칸은 잠근다', () => {
    expect(isOutsideOperationHours('23:30', '00:00:00', '23:30:00')).toBe(true);
    expect(isOutsideOperationHours('23:30', '09:00:00', '23:59:59')).toBe(true);
  });

  it('칸 시작을 분으로 받아도 같다', () => {
    expect(isOutsideOperationHours(1410, '00:00:00', '23:30:00', true)).toBe(
      false,
    );
    expect(isOutsideOperationHours(510, '09:00:00', '22:00:00')).toBe(true);
  });
});

// 익일 꼬리 칸도 보통 칸과 같은 규칙으로 고른다. 꼬리 칸 전용 안내는 없고, 자정을 넘는 범위에 남의 예약이
// 끼면 이 판정이 true 가 되어 RoomPage 가 누른 칸부터 새로 고른다.
describe('hasReservedSlotInRange 익일 꼬리', () => {
  // 서버 응답처럼 예약은 문자열, 선택 범위는 Date 로 준다
  const iso = local => `2099-10-${local}:00`;
  const at = local => new Date(iso(local));

  it('자정 앞의 남의 예약을 건너 꼬리 칸까지 잇는 범위는 true', () => {
    const ranges = [
      { startDateTime: iso('20T23:30'), endDateTime: iso('21T00:00') },
    ];
    expect(hasReservedSlotInRange(ranges, at('20T23:00'), at('21T00:30'))).toBe(
      true,
    );
  });

  it('꼬리 안의 남의 예약을 건너는 범위도 true', () => {
    const ranges = [
      { startDateTime: iso('21T00:00'), endDateTime: iso('21T00:30') },
    ];
    expect(hasReservedSlotInRange(ranges, at('20T23:00'), at('21T01:00'))).toBe(
      true,
    );
  });

  it('꼬리 칸에서 시작한 범위는 그 앞에서 끝나는 자정 넘김 예약과 겹치지 않는다', () => {
    const ranges = [
      { startDateTime: iso('20T23:00'), endDateTime: iso('21T00:30') },
    ];
    expect(hasReservedSlotInRange(ranges, at('21T00:30'), at('21T01:30'))).toBe(
      false,
    );
  });
});
