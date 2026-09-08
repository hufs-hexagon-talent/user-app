import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

import {
  useCreateInquiry,
  useMyInquiries,
  useUpdateInquiry,
} from '../../api/inquiry.api';
import { useUserReservation } from '../../api/reservation.api';
import { useInquiryRooms } from '../../api/room.api';

import InquiryForm, {
  CONTENT_PLACEHOLDERS,
  DEEP_LINK_ERROR_MESSAGE,
  DEEP_LINK_MISSING_MESSAGE,
  DEEP_LINK_PENDING_MESSAGE,
  EDIT_LOADING_MESSAGE,
  LINKED_RESERVATION_HINT,
  OCCURRED_AT_HINT,
  ROOMS_LOADING_MESSAGE,
  ROOMS_UNAVAILABLE_MESSAGE,
} from './InquiryForm';
import { FUTURE_MESSAGE, TOO_OLD_MESSAGE } from './occurredAt';

jest.mock('../../api/inquiry.api', () => ({
  useMyInquiries: jest.fn(),
  useCreateInquiry: jest.fn(),
  useUpdateInquiry: jest.fn(),
}));
jest.mock('../../api/reservation.api', () => ({
  useUserReservation: jest.fn(),
}));
jest.mock('../../api/room.api', () => ({
  useInquiryRooms: jest.fn(),
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
let mockParamsValue = {};
let mockSearchParamsValue = new URLSearchParams();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParamsValue,
  useSearchParams: () => [mockSearchParamsValue, jest.fn()],
}));

const doCreate = jest.fn();
const doUpdate = jest.fn();

// 종료 시각이 과거여야 NOT_VISITED 가 "미출석" 으로 고정된다(미래면 "예약 예정").
const RESERVATION_A = {
  reservationId: 10,
  roomName: '201',
  partitionNumber: 'A',
  reservationStartTime: '2026-08-05T10:00:00',
  reservationEndTime: '2026-08-05T11:00:00',
  reservationState: 'NOT_VISITED',
};
const RESERVATION_B = {
  reservationId: 20,
  roomName: '302',
  partitionNumber: 'B',
  reservationStartTime: '2026-08-06T14:00:00',
  reservationEndTime: '2026-08-06T15:00:00',
  reservationState: 'VISITED',
};
const CARD_A = '2026-08-05 10:00~11:00 201-A 미출석';
const CARD_B = '2026-08-06 14:00~15:00 302-B 출석';
const ROOMS = [
  { roomId: 1, roomName: '306', departmentId: 1 },
  { roomId: 2, roomName: '428', departmentId: 1 },
];

const mockReservations = (over = {}) =>
  useUserReservation.mockReturnValue({
    data: [RESERVATION_A, RESERVATION_B],
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    ...over,
  });
const mockRooms = (over = {}) =>
  useInquiryRooms.mockReturnValue({
    data: ROOMS,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    ...over,
  });

const chooseCategory = label =>
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(label) }));
const typeContent = text =>
  fireEvent.change(screen.getByLabelText('문의 내용'), {
    target: { value: text },
  });
// 비활성 버튼 클릭은 조용히 삼켜져 뒤의 waitFor 타임아웃으로만 보인다. 여기서 먼저 잡는다.
const submit = () => {
  const button = screen.getByRole('button', { name: /제출하기|수정하기/ });
  expect(button).toBeEnabled();
  fireEvent.click(button);
};
const openPicker = () =>
  fireEvent.click(screen.getByRole('button', { name: '예약 선택' }));
const pickCard = name =>
  fireEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name }),
  );
const closePicker = () =>
  fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
// 카드(접근 이름이 있는 버튼)만 고른다.
const pickedCardInDialog = () =>
  within(screen.getByRole('dialog'))
    .getAllByRole('button', { pressed: true })
    .filter(button => button.hasAttribute('aria-label'));
const pickRoom = name => fireEvent.click(screen.getByRole('radio', { name }));
const setOccurredAt = value =>
  fireEvent.change(screen.getByLabelText(/언제 그랬나요/), {
    target: { value },
  });
const localValue = date => {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};
// 발생 시각 픽스처는 상대 시각으로 — 고정 날짜는 30일이 지나면 "범위 밖" 상태로 시작한다.
// datetime-local 은 분 단위라 초를 0 으로 맞춰야 왕복이 맞는다.
const hoursAgo = hours => {
  const date = new Date(Date.now() - hours * 60 * 60 * 1000);
  date.setSeconds(0, 0);
  return date;
};

const editInquiry = (over = {}) => ({
  inquiryId: 9,
  category: 'ATTENDANCE',
  content: '출석이 안 잡혔어요',
  status: 'OPEN',
  adminMemo: null,
  reservationId: 10,
  reservationSummary: '2026-08-05 10:00~11:00 201-A',
  roomId: null,
  roomName: null,
  occurredAt: null,
  ...over,
});
const mockEdit = inquiry => {
  mockParamsValue = { id: String(inquiry.inquiryId) };
  useMyInquiries.mockReturnValue({ data: [inquiry], isPending: false });
};

