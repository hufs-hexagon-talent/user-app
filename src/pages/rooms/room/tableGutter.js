// 표와 범례는 좌우 여백이 같아야 한다. 표는 MUI sx, 범례는 Tailwind class 라
// 표현이 달라 값이 따로 놀기 쉽다(실제로 범례 16px / 표 60px 로 44px 어긋나 있었다).
//
// 값뿐 아니라 "몇 px 부터 바뀌는지"도 맞아야 한다. MUI 기본 md 는 900px 인데
// Tailwind 기본 md 는 768px 라, 양쪽 다 md 를 쓰면 768~899px 에서 범례만 먼저
// 24px 로 넘어가 12px 어긋난다.
//
// 기준은 900px(MUI md)로 잡는다. ReservationTimeTable.jsx 가 칸 폭·높이·폰트·패딩·
// 스티키 열 폭 등 11군데에서 MUI {xs, md} 를 쓰므로 표 전체가 900px 에서 한꺼번에
// 바뀐다. 범례는 그 표 바로 아래에 붙으므로 표를 따라가야 한다.

// 좌우 여백의 실제 픽셀 값.
export const GUTTER_PX = { xs: 12, md: 24 };

// 여백이 바뀌는 화면 폭. MUI 기본 md 와 같아야 한다(tableGutter.test.jsx 가 검증).
export const GUTTER_BREAKPOINT_PX = 900;

// 표 wrapper 가 쓰는 MUI sx 값. 키 'md' 가 곧 900px 이다.
export const TABLE_GUTTER_SX = {
  xs: `${GUTTER_PX.xs}px`,
  md: `${GUTTER_PX.md}px`,
};

// 범례가 쓰는 Tailwind 클래스. 눈금: px-3 = 12px, px-6 = 24px.
// md: 는 768px 라 쓸 수 없다 — 표와 같은 900px 로 맞추려고 임의 변형을 쓴다.
// Tailwind 는 정적 스캔으로 클래스를 찾으므로 이 리터럴이 있어야 CSS 가 생성된다.
// TimeTableLegend.jsx 는 이 상수를 참조만 하고 px-3/min-[900px]:px-6 텍스트가 없다 —
// 상수를 다른 파일로 옮기거나 tailwind.config.js content 글롭에서 .js 를 빼면
// 에러 없이 조용히 깨진다.
export const LEGEND_GUTTER_CLASS = 'px-3 min-[900px]:px-6';

// 위 클래스가 실제로 몇 px 인지. 테스트가 GUTTER_PX 와 대조한다.
export const TAILWIND_PX = { 'px-3': 12, 'px-6': 24 };
