import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';

import { useMyInfo } from '../../api/user.api';
import {
  useLatestReservation,
  useUserReservation,
} from '../../api/reservation.api';

import MyPage from './MyPage';

jest.mock('../../api/user.api', () => ({
  useMyInfo: jest.fn(),
}));
jest.mock('../../api/reservation.api', () => ({
  useLatestReservation: jest.fn(),
  useUserReservation: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

beforeEach(() => {
  jest.clearAllMocks();
  useMyInfo.mockReturnValue({
    data: { name: '홍길동', serial: '202512345', email: 'a@hufs.ac.kr' },
  });
  useLatestReservation.mockReturnValue({ data: [] });
  useUserReservation.mockReturnValue({
    data: [],
    isPending: false,
    isError: false,
    refetch: jest.fn(),
  });
});

describe('MyPage 문의 섹션', () => {
  it('문의하기를 누르면 접수 화면으로 바로 간다', () => {
    render(<MyPage />);

    fireEvent.click(screen.getByRole('button', { name: '문의하기' }));

    expect(mockNavigate).toHaveBeenCalledWith('/inquiry/new');
  });

  // Notion 폼을 새 창으로 열던 자리를 인앱 화면 이동으로 바꿨다. window.open 이 다시 호출되면 회귀다.
  it('내 문의를 누르면 목록으로 가고 창을 새로 열지 않는다', () => {
    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => {});
    render(<MyPage />);

    fireEvent.click(screen.getByRole('button', { name: '내 문의' }));

    expect(mockNavigate).toHaveBeenCalledWith('/inquiry');
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  // 섹션 하나에 항목 하나("문의 및 건의 › 1:1 문의")가 껍데기였다. 섹션 "문의" 아래 두 항목.
  it('섹션 제목은 문의이고 1:1 문의·문의 및 건의는 없다', () => {
    render(<MyPage />);

    expect(screen.getByText('문의')).toBeInTheDocument();
    expect(screen.queryByText(/1:1/)).toBeNull();
    expect(screen.queryByText('문의 및 건의')).toBeNull();
  });

  it('내 예약 관리 항목도 버튼이고 각 화면으로 간다', () => {
    render(<MyPage />);

    fireEvent.click(screen.getByRole('button', { name: '내 QR코드' }));
    expect(mockNavigate).toHaveBeenCalledWith('/otp');
    fireEvent.click(screen.getByRole('button', { name: '내 예약 조회' }));
    expect(mockNavigate).toHaveBeenCalledWith('/check');
  });

  it('정정 요청·의견 보내기 같은 Notion 항목은 더 이상 없다', () => {
    render(<MyPage />);

    expect(screen.queryByText('정정 요청')).toBeNull();
    expect(screen.queryByText('의견 보내기')).toBeNull();
  });
});

// 상단 네비게이션의 "이용 규칙" 탭을 이 메뉴로 내렸다. 로그인한 학생에게는
// 여기가 주 경로다(푸터 링크는 마이페이지가 없는 계정을 위한 보조 경로다).
describe('MyPage 이용 안내', () => {
  it('이용 규칙을 누르면 규칙 화면으로 이동한다', () => {
    render(<MyPage />);

    fireEvent.click(screen.getByText('이용 규칙'));

    expect(mockNavigate).toHaveBeenCalledWith('/notice');
  });

  it('이용 안내 섹션 제목이 보인다', () => {
    render(<MyPage />);

    expect(screen.getByText('이용 안내')).toBeInTheDocument();
  });
});

const attendedReservation = {
  reservationId: 1,
  reservationState: 'VISITED',
  reservationStartTime: '2026-09-09T10:00:00+09:00',
  reservationEndTime: '2026-09-09T12:30:00+09:00',
};
const usageRegion = () =>
  screen.getByRole('region', { name: '세미나실 이용 기록' });

describe('MyPage 이용 기록', () => {
  it('내 정보 아래, 예약 관리 메뉴 위에서 출석한 예약의 합계를 보여준다', () => {
    useUserReservation.mockReturnValue({
      data: [
        attendedReservation,
        {
          ...attendedReservation,
          reservationId: 2,
          reservationState: 'NOT_VISITED',
        },
      ],
      isPending: false,
      isError: false,
    });
    render(<MyPage />);

    expect(usageRegion()).toHaveTextContent(/2\s*시간\s*30\s*분/);
    expect(usageRegion()).toHaveTextContent('1회');
    expect(usageRegion()).toHaveTextContent('출석한 예약 시간 기준');
    expect(screen.queryByText('이번 학기')).toBeNull();
    expect(
      screen.getByText('홍길동').compareDocumentPosition(usageRegion()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      usageRegion().compareDocumentPosition(
        screen.getByRole('button', { name: '내 QR코드' }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('첫 조회 중에는 0시간이나 첫 이용 전으로 잘못 표시하지 않는다', () => {
    useUserReservation.mockReturnValue({
      data: undefined,
      isPending: true,
      isError: false,
    });
    render(<MyPage />);
    expect(within(usageRegion()).getByRole('status')).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(usageRegion()).not.toHaveTextContent('0시간');
    expect(screen.queryByText('첫 기록을 기다리고 있어요')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '내 QR코드' }));
    expect(mockNavigate).toHaveBeenCalledWith('/otp');
  });

  it('조회 실패는 기록 없음과 구분하고 카드에서 다시 시도할 수 있다', () => {
    const refetch = jest.fn();
    useUserReservation.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      refetch,
    });
    render(<MyPage />);
    expect(screen.queryByText('첫 기록을 기다리고 있어요')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '내 예약 조회' }));
    expect(mockNavigate).toHaveBeenCalledWith('/check');
  });

  it('재조회 실패 때 기존 합계와 횟수를 유지한다', () => {
    const refetch = jest.fn();
    useUserReservation.mockReturnValue({
      data: [attendedReservation],
      isPending: false,
      isError: true,
      refetch,
    });
    render(<MyPage />);
    expect(usageRegion()).toHaveTextContent(/2\s*시간\s*30\s*분/);
    expect(usageRegion()).toHaveTextContent('1회');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('정상 조회한 출석 기록이 없을 때 첫 기록 안내를 보여준다', () => {
    render(<MyPage />);
    expect(usageRegion()).toHaveTextContent('첫 기록을 기다리고 있어요');
    expect(usageRegion()).toHaveTextContent('출석한 예약 시간 기준');
  });

  it('유효하지 않은 출석 시각은 일부 합계나 빈 기록으로 표시하지 않는다', () => {
    useUserReservation.mockReturnValue({
      data: [{ ...attendedReservation, reservationEndTime: null }],
      isPending: false,
      isError: false,
      refetch: jest.fn(),
    });
    render(<MyPage />);
    expect(screen.queryByText('첫 기록을 기다리고 있어요')).toBeNull();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeVisible();
  });
});

// 24시간 운영 작업 전에 같은 날 끝나는 현재 예약의 표기를 고정해 둔다.
describe('MyPage 현재 예약 표기', () => {
  it('같은 날 끝나는 예약은 시작 날짜·시각과 종료 시각을 적는다', () => {
    useLatestReservation.mockReturnValue({
      data: [
        {
          reservationId: 1,
          roomName: '306',
          partitionNumber: 1,
          reservationStartTime: '2026-10-20T10:00:00+09:00',
          reservationEndTime: '2026-10-20T11:00:00+09:00',
        },
      ],
    });
    render(<MyPage />);

    expect(
      screen.getByText('306-1호 / 10월 20일 10:00 ~ 11:00'),
    ).toBeInTheDocument();
  });
});

describe('MyPage 현재 예약 자정 표기', () => {
  const latest = (start, end) => ({
    data: [
      {
        reservationId: 1,
        roomName: '306',
        partitionNumber: 1,
        reservationStartTime: start,
        reservationEndTime: end,
      },
    ],
  });

  it('자정에 끝나면 24:00 으로 적는다', () => {
    useLatestReservation.mockReturnValue(
      latest('2026-10-20T23:30:00+09:00', '2026-10-21T00:00:00+09:00'),
    );
    render(<MyPage />);

    expect(
      screen.getByText('306-1호 / 10월 20일 23:30 ~ 24:00'),
    ).toBeInTheDocument();
  });

  it('다음 날에 끝나면 익일을 붙인다', () => {
    useLatestReservation.mockReturnValue(
      latest('2026-10-20T23:00:00+09:00', '2026-10-21T01:00:00+09:00'),
    );
    render(<MyPage />);

    expect(
      screen.getByText('306-1호 / 10월 20일 23:00 ~ 익일 01:00'),
    ).toBeInTheDocument();
  });
});
