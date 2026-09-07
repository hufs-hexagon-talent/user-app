import React, { useState } from 'react';
import { Navbar } from 'flowbite-react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../assets/logo/logoCes.png';
import useAuth from '../../hooks/useAuth';
import { useServiceRole } from '../../api/user.api';

// 메뉴 이동은 라우터로 한다. href(전체 페이지 로드)는 화면 상태를 초기화하고
// 로그아웃 요청을 페이지 이탈로 중단시키는 원인이었다.
// locked: 기본 비밀번호를 바꾸기 전이라 다른 화면으로 갈 수 없는 상태.
// 눌러도 되돌아오기만 하는 링크는 비로그인과 같은 방식으로 비활성 표시한다.
const NavigationBar = ({ locked = false }) => {
  const { loggedIn, logout } = useAuth();
  const { data: serviceRole } = useServiceRole();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

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
            <Navbar.Link as={Link} to="/qrcheck">
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
              <Navbar.Link as={Link} to="/">
                세미나실 예약
              </Navbar.Link>
            )}
            {loggedIn && !locked ? (
              <Navbar.Link as={Link} to="/otp">
                내 QR코드
              </Navbar.Link>
            ) : (
              <Navbar.Link as="span" className="text-gray-400">
                내 QR코드
              </Navbar.Link>
            )}
            {loggedIn && !locked ? (
              <Navbar.Link as={Link} to="/mypage">
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
