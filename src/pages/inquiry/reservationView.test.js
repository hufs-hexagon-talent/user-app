import {
  CANCELED_RESERVATION_SUFFIX,
  formatDateHeading,
  formatReservationTime,
  formatReservationTimeRange,
  formatRoom,
  groupByDate,
  isDisputable,
  linkedReservationLabel,
  reservationStateLabel,
  sortReservationsLatestFirst,
} from './reservationView';

const reservation = (over = {}) => ({
  reservationId: 1,
  roomName: '201',
  partitionNumber: 'A',
  reservationStartTime: '2026-09-05T10:00:00',
  reservationEndTime: '2026-09-05T11:00:00',
  reservationState: 'NOT_VISITED',
  ...over,
});

describe('reservationStateLabel', () => {
  const now = new Date('2026-09-05T10:30:00');

  it('VISITED 는 출석, PROCESSED 와 미지값은 처리됨', () => {
    expect(
      reservationStateLabel(reservation({ reservationState: 'VISITED' }), now),
    ).toBe('출석');
    expect(
      reservationStateLabel(
        reservation({ reservationState: 'PROCESSED' }),
        now,
      ),
    ).toBe('처리됨');
    expect(
      reservationStateLabel(reservation({ reservationState: 'WHATEVER' }), now),
    ).toBe('처리됨');
  });

  // 서버의 노쇼 판정은 종료 시각 경과다. 진행 중(종료 전)인 예약은 아직 체크인할 수 있다.
  it('NOT_VISITED 는 종료 시각이 지났을 때만 미출석, 시작 전이면 예약 예정', () => {
    expect(
      reservationStateLabel(
        reservation({
          reservationStartTime: '2026-09-04T10:00:00',
          reservationEndTime: '2026-09-04T11:00:00',
        }),
        now,
      ),
    ).toBe('미출석');
    expect(
      reservationStateLabel(
        reservation({
          reservationStartTime: '2026-09-06T10:00:00',
          reservationEndTime: '2026-09-06T11:00:00',
        }),
        now,
      ),
    ).toBe('예약 예정');
  });
});

describe('reservationStateLabel 이용 중', () => {
  // 시작은 지났고 종료는 안 지난 NOT_VISITED. "예약 예정" 도 "미출석" 도 아니다.
  it('NOT_VISITED 가 진행 중이면 이용 중', () => {
    const now = new Date('2026-09-05T10:30:00');
    expect(reservationStateLabel(reservation(), now)).toBe('이용 중');
    expect(
      reservationStateLabel(reservation(), new Date('2026-09-05T09:00:00')),
    ).toBe('예약 예정');
  });
});

describe('isDisputable', () => {
  const now = new Date('2026-09-05T10:30:00');

  // 출석 이의 대상: 종료가 지난 미출석, 그리고 제한이 풀리며 처리된 예약.
  it('종료가 지난 NOT_VISITED 와 PROCESSED 만 참', () => {
    expect(isDisputable(reservation(), now)).toBe(false);
    expect(
      isDisputable(
        reservation({
          reservationStartTime: '2026-09-04T10:00:00',
          reservationEndTime: '2026-09-04T11:00:00',
        }),
        now,
      ),
    ).toBe(true);
    expect(
      isDisputable(reservation({ reservationState: 'PROCESSED' }), now),
    ).toBe(true);
    expect(
      isDisputable(
        reservation({
          reservationState: 'VISITED',
          reservationStartTime: '2026-09-04T10:00:00',
          reservationEndTime: '2026-09-04T11:00:00',
        }),
        now,
      ),
    ).toBe(false);
  });
});

describe('formatReservationTimeRange / formatDateHeading / groupByDate', () => {
  it('카드의 시각은 날짜 없이, 그룹 제목은 연도와 요일과 함께', () => {
    expect(formatReservationTimeRange(reservation())).toBe('10:00~11:00');
    expect(formatDateHeading('2026-09-05T10:00:00')).toBe('2026-09-05 (토)');
  });

  it('같은 날짜끼리 묶고 입력 순서를 지킨다', () => {
    const groups = groupByDate([
      reservation({
        reservationId: 3,
        reservationStartTime: '2026-09-06T14:00:00',
      }),
      reservation({
        reservationId: 2,
        reservationStartTime: '2026-09-05T15:00:00',
      }),
      reservation({
        reservationId: 1,
        reservationStartTime: '2026-09-05T10:00:00',
      }),
    ]);

    expect(groups.map(g => g.heading)).toEqual([
      '2026-09-06 (일)',
      '2026-09-05 (토)',
    ]);
    expect(groups[1].items.map(r => r.reservationId)).toEqual([2, 1]);
    expect(groupByDate([])).toEqual([]);
  });
});

describe('formatReservationTime / formatRoom', () => {
  // 서버 스냅샷(reservationSummary)과 같은 포맷이어야 수정 모드에서 두 값이 한 자리에 나란히 놓인다.
  it('연도를 포함한 시작~끝 시각을 만든다', () => {
    expect(formatReservationTime(reservation())).toBe('2026-09-05 10:00~11:00');
  });

  it('호실-분번을 만든다', () => {
    expect(formatRoom(reservation())).toBe('201-A');
  });
});

describe('sortReservationsLatestFirst', () => {
  it('startTime 내림차순으로 정렬한 새 배열을 돌려준다', () => {
    const list = [
      reservation({
        reservationId: 2,
        reservationStartTime: '2026-09-06T00:00:00',
      }),
      reservation({
        reservationId: 1,
        reservationStartTime: '2026-09-01T00:00:00',
      }),
      reservation({
        reservationId: 3,
        reservationStartTime: '2026-09-03T00:00:00',
      }),
    ];

    const result = sortReservationsLatestFirst(list);

    expect(result.map(r => r.reservationId)).toEqual([2, 3, 1]);
    expect(list.map(r => r.reservationId)).toEqual([2, 1, 3]);
  });

  it('상한 없이 전량을 돌려준다', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      reservation({
        reservationId: i + 1,
        reservationStartTime: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00`,
      }),
    );

    expect(sortReservationsLatestFirst(many)).toHaveLength(25);
  });

  it('목록이 없으면 빈 배열', () => {
    expect(sortReservationsLatestFirst(undefined)).toEqual([]);
    expect(sortReservationsLatestFirst([])).toEqual([]);
  });
});

describe('linkedReservationLabel', () => {
  it('스냅샷이 없으면 null', () => {
    expect(
      linkedReservationLabel({ reservationId: null, reservationSummary: null }),
    ).toBeNull();
  });

  it('예약이 살아 있으면 스냅샷 그대로', () => {
    expect(
      linkedReservationLabel({
        reservationId: 10,
        reservationSummary: '2026-08-30 10:00~11:00 201-A',
      }),
    ).toBe('2026-08-30 10:00~11:00 201-A');
  });

  // 학생이 예약을 취소하면 행이 지워져 id 가 null 이 되고 스냅샷 문자열만 남는다.
  it('예약이 지워졌으면 취소된 예약 접미어를 붙인다', () => {
    expect(CANCELED_RESERVATION_SUFFIX).toBe(' · 취소된 예약');
    expect(
      linkedReservationLabel({
        reservationId: null,
        reservationSummary: '2026-08-30 10:00~11:00 201-A',
      }),
    ).toBe('2026-08-30 10:00~11:00 201-A · 취소된 예약');
  });
});
