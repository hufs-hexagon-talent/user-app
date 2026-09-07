import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';

import Footer from './Footer';
import { authState } from '../../hooks/authState';

// user.api 를 통째로 목킹하면 useServiceRole 이 내부에서 useMe() 를 부르지 않으므로
// QueryClientProvider 가 필요 없다. useAuth 가 useRecoilState 를 쓰므로 RecoilRoot 는
// 바깥에 있어야 하고, 이동은 useNavigate 호출로 확인한다.
const mockRole = jest.fn();
jest.mock('../../api/user.api', () => ({
  useServiceRole: () => ({ data: mockRole() }),
}));
jest.mock('react-simple-snackbar', () => ({
  useSnackbar: () => [jest.fn(), jest.fn()],
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const renderFooter = ({ loggedIn = false, role } = {}) => {
  mockRole.mockReturnValue(role);
  return render(
    <RecoilRoot
      initializeState={snap =>
        snap.set(authState, { isAuthenticated: loggedIn })
      }>
      <Footer />
    </RecoilRoot>,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Footer 이용 규칙 링크', () => {
  // 상단 네비에서 이용 규칙이 빠진 뒤, 로그인 화면에 있는 학생에게는 푸터가
  // 유일한 경로다. 초기 비밀번호를 확인하려는 사람이 여기서 막히면 안 된다.
  it('비로그인 방문자에게도 보이고, 누르면 이용 규칙 화면으로 이동한다', () => {
    renderFooter({ loggedIn: false });

    fireEvent.click(screen.getByRole('button', { name: '이용 규칙' }));

    expect(mockNavigate).toHaveBeenCalledWith('/notice');
  });

  // 마이페이지가 없는 RESIDENT 도 같은 이유로 포함한다. 역할로 감싸면 회귀다.
  it.each([
    ['일반 사용자', 'USER'],
    ['이용 정지된 사용자', 'BLOCKED'],
    ['관리실 계정', 'RESIDENT'],
    ['관리자', 'ADMIN'],
  ])('%s 에게도 보인다', (_label, role) => {
    renderFooter({ loggedIn: true, role });

    expect(
      screen.getByRole('button', { name: '이용 규칙' }),
    ).toBeInTheDocument();
  });

  // 키보드로 누를 수 있어야 한다. 아래 관리자 항목처럼 div + onClick 이면
  // 탭으로 닿지 않는다.
  it('버튼이라 탭으로 닿는다', () => {
    renderFooter({ loggedIn: false });

    expect(screen.getByRole('button', { name: '이용 규칙' }).tagName).toBe(
      'BUTTON',
    );
  });

  // href 로 옮기면 전체 페이지가 다시 로드되어 화면 상태가 초기화된다.
  it('href 가 아니라 라우터로 이동한다', () => {
    const { container } = renderFooter({ loggedIn: false });

    expect(container.querySelector('a[href="/notice"]')).toBeNull();
  });
});

describe('Footer 관리자 링크', () => {
  it('관리자에게만 보인다', () => {
    renderFooter({ loggedIn: true, role: 'ADMIN' });

    expect(screen.getByText('관리자')).toBeInTheDocument();
  });

  it.each([
    ['일반 사용자', { loggedIn: true, role: 'USER' }],
    ['비로그인 방문자', { loggedIn: false }],
  ])('%s 에게는 보이지 않는다', (_label, options) => {
    renderFooter(options);

    expect(screen.queryByText('관리자')).toBeNull();
  });
});
