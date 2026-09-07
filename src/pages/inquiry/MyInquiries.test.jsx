import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { useMyInquiries } from '../../api/inquiry.api';

import MyInquiries from './MyInquiries';
import { STALE_MESSAGE } from './inquiryView';

jest.mock('../../api/inquiry.api', () => ({
  useMyInquiries: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const OPEN_INQUIRY = {
  inquiryId: 1,
  category: 'FACILITY',
  content: '에어컨이 고장났습니다. 확인 부탁드립니다.',
  status: 'OPEN',
  adminMemo: null,
  reservationId: null,
  reservationSummary: null,
  roomId: 1,
  roomName: '306',
  occurredAt: null,
  createAt: '2026-09-01T10:00:00',
  resolvedAt: null,
};

const RESOLVED_INQUIRY = {
  inquiryId: 2,
  category: 'ATTENDANCE',
  content: '출석이 안 잡혔어요.',
  status: 'RESOLVED',
  adminMemo: '확인 후 출석 처리했습니다.',
  reservationId: 10,
  reservationSummary: '2026-08-30 10:00~11:00 201-A',
  createAt: '2026-08-30T09:00:00',
  resolvedAt: '2026-08-30T11:40:00',
};

const mockList = (data, over = {}) =>
  useMyInquiries.mockReturnValue({
    data,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    ...over,
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockList([OPEN_INQUIRY, RESOLVED_INQUIRY]);
});

const itemOf = text => screen.getByText(text).closest('li');
const openItem = () => itemOf(OPEN_INQUIRY.content);
const resolvedItem = () => itemOf(RESOLVED_INQUIRY.content);

describe('MyInquiries', () => {
  it('제목은 내 문의다', () => {
    render(<MyInquiries />);

    expect(
      screen.getByRole('heading', { name: '내 문의' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/1:1/)).toBeNull();
  });

  it('답변 대기·답변 완료 섹션을 건수와 함께 보여준다', () => {
    render(<MyInquiries />);

    expect(
      screen.getByRole('heading', { name: '답변 대기 1건' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '답변 완료 1건' }),
    ).toBeInTheDocument();
  });

  it('한쪽이 0건이면 그 섹션은 그리지 않는다', () => {
    mockList([RESOLVED_INQUIRY]);
    render(<MyInquiries />);

    expect(screen.queryByRole('heading', { name: /답변 대기/ })).toBeNull();
    expect(
      screen.getByRole('heading', { name: '답변 완료 1건' }),
    ).toBeInTheDocument();
  });

  it('유형과 상태 배지와 접수 일시를 함께 보여준다', () => {
    render(<MyInquiries />);

    expect(
      within(openItem()).getByText('시설·키오스크 고장'),
    ).toBeInTheDocument();
    expect(within(openItem()).getByText('답변 대기')).toBeInTheDocument();
    expect(
      within(openItem()).getByText('2026-09-01 10:00'),
    ).toBeInTheDocument();
    expect(
      within(resolvedItem()).getByText('출석·예약 이의'),
    ).toBeInTheDocument();
    expect(within(resolvedItem()).getByText('답변 완료')).toBeInTheDocument();
  });

  // 목록은 훑는 화면이다. 622자짜리 문의 한 건이 화면을 통째로 먹으면 새 답변이 안 보인다.
  it('행을 누르면 그 문의의 상세로 간다', () => {
    render(<MyInquiries />);

    fireEvent.click(within(resolvedItem()).getByRole('button'));

    expect(mockNavigate).toHaveBeenCalledWith('/inquiry/2');
  });

  // 클램프는 눈에만 걸린다. 접근 이름에 본문을 실으면 400자가 그대로 읽힌다.
  it('행의 접근 이름은 유형·상태·접수 일시로 짧게 준다', () => {
    render(<MyInquiries />);

    expect(
      screen.getByRole('button', {
        name: '출석·예약 이의 답변 완료 2026-08-30 09:00 문의 보기',
      }),
    ).toBeInTheDocument();
  });

  // 답변 완료도 예외가 아니다 — 전문과 관리자 답변은 상세에서만 읽는다.
  it('두 섹션 모두 본문을 2줄로 자르고 관리자 답변은 목록에 싣지 않는다', () => {
    render(<MyInquiries />);

    expect(screen.getByText(OPEN_INQUIRY.content)).toHaveClass('line-clamp-2');
    expect(screen.getByText(RESOLVED_INQUIRY.content)).toHaveClass(
      'line-clamp-2',
    );
    expect(screen.queryByText('확인 후 출석 처리했습니다.')).toBeNull();
    expect(screen.queryByText(/관리자 답변/)).toBeNull();
  });

  // jsdom 은 CSS 를 적용하지 않아 클램프가 죽어도 위 테스트는 통과한다. tailwind 는
  // .line-clamp-2{display:-webkit-box} 를 .block{display:block} 보다 먼저 내보내고 명시도가
  // 같아서, 둘을 같이 주면 block 이 이겨 클램프가 통째로 무효가 된다(실측: 200px vs 40px).
  // 클래스 조합 자체를 금지해서 잠근다.
  it('본문에 line-clamp-2 와 block 을 함께 주지 않는다', () => {
    render(<MyInquiries />);

    [OPEN_INQUIRY, RESOLVED_INQUIRY].forEach(inquiry => {
      const body = screen.getByText(inquiry.content);
      expect(body).toHaveClass('line-clamp-2');
      expect(body).not.toHaveClass('block');
    });
  });

  // 긴 본문이 행을 오른쪽으로 늘리면 클램프가 잘릴 자리를 못 찾는다(admin Shell 과 같은 함정).
  it('본문을 감싼 칸은 min-width 를 0 으로 내린다', () => {
    render(<MyInquiries />);

    expect(screen.getByText(OPEN_INQUIRY.content).parentElement).toHaveClass(
      'min-w-0',
    );
  });

  // 관리자가 재오픈하면 배지는 답변 대기인데 답변은 남아 있다. 그 어긋남만 표시한다.
  it('재오픈된 문의 행에만 이전 답변 표시를 붙인다', () => {
    mockList([
      { ...OPEN_INQUIRY, adminMemo: '자리를 다시 확인해 주세요.' },
      RESOLVED_INQUIRY,
    ]);
    render(<MyInquiries />);

    expect(within(openItem()).getByText('이전 답변')).toBeInTheDocument();
    expect(within(resolvedItem()).queryByText('이전 답변')).toBeNull();
    expect(screen.queryByText('자리를 다시 확인해 주세요.')).toBeNull();
  });

  // 행 버튼의 aria-label 이 안쪽 텍스트를 통째로 덮는다. 칩을 거기 안 실으면 스크린리더는
  // 답변이 와 있다는 사실만 못 받는다 — 이 표시가 필요한 유일한 경우인데도.
  it('재오픈된 행은 접근 이름에도 이전 답변을 싣는다', () => {
    mockList([
      { ...OPEN_INQUIRY, adminMemo: '자리를 다시 확인해 주세요.' },
      RESOLVED_INQUIRY,
    ]);
    render(<MyInquiries />);

    expect(
      screen.getByRole('button', {
        name: '시설·키오스크 고장 답변 대기 이전 답변 2026-09-01 10:00 문의 보기',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: '출석·예약 이의 답변 완료 2026-08-30 09:00 문의 보기',
      }),
    ).toBeInTheDocument();
  });

  it('수정·삭제는 목록에 두지 않는다', () => {
    render(<MyInquiries />);

    expect(screen.queryByRole('button', { name: '수정' })).toBeNull();
    expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
  });

  it('답변 완료는 답변한 순서로, 새 답변이 맨 위에 온다', () => {
    const older = {
      ...RESOLVED_INQUIRY,
      inquiryId: 5,
      content: '오래된 답변',
      createAt: '2026-08-01T00:00:00',
      resolvedAt: '2026-08-02T00:00:00',
    };
    const newer = {
      ...RESOLVED_INQUIRY,
      inquiryId: 6,
      content: '새 답변',
      createAt: '2026-07-01T00:00:00',
      resolvedAt: '2026-09-01T00:00:00',
    };
    mockList([older, newer]);
    render(<MyInquiries />);

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('새 답변');
    expect(items[1]).toHaveTextContent('오래된 답변');
  });

  it('메타 줄은 유형별로 다르다 — 예약 요약, 방·발생 시각, 취소된 예약', () => {
    mockList([
      OPEN_INQUIRY,
      RESOLVED_INQUIRY,
      {
        ...OPEN_INQUIRY,
        inquiryId: 3,
        category: 'ETC',
        content: '취소한 예약인데 출석 문제가 있어요.',
        roomId: null,
        roomName: null,
        reservationId: null,
        reservationSummary: '2026-08-28 13:00~14:00 306-1',
      },
      {
        ...OPEN_INQUIRY,
        inquiryId: 4,
        content: '지워진 방의 고장',
        roomId: null,
        roomName: '428',
      },
    ]);
    render(<MyInquiries />);

    expect(
      within(resolvedItem()).getByText('예약 2026-08-30 10:00~11:00 201-A'),
    ).toBeInTheDocument();
    expect(within(openItem()).getByText('306')).toBeInTheDocument();
    expect(
      within(itemOf('취소한 예약인데 출석 문제가 있어요.')).getByText(
        '예약 2026-08-28 13:00~14:00 306-1 · 취소된 예약',
      ),
    ).toBeInTheDocument();
    expect(
      within(itemOf('지워진 방의 고장')).getByText('428(삭제된 방)'),
    ).toBeInTheDocument();
  });

  it('문의가 없으면 안내 문구를 보여주고 헤더의 문의하기로 접수 화면에 간다', () => {
    mockList([]);
    render(<MyInquiries />);

    expect(screen.getByText('접수한 문의가 없습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '문의하기' }));

    expect(mockNavigate).toHaveBeenCalledWith('/inquiry/new');
  });

  // 마이페이지에서 폼으로 바로 가는 항목이 사라졌다. 목록 API 가 죽어도 접수 경로는 살아야 한다.
  it('목록 없이 실패하면 오류 문구와 다시 시도, 문의하기 버튼이 있다', () => {
    const refetch = jest.fn();
    mockList(undefined, { isError: true, refetch });
    render(<MyInquiries />);

    expect(
      screen.getByText('문의 목록을 불러오지 못했습니다.'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '문의하기' }));
    expect(mockNavigate).toHaveBeenCalledWith('/inquiry/new');
  });

  // react-query v5 는 재조회가 실패해도 data 를 유지한다. 손에 쥔 목록을 오류 문구로 덮지 않는다.
  it('캐시가 있는 채로 재조회에 실패하면 목록 위에 배너만 얹는다', () => {
    const refetch = jest.fn();
    mockList([OPEN_INQUIRY, RESOLVED_INQUIRY], { isError: true, refetch });
    render(<MyInquiries />);

    expect(screen.getByRole('status')).toHaveTextContent(STALE_MESSAGE);
    expect(screen.getByText(RESOLVED_INQUIRY.content)).toBeInTheDocument();
    expect(screen.queryByText('문의 목록을 불러오지 못했습니다.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('불러오는 중에도 문의하기 버튼이 있다', () => {
    mockList(undefined, { isPending: true });
    render(<MyInquiries />);

    expect(
      screen.getByText('문의 목록을 불러오는 중입니다.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '문의하기' }),
    ).toBeInTheDocument();
  });
});
