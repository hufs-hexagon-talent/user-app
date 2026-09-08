import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useMyInquiries } from '../../api/inquiry.api';
import {
  useDeleteReservation,
  useLatestReservation,
  useNoShow,
  useUserReservation,
} from '../../api/reservation.api';
import { useBlockedPeriod, useMyInfo } from '../../api/user.api';

import Check from './CheckRoom';

jest.mock('../../api/reservation.api', () => ({
  useDeleteReservation: jest.fn(),
  useLatestReservation: jest.fn(),
  useNoShow: jest.fn(),
  useUserReservation: jest.fn(),
}));
jest.mock('../../api/user.api', () => ({
  useBlockedPeriod: jest.fn(),
  useMyInfo: jest.fn(),
}));
jest.mock('../../api/inquiry.api', () => ({
  useMyInquiries: jest.fn(),
}));

const mockOpenSuccessSnackbar = jest.fn();
const mockOpenErrorSnackbar = jest.fn();
jest.mock('../../components/snackbar/SnackBar', () => ({
  useCustomSnackbars: () => ({
    openSuccessSnackbar: mockOpenSuccessSnackbar,
    openErrorSnackbar: mockOpenErrorSnackbar,
  }),
}));

const loaded = data => ({
  data,
  isPending: false,
  isError: false,
  refetch: jest.fn(),
});
const pending = () => ({
  data: undefined,
  isPending: true,
  isError: false,
  refetch: jest.fn(),
});
const failed = () => ({
  data: undefined,
  isPending: false,
  isError: true,
  refetch: jest.fn(),
});

const reservation = (id, overrides = {}) => ({
  reservationId: id,
  reservationStartTime: '2099-01-01T10:00:00',
  reservationEndTime: '2099-01-01T11:00:00',
  reservationState: 'NOT_VISITED',
  roomName: '세미나실',
  partitionNumber: 1,
  ...overrides,
});

const noShowOf = (count, list = []) => ({
  noShowCount: count,
  reservationList: { reservationInfoResponses: list },
});

const openNoShowPopover = () =>
  fireEvent.click(screen.getByRole('button', { name: '내 노쇼 현황' }));

// 표의 문의 링크가 <Link> 라 라우터 컨텍스트가 필요하다.
const renderCheck = () =>
  render(
    <MemoryRouter>
      <Check />
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  useNoShow.mockReturnValue(loaded(noShowOf(1)));
  useUserReservation.mockReturnValue(loaded([]));
  useLatestReservation.mockReturnValue(loaded([]));
  useMyInfo.mockReturnValue(loaded({ name: '홍길동', serviceRole: 'USER' }));
  useDeleteReservation.mockReturnValue({
    mutateAsync: jest.fn().mockResolvedValue({}),
    isPending: false,
  });
  useBlockedPeriod.mockReturnValue(loaded(null));
  useMyInquiries.mockReturnValue(loaded([]));
});

