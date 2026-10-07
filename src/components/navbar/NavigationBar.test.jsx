import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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

// 활성 탭은 현재 경로로 정해지므로 경로를 지정해 렌더할 수 있어야 한다.
// 로그인 여부와 locked(기본 비밀번호 변경 전)는 관리자 화면 링크 조건을 볼 때만 바꾼다.
const renderAt = (role, path, { loggedIn = true, locked = false } = {}) => {
  mockRole.mockReturnValue(role);
  return render(
    <RecoilRoot
      initializeState={snap =>
        snap.set(authState, { isAuthenticated: loggedIn })
      }>
      <MemoryRouter initialEntries={[path]}>
        <NavigationBar locked={locked} />
      </MemoryRouter>
    </RecoilRoot>,
  );
};

const renderAs = role => renderAt(role, '/');

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

// 관리자 화면(admin-app)은 /admin/ 아래에서 따로 도는 앱이다. 학생 앱 라우터에는 그 경로가
// 없어서 라우터로 옮기면 * 라우트가 / 로 되돌린다. 위와 같이 텍스트가 아니라 href 로 본다.
describe('NavigationBar 관리자 화면 링크', () => {
  const adminLink = container => container.querySelector('a[href="/admin/"]');

  // 옛 관리자 화면(/manage)에서도 같은 네비가 그려진다. 거기서 새 관리자 화면으로 가는 길이다.
  it.each(['/', '/manage/policy'])(
    '관리자에게는 %s 에서 /admin/ 링크가 보인다',
    path => {
      const { container } = renderAt('ADMIN', path);

      expect(adminLink(container)).toHaveTextContent('관리자 화면');
    },
  );

  // MemoryRouter 의 Link 도 href 는 똑같이 그린다. 차이는 클릭의 기본 동작을 막느냐다.
  // React 는 루트 컨테이너에서 이벤트를 처리하므로 window 리스너가 가장 나중에 본다.
  // jsdom 은 실제 페이지 이동을 못 해서 확인한 뒤 여기서 막는다.
  test('라우터 이동이 아니라 전체 페이지 이동이다', () => {
    const { container } = renderAt('ADMIN', '/');
    let prevented;
    const spy = event => {
      prevented = event.defaultPrevented;
      event.preventDefault();
    };
    window.addEventListener('click', spy);
    fireEvent.click(adminLink(container));
    window.removeEventListener('click', spy);

    expect(prevented).toBe(false);
  });

  // 위 테스트는 target=_blank 도 통과한다. 새 탭도 기본 동작을 막지 않기 때문이다.
  // 관리자 화면에서 학생 화면으로 오는 링크가 있어 오가기 쉽고, 모바일에서 탭이 쌓이지 않도록 같은 탭이다.
  // 관리자 화면의 '학생 화면' 링크(새 탭)와 맞춘다고 이 링크까지 새 탭으로 바꾸면 여기서 걸린다.
  test('새 탭이 아니라 같은 탭에서 연다', () => {
    const { container } = renderAt('ADMIN', '/');

    expect(adminLink(container)).not.toHaveAttribute('target');
  });

  it.each([
    ['일반 사용자', 'USER', {}],
    ['이용 정지된 사용자', 'BLOCKED', {}],
    ['관리실 계정', 'RESIDENT', {}],
    // 역할 조회가 끝나기 전에 그리면 잠깐 보였다 사라진다.
    ['역할을 아직 모르는 동안', undefined, {}],
    // 기본 비밀번호를 바꾸기 전에는 비밀번호 화면 밖으로 보내지 않는다.
    ['비밀번호를 바꾸기 전인 관리자', 'ADMIN', { locked: true }],
    // 역할 값이 남아 있어도 로그인 여부로 막히는지 보려고 ADMIN 을 준다.
    ['로그인하지 않은 방문자', 'ADMIN', { loggedIn: false }],
  ])('%s 에게는 /admin/ 링크가 없다', (_label, role, options) => {
    const { container } = renderAt(role, '/', options);

    expect(adminLink(container)).toBeNull();
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

  // jsdom 은 레이아웃이 없어 줄바꿈 자체는 못 잰다. 의도(좁은 폭에서만 작게)만 고정한다.
  // 실제 폭은 헤드리스 브라우저로 320~430px 에서 한 줄임을 확인했다.
  test('브랜드 제목은 sm 미만에서 16px, sm 이상에서 20px 이다', () => {
    renderAs('STUDENT');
    const title = screen.getByText('컴퓨터공학부 세미나실 예약 시스템');

    expect(title).toHaveClass('text-base');
    expect(title).toHaveClass('sm:text-xl');
    expect(title).toHaveClass('whitespace-nowrap');
  });

  // 관리자 메뉴 다섯 개는 간격 32px 이면 768~791px 에서 브랜드 옆에 못 들어가 두 줄(78px)이 되고,
  // 한 줄 58px 를 전제로 둔 토스트 위치(index.css)가 어긋난다. 여기서도 의도만 고정한다.
  // 실제 폭은 헤드리스 브라우저로 768·820·1024·1280px 에서 한 줄임을 확인했다.
  test('메뉴 간격은 md 구간에서 24px, lg 이상에서 32px 이다', () => {
    const { container } = renderAs('ADMIN');
    const list = container.querySelector('nav ul');

    expect(list).toHaveClass('md:space-x-6');
    expect(list).toHaveClass('lg:space-x-8');
    expect(list).not.toHaveClass('md:space-x-8');
    // theme.list 는 통째로 바뀐다. 기본값에 있던 가로 배치가 빠지면 데스크톱 메뉴가 세로로 선다.
    expect(list).toHaveClass('md:flex-row');
  });
});

// 이용 규칙은 마이페이지 안으로 내려갔다. 마이페이지가 없는 사람들(비로그인·관리실 계정·
// 비밀번호 변경 강제 상태)은 푸터에서 들어간다.
describe('NavigationBar 이용 규칙 링크 제거', () => {
  test('상단에 /notice 로 가는 링크가 없다', () => {
    const { container } = renderAt('USER', '/');
    expect(container.querySelector('a[href="/notice"]')).toBeNull();
  });

  test('관리실 계정 메뉴에도 /notice 로 가는 링크가 없다', () => {
    const { container } = renderAt('RESIDENT', '/qrcheck');
    expect(container.querySelector('a[href="/notice"]')).toBeNull();
  });
});

describe('NavigationBar 현재 탭 표시', () => {
  // jsdom 은 CSS 를 평가하지 않아 색으로는 확인할 수 없다. aria-current 로 본다.
  test('마이페이지에 있으면 그 링크에만 현재 위치 표시가 붙는다', () => {
    renderAt('USER', '/mypage');

    expect(screen.getByRole('link', { name: '마이페이지' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('link', { name: '세미나실 예약' }),
    ).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: '내 QR코드' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  // 세미나실 예약의 경로는 "/" 라 startsWith 로 비교하면 어느 화면에서든 활성이 된다.
  test('내 QR코드 화면에서 세미나실 예약이 활성으로 잡히지 않는다', () => {
    renderAt('USER', '/otp');

    expect(screen.getByRole('link', { name: '내 QR코드' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('link', { name: '세미나실 예약' }),
    ).not.toHaveAttribute('aria-current');
  });

  test('첫 화면에서는 세미나실 예약이 활성이다', () => {
    renderAt('USER', '/');

    expect(
      screen.getByRole('link', { name: '세미나실 예약' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  test('관리실 계정의 출석 체크도 현재 위치 표시를 받는다', () => {
    renderAt('RESIDENT', '/qrcheck');

    expect(screen.getByRole('link', { name: '출석 체크' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  // flowbite 의 active prop 은 이 프로젝트에서 색이 생성되지 않는 cyan 을 쓴다.
  // 클래스를 직접 주는지 확인해 둔다. 모바일 세로 목록은 배경, 데스크톱은 밑줄이다.
  test('활성 링크에 강조 클래스가 직접 붙는다', () => {
    renderAt('USER', '/mypage');
    const active = screen.getByRole('link', { name: '마이페이지' });

    expect(active).toHaveClass('bg-blue-50');
    expect(active).toHaveClass('md:underline');
  });
});

// 마이페이지 메뉴에서 들어가는 화면들은 상단에 자기 탭이 없다. 그 안에 있는 동안
// 네 탭이 모두 회색이면 처음 고치려던 "내가 어디 있지"가 그대로 남는다.
describe('NavigationBar 마이페이지 갈래 표시', () => {
  it.each([
    ['내 예약 조회', '/check'],
    ['1:1 문의 목록', '/inquiry'],
    ['이용 규칙', '/notice'],
    ['비밀번호 변경', '/password'],
    ['이메일 변경', '/emailSend'],
  ])('%s 화면에서 마이페이지 탭이 켜진다', (_label, path) => {
    renderAt('USER', path);

    expect(screen.getByRole('link', { name: '마이페이지' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  // 문의는 접수·수정이 하위 경로로 더 있다. 목록에서만 켜지면 폼에 들어가는 순간 꺼진다.
  it.each([['접수', '/inquiry/new'], ['수정', '/inquiry/12/edit']])(
    '문의 %s 화면에서도 켜진 채로 남는다',
    (_label, path) => {
      renderAt('USER', path);

      expect(screen.getByRole('link', { name: '마이페이지' })).toHaveAttribute(
        'aria-current',
        'page',
      );
    },
  );

  // 내 QR코드는 마이페이지 메뉴에도 있지만 상단에 자기 탭이 있다.
  // 두 탭이 동시에 켜지면 어느 쪽이 현재 위치인지 알 수 없다.
  test('내 QR코드 화면에서는 마이페이지가 아니라 자기 탭만 켜진다', () => {
    renderAt('USER', '/otp');

    expect(screen.getByRole('link', { name: '내 QR코드' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: '마이페이지' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  // 접두사만 같은 남의 경로까지 삼키면 안 된다. 지금은 없지만 라우트가 늘면 생긴다.
  test('경로 접두사만 같은 화면은 마이페이지로 치지 않는다', () => {
    renderAt('USER', '/checkin');

    expect(screen.getByRole('link', { name: '마이페이지' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  test('첫 화면에서는 마이페이지가 꺼져 있다', () => {
    renderAt('USER', '/');

    expect(screen.getByRole('link', { name: '마이페이지' })).not.toHaveAttribute(
      'aria-current',
    );
  });
});