const doubleTap = async button => {
  await act(async () => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParamsValue = {};
  mockSearchParamsValue = new URLSearchParams();
  doCreate.mockResolvedValue({});
  doUpdate.mockResolvedValue({});
  useCreateInquiry.mockReturnValue({ mutateAsync: doCreate, isPending: false });
  useUpdateInquiry.mockReturnValue({ mutateAsync: doUpdate, isPending: false });
  useMyInquiries.mockReturnValue({ data: [], isPending: false });
  mockReservations();
  mockRooms();
});

describe('InquiryForm 유형 선택', () => {
  // 기본값이 ATTENDANCE 라 고장 신고자가 "관련 예약 필수" 를 먼저 만났다. 유형을 고르기 전엔 아무것도 묻지 않는다.
  it('유형을 고르기 전에는 라디오 카드 셋만 있고 필드·제출이 없다', () => {
    render(<InquiryForm />);

    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
    expect(
      screen.getByText('출석했는데 미출석으로 표시돼요'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('문의 내용')).toBeNull();
    expect(screen.getByRole('button', { name: '제출하기' })).toBeDisabled();
  });

  it('쿼리의 category 로 카드를 미리 고르고, 잘못된 값은 무시한다', () => {
    mockSearchParamsValue = new URLSearchParams('category=FACILITY');
    const { unmount } = render(<InquiryForm />);
    expect(
      screen.getByRole('radio', { name: /시설·키오스크 고장/ }),
    ).toBeChecked();
    expect(
      screen.getByRole('group', { name: /어느 방인가요/ }),
    ).toBeInTheDocument();
    unmount();

    mockSearchParamsValue = new URLSearchParams('category=BOGUS');
    render(<InquiryForm />);
    expect(screen.queryByRole('radio', { checked: true })).toBeNull();
  });

  it('쿼리의 reservationId 가 양의 정수가 아니면 무시한다', () => {
    ['abc', '1.5', '-1'].forEach(value => {
      mockSearchParamsValue = new URLSearchParams(
        `category=ATTENDANCE&reservationId=${value}`,
      );
      const { unmount } = render(<InquiryForm />);
      expect(screen.queryByText(DEEP_LINK_PENDING_MESSAGE)).toBeNull();
      expect(screen.queryByText(DEEP_LINK_MISSING_MESSAGE)).toBeNull();
      expect(
        screen.getByRole('button', { name: '예약 선택' }),
      ).toBeInTheDocument();
      unmount();
    });
  });

  // 폼이 isFetching 을 내리지 않으면 모달의 다시 시도가 진행 중을 표시하지 못한다.
  it('재조회 중에 연 예약 선택 모달의 다시 시도는 잠겨 있다', () => {
    mockSearchParamsValue = new URLSearchParams('category=ATTENDANCE');
    mockReservations({ isError: true, isFetching: true });
    render(<InquiryForm />);

    openPicker();

    expect(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: '다시 불러오는 중',
      }),
    ).toBeDisabled();
  });

  it('유형마다 내용 칸의 안내 문구가 다르다', () => {
    render(<InquiryForm />);
    chooseCategory('기타');
    expect(screen.getByLabelText('문의 내용')).toHaveAttribute(
      'placeholder',
      CONTENT_PLACEHOLDERS.ETC,
    );
    chooseCategory('출석·예약 이의');
    expect(screen.getByLabelText('문의 내용')).toHaveAttribute(
      'placeholder',
      CONTENT_PLACEHOLDERS.ATTENDANCE,
    );
  });

  it('문의 내용은 1000자 제한과 함께 글자 수를 보여준다', () => {
    render(<InquiryForm />);
    chooseCategory('기타');
    const textarea = screen.getByLabelText('문의 내용');

    expect(textarea.maxLength).toBe(1000);
    expect(screen.getByText('0 / 1000')).toBeInTheDocument();
    fireEvent.change(textarea, { target: { value: '안녕하세요' } });
    expect(screen.getByText('5 / 1000')).toBeInTheDocument();
  });
});

