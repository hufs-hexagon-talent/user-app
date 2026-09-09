// 앱 공용 flowbite Modal 테마. 예약 확인 모달(RoomPage)과 예약 선택 모달(ReservationPickerModal)이 같이 쓴다.
// flowbite Modal 의 기본 테마(node_modules/flowbite-react/dist/esm/components/Modal/theme.mjs)에서
// 껍데기(반경·그림자·여백·구분선 제거·배경 블러)를 "타임레일" 디자인 값으로 바꾼다. 본문은 순수
// 시각 요소라 테마가 아니라 이 테마를 쓰는 쪽 JSX 로 직접 짠다.
//
// root — 오버레이(FloatingOverlay, data-testid="modal-overlay")
//   base 기본값: "fixed inset-x-0 top-0 z-50 h-screen overflow-y-auto overflow-x-hidden md:inset-0
//   md:h-full". 레이아웃 유틸은 그대로 두고 배경 그라데이션과 블러만 더한다 — 이건 오버레이
//   자신의 크기라 content.base 의 h-full 버그(아래)와는 무관하다. show.on 기본값
//   "flex bg-gray-900 bg-opacity-50 dark:bg-opacity-80" 은 배경을 root.base 의 그라데이션이
//   대신하므로 "flex" 만 남긴다(show.off "hidden" 은 Modal 이 !show 면 아예 null 을 반환해 쓰일
//   일이 없어 안 건드린다). sizes["2xl"] 기본값 "max-w-2xl" 은 d5.css 의
//   `[role="dialog"]{ max-width:26rem }` 값으로 바꾼다 — Modal 이 size prop 을 안 받으면 기본이
//   "2xl"이고, role="dialog" 는 floating-ui 의 useRole 이 content.base 래퍼(아래)에 얹는다.
//   base 의 h-screen 은 h-dvh 로 바꿨다 — 패널이 max-h-[90dvh] 인데 오버레이가 100vh 면 iOS
//   사파리(툴바 표시)에서 긴 목록의 하단이 툴바 뒤로 잘리고, 오버레이 콘텐츠가 오버레이보다
//   작아 끌어올릴 수도 없다.
//
// content.base — 기본값은 "relative h-full w-full p-4 md:h-auto" 인데, 여기서 h-full 과
//   md:h-auto 를 뺐다. dismissible 의 바깥 클릭은 floating-ui 가 document 에 리스너를 걸고
//   (@floating-ui/react 의 useDismiss) 누른 지점이 floating element 안인지로 판정하는데,
//   floating element 가 바로 이 래퍼다. h-full 이면 래퍼가 뷰포트를 다 덮어서 어두운 여백을
//   눌러도 "안쪽"으로 판정돼 모바일에서만 바깥 클릭이 안 먹었다. 래퍼를 내용 높이로 줄이면
//   해결된다. h-dvh·min-h-screen 등 다른 전체 높이 유틸로 되돌려도 같은 버그가 재발하니 손대지
//   말 것. 세로 가운데 정렬은 오버레이에 className 으로 준 flex items-center justify-center 가
//   맡고, 내용이 길 때 스크롤은 Modal.Body 의 flex-1 overflow-auto(body.base)가 전담한다 —
//   오버레이 콘텐츠는 오버레이 자신보다 항상 작아 root.base 의 overflow-y-auto 는 실제로
//   발동하지 않는다. 이 래퍼(role="dialog", tabindex="-1")는 이 테마를 쓰는 Modal 이
//   initialFocus 로 지정하는 대상이라 열릴 때 포커스를 받는다 — 여기 focus:outline-none 을 더해
//   그때 테두리가 보이지 않게 한다.
//
// content.inner 기본값: "relative flex max-h-[90dvh] flex-col rounded-lg bg-white shadow
//   dark:bg-gray-700". 여기에 26px 반경·다층 그림자·overflow-hidden·antialiased 를 입힌다.
//   dark: 변형은 없앤다 — 이 디자인은 크림/남색 고정 팔레트라 OS 다크모드를 따라가면 깨진다
//   (d5.css 에도 다크 변형이 없다). w-full 은 보험이다. 패널의 부모(content.base)에 display
//   유틸이 없어 블록 박스라 auto 폭이 이미 부모를 채우므로 지금은 없어도 결과가 같다. 다만
//   <Modal> 에 style 이나 display 계열 className 을 주면 floating-ui 의 getFloatingProps 가 그
//   props 를 이 래퍼에도 얹어 flex 컨테이너로 만들고, 그러면 패널이 내용 크기로 줄어든다.
//   예전에 모달이 좁았던 원인이 그거였다(인라인 style={{display:'flex'}}). 그 실수가 반복돼도
//   폭은 유지되게 남겨 둔다.
//
// header — 기본값: "flex items-start justify-between rounded-t border-b p-5
//   dark:border-gray-600". 구분선·둥근 모서리를 없애고(패널이 이미 overflow-hidden 이라 자기
//   반경은 필요 없다) d5.css 의 padding/gap/정렬로 바꾼다.
//   title 기본값: "text-xl font-medium text-gray-900 dark:text-white" — Modal.Header 는
//   children 을 자기 <h3> 안에 넣는다(as 기본값 h3, ModalHeader.mjs). 그 안에 heading 을 또
//   쓰면 <h3><h2>..</h2></h3> 가 되어 heading 이 두 개로 잡히므로, 문구만 넘기고 모양은 계속
//   이 테마로 준다. 여기에 d5.css 의 크기·자간·색을 더한다.
//   close.base 기본값: "ml-auto inline-flex items-center rounded-lg bg-transparent p-1.5
//   text-sm text-gray-400 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-600
//   dark:hover:text-white" — 44px 탭 영역 안에 38px 크림 원반을 넣는다(padding 3px +
//   bg-clip-content 로 배경을 padding 안쪽에만 칠한다). 아이콘 색은 #3E4A58 로 바꾼다
//   (배경 #F1EEE9 대비 7.8:1 — WCAG 1.4.11 의 비텍스트 3:1 을 넉넉히 넘는다. 기존
//   text-gray-400 은 흰 배경에서 2.54:1 로 미달이었다). focus:outline-none +
//   focus-visible: 링으로 바꿔 모달이 열리며 이 버튼에 자동으로 가는 포커스가 마우스
//   사용자에게는 파란 기본 outline 으로 보이지 않고, 키보드 사용자에게는 여전히 보이게 한다.
//   close.icon 기본값 "h-5 w-5"(20px) 는 16px 로 줄인다(d5.css `[data-close] svg`).
//
// body 기본값: "flex-1 overflow-auto p-6"(popup: "pt-0", 안 씀). header 와 짝지어 4px 로
//   좁혀 제목과 카드 사이 간격을 d5.css 대로 맞춘다.
//
// footer 기본값: "flex items-center space-x-2 rounded-b border-gray-200 p-6
//   dark:border-gray-600"(popup: "border-t"). popup prop 을 안 주면 ModalFooter.mjs 의
//   `!popup && theme.popup` 이 항상 참이라 구분선이 기본으로 늘 붙는다 — 빈 문자열로 지운다.
export const modalTheme = {
  root: {
    base: 'fixed inset-x-0 top-0 z-50 h-dvh overflow-y-auto overflow-x-hidden md:inset-0 md:h-full bg-[image:radial-gradient(135%_105%_at_50%_0%,rgba(0,45,86,0.58)_0%,rgba(7,13,20,0.78)_100%)] backdrop-blur-[10px] backdrop-saturate-[115%]',
    show: {
      on: 'flex',
    },
    sizes: {
      '2xl': 'max-w-[26rem]',
    },
  },
  content: {
    base: 'relative w-full p-4 focus:outline-none',
    inner:
      'relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-[26px] bg-white antialiased shadow-[0_0_0_1px_rgba(0,45,86,0.07),0_2px_4px_rgba(9,20,32,0.06),0_16px_32px_-14px_rgba(9,20,32,0.24),0_44px_76px_-30px_rgba(0,45,86,0.45)]',
  },
  header: {
    base: 'flex items-center justify-between gap-[10px] rounded-none border-0 pl-5 pr-4 pt-[18px] pb-1',
    title:
      'min-w-0 text-[20px] font-bold leading-[26px] tracking-[-0.022em] text-[#101B26]',
    close: {
      base: 'ml-auto inline-flex h-[44px] w-[44px] flex-none min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-[#F1EEE9] bg-clip-content p-[3px] text-[#3E4A58] transition hover:bg-[#E4DFD8] hover:text-[#002D56] active:scale-[0.94] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002D56]',
      icon: 'h-4 w-4',
    },
  },
  body: {
    base: 'flex-1 overflow-auto px-5 pb-0 pt-1',
  },
  footer: {
    base: 'flex items-center rounded-none border-0 px-5 pb-5 pt-4',
    popup: '',
  },
};
