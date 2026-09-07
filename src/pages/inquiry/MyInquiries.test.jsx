import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import { useDeleteInquiry, useMyInquiries } from '../../api/inquiry.api';

import MyInquiries, { STALE_MESSAGE } from './MyInquiries';

jest.mock('../../api/inquiry.api', () => ({
  useMyInquiries: jest.fn(),
  useDeleteInquiry: jest.fn(),
}));

const mockOpenSuccessSnackbar = jest.fn();
const mockOpenErrorSnackbar = jest.fn();
jest.mock('../../components/snackbar/SnackBar', () => ({
  useCustomSnackbars: () => ({
    openSuccessSnackbar: mockOpenSuccessSnackbar,
    openErrorSnackbar: mockOpenErrorSnackbar,
  }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const doDelete = jest.fn();

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
  doDelete.mockResolvedValue({});
  useDeleteInquiry.mockReturnValue({ mutateAsync: doDelete, isPending: false });
  mockList([OPEN_INQUIRY, RESOLVED_INQUIRY]);
});

const itemOf = text => screen.getByText(text).closest('li');
const openItem = () => itemOf(OPEN_INQUIRY.content);
const resolvedItem = () => itemOf(RESOLVED_INQUIRY.content);
const openDeleteModal = item =>
  fireEvent.click(within(item).getByRole('button', { name: '삭제' }));

describe('MyInquiries', () => {
  it('제목은 내 문의다', () => {
    render(<MyInquiries />);

    expect(
      screen.getByRole('heading', { name: '내 문의' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/1:1/)).toBeNull();
  });

  // 위쪽 카드가 무슨 무리인지 화면이 말하지 않았다. 두 섹션 모두 제목을 갖고, 접지 않는다.
  it('답변 대기·답변 완료 섹션을 건수와 함께 항상 펼쳐 보여준다', () => {
    render(<MyInquiries />);

    expect(
      screen.getByRole('heading', { name: '답변 대기 1건' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: '답변 완료 1건' }),
    ).toBeInTheDocument();
    expect(screen.getByText(OPEN_INQUIRY.content)).toBeInTheDocument();
    expect(screen.getByText(RESOLVED_INQUIRY.content)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /답변 완료/ })).toBeNull();
  });

  it('한쪽이 0건이면 그 섹션은 그리지 않는다', () => {
    mockList([RESOLVED_INQUIRY]);
    render(<MyInquiries />);

    expect(screen.queryByRole('heading', { name: /답변 대기/ })).toBeNull();
    expect(
      screen.getByRole('heading', { name: '답변 완료 1건' }),
    ).toBeInTheDocument();
  });

  it('답변 대기 문의만 수정·삭제 버튼을 보여준다', () => {
    render(<MyInquiries />);

    expect(
      within(openItem()).getByRole('button', { name: '수정' }),
    ).toBeInTheDocument();
    expect(
      within(openItem()).getByRole('button', { name: '삭제' }),
    ).toBeInTheDocument();
    expect(
      within(resolvedItem()).queryByRole('button', { name: '수정' }),
    ).toBeNull();
    expect(
      within(resolvedItem()).queryByRole('button', { name: '삭제' }),
    ).toBeNull();
  });

  it('유형과 상태 배지를 함께 보여준다', () => {
    render(<MyInquiries />);

    expect(
      within(openItem()).getByText('시설·키오스크 고장'),
    ).toBeInTheDocument();
    expect(within(openItem()).getByText('답변 대기')).toBeInTheDocument();
    expect(
      within(resolvedItem()).getByText('출석·예약 이의'),
    ).toBeInTheDocument();
    expect(within(resolvedItem()).getByText('답변 완료')).toBeInTheDocument();
  });

  // 학생은 답변을 보러 온다. 답변이 본문보다 먼저 온다.
  it('답변 완료 카드는 관리자 답변 박스를 답변 시각과 함께 본문 위에 그린다', () => {
    render(<MyInquiries />);

    const item = resolvedItem();
    expect(
      within(item).getByText('관리자 답변 · 2026-08-30 11:40'),
    ).toBeInTheDocument();
    expect(within(item).getByText('내 문의')).toBeInTheDocument();
    expect(within(item).queryByText(/처리 메모/)).toBeNull();
    const answer = within(item).getByText('확인 후 출석 처리했습니다.');
    const body = within(item).getByText(RESOLVED_INQUIRY.content);
    expect(
      answer.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  // 관리자가 재오픈하면 status 는 OPEN 인데 답변은 남아 있다. 숨기면 학생은 답변을 잃는다.
  it('재오픈된 문의는 답변 대기 섹션에서 이전 답변을 시각 없이 보여준다', () => {
    mockList([{ ...OPEN_INQUIRY, adminMemo: '자리를 다시 확인해 주세요.' }]);
    render(<MyInquiries />);

    const item = openItem();
    expect(within(item).getByText('이전 답변')).toBeInTheDocument();
    expect(
      within(item).getByText('자리를 다시 확인해 주세요.'),
    ).toBeInTheDocument();
    expect(within(item).queryByText(/이전 답변 ·/)).toBeNull();
    expect(
      within(item).getByRole('button', { name: '수정' }),
    ).toBeInTheDocument();
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

  // 답변 완료 문의는 본문을 끝까지 읽을 다른 길이 없다. 답변 대기는 수정 화면에서 전문이 읽힌다.
  it('답변 완료 카드는 본문 전문을, 답변 대기 카드는 2줄 클램프를 쓴다', () => {
    const longContent = `첫 줄입니다.\n둘째 줄입니다.\n${'가'.repeat(400)}`;
    mockList([OPEN_INQUIRY, { ...RESOLVED_INQUIRY, content: longContent }]);
    render(<MyInquiries />);

    // 기본 문자열 매처는 줄바꿈을 공백으로 정규화하므로 textContent 를 직접 비교한다.
    const resolvedBody = screen.getByText(
      (_, el) => el.tagName === 'P' && el.textContent === longContent,
    );
    expect(resolvedBody).toHaveClass('whitespace-pre-wrap');
    expect(resolvedBody).not.toHaveClass('line-clamp-2');
    expect(screen.getByText(OPEN_INQUIRY.content)).toHaveClass('line-clamp-2');
  });

  it('수정 버튼을 누르면 해당 문의의 수정 화면으로 이동한다', () => {
    render(<MyInquiries />);

    fireEvent.click(within(openItem()).getByRole('button', { name: '수정' }));

    expect(mockNavigate).toHaveBeenCalledWith(
      `/inquiry/${OPEN_INQUIRY.inquiryId}/edit`,
    );
  });

  it('삭제 확인 모달에서 취소를 누르면 삭제 요청을 보내지 않는다', () => {
    render(<MyInquiries />);
    openDeleteModal(openItem());

    expect(
      screen.getByText('해당 문의를 삭제하시겠습니까?'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(doDelete).not.toHaveBeenCalled();
    expect(
      screen.queryByText('해당 문의를 삭제하시겠습니까?'),
    ).not.toBeInTheDocument();
  });

  it('삭제 확인 모달에서 확인을 누르면 삭제를 요청한다', async () => {
    render(<MyInquiries />);
    openDeleteModal(openItem());

    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() =>
      expect(doDelete).toHaveBeenCalledWith(OPEN_INQUIRY.inquiryId),
    );
    expect(mockOpenSuccessSnackbar).toHaveBeenCalledWith(
      '문의를 삭제했습니다.',
      3000,
    );
  });

  it('확인 버튼을 두 번 눌러도 삭제 요청은 한 번만 보낸다', async () => {
    let resolveDelete;
    doDelete.mockReturnValue(
      new Promise(resolve => {
        resolveDelete = resolve;
      }),
    );

    render(<MyInquiries />);
    openDeleteModal(openItem());

    const confirmButton = screen.getByRole('button', { name: '확인' });
    await act(async () => {
      confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      confirmButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(doDelete).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveDelete({});
    });
  });

  it('삭제 실패는 서버 원문 대신 학생용 문구를 띄운다', async () => {
    doDelete.mockRejectedValue({
      response: {
        status: 403,
        data: { code: 'AUTH-002', message: '서버 원문' },
      },
    });

    render(<MyInquiries />);
    openDeleteModal(openItem());
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() =>
      expect(mockOpenErrorSnackbar).toHaveBeenCalledWith(
        '본인 문의만 수정하거나 삭제할 수 있습니다.',
        3000,
      ),
    );
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

  // react-query v5 는 재조회가 실패해도 data 를 유지한다. 손에 쥔 답변을 오류 문구로 덮지 않는다.
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
