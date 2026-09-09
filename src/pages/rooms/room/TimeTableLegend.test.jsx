import React from 'react';
import { render } from '@testing-library/react';

import TimeTableLegend from './TimeTableLegend';
import { LEGEND, LEGEND_OMITTED, SLOT_PALETTE } from './slotPalette';

describe('TimeTableLegend', () => {
  it('LEGEND 의 covers 와 LEGEND_OMITTED 를 합치면 SLOT_PALETTE 의 키와 정확히 같다', () => {
    // 상태를 새로 추가하고 범례에서 어떻게 설명할지 정하지 않으면 이 테스트가 잡는다.
    const paletteKeys = Object.keys(SLOT_PALETTE);
    const coveredKeys = LEGEND.flatMap(entry => entry.covers);
    const explainedKeys = [...coveredKeys, ...LEGEND_OMITTED];

    expect(new Set(explainedKeys)).toEqual(new Set(paletteKeys));
    expect(explainedKeys).toHaveLength(paletteKeys.length);
  });

  it('past 와 closed 는 화면에서 같은 모양이다', () => {
    // 예약 불가 빗금을 고칠 때 두 상태 중 한쪽만 바꾸면 이 테스트가 잡는다.
    expect(SLOT_PALETTE.closed).toEqual(SLOT_PALETTE.past);
  });

  it('범례 라벨 순서가 정해진 대로다', () => {
    expect(LEGEND.map(entry => entry.label)).toEqual([
      '예약 가능',
      '내 예약',
      '예약 완료',
      '예약 불가',
    ]);
  });

  it('범례 항목마다 라벨 텍스트가 한 번씩 나온다', () => {
    const { getAllByText } = render(<TimeTableLegend />);

    LEGEND.forEach(({ label }) => {
      expect(getAllByText(label)).toHaveLength(1);
    });
  });
});