describe('InquiryForm 출석·예약 이의', () => {
  it('예약을 고르지 않으면 제출이 비활성이고, 고르면 활성이며 reservationId 만 보낸다', async () => {
    render(<InquiryForm />);
    chooseCategory('출석·예약 이의');
    typeContent('출석이 안 잡혀요');
    expect(screen.getByRole('button', { name: '제출하기' })).toBeDisabled();
    expect(
      within(screen.getByRole('group', { name: '관련 예약' })).getByText(
        '필수',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('예약을 특정할 수 없는 출석 문제는 기타로'),
    ).toBeInTheDocument();

    openPicker();
    pickCard(CARD_A);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('201-A')).toBeInTheDocument();
    submit();

    await waitFor(() =>
      expect(doCreate).toHaveBeenCalledWith({
        category: 'ATTENDANCE',
        content: '출석이 안 잡혀요',
        reservationId: 10,
        roomId: null,
        occurredAt: null,
      }),
    );
    expect(mockOpenSuccessSnackbar).toHaveBeenCalledWith(
      '문의가 접수되었습니다.',
      3000,
    );
    expect(mockNavigate).toHaveBeenCalledWith('/inquiry');
  });

  it('예약 선택 모달의 카드에 시각·호실·상태가 보이고, 예약이 없으면 빈 상태 안내가 보인다', () => {
    const { unmount } = render(<InquiryForm />);
    chooseCategory('출석·예약 이의');
    openPicker();
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('button', { name: CARD_B }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole('button', { name: CARD_A }),
    ).toBeInTheDocument();
    closePicker();
    unmount();

    mockReservations({ data: [] });
    render(<InquiryForm />);
    chooseCategory('출석·예약 이의');
    openPicker();
    expect(
      within(screen.getByRole('dialog')).getByText(/예약 내역이 없습니다\./),
    ).toBeInTheDocument();
  });

  it('고른 예약을 변경 버튼으로 바꿀 수 있고, 출석 유형에는 선택 해제가 없다', () => {
    render(<InquiryForm />);
    chooseCategory('출석·예약 이의');
    openPicker();
    pickCard(CARD_A);
    expect(
      screen.queryByRole('button', { name: '관련 예약 선택 해제' }),
    ).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '관련 예약 변경' }));
    expect(pickedCardInDialog()[0]).toHaveAccessibleName(CARD_A);
    pickCard(CARD_B);

    expect(screen.getByText('302-B')).toBeInTheDocument();
    expect(screen.queryByText('201-A')).toBeNull();
  });

  it('예약을 고르면 포커스가 변경 버튼으로 간다', async () => {
    render(<InquiryForm />);
    chooseCategory('출석·예약 이의');
    openPicker();
    pickCard(CARD_A);

    const changeButton = screen.getByRole('button', { name: '관련 예약 변경' });
    await waitFor(() => expect(changeButton).toHaveFocus());
    expect(changeButton).toHaveClass('min-h-[44px]');
  });

  // /check 표의 "문의" 링크는 예약이 확정된 채로 폼을 연다 — 주 흐름에서 피커를 열지 않는다.
  it('딥링크 reservationId 가 목록에 있으면 확정 카드로 그리고 피커 없이 제출한다', async () => {
    mockSearchParamsValue = new URLSearchParams(
      'category=ATTENDANCE&reservationId=10',
    );
    render(<InquiryForm />);

    expect(screen.getByRole('radio', { name: /출석·예약 이의/ })).toBeChecked();
    expect(screen.getByText('201-A')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByRole('button', { name: '관련 예약 변경' }),
    ).toBeInTheDocument();
    typeContent('QR 을 찍었는데 미출석');
    submit();

    await waitFor(() =>
      expect(doCreate).toHaveBeenCalledWith(
        expect.objectContaining({ reservationId: 10 }),
      ),
    );
  });

  it('딥링크는 목록이 로드되는 동안 확인 중 문구를 보이고, 못 찾으면 안내 뒤 피커 버튼을 남기며, 고르면 안내가 사라진다', () => {
    mockSearchParamsValue = new URLSearchParams(
      'category=ATTENDANCE&reservationId=999',
    );
    mockReservations({ data: undefined, isPending: true });
    const { rerender } = render(<InquiryForm />);
    expect(screen.getByText(DEEP_LINK_PENDING_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText(DEEP_LINK_MISSING_MESSAGE)).toBeNull();

    mockReservations();
    rerender(<InquiryForm />);
    expect(screen.getByText(DEEP_LINK_MISSING_MESSAGE)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '예약 선택' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();

    openPicker();
    pickCard(CARD_A);
    expect(screen.queryByText(DEEP_LINK_MISSING_MESSAGE)).toBeNull();
    expect(screen.getByText('201-A')).toBeInTheDocument();

    // 기타로 바꿔 선택을 해제해도 "아래에서 골라 주세요" 가 되살아나면 안 된다.
    chooseCategory('기타');
    fireEvent.click(
      screen.getByRole('button', { name: '관련 예약 선택 해제' }),
    );
    expect(screen.queryByText(DEEP_LINK_MISSING_MESSAGE)).toBeNull();
  });

  // "다시 시도" 는 누르는 순간 "확인 중" 문구로 바뀌어 사라진다. 포커스가 body 로 떨어지면 안 된다.
  it('딥링크 중 예약 조회가 실패하면 실패 문구와 다시 시도를 보여주고, 다시 시도 뒤 포커스는 예약 선택 버튼으로 간다', async () => {
    mockSearchParamsValue = new URLSearchParams(
      'category=ATTENDANCE&reservationId=10',
    );
    const refetch = jest.fn();
    mockReservations({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    render(<InquiryForm />);

    expect(
      screen.getByText(new RegExp(DEEP_LINK_ERROR_MESSAGE)),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '예약 선택' })).toHaveFocus(),
    );
  });

  it('선택한 예약을 서버가 거절하면(INQUIRY-002) 선택을 비우고 목록을 다시 읽는다', async () => {
    const refetch = jest.fn();
    mockReservations({ refetch });
    doCreate.mockRejectedValue({
      response: {
        status: 400,
        data: { code: 'INQUIRY-002', message: '서버 원문' },
      },
    });
    render(<InquiryForm />);
    chooseCategory('출석·예약 이의');
    typeContent('출석이 안 잡혀요');
    openPicker();
    pickCard(CARD_A);
    refetch.mockClear();
    submit();

    await waitFor(() =>
      expect(mockOpenErrorSnackbar).toHaveBeenCalledWith(
        '선택한 예약을 찾을 수 없습니다. 본인 예약만 선택할 수 있습니다.',
        3000,
      ),
    );
    expect(
      screen.getByRole('button', { name: '예약 선택' }),
    ).toBeInTheDocument();
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalledWith('/inquiry');
  });
});

