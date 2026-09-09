import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { useMyInfo } from '../../api/user.api';
import { useLatestReservation } from '../../api/reservation.api';

import MyPage from './MyPage';

jest.mock('../../api/user.api', () => ({
  useMyInfo: jest.fn(),
}));
jest.mock('../../api/reservation.api', () => ({
  useLatestReservation: jest.fn(),
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
