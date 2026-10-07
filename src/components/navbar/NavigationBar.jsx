import React, { useState } from 'react';
import { Navbar } from 'flowbite-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Logo from '../../assets/logo/logoCes.png';
import useAuth from '../../hooks/useAuth';
import { useServiceRole } from '../../api/user.api';

// flowbite 의 active prop 은 cyan 팔레트로 색을 준다. 이 프로젝트는 tailwind.config.js 에서
// colors 를 통째로 갈아끼워 cyan 이 생성되지 않으므로 클래스만 붙고 화면은 그대로다.
// 그래서 활성 표시는 직접 지정한다.
// 모바일에서는 햄버거를 열면 세로 목록이라 글자색만으로는 눈에 띄지 않아 배경과 왼쪽 보더를
// 같이 준다. 데스크톱 가로 배치에서는 알약 배경이 어색해 밑줄로 바꾼다.
const ACTIVE_LINK_CLASS = [
  'bg-blue-50 hover:bg-blue-50 border-l-4 border-[#2F7DC4] pl-2',
  'font-semibold text-[#2F7DC4]',
  'md:bg-transparent md:border-l-0 md:pl-0',
  'md:underline md:decoration-2 md:underline-offset-8',
].join(' ');

// 마이페이지 메뉴에서 들어가는 화면들. 상단에 자기 탭이 없어서, 여기 있는 동안에는
// 네 탭이 모두 회색이라 어느 갈래에 있는지 알 수 없었다. 마이페이지 탭을 켜 둔다.
// 문의는 접수·수정 화면이 하위 경로로 더 있어 그 아래까지 포함한다.
// 내 QR코드(/otp)는 마이페이지 메뉴에도 있지만 상단에 자기 탭이 있으므로 넣지 않는다.
// 이용 규칙(/notice)은 푸터로도 들어오지만, 그 경로로 오는 비로그인·관리실 계정은
// 마이페이지 탭 자체가 비활성이라 영향이 없다.
const MYPAGE_SECTION = [
  '/check',
  '/inquiry',
  '/notice',
  '/password',
  '/emailSend',
];

// flowbite 기본 목록 클래스에서 md 구간(768~1023px)의 메뉴 간격만 32px 에서 24px 로 줄였다.
// 관리자는 메뉴가 다섯 개라 32px 이면 791px 까지 브랜드 옆에 들어가지 못하고 두 줄(78px)이 된다.
// 토스트 위치(index.css)가 데스크톱 네비를 한 줄 58px 로 보고 있다. theme.list 는 병합이 아니라
// 통째로 바뀌므로 나머지 클래스도 기본값 그대로 적는다.
const MENU_THEME = {
  list: 'mt-4 flex flex-col md:mt-0 md:flex-row md:space-x-6 md:text-sm md:font-medium lg:space-x-8',
};