describe('InquiryForm 시설·키오스크 고장', () => {
  it('방을 고르기 전엔 제출이 비활성이고, 고르면 roomId 를 보내며 예약은 보내지 않는다', async () => {
    render(<InquiryForm />);
    chooseCategory('시설·키오스크 고장');
    typeContent('키오스크가 꺼졌어요');
    expect(screen.queryByRole('group', { name: '관련 예약' })).toBeNull();
    expect(screen.getByRole('button', { name: '제출하기' })).toBeDisabled();

    pickRoom('306');
    expect(screen.getByRole('radio', { name: '306' })).toBeChecked();
    submit();

    await waitFor(() =>
      expect(doCreate).toHaveBeenCalledWith({
        category: 'FACILITY',
        content: '키오스크가 꺼졌어요',
        reservationId: null,
        roomId: 1,
        occurredAt: null,
      }),
    );
  });

  it('발생 시각을 지정하면 ISO 로 보내고, 비워 두면 null 이다', async () => {
    render(<InquiryForm />);
    chooseCategory('시설·키오스크 고장');
    typeContent('에어컨');
    pickRoom('428');
    expect(screen.getByText(OCCURRED_AT_HINT)).toBeInTheDocument();
    const twoHoursAgo = hoursAgo(2);
    setOccurredAt(localValue(twoHoursAgo));
    submit();

    await waitFor(() =>
      expect(doCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          roomId: 2,
          occurredAt: twoHoursAgo.toISOString(),
        }),
      ),
    );
  });

  it('발생 시각이 미래거나 30일보다 오래되면 문구를 보이고 제출을 잠그며, 입력에 힌트·오류가 연결된다', () => {
    render(<InquiryForm />);
    chooseCategory('시설·키오스크 고장');
    typeContent('에어컨');
    pickRoom('306');
    const input = screen.getByLabelText(/언제 그랬나요/);
    expect(screen.getByRole('button', { name: '제출하기' })).toBeEnabled();
    expect(input).toHaveAccessibleDescription(OCCURRED_AT_HINT);
    expect(input).not.toBeInvalid();

    setOccurredAt(localValue(new Date(Date.now() + 60 * 60 * 1000)));
    expect(screen.getByRole('alert')).toHaveTextContent(FUTURE_MESSAGE);
    expect(screen.getByRole('button', { name: '제출하기' })).toBeDisabled();
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription(
      `${OCCURRED_AT_HINT} ${FUTURE_MESSAGE}`,
    );

    setOccurredAt(localValue(new Date(Date.now() - 31 * 24 * 60 * 60 * 1000)));
    expect(screen.getByRole('alert')).toHaveTextContent(TOO_OLD_MESSAGE);

    setOccurredAt('');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(input).not.toBeInvalid();
    expect(screen.getByRole('button', { name: '제출하기' })).toBeEnabled();
  });

  it('방 목록을 불러오는 동안은 제출이 잠기고 로딩 문구가 보인다', () => {
    mockRooms({ data: undefined, isPending: true });
    render(<InquiryForm />);
    chooseCategory('시설·키오스크 고장');
    typeContent('에어컨');

    expect(screen.getByText(ROOMS_LOADING_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '제출하기' })).toBeDisabled();
  });

  // 고장난 방에서 하는 신고가 방 목록 조회 실패로 막히면 안 된다. "다시 시도" 는 누르는 순간
  // 로딩 문구로 바뀌어 사라지므로 포커스를 방 fieldset 에 둔다.
  it('방 목록이 실패하거나 비어 있으면 안내와 다시 시도를 보이고 방 없이 제출할 수 있다', async () => {
    const refetch = jest.fn();
    mockRooms({ data: undefined, isPending: false, isError: true, refetch });
    const { unmount } = render(<InquiryForm />);
    chooseCategory('시설·키오스크 고장');
    typeContent('306 키오스크');
    expect(screen.getByText(ROOMS_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('group', { name: /어느 방인가요/ })).toHaveFocus();
    expect(screen.getByRole('button', { name: '제출하기' })).toBeEnabled();
    submit();
    await waitFor(() =>
      expect(doCreate).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: null }),
      ),
    );
    unmount();

    mockRooms({ data: [] });
    render(<InquiryForm />);
    chooseCategory('시설·키오스크 고장');
    expect(screen.getByText(ROOMS_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
  });

  // react-query v5 는 재조회가 실패해도 data 를 유지한 채 isError 만 켠다. 목록이 손에 있으면
  // 세그먼트를 그리고 방 선택을 요구한다(피커·내 문의 목록과 같은 순서).
  it('방 목록 캐시가 있으면 재조회가 실패해도 세그먼트만 보이고 방을 골라야 제출할 수 있다', () => {
    mockRooms({ isError: true });
    render(<InquiryForm />);
    chooseCategory('시설·키오스크 고장');
    typeContent('에어컨');

    expect(screen.getByRole('radio', { name: '306' })).toBeInTheDocument();
    expect(screen.queryByText(ROOMS_UNAVAILABLE_MESSAGE)).toBeNull();
    expect(screen.getByRole('button', { name: '제출하기' })).toBeDisabled();
    pickRoom('306');
    expect(screen.getByRole('button', { name: '제출하기' })).toBeEnabled();
  });

  it('서버가 방을 거절하면(CLIENT-001 roomId) 학생용 문구를 띄우고 선택을 비운 뒤 목록을 다시 읽는다', async () => {
    const refetch = jest.fn();
    mockRooms({ refetch });
    doCreate.mockRejectedValue({
      response: {
        status: 400,
        data: {
          code: 'CLIENT-001',
          errors: [{ field: 'roomId', message: '서버 원문' }],
        },
      },
    });
    render(<InquiryForm />);
    chooseCategory('시설·키오스크 고장');
    typeContent('에어컨');
    pickRoom('306');
    submit();

    await waitFor(() =>
      expect(mockOpenErrorSnackbar).toHaveBeenCalledWith(
        '선택한 방을 찾을 수 없습니다. 목록을 새로 고쳐 주세요.',
        3000,
      ),
    );
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('radio', { name: '306' })).not.toBeChecked();
    expect(screen.getByRole('button', { name: '제출하기' })).toBeDisabled();
  });
});

