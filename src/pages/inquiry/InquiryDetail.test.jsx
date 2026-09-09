import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import { useDeleteInquiry, useMyInquiries } from '../../api/inquiry.api';

import InquiryDetail from './InquiryDetail';
import { STALE_MESSAGE } from './inquiryView';

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
let mockParamId = '1';
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: mockParamId }),
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
  occurredAt: '2026-09-01T09:30:00',
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
  mockParamId = '1';
  doDelete.mockResolvedValue({});
  useDeleteInquiry.mockReturnValue({ mutateAsync: doDelete, isPending: false });
  mockList([OPEN_INQUIRY, RESOLVED_INQUIRY]);
});

const openDeleteModal = () =>
  fireEvent.click(screen.getByRole('button', { name: '삭제' }));

describe('InquiryDetail', () => {
  it('유형을 제목으로, 상태 배지와 접수 일시와 메타 줄을 함께 보여준다', () => {
    render(<InquiryDetail />);

    expect(
      screen.getByRole('heading', { name: '시설·키오스크 고장' }),
    ).toBeInTheDocument();
    expect(screen.getByText('답변 대기')).toBeInTheDocument();
    expect(screen.getByText('2026-09-01 10:00')).toBeInTheDocument();
    expect(screen.getByText('306 · 발생 2026-09-01 09:30')).toBeInTheDocument();
  });

  // 목록은 2줄로 자른다. 전문을 읽을 곳은 여기뿐이라 잘라서는 안 된다.
  it('본문을 자르지 않고 줄바꿈까지 살려서 보여준다', () => {
    const longContent = `첫 줄입니다.\n둘째 줄입니다.\n${'가'.repeat(400)}`;
    mockList([{ ...OPEN_INQUIRY, content: longContent }]);
    render(<InquiryDetail />);

    // 기본 문자열 매처는 줄바꿈을 공백으로 정규화하므로 textContent 를 직접 비교한다.
    const body = screen.getByText(
      (_, el) => el.tagName === 'P' && el.textContent === longContent,
    );
    expect(body).toHaveClass('whitespace-pre-wrap');
    expect(body).not.toHaveClass('line-clamp-2');
  });

  // 학생은 답변을 보러 들어온다. 답변이 본문보다 먼저 온다(§3.2 와 같은 순서).
  it('답변 완료는 관리자 답변을 답변 시각과 함께 본문 위에 그린다', () => {
    mockParamId = '2';
    render(<InquiryDetail />);

    expect(
      screen.getByText('관리자 답변 · 2026-08-30 11:40'),
    ).toBeInTheDocument();
    const answer = screen.getByText('확인 후 출석 처리했습니다.');
    const body = screen.getByText(RESOLVED_INQUIRY.content);
    expect(
      answer.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText('문의 내용')).toBeInTheDocument();
    expect(screen.queryByText(/처리 메모/)).toBeNull();
  });

  // 관리자가 재오픈하면 status 는 OPEN 인데 답변은 남는다. 숨기면 학생은 답변을 잃는다.
  it('재오픈된 문의는 이전 답변을 시각 없이 보여주고 수정·삭제도 남긴다', () => {
    mockList([{ ...OPEN_INQUIRY, adminMemo: '자리를 다시 확인해 주세요.' }]);
    render(<InquiryDetail />);

    expect(screen.getByText('이전 답변')).toBeInTheDocument();
    expect(screen.getByText('자리를 다시 확인해 주세요.')).toBeInTheDocument();
    expect(screen.queryByText(/이전 답변 ·/)).toBeNull();
    expect(screen.getByRole('button', { name: '수정' })).toBeInTheDocument();
  });

  it('답변 완료 문의에는 수정·삭제가 없다', () => {
    mockParamId = '2';
    render(<InquiryDetail />);

    expect(screen.queryByRole('button', { name: '수정' })).toBeNull();
    expect(screen.queryByRole('button', { name: '삭제' })).toBeNull();
  });

  it('뒤로 가는 링크와 수정 버튼이 각각 목록·수정 화면으로 보낸다', () => {
    render(<InquiryDetail />);

    fireEvent.click(screen.getByRole('button', { name: '내 문의' }));
    expect(mockNavigate).toHaveBeenCalledWith('/inquiry');

    fireEvent.click(screen.getByRole('button', { name: '수정' }));
    expect(mockNavigate).toHaveBeenCalledWith('/inquiry/1/edit');
  });

  it('삭제 확인 모달에서 취소를 누르면 삭제 요청을 보내지 않는다', () => {
    render(<InquiryDetail />);
    openDeleteModal();

    expect(
      screen.getByText('해당 문의를 삭제하시겠습니까?'),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    expect(doDelete).not.toHaveBeenCalled();
    expect(
      screen.queryByText('해당 문의를 삭제하시겠습니까?'),
    ).not.toBeInTheDocument();
  });

  // 지워진 문의의 주소가 히스토리에 남으면 뒤로가기가 곧바로 목록으로 되튕겨 아무 일도
  // 일어나지 않은 것처럼 보인다. replace 로 그 항목을 없앤다.
  it('삭제에 성공하면 스낵바를 띄우고 목록으로 replace 이동한다', async () => {
    render(<InquiryDetail />);
    openDeleteModal();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => expect(doDelete).toHaveBeenCalledWith(1));
    expect(mockOpenSuccessSnackbar).toHaveBeenCalledWith(
      '문의를 삭제했습니다.',
      3000,
    );
    expect(mockNavigate).toHaveBeenCalledWith('/inquiry', { replace: true });
  });

  it('확인 버튼을 두 번 눌러도 삭제 요청은 한 번만 보낸다', async () => {
    let resolveDelete;
    doDelete.mockReturnValue(
      new Promise(resolve => {
        resolveDelete = resolve;
      }),
    );

    render(<InquiryDetail />);
    openDeleteModal();

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

  it('삭제 실패는 서버 원문 대신 학생용 문구를 띄우고 화면에 머문다', async () => {
    doDelete.mockRejectedValue({
      response: {
        status: 403,
        data: { code: 'AUTH-002', message: '서버 원문' },
      },
    });

    render(<InquiryDetail />);
    openDeleteModal();
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() =>
      expect(mockOpenErrorSnackbar).toHaveBeenCalledWith(
        '본인 문의만 수정하거나 삭제할 수 있습니다.',
        3000,
      ),
    );
    expect(mockNavigate).not.toHaveBeenCalledWith('/inquiry', {
      replace: true,
    });
  });

  // 로딩 중 find 실패를 "없는 문의" 로 읽으면 주 흐름 전원이 목록으로 튕긴다.
  it('목록을 불러오는 중에는 로딩 문구만 보이고 되돌려 보내지 않는다', () => {
    mockList(undefined, { isPending: true });
    render(<InquiryDetail />);

    expect(screen.getByText('문의를 불러오는 중입니다.')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('목록에 없는 문의면 목록으로 replace 이동한다', () => {
    mockParamId = '999';
    render(<InquiryDetail />);

    expect(mockNavigate).toHaveBeenCalledWith('/inquiry', { replace: true });
  });

  it('주소의 문의 번호가 숫자가 아니면 목록으로 replace 이동한다', () => {
    mockParamId = 'new';
    render(<InquiryDetail />);

    expect(mockNavigate).toHaveBeenCalledWith('/inquiry', { replace: true });
  });

  it('목록 없이 실패하면 오류 문구와 다시 시도를 보여준다', () => {
    const refetch = jest.fn();
    mockList(undefined, { isError: true, refetch });
    render(<InquiryDetail />);

    expect(screen.getByText('문의를 불러오지 못했습니다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // react-query v5 는 재조회가 실패해도 data 를 유지한다. 손에 쥔 답변을 오류 문구로 덮지 않는다.
  it('배너의 다시 시도는 재조회 중에 잠기고 진행 중으로 표시된다', () => {
    mockList([OPEN_INQUIRY], { isError: true, isFetching: true });
    render(<InquiryDetail />);

    expect(
      screen.getByRole('button', { name: '다시 불러오는 중' }),
    ).toBeDisabled();
    expect(screen.getByText(OPEN_INQUIRY.content)).toBeInTheDocument();
  });

  it('캐시가 있는 채로 재조회에 실패하면 배너만 얹고 내용을 지킨다', () => {
    const refetch = jest.fn();
    mockList([OPEN_INQUIRY], { isError: true, refetch });
    render(<InquiryDetail />);

    expect(screen.getByRole('status')).toHaveTextContent(STALE_MESSAGE);
    expect(screen.getByText(OPEN_INQUIRY.content)).toBeInTheDocument();
    expect(screen.queryByText('문의를 불러오지 못했습니다.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