// 메뉴 이동은 라우터로 한다. href(전체 페이지 로드)는 화면 상태를 초기화하고
// 로그아웃 요청을 페이지 이탈로 중단시키는 원인이었다. 예외는 관리자 화면 링크 하나다(아래 주석).
// locked: 기본 비밀번호를 바꾸기 전이라 다른 화면으로 갈 수 없는 상태.
// 눌러도 되돌아오기만 하는 링크는 비로그인과 같은 방식으로 비활성 표시한다.
const NavigationBar = ({ locked = false }) => {
  const { loggedIn, logout } = useAuth();
  const { data: serviceRole } = useServiceRole();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [loggingOut, setLoggingOut] = useState(false);

  // 정확히 일치할 때만 활성으로 본다. 세미나실 예약의 경로가 "/" 라
  // startsWith 로 비교하면 어느 화면에 있든 항상 활성이 된다.
  // 마이페이지만 예외다(MYPAGE_SECTION 주석 참고).
  const isActive = to =>
    to === '/mypage'
      ? pathname === '/mypage' ||
        MYPAGE_SECTION.some(
          section => pathname === section || pathname.startsWith(`${section}/`),
        )
      : pathname === to;

  const linkProps = to =>
    isActive(to)
      ? { className: ACTIVE_LINK_CLASS, 'aria-current': 'page' }
      : {};

  const handleLogout = async to => {
    // 응답을 기다리는 동안 다시 눌러도 요청을 또 보내지 않는다
    if (loggingOut) return;
    setLoggingOut(true);
    // 로그아웃이 끝난 뒤 이동해야 한다. 먼저 이동하면 아직 로그인 상태라
    // /login 라우트가 없어 * 라우트가 / 로 덮어쓴다.
    try {
      await logout();
    } catch (e) {
      // 화면 상태 정리는 logout 안의 finally 가 보장한다. 이동은 계속한다.
    }
    // logout 이 loggedIn 을 false 로 바꾸면 이 버튼은 사라진다.
    // 언마운트 뒤 setState 경고를 피하려고 이동 전에 되돌린다.
    setLoggingOut(false);
    navigate(to, { replace: true });
  };

  const logoutLabel = loggingOut ? '로그아웃 중...' : '로그아웃';

  return (
    // 스크롤해도 상단에 남는다. 예약 표가 세로로 길어 표를 보다가 메뉴로 가려면
    // 맨 위까지 되돌아가야 했다. z-30 은 표의 스티키 호실명 열(zIndex 3)보다 위,
    // 모바일 하단 선택 바(z-40)보다 아래다.
    <Navbar fluid rounded className="sticky top-0 z-30 border-b-2 bg-white">
      <Navbar.Brand as={locked ? 'div' : Link} to={locked ? undefined : '/'}>
        <img src={Logo} className="mr-3 h-6 sm:h-9" alt="cse logo" />
        {/* 20px 제목(약 309px) + 햄버거 40px 이 366px 미만 폭을 넘겨 햄버거가 둘째 줄로 떨어지고
            상단 바가 62→90px 로 늘었다. sm(640px) 미만에서만 16px 로 줄인다. min-w-0·truncate 는
            flex 줄바꿈 판정이 줄이기 전 폭으로 되므로 소용없고, 잘린 제목은 읽히지도 않는다. */}
        <span className="self-center whitespace-nowrap text-base font-semibold sm:text-xl dark:text-white">
          컴퓨터공학부 세미나실 예약 시스템
        </span>
      </Navbar.Brand>
      <Navbar.Toggle />
      <Navbar.Collapse theme={MENU_THEME}>
        {/* 출석 체크용 아이디라면 */}
        {loggedIn && serviceRole === 'RESIDENT' ? (
          <>
            <Navbar.Link as={Link} to="/qrcheck" {...linkProps('/qrcheck')}>
              출석 체크
            </Navbar.Link>
            <Navbar.Link
              as="button"
              disabled={loggingOut}
              onClick={() => handleLogout('/login')}>
              {logoutLabel}
            </Navbar.Link>
          </>
        ) : (
          <>
            {locked ? (
              <Navbar.Link as="span" className="text-gray-400">
                세미나실 예약
              </Navbar.Link>
            ) : (
              <Navbar.Link as={Link} to="/" {...linkProps('/')}>
                세미나실 예약
              </Navbar.Link>
            )}
            {loggedIn && !locked ? (
              <Navbar.Link as={Link} to="/otp" {...linkProps('/otp')}>
                내 QR코드
              </Navbar.Link>
            ) : (
              <Navbar.Link as="span" className="text-gray-400">
                내 QR코드
              </Navbar.Link>
            )}
            {loggedIn && !locked ? (
              <Navbar.Link as={Link} to="/mypage" {...linkProps('/mypage')}>
                마이페이지
              </Navbar.Link>
            ) : (
              <Navbar.Link as="span" className="text-gray-400">
                마이페이지
              </Navbar.Link>
            )}
            {/* 관리자 화면(admin-app)은 같은 호스트의 /admin 아래에서 따로 도는 앱이라 이 라우터로는
                갈 수 없다. 그래서 여기만 href 로 전체 페이지를 옮긴다. '/admin' 은 admin-app nginx 가
                '/admin/' 으로 301 을 보내므로 끝 슬래시를 붙여 둔다. 이 네비는 옛 관리자 화면(/manage)
                에서도 그려지므로 거기서 새 관리자 화면으로 돌아가는 길도 이 링크가 맡는다.
                새 탭이 아니라 같은 탭에서 연다. 관리자 화면에도 여기로 오는 링크가 있어 오가기 쉽고,
                모바일에서 탭이 쌓이지 않는다. 관리자 화면의 '학생 화면' 링크만 잠깐 확인하는 용도라 새 탭이다.
                역할을 아직 모르는 동안(undefined)에는 그리지 않아 잠깐 보였다 사라지는 일이 없다.
                숨기는 것은 화면 처리일 뿐이고 권한은 admin-app 과 API 가 막는다. */}
            {loggedIn && !locked && serviceRole === 'ADMIN' && (
              <Navbar.Link href="/admin/">관리자 화면</Navbar.Link>
            )}
            {loggedIn ? (
              <Navbar.Link
                as="button"
                disabled={loggingOut}
                onClick={() => handleLogout('/')}>
                {logoutLabel}
              </Navbar.Link>
            ) : (
              <Navbar.Link as={Link} to="/login">
                로그인
              </Navbar.Link>
            )}
          </>
        )}
      </Navbar.Collapse>
    </Navbar>
  );
};

export default NavigationBar;
