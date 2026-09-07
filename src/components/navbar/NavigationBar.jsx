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

// 메뉴 이동은 라우터로 한다. href(전체 페이지 로드)는 화면 상태를 초기화하고
// 로그아웃 요청을 페이지 이탈로 중단시키는 원인이었다.
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
  // 나머지 탭(/otp·/mypage·/qrcheck)은 라우터에 하위 경로가 없어 정확 일치로 충분하다.
  const linkProps = to =>
    pathname === to
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
        <span className="self-center whitespace-nowrap text-xl font-semibold dark:text-white">
          컴퓨터공학부 세미나실 예약 시스템
        </span>
      </Navbar.Brand>
      <Navbar.Toggle />
      <Navbar.Collapse>
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
