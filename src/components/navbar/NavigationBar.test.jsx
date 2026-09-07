import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RecoilRoot } from 'recoil';

import NavigationBar from './NavigationBar';
import { authState } from '../../hooks/authState';

// user.api 를 통째로 목킹하면 useServiceRole 이 내부에서 useMe() 를 부르지 않으므로
// QueryClientProvider 가 필요 없다. Link·useNavigate 때문에 라우터는 있어야 하고,
// useAuth 가 useRecoilState 를 쓰므로 RecoilRoot 가 바깥이어야 한다.
const mockRole = jest.fn();
jest.mock('../../api/user.api', () => ({
  useServiceRole: () => ({ data: mockRole() }),
}));

const renderAs = role => {
  mockRole.mockReturnValue(role);
  return render(
    <RecoilRoot
      initializeState={snap => snap.set(authState, { isAuthenticated: true })}>
      <MemoryRouter>
        <NavigationBar />
      </MemoryRouter>
    </RecoilRoot>,
  );
};

describe('NavigationBar 출석 체크 링크', () => {
  test('관리실 계정에게는 출석 체크 링크가 보인다', () => {
    renderAs('RESIDENT');
    expect(screen.getByRole('link', { name: '출석 체크' })).toHaveAttribute(
      'href',
      '/qrcheck',
    );
  });

  // 텍스트가 아니라 href 로 본다. 문구만 바꾼 링크가 되살아나도 잡아야 한다.
  test('관리자에게는 /qrcheck 로 가는 링크 자체가 없다', () => {
    const { container } = renderAs('ADMIN');
    expect(container.querySelector('a[href="/qrcheck"]')).toBeNull();
  });
});

describe('NavigationBar 고정', () => {
  test('스크롤해도 상단에 남도록 sticky 로 붙어 있다', () => {
    const { container } = renderAs('STUDENT');
    const nav = container.querySelector('nav');

    expect(nav).toHaveClass('sticky');
    expect(nav).toHaveClass('top-0');
    // z-30 은 표의 스티키 호실명 열(z-index 3)보다 위, 하단 바(z-40)보다 아래여야 한다.
    expect(nav).toHaveClass('z-30');
    // 불투명 배경이 없으면 스크롤 중 표 내용이 네비 뒤로 비친다.
    expect(nav).toHaveClass('bg-white');
  });
});

// 이용 규칙은 마이페이지 안으로 내려갔다. 마이페이지가 없는 사람들(비로그인·관리실 계정·
// 비밀번호 변경 강제 상태)은 푸터에서 들어간다.
describe('NavigationBar 이용 규칙 링크 제거', () => {
  // 문구가 아니라 href 로 본다. 문구만 바꾼 링크가 되살아나도 잡아야 한다.
  test('상단에 /notice 로 가는 링크가 없다', () => {
    const { container } = renderAs('USER');
    expect(container.querySelector('a[href="/notice"]')).toBeNull();
  });

  test('관리실 계정 메뉴에도 /notice 로 가는 링크가 없다', () => {
    const { container } = renderAs('RESIDENT');
    expect(container.querySelector('a[href="/notice"]')).toBeNull();
  });
});