describe('예약 목록', () => {
  test('불러오는 중에는 로딩 문구를 보여준다', () => {
    useUserReservation.mockReturnValue(pending());
    renderCheck();

    expect(screen.getByText('예약 목록을 불러오는 중입니다.')).toBeVisible();
    expect(screen.queryByText('예약 내역이 없습니다.')).toBeNull();
  });

  test('조회에 실패하면 빈 목록이 아니라 실패 문구와 다시 시도를 보여준다', () => {
    const query = failed();
    useUserReservation.mockReturnValue(query);
    renderCheck();

    expect(screen.getByText('예약 목록을 불러오지 못했습니다.')).toBeVisible();
    expect(screen.queryByText('예약 내역이 없습니다.')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(query.refetch).toHaveBeenCalledTimes(1);
  });

  // react-query v5 는 재조회가 실패해도 data 를 유지한다. 앱 복귀(refetchOnWindowFocus) 때
  // 한 번 실패했다고 받아 둔 목록을 지우면 예약 취소·문의 경로가 통째로 사라진다.
  test('재조회에 실패해도 받아 둔 목록은 남기고 위에 안내만 얹는다', () => {
    const refetch = jest.fn();
    useUserReservation.mockReturnValue({
      ...loaded([reservation(7)]),
      isError: true,
      refetch,
    });
    renderCheck();

    // 접근 이름은 다른 PR(fix/tap-targets)이 "… 예약 취소" 로 바꾼다. 어느 쪽이 먼저 들어와도 통과하게 둔다.
    expect(
      screen.getByRole('button', { name: /^삭제$|예약 취소$/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('예약 목록을 불러오지 못했습니다.'),
    ).toBeNull();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('최신 예약 목록을 못 받아왔습니다.');
    fireEvent.click(
      within(status).getByRole('button', { name: '다시 시도' }),
    );
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  test('예약이 없으면 없음 문구를 보여준다', () => {
    renderCheck();

    expect(screen.getByText('예약 내역이 없습니다.')).toBeVisible();
  });

  test('예약이 있으면 목록을 보여준다', () => {
    useUserReservation.mockReturnValue(loaded([reservation(1)]));
    renderCheck();

    expect(screen.getByText('세미나실-1')).toBeVisible();
    expect(screen.queryByText('예약 내역이 없습니다.')).toBeNull();
  });

  test('마지막 페이지의 예약이 사라지면 남은 페이지를 보여준다', () => {
    const many = Array.from({ length: 6 }, (_, index) =>
      reservation(index + 1, { partitionNumber: index + 1 }),
    );
    useUserReservation.mockReturnValue(loaded(many));
    const { rerender } = renderCheck();

    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
    expect(screen.getByText('세미나실-6')).toBeVisible();

    useUserReservation.mockReturnValue(loaded(many.slice(0, 5)));
    rerender(
      <MemoryRouter>
        <Check />
      </MemoryRouter>,
    );

    expect(screen.getByText('세미나실-1')).toBeVisible();
    expect(screen.getByRole('button', { name: 'page 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('예약 취소', () => {
  test('확인을 누르면 취소 요청을 보내고 성공 안내를 띄운다', async () => {
    const mutateAsync = jest.fn().mockResolvedValue({});
    useDeleteReservation.mockReturnValue({ mutateAsync, isPending: false });
    useUserReservation.mockReturnValue(loaded([reservation(7)]));
    renderCheck();

    fireEvent.click(screen.getByRole('button', { name: /예약 취소$/ }));
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() =>
      expect(mockOpenSuccessSnackbar).toHaveBeenCalledWith(
        '예약을 취소했습니다.',
        3000,
      ),
    );
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(mutateAsync).toHaveBeenCalledWith(7);
  });

  test('취소 실패는 서버 원문 대신 학생용 문구를 띄운다', async () => {
    const mutateAsync = jest.fn().mockRejectedValue({
      response: {
        status: 412,
        data: {
          code: 'RESERVATION-010',
          message: '이미 방문 처리된 예약은 삭제할 수 없습니다.',
        },
      },
    });
    useDeleteReservation.mockReturnValue({ mutateAsync, isPending: false });
    useUserReservation.mockReturnValue(loaded([reservation(7)]));
    renderCheck();

    fireEvent.click(screen.getByRole('button', { name: /예약 취소$/ }));
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() =>
      expect(mockOpenErrorSnackbar).toHaveBeenCalledWith(
        '이미 출석한 예약은 취소할 수 없습니다.',
        3000,
      ),
    );
  });

  test('취소 요청이 진행 중이면 확인을 다시 누를 수 없다', () => {
    const mutateAsync = jest.fn(() => new Promise(() => {}));
    useDeleteReservation.mockReturnValue({ mutateAsync, isPending: true });
    useUserReservation.mockReturnValue(loaded([reservation(7)]));
    renderCheck();

    fireEvent.click(screen.getByRole('button', { name: /예약 취소$/ }));
    const confirm = screen.getByRole('button', { name: '확인' });
    expect(confirm).toBeDisabled();

    fireEvent.click(confirm);
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});

describe('내 노쇼 현황 팝오버', () => {
  test('여는 시점에 제한 기간을 조회해 첫 열람부터 보여준다', () => {
    useBlockedPeriod.mockImplementation(({ enabled }) =>
      enabled
        ? loaded({
            data: {
              startBlockedDate: '2026-08-01',
              endBlockedDate: '2026-09-01',
            },
          })
        : pending(),
    );
    renderCheck();
    expect(useBlockedPeriod).toHaveBeenLastCalledWith({ enabled: false });

    openNoShowPopover();

    expect(useBlockedPeriod).toHaveBeenLastCalledWith({ enabled: true });
    expect(
      screen.getByText('현재 예약 제한 기간 : 2026-08-01 ~ 2026-09-01'),
    ).toBeVisible();
  });

  test('이미 제한 상태인 학생은 화면에 들어올 때 제한 기간을 미리 조회한다', () => {
    useMyInfo.mockReturnValue(
      loaded({ name: '홍길동', serviceRole: 'BLOCKED' }),
    );
    renderCheck();

    expect(useBlockedPeriod).toHaveBeenLastCalledWith({ enabled: true });
  });

  test('제한 상태가 아니면 제한 기간 줄을 보여주지 않는다', () => {
    renderCheck();
    openNoShowPopover();

    expect(screen.queryByText(/예약 제한 기간/)).toBeNull();
    expect(screen.getByText(/방문하지 않은 횟수는 1번 입니다/)).toBeVisible();
  });

  test('팝오버 안을 눌러도 닫히지 않는다', () => {
    renderCheck();
    // 팝오버가 열리면 나머지 화면은 aria-hidden 이 되므로 버튼은 열기 전에 잡아 둔다.
    const button = screen.getByRole('button', { name: '내 노쇼 현황' });
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-describedby', 'simple-popover');

    fireEvent.click(screen.getByText(/방문하지 않은 횟수는 1번 입니다/));

    expect(button).toHaveAttribute('aria-describedby', 'simple-popover');
  });

  test('노쇼 횟수를 불러오기 전에는 횟수 문구를 보여주지 않는다', () => {
    useNoShow.mockReturnValue(pending());
    renderCheck();
    openNoShowPopover();

    expect(screen.getByText('노쇼 현황을 불러오는 중입니다.')).toBeVisible();
    expect(screen.queryByText(/undefined/)).toBeNull();
  });

  test('노쇼 횟수 조회에 실패하면 실패 문구와 다시 시도를 보여준다', () => {
    const query = failed();
    useNoShow.mockReturnValue(query);
    renderCheck();
    openNoShowPopover();

    expect(screen.getByText('노쇼 현황을 불러오지 못했습니다.')).toBeVisible();
    expect(screen.queryByText(/undefined/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(query.refetch).toHaveBeenCalledTimes(1);
  });

  test('제한 기간 조회에 실패하면 그 사실을 알린다', () => {
    useBlockedPeriod.mockReturnValue(failed());
    renderCheck();
    openNoShowPopover();

    expect(
      screen.getByText('예약 제한 기간을 불러오지 못했습니다.'),
    ).toBeVisible();
  });
});

describe('출석 문의 진입점', () => {
  const past = (id, over = {}) =>
    reservation(id, {
      reservationStartTime: '2020-01-01T10:00:00',
      reservationEndTime: '2020-01-01T11:00:00',
      ...over,
    });

  test('표는 시작 시각 역순이다', () => {
    useUserReservation.mockReturnValue(
      loaded([
        past(1, { partitionNumber: 1 }),
        reservation(2, { partitionNumber: 2 }),
        past(3, {
          partitionNumber: 3,
          reservationStartTime: '2021-01-01T10:00:00',
          reservationEndTime: '2021-01-01T11:00:00',
        }),
      ]),
    );
    renderCheck();

    const cells = screen.getAllByText(/세미나실-\d/).map(el => el.textContent);
    expect(cells).toEqual(['세미나실-2', '세미나실-3', '세미나실-1']);
  });

  // 지난 미출석·처리됨은 문의, 앞으로의 예약은 삭제, 이용 중·출석은 빈칸.
  test('마지막 셀은 예약 상태에 따라 문의·삭제·빈칸이다', () => {
    const now = Date.now();
    useUserReservation.mockReturnValue(
      loaded([
        past(1),
        past(2, { reservationState: 'PROCESSED' }),
        reservation(3),
        reservation(4, {
          reservationState: 'NOT_VISITED',
          reservationStartTime: new Date(now - 10 * 60 * 1000).toISOString(),
          reservationEndTime: new Date(now + 50 * 60 * 1000).toISOString(),
        }),
        reservation(5, { reservationState: 'VISITED' }),
      ]),
    );
    renderCheck();

    const links = screen.getAllByRole('link', { name: /출석 문의하기$/ });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute(
      'href',
      expect.stringContaining(
        '/inquiry/new?category=ATTENDANCE&reservationId=',
      ),
    );
    expect(screen.getAllByRole('button', { name: /예약 취소$/ })).toHaveLength(1);
    expect(screen.getByText('이용 중')).toBeVisible();
    expect(screen.getByText('예약 예정')).toBeVisible();
    expect(screen.getByText('미출석')).toBeVisible();
    expect(screen.getByText('처리됨')).toBeVisible();
    expect(screen.getByText('출석')).toBeVisible();
  });

  test('문의 링크는 그 예약의 딥링크를 갖고 접근 이름에 시각·호실이 있다', () => {
    useUserReservation.mockReturnValue(loaded([past(7)]));
    renderCheck();

    const link = screen.getByRole('link', {
      name: '2020-01-01 10:00~11:00 세미나실-1 출석 문의하기',
    });
    expect(link).toHaveAttribute(
      'href',
      '/inquiry/new?category=ATTENDANCE&reservationId=7',
    );
    expect(link).toHaveTextContent('문의');
    expect(link).toHaveClass('min-h-[44px]');
  });

  // 앱에서 예약을 취소하는 유일한 경로다. 글자 높이(20px)만큼만 눌리던 것을 문의 링크와 같은
  // 44px 로 맞추고, 표의 여러 행이 전부 "삭제" 로 읽히지 않게 시각·호실을 접근 이름에 넣는다.
  test('삭제 버튼은 44px 탭 영역과 시각·호실이 든 접근 이름을 갖는다', () => {
    useUserReservation.mockReturnValue(loaded([reservation(7)]));
    renderCheck();

    const button = screen.getByRole('button', {
      name: /세미나실-1 예약 취소$/,
    });
    expect(button).toHaveTextContent('삭제');
    expect(button).toHaveClass('min-h-[44px]');
    expect(button).not.toHaveClass('dark:text-cyan-500');
  });

  // 같은 예약을 표와 팝오버에서 두세 번 접수하는 학생이 있었다. 이미 문의했으면 그 문의로 보낸다.
  test('이미 문의한 예약은 그 문의의 상세로 가는 문의 보기 링크가 된다', () => {
    useUserReservation.mockReturnValue(loaded([past(7), past(8)]));
    useMyInquiries.mockReturnValue(
      loaded([{ inquiryId: 42, reservationId: 7 }]),
    );
    renderCheck();

    // 표 안에서 링크 이름이 행마다 같으면 어느 예약인지 알 수 없다 — 접근 이름에 시각·호실을 넣는다.
    expect(
      screen.getByRole('link', {
        name: '2020-01-01 10:00~11:00 세미나실-1 문의 보기',
      }),
    ).toHaveAttribute('href', '/inquiry/42');
    expect(
      screen.getAllByRole('link', { name: /출석 문의하기$/ }),
    ).toHaveLength(1);
  });

  // 서버가 접수일 내림차순으로 준다. 같은 예약에 문의가 여럿이면 최근 것으로 보낸다.
  test('한 예약에 문의가 여럿이면 가장 최근 문의로 보낸다', () => {
    useUserReservation.mockReturnValue(loaded([past(7)]));
    useMyInquiries.mockReturnValue(
      loaded([
        { inquiryId: 9, reservationId: 7 },
        { inquiryId: 3, reservationId: 7 },
      ]),
    );
    renderCheck();

    expect(screen.getByRole('link', { name: /문의 보기$/ })).toHaveAttribute(
      'href',
      '/inquiry/9',
    );
  });

  // 문의 목록을 못 읽었다고 진입점을 없애면 이의를 아예 못 낸다. 중복 접수보다 그쪽이 나쁘다.
  test('문의 목록을 불러오는 중이거나 실패하면 문의 링크를 그대로 둔다', () => {
    useUserReservation.mockReturnValue(loaded([past(7)]));
    useMyInquiries.mockReturnValue(pending());
    const { unmount } = renderCheck();
    expect(
      screen.getByRole('link', { name: /출석 문의하기$/ }),
    ).toBeInTheDocument();
    unmount();

    useMyInquiries.mockReturnValue(failed());
    renderCheck();
    expect(
      screen.getByRole('link', { name: /출석 문의하기$/ }),
    ).toBeInTheDocument();
  });

  // 페이지당 5건이라, 정렬이 페이지를 나누기 전에 일어나지 않으면 첫 페이지에 옛 예약이 섞인다.
  test('정렬은 페이지를 나누기 전에 적용된다', () => {
    const older = Array.from({ length: 5 }, (_, index) =>
      past(index + 1, { partitionNumber: index + 1 }),
    );
    useUserReservation.mockReturnValue(
      loaded([...older, reservation(9, { partitionNumber: 9 })]),
    );
    renderCheck();

    expect(screen.getByText('세미나실-9')).toBeVisible();
    expect(screen.queryByText('세미나실-5')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Go to page 2' }));
    expect(screen.getByText('세미나실-5')).toBeVisible();
  });

  test('노쇼 팝오버의 행에도 문의 링크가 있다', () => {
    useNoShow.mockReturnValue(loaded(noShowOf(1, [past(9)])));
    renderCheck();
    openNoShowPopover();

    expect(
      screen.getByRole('link', {
        name: '2020-01-01 10:00~11:00 세미나실-1 출석 문의하기',
      }),
    ).toHaveAttribute(
      'href',
      '/inquiry/new?category=ATTENDANCE&reservationId=9',
    );
  });
});
