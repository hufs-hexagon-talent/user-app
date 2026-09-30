import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { RecoilRoot } from 'recoil';

import Footer from './Footer';
import { authState } from '../../hooks/authState';

// 지금 Footer 는 로그인 여부도 역할도 보지 않는다. 그래도 목과 RecoilRoot 를 남겨
// 두는 이유는, 누가 다시 역할이나 로그인으로 푸터를 감쌌을 때 아래 테스트들이 그걸
// 잡아야 해서다. user.api 를 통째로 목킹하면 useServiceRole 이 내부에서 useMe() 를
// 부르지 않아 QueryClientProvider 가 필요 없다. 이동은 useNavigate 호출로 확인한다.
const mockRole = jest.fn();
jest.mock('../../api/user.api', () => ({
  useServiceRole: () => ({ data: mockRole() }),
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

  // 키보드로 누를 수 있어야 한다. div + onClick 이면 탭으로 닿지 않는다.
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

/*
 * 학생 앱에서 관리자 화면(/admin/)으로 가는 입구는 상단 네비의 ADMIN 전용
 * '관리자 화면' 링크 하나로 옮겼다(NavigationBar.test.jsx). 옛 관리자 화면(/manage)
 * 으로 가는 길은 새 관리자 화면 사이드바가 맡는다. 푸터에는 관리자 진입점을 두지
 * 않는다. 푸터는 역할을 보지 않는 영역이고(맨 위 주석), 모바일에서는 맨 아래까지
 * 내려가야 보인다.
 */
describe('Footer 관리자 링크', () => {
  it.each([
    ['관리자', { loggedIn: true, role: 'ADMIN' }],
    ['일반 사용자', { loggedIn: true, role: 'USER' }],
    ['비로그인 방문자', { loggedIn: false }],
  ])('%s 에게 관리자 진입점을 두지 않는다', (_label, options) => {
    renderFooter(options);

    expect(screen.queryByText('관리자')).toBeNull();
  });
});
