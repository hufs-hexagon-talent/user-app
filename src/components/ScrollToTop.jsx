import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

// 라우트가 바뀌면 새 화면을 맨 위부터 보여준다. 스크롤을 되돌리는 코드가 없어서 /check 아래쪽에서
// 문의 링크를 누르면 /inquiry/new 가 그 오프셋 그대로 열려 제목과 유형 카드가 뷰포트 위로 잘렸다.
// - 키는 pathname 만 본다. 같은 화면의 쿼리 변경(?date, ?category)에서는 튀지 않는다.
// - POP(뒤로·앞으로 가기, 첫 진입)은 건너뛰어 브라우저의 복원 시도를 방해하지 않는다. 복원을
//   보장하지는 않는다(SPA 는 복원 시점에 화면이 아직 짧아 잘리는 경우가 흔하다).
// - useLayoutEffect 라 페인트 전에 올라가 "중간에서 위로 튀는" 깜빡임이 없다.
// - RoomPage 의 useTimeTableScroll 은 표 컨테이너의 scrollLeft 만 다루므로 부딪치지 않는다.
const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  // navigationType 은 첫 PUSH 에서 POP→PUSH 로 바뀌므로 그것만으로는 "화면이 바뀌었는지" 를
  // 알 수 없다. 직전 pathname 과 비교해 실제로 다른 화면일 때만 올린다.
  const lastPathname = useRef(pathname);

  useLayoutEffect(() => {
    if (lastPathname.current === pathname) return;
    lastPathname.current = pathname;
    if (navigationType === 'POP') return;
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);

  return null;
};

export default ScrollToTop;