describe('InquiryForm 기타', () => {
  it('내용만으로 제출할 수 있고 예약 영역은 접혀 있다', async () => {
    render(<InquiryForm />);
    chooseCategory('기타');
    expect(screen.queryByRole('group', { name: '관련 예약' })).toBeNull();
    expect(
      screen.getByRole('button', { name: /관련 예약 연결/ }),
    ).toHaveAttribute('aria-expanded', 'false');
    typeContent('예약 시간을 늘려 주세요');
    submit();

    await waitFor(() =>
      expect(doCreate).toHaveBeenCalledWith({
        category: 'ETC',
        content: '예약 시간을 늘려 주세요',
        reservationId: null,
        roomId: null,
        occurredAt: null,
      }),
    );
  });

  // 토글 버튼이 사라지면 포커스가 body 로 떨어진다. 펼친 뒤에도 같은 엘리먼트로 남아 있어야 한다.
  it('토글로 예약 영역을 펼쳐 예약을 고르면 reservationId 를 보내고, 토글은 같은 엘리먼트로 남아 있다', async () => {
    render(<InquiryForm />);
    chooseCategory('기타');
    typeContent('문의합니다');
    const toggle = screen.getByRole('button', { name: /관련 예약 연결/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', 'etc-reservation-area');
    expect(document.getElementById('etc-reservation-area')).not.toBeNull();
    expect(
      within(screen.getByRole('group', { name: '관련 예약' })).getByText(
        '선택',
      ),
    ).toBeInTheDocument();

    openPicker();
    pickCard(CARD_A);
    expect(toggle).toBeInTheDocument();
    submit();

    await waitFor(() =>
      expect(doCreate).toHaveBeenCalledWith(
        expect.objectContaining({ reservationId: 10 }),
      ),
    );
  });

  it('선택 해제하면 연결 없이 보내고 포커스가 예약 선택 버튼으로 간다', async () => {
    render(<InquiryForm />);
    chooseCategory('기타');
    typeContent('문의합니다');
    fireEvent.click(screen.getByRole('button', { name: /관련 예약 연결/ }));
    openPicker();
    pickCard(CARD_A);
    fireEvent.click(
      screen.getByRole('button', { name: '관련 예약 선택 해제' }),
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: '예약 선택' })).toHaveFocus(),
    );
    submit();
    await waitFor(() =>
      expect(doCreate).toHaveBeenCalledWith(
        expect.objectContaining({ reservationId: null }),
      ),
    );
  });

  // 카드가 화면에서 사라졌는데 reservationId 가 실려 나가면 학생이 보지도 지울 수도 없는 연결이 생긴다.
  it('예약을 고른 채 영역을 접으면 선택이 지워져 연결 없이 보낸다', async () => {
    render(<InquiryForm />);
    chooseCategory('기타');
    typeContent('문의합니다');
    const toggle = screen.getByRole('button', { name: /관련 예약 연결/ });
    fireEvent.click(toggle);
    openPicker();
    pickCard(CARD_A);
    expect(screen.getByText('201-A')).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('201-A')).toBeNull();
    fireEvent.click(toggle);
    expect(screen.queryByText('201-A')).toBeNull();
    expect(
      screen.getByRole('button', { name: '예약 선택' }),
    ).toBeInTheDocument();
    submit();

    await waitFor(() =>
      expect(doCreate).toHaveBeenCalledWith(
        expect.objectContaining({ reservationId: null }),
      ),
    );
  });

  it('딥링크로 예약이 확정되면 기타에서도 영역이 펼쳐진 채 카드가 보인다', () => {
    mockSearchParamsValue = new URLSearchParams(
      'category=ETC&reservationId=10',
    );
    render(<InquiryForm />);

    expect(
      screen.getByRole('button', { name: /관련 예약 연결/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('201-A')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '관련 예약 선택 해제' }),
    ).toBeInTheDocument();
  });
});

