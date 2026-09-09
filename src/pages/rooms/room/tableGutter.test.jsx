import React from 'react';
import { createTheme } from '@mui/material/styles';
import { render } from '@testing-library/react';

import {
  GUTTER_BREAKPOINT_PX,
  GUTTER_PX,
  LEGEND_GUTTER_CLASS,
  TABLE_GUTTER_SX,
  TAILWIND_PX,
} from './tableGutter';
import TimeTableLegend from './TimeTableLegend';

describe('표와 범례의 좌우 여백', () => {
  it('표의 sx 값이 실제 픽셀과 맞는다', () => {
    // 기대값을 리터럴로 적는다. `${GUTTER_PX.xs}px` 로 적으면 구현과 같은 식이라
    // 값을 어떻게 바꿔도 통과하는 항진 단언이 된다.
    expect(GUTTER_PX).toEqual({ xs: 12, md: 24 });
    expect(TABLE_GUTTER_SX).toEqual({ xs: '12px', md: '24px' });
  });

  it('범례 클래스가 표와 같은 여백 값을 가리킨다', () => {
    // 범례가 표와 44px 어긋나 있던 회귀를 막는다.
    const [base, upper] = LEGEND_GUTTER_CLASS.split(' ');
    expect(TAILWIND_PX[base]).toBe(GUTTER_PX.xs);
    expect(TAILWIND_PX[upper.replace(/^min-\[\d+px\]:/, '')]).toBe(
      GUTTER_PX.md,
    );
  });

  it('범례가 바뀌는 폭이 표(MUI md)와 같다', () => {
    // 이 파일의 핵심. Tailwind 기본 md 는 768px, MUI 기본 md 는 900px 라
    // 양쪽 다 md: 를 쓰면 768~899px 에서 범례만 먼저 24px 로 넘어가 12px 어긋난다.
    // 표는 MUI {xs, md} 를 11군데에서 쓰므로 범례가 표를 따라간다.
    expect(createTheme().breakpoints.values.md).toBe(GUTTER_BREAKPOINT_PX);
    expect(LEGEND_GUTTER_CLASS).toContain(`min-[${GUTTER_BREAKPOINT_PX}px]:`);
    expect(LEGEND_GUTTER_CLASS).not.toMatch(/(^|\s)md:/);
  });

  it('범례가 실제로 이 클래스를 단다', () => {
    // 상수만 맞고 컴포넌트가 안 쓰면 소용없다. 실물을 렌더해서 확인한다.
    const { container } = render(<TimeTableLegend />);

    LEGEND_GUTTER_CLASS.split(' ').forEach(className => {
      expect(container.firstChild).toHaveClass(className);
    });
  });
});
