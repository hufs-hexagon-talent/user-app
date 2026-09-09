import { modalTheme } from './modalTheme';

describe('modalTheme', () => {
  // 오버레이(root)는 보이는 높이(dvh)를 써야 한다. 패널이 max-h-[90dvh] 인데 오버레이가
  // 100vh(h-screen) 이면 iOS 사파리(툴바 표시)에서 긴 목록의 하단이 잘리고 끌어올릴 수도 없다.
  // content.base 의 전체 높이 유틸 금지(RoomPage.test.jsx)와는 다른 층이다 — 거기서는
  // h-dvh 가 금지어지만, 오버레이 자신의 높이에는 dvh 가 맞다.
  it('root.base 는 h-dvh 를 쓰고 h-screen 은 쓰지 않는다', () => {
    expect(modalTheme.root.base).toMatch(/\bh-dvh\b/);
    expect(modalTheme.root.base).not.toMatch(/\bh-screen\b/);
  });

  it('content.base 는 기대한 클래스만 갖는다', () => {
    expect(modalTheme.content.base.split(/\s+/).filter(Boolean).sort()).toEqual(
      ['relative', 'w-full', 'p-4', 'focus:outline-none'].sort(),
    );
  });

  // body 는 pb-0 이라 footer 없는 모달은 자기 래퍼에 하단 여백을 줘야 한다(ReservationPickerModal).
  it('body.base 의 하단 여백은 0 이다', () => {
    expect(modalTheme.body.base).toBe('flex-1 overflow-auto px-5 pb-0 pt-1');
  });
});