describe('InquiryForm 유형 전환', () => {
  // 화면에서 숨긴 값이 제출되면 학생이 보이지도 지울 수도 없는 연결이 생긴다.
  it('예약을 고른 뒤 시설로 바꾸면 예약이 비워지고, 방·시각을 고른 뒤 기타로 바꾸면 방·시각이 비워진다', async () => {
    render(<InquiryForm />);
    chooseCategory('기타');
    typeContent('전환 테스트');
    fireEvent.click(screen.getByRole('button', { name: /관련 예약 연결/ }));
    openPicker();
    pickCard(CARD_A);

    chooseCategory('시설·키오스크 고장');
    expect(screen.queryByText('201-A')).toBeNull();
    pickRoom('306');
    setOccurredAt(localValue(hoursAgo(1)));

    chooseCategory('기타');
    submit();
    await waitFor(() =>
      expect(doCreate).toHaveBeenCalledWith({
        category: 'ETC',
        content: '전환 테스트',
        reservationId: null,
        roomId: null,
        occurredAt: null,
      }),
    );

    chooseCategory('시설·키오스크 고장');
    expect(screen.getByRole('radio', { name: '306' })).not.toBeChecked();
    expect(screen.getByLabelText(/언제 그랬나요/)).toHaveValue('');
  });

  // 출석 안내("예약을 특정할 수 없는 출석 문제는 기타로")를 따라 기타로 바꾼 학생이 확정된 예약을
  // 못 보는 채로 그 예약이 실려 나가면 안 된다 — 펼친 채로 시작하고 해제할 수 있어야 한다.
  it('출석에서 피커로 예약을 고른 뒤 기타로 바꾸면 예약 영역이 펼쳐진 채 카드가 보이고 그대로 제출된다', async () => {
    render(<InquiryForm />);
    chooseCategory('출석·예약 이의');
    typeContent('전환 테스트');
    openPicker();
    pickCard(CARD_A);
    expect(screen.getByText('201-A')).toBeInTheDocument();

    chooseCategory('기타');
    expect(
      screen.getByRole('button', { name: /관련 예약 연결/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('201-A')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '관련 예약 선택 해제' }),
    ).toBeInTheDocument();
    submit();

    await waitFor(() =>
      expect(doCreate).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'ETC', reservationId: 10 }),
      ),
    );
  });
});

describe('InquiryForm 제출 공통', () => {
  it('요청이 진행 중이면 제출 버튼이 비활성 상태다', () => {
    useCreateInquiry.mockReturnValue({
      mutateAsync: doCreate,
      isPending: true,
    });
    render(<InquiryForm />);
    chooseCategory('기타');
    typeContent('문의합니다');

    expect(screen.getByRole('button', { name: '제출하기' })).toBeDisabled();
  });

  it('제출 버튼을 두 번 눌러도 요청은 한 번만 보낸다', async () => {
    let resolveCreate;
    doCreate.mockReturnValue(
      new Promise(resolve => {
        resolveCreate = resolve;
      }),
    );
    render(<InquiryForm />);
    chooseCategory('기타');
    typeContent('문의합니다');

    await doubleTap(screen.getByRole('button', { name: '제출하기' }));
    expect(doCreate).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolveCreate({});
    });
  });

  it('내용의 앞뒤 공백을 지워 보낸다', async () => {
    render(<InquiryForm />);
    chooseCategory('기타');
    typeContent('  냉방이 안 돼요  ');
    submit();

    await waitFor(() =>
      expect(doCreate).toHaveBeenCalledWith(
        expect.objectContaining({ content: '냉방이 안 돼요' }),
      ),
    );
  });

  it('세션 만료 오류는 스낵바 없이 조용히 처리한다', async () => {
    doCreate.mockRejectedValue({
      sessionExpired: true,
      response: { status: 401, data: { code: 'AUTH-013' } },
    });
    render(<InquiryForm />);
    chooseCategory('기타');
    typeContent('문의');
    submit();

    await waitFor(() => expect(doCreate).toHaveBeenCalledTimes(1));
    expect(mockOpenErrorSnackbar).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith('/inquiry');
  });

  it('모든 label 의 htmlFor 가 실제 요소를 가리킨다', () => {
    const { container } = render(<InquiryForm />);
    chooseCategory('시설·키오스크 고장');
    const labels = container.querySelectorAll('label[for]');

    expect(labels.length).toBeGreaterThan(0);
    labels.forEach(label => {
      expect(
        container.querySelector(`#${label.getAttribute('for')}`),
      ).not.toBeNull();
    });
  });
});

