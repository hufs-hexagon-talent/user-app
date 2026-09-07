import { format } from 'date-fns';

import {
  DELETED_ROOM_SUFFIX,
  metaLabel,
  sortResolvedLatestFirst,
} from './inquiryView';

describe('metaLabel', () => {
  it('출석·기타 문의는 연결 예약 요약을 "예약 " 접두어로 준다', () => {
    expect(
      metaLabel({
        category: 'ATTENDANCE',
        reservationId: 10,
        reservationSummary: '2026-08-30 10:00~11:00 306-1',
      }),
    ).toBe('예약 2026-08-30 10:00~11:00 306-1');
    expect(
      metaLabel({
        category: 'ETC',
        reservationId: null,
        reservationSummary: '2026-08-30 10:00~11:00 306-1',
      }),
    ).toBe('예약 2026-08-30 10:00~11:00 306-1 · 취소된 예약');
    expect(metaLabel({ category: 'ETC', reservationSummary: null })).toBeNull();
  });

  it('시설 문의는 방과 발생 시각을 " · " 로 잇고, 없는 값은 뺀다', () => {
    const occurredAt = '2026-09-05T04:40:00Z';
    expect(
      metaLabel({
        category: 'FACILITY',
        roomId: 1,
        roomName: '306',
        occurredAt,
      }),
    ).toBe(`306 · 발생 ${format(new Date(occurredAt), 'yyyy-MM-dd HH:mm')}`);
    expect(
      metaLabel({ category: 'FACILITY', roomId: 1, roomName: '306' }),
    ).toBe('306');
    expect(
      metaLabel({ category: 'FACILITY', roomId: null, roomName: '306' }),
    ).toBe(`306${DELETED_ROOM_SUFFIX}`);
  });

  it('시설 문의에 방도 시각도 없으면 연결 예약(구 폼 접수)으로 대신하고, 그것도 없으면 null', () => {
    expect(
      metaLabel({
        category: 'FACILITY',
        roomId: null,
        roomName: null,
        occurredAt: null,
        reservationId: 3,
        reservationSummary: '2026-09-01 10:00~11:00 428-2',
      }),
    ).toBe('예약 2026-09-01 10:00~11:00 428-2');
    expect(metaLabel({ category: 'FACILITY', roomName: null })).toBeNull();
  });
});

describe('sortResolvedLatestFirst', () => {
  it('resolvedAt 내림차순, 없으면 createAt 으로 대신한다', () => {
    const a = {
      inquiryId: 1,
      createAt: '2026-08-01T00:00:00Z',
      resolvedAt: '2026-08-02T00:00:00Z',
    };
    const b = {
      inquiryId: 2,
      createAt: '2026-07-01T00:00:00Z',
      resolvedAt: '2026-09-01T00:00:00Z',
    };
    const c = {
      inquiryId: 3,
      createAt: '2026-08-15T00:00:00Z',
      resolvedAt: null,
    };
    expect(sortResolvedLatestFirst([a, b, c]).map(i => i.inquiryId)).toEqual([
      2, 3, 1,
    ]);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const list = [
      { inquiryId: 1, createAt: '2026-08-01T00:00:00Z', resolvedAt: null },
    ];
    const copy = [...list];
    sortResolvedLatestFirst(list);
    expect(list).toEqual(copy);
  });
});
