import { format } from 'date-fns';

import {
  DELETED_ROOM_SUFFIX,
  answerTitle,
  hasAnswer,
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

describe('hasAnswer', () => {
  it('adminMemo 가 있으면 상태와 무관하게 답변으로 본다', () => {
    expect(hasAnswer({ status: 'RESOLVED', adminMemo: '처리했습니다.' })).toBe(
      true,
    );
    // 재오픈은 status 가 OPEN 으로 돌아오지만 답변은 남는다.
    expect(
      hasAnswer({ status: 'OPEN', adminMemo: '다시 확인해 주세요.' }),
    ).toBe(true);
  });

  it('adminMemo 가 없거나 빈 문자열이면 답변이 아니다', () => {
    expect(hasAnswer({ status: 'RESOLVED', adminMemo: null })).toBe(false);
    expect(hasAnswer({ status: 'OPEN', adminMemo: '' })).toBe(false);
    expect(hasAnswer(null)).toBe(false);
  });
});

describe('answerTitle', () => {
  it('답변 완료는 답변 시각을 붙인다', () => {
    expect(
      answerTitle({ status: 'RESOLVED', resolvedAt: '2026-08-30T11:40:00' }),
    ).toBe('관리자 답변 · 2026-08-30 11:40');
  });

  it('답변 완료인데 답변 시각이 없으면 시각 없이 쓴다', () => {
    expect(answerTitle({ status: 'RESOLVED', resolvedAt: null })).toBe(
      '관리자 답변',
    );
  });

  // 재오픈 답변의 시각을 담는 필드가 없다. updateAt 은 마지막 수정 시각일 뿐이라 쓰지 않는다.
  it('재오픈(OPEN)은 시각 없는 이전 답변이다', () => {
    expect(
      answerTitle({ status: 'OPEN', resolvedAt: '2026-08-30T11:40:00' }),
    ).toBe('이전 답변');
  });
});