describe('InquiryForm 수정 모드', () => {
  it('문의를 불러오는 동안은 로딩 문구만 보이고 라디오 카드가 없다', () => {
    mockParamsValue = { id: '9' };
    useMyInquiries.mockReturnValue({ data: undefined, isPending: true });
    render(<InquiryForm />);

    expect(screen.getByText(EDIT_LOADING_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('시설 문의는 유형·내용·방·발생 시각(로컬)을 채우고, 저장하면 시설 필드를 통째로 보낸다', async () => {
    const occurredAt = hoursAgo(24);
    mockEdit(
      editInquiry({
        inquiryId: 7,
        category: 'FACILITY',
        content: '냉방이 안 됩니다',
        reservationId: null,
        reservationSummary: null,
        roomId: 2,
        roomName: '428',
        occurredAt: occurredAt.toISOString(),
      }),
    );
    render(<InquiryForm />);

    expect(
      screen.getByRole('radio', { name: /시설·키오스크 고장/ }),
    ).toBeChecked();
    expect(screen.getByLabelText('문의 내용')).toHaveValue('냉방이 안 됩니다');
    expect(screen.getByRole('radio', { name: '428' })).toBeChecked();
    expect(screen.getByLabelText(/언제 그랬나요/)).toHaveValue(
      localValue(occurredAt),
    );
    expect(screen.getByRole('button', { name: '수정하기' })).toBeEnabled();

    pickRoom('306');
    setOccurredAt('');
    submit();

    await waitFor(() =>
      expect(doUpdate).toHaveBeenCalledWith({
        inquiryId: 7,
        category: 'FACILITY',
        content: '냉방이 안 됩니다',
        reservationId: null,
        roomId: 1,
        occurredAt: null,
      }),
    );
    expect(mockOpenSuccessSnackbar).toHaveBeenCalledWith(
      '문의를 수정했습니다.',
      3000,
    );
    expect(mockNavigate).toHaveBeenCalledWith('/inquiry');
  });

  it('시설 문의 수정에서 방 목록이 실패하면 기존 roomId 를 그대로 보낸다', async () => {
    mockRooms({ data: undefined, isPending: false, isError: true });
    mockEdit(
      editInquiry({
        inquiryId: 7,
        category: 'FACILITY',
        content: '냉방',
        reservationId: null,
        reservationSummary: null,
        roomId: 2,
        roomName: '428',
      }),
    );
    render(<InquiryForm />);

    expect(screen.getByText(ROOMS_UNAVAILABLE_MESSAGE)).toBeInTheDocument();
    submit();
    await waitFor(() =>
      expect(doUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: 2 }),
      ),
    );
  });

  it('시설 문의를 기타로 바꿔 저장하면 방·발생 시각이 null 로 나간다', async () => {
    mockEdit(
      editInquiry({
        inquiryId: 7,
        category: 'FACILITY',
        content: '냉방',
        reservationId: null,
        reservationSummary: null,
        roomId: 2,
        roomName: '428',
        occurredAt: hoursAgo(1).toISOString(),
      }),
    );
    render(<InquiryForm />);
    chooseCategory('기타');
    submit();

    await waitFor(() =>
      expect(doUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'ETC',
          roomId: null,
          occurredAt: null,
          reservationId: null,
        }),
      ),
    );
  });

  // 포커스 재조회로 같은 문의의 새 객체가 오면(관리자 답변 등) 참조가 바뀐다. 그때마다 서버 값으로
  // 다시 채우면 고치던 내용이 사라진다.
  it('수정 중에 목록이 재조회돼 같은 문의의 새 객체가 와도 입력이 유지된다', () => {
    const base = {
      inquiryId: 7,
      category: 'ETC',
      content: '원문',
      reservationId: null,
      reservationSummary: null,
    };
    mockEdit(editInquiry(base));
    const { rerender } = render(<InquiryForm />);
    typeContent('고친 내용');

    useMyInquiries.mockReturnValue({
      data: [editInquiry({ ...base, adminMemo: '관리자 답변' })],
      isPending: false,
    });
    rerender(<InquiryForm />);

    expect(screen.getByLabelText('문의 내용')).toHaveValue('고친 내용');
  });

  it('예약이 연결된 출석 문의는 스냅샷과 안내를 보여주고, 바꾸지 않으면 reservationId 를 null 로 보낸다', async () => {
    mockEdit(editInquiry());
    render(<InquiryForm />);

    expect(
      screen.getByText('2026-08-05 10:00~11:00 201-A'),
    ).toBeInTheDocument();
    expect(screen.getByText(LINKED_RESERVATION_HINT)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '예약 선택' })).toBeNull();
    expect(
      screen.getByRole('button', { name: '다른 예약으로 변경' }),
    ).toBeInTheDocument();
    submit();

    await waitFor(() =>
      expect(doUpdate).toHaveBeenCalledWith({
        inquiryId: 9,
        category: 'ATTENDANCE',
        content: '출석이 안 잡혔어요',
        reservationId: null,
        roomId: null,
        occurredAt: null,
      }),
    );
  });

  it('다른 예약으로 변경에서 고르지 않고 닫으면 아무것도 바뀌지 않고, 고르면 그 예약으로 보내며 되돌리기로 복귀한다', async () => {
    mockEdit(editInquiry());
    render(<InquiryForm />);
    fireEvent.click(screen.getByRole('button', { name: '다른 예약으로 변경' }));
    expect(pickedCardInDialog()[0]).toHaveAccessibleName(CARD_A);
    closePicker();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByText('2026-08-05 10:00~11:00 201-A'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다른 예약으로 변경' }));
    pickCard(CARD_B);
    expect(screen.getByText('302-B')).toBeInTheDocument();
    submit();
    await waitFor(() =>
      expect(doUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ reservationId: 20 }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: '관련 예약 되돌리기' }));
    expect(
      screen.getByText('2026-08-05 10:00~11:00 201-A'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: '다른 예약으로 변경' }),
      ).toHaveFocus(),
    );
  });

  // 목록 카드는 그 예약을 보여준다. 수정 화면이 접어 숨기면 학생은 연결을 바꿀 수 있다는 걸 모른다.
  it('예약이 연결된 기타 문의는 예약 영역이 펼쳐진 채로 열리고, 시설을 거쳐 돌아와도 다시 펼쳐진다', () => {
    mockEdit(editInquiry({ category: 'ETC' }));
    render(<InquiryForm />);

    expect(
      screen.getByRole('button', { name: /관련 예약 연결/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText('2026-08-05 10:00~11:00 201-A'),
    ).toBeInTheDocument();
    expect(screen.getByText(LINKED_RESERVATION_HINT)).toBeInTheDocument();

    chooseCategory('시설·키오스크 고장');
    chooseCategory('기타');
    expect(
      screen.getByRole('button', { name: /관련 예약 연결/ }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByText('2026-08-05 10:00~11:00 201-A'),
    ).toBeInTheDocument();
  });

  it('스냅샷 없이 예약만 연결된 문의도 빈 상자로 보이지 않는다', () => {
    mockEdit(editInquiry({ reservationId: 10, reservationSummary: null }));
    render(<InquiryForm />);

    expect(screen.getByText('연결된 예약')).toBeInTheDocument();
  });

  it('취소된 예약만 남은 문의도 출석 유형으로 수정할 수 있다', async () => {
    mockEdit(editInquiry({ reservationId: null }));
    render(<InquiryForm />);

    expect(
      screen.getByText('2026-08-05 10:00~11:00 201-A · 취소된 예약'),
    ).toBeInTheDocument();
    submit();
    await waitFor(() =>
      expect(doUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'ATTENDANCE',
          reservationId: null,
        }),
      ),
    );
  });

  it('수정 대상 문의가 캐시에 없으면 목록으로 돌아간다', () => {
    mockParamsValue = { id: '999' };
    useMyInquiries.mockReturnValue({ data: [], isPending: false });
    render(<InquiryForm />);

    expect(mockNavigate).toHaveBeenCalledWith('/inquiry');
  });

  it('처리 완료된 문의를 수정하려 하면 문구를 보여주고 목록으로 돌려보낸다', async () => {
    mockEdit(
      editInquiry({
        inquiryId: 3,
        category: 'ETC',
        content: '내용',
        reservationId: null,
        reservationSummary: null,
      }),
    );
    doUpdate.mockRejectedValue({
      response: {
        status: 400,
        data: { code: 'INQUIRY-003', message: '서버 원문' },
      },
    });
    render(<InquiryForm />);
    submit();

    await waitFor(() =>
      expect(mockOpenErrorSnackbar).toHaveBeenCalledWith(
        '처리 완료된 문의는 수정하거나 삭제할 수 없습니다.',
        3000,
      ),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/inquiry');
  });
});
