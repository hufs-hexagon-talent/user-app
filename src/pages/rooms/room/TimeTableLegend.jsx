import React from 'react';

import { LEGEND, SLOT_PALETTE } from './slotPalette';
import { LEGEND_GUTTER_CLASS } from './tableGutter';

const TimeTableLegend = () => (
  <div
    className={`flex flex-wrap items-center gap-x-3 gap-y-2 pt-6 ${LEGEND_GUTTER_CLASS}`}>
    {LEGEND.map(({ key, label }) => {
      const palette = SLOT_PALETTE[key];
      return (
        <div key={key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="flex h-4 w-4 flex-none items-center justify-center rounded-sm border border-gray-300 text-[9px] text-white"
            style={{
              backgroundColor: palette.background,
              backgroundImage: palette.pattern ?? 'none',
            }}
          />
          <span className="whitespace-nowrap text-xs text-gray-800">
            {label}
          </span>
        </div>
      );
    })}
  </div>
);

export default TimeTableLegend;
