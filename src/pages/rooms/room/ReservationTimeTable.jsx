import React, { useRef } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { parse } from 'date-fns';

import { SLOT_LABEL, SLOT_PALETTE } from './slotPalette';
import { getSlotState, initialScrollIndex } from './slotState';
import { TABLE_GUTTER_SX } from './tableGutter';
import useTimeTableScroll from './useTimeTableScroll';

const STICKY_COL_WIDTH = { xs: 52, md: 100 };
const GRID_BORDER = '1px solid #B6B4B0';

const ReservationTimeTable = ({
  rooms,
  times,
  selectedDate,
  now,
  selection,
  onCellClick,
}) => {
  // 날짜가 바뀔 때만 다시 잡는다. now 가 30초마다 바뀌어도 스크롤이 되돌아가지 않게.
  const initialIndexRef = useRef(null);
  if (
    initialIndexRef.current === null ||
    initialIndexRef.current.date !== selectedDate
  ) {
    initialIndexRef.current = {
      date: selectedDate,
      index: initialScrollIndex({ times, now, selectedDate }),
    };
  }

  const { containerRef, edges, handleScroll } = useTimeTableScroll({
    scrollToIndex: initialIndexRef.current?.index ?? 0,
    resetKey: selectedDate,
    // 빈 표에서 실제 열이 채워지는 순간(예: scrollToIndex 가 0 그대로인 날짜)에도
    // 가장자리 표시를 다시 재게 하려고 렌더된 열 수를 함께 넘긴다.
    columnCount: times.length,
  });

  return (
    <>
      <Box
        sx={{
          position: 'relative',
          marginX: TABLE_GUTTER_SX,
        }}>
        <TableContainer
          ref={containerRef}
          onScroll={handleScroll}
          sx={{
            overflowX: 'auto',
            marginTop: '20px',
          }}>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <caption className="sr-only">호실별 30분 단위 예약 현황</caption>
            <TableHead sx={{ borderBottom: 'none' }}>
              <TableRow>
                <TableCell
                  data-sticky-col
                  sx={{
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                    backgroundColor: '#fff',
                    border: 'none',
                    padding: 0,
                    width: STICKY_COL_WIDTH,
                    minWidth: STICKY_COL_WIDTH,
                  }}
                />
                {times.slice(0, -1).map((time, timeIndex) => (
                  <TableCell
                    key={timeIndex}
                    data-time-index={timeIndex}
                    component="th"
                    scope="col"
                    align="left"
                    aria-label={`${time}~${times[timeIndex + 1]}`}
                    sx={{
                      border: 'none',
                      position: 'relative',
                      padding: { xs: '6px 0 8px 4px', md: '10px 0 10px 4px' },
                      width: { xs: 44, md: 52 },
                      minWidth: { xs: 44, md: 52 },
                      fontSize: { xs: '10.5px', md: '12px' },
                      color: '#555',
                      whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        // 본문 경계는 앞 셀의 오른쪽 1px 테두리다. 눈금도 같은 픽셀에 붙인다.
                        left: -1,
                        bottom: -1,
                        height: time.endsWith(':00') ? 6 : 3,
                        borderLeft: GRID_BORDER,
                      },
                    }}>
                    {time.endsWith(':00') || timeIndex === 0 ? time : null}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rooms.map((room, i) => (
                <TableRow key={i}>
                  <TableCell
                    component="th"
                    scope="row"
                    sx={{
                      px: { xs: 0.75, md: 2 },
                      py: { xs: 1, md: 2 },
                      border: 'none',
                      borderLeft: GRID_BORDER,
                      borderRight: GRID_BORDER,
                      borderBottom: GRID_BORDER,
                      borderTop: i === 0 ? GRID_BORDER : 'none',
                      whiteSpace: 'nowrap',
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      backgroundColor: '#fff',
                      fontSize: { xs: '11.5px', md: '14px' },
                      width: STICKY_COL_WIDTH,
                      minWidth: STICKY_COL_WIDTH,
                      // 스크롤 경계는 실제 고정 셀에 붙인다. 외부 페이드는 셀 폭과 어긋날 수 있다.
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        right: -4,
                        width: 4,
                        pointerEvents: 'none',
                        background: edges.left
                          ? 'linear-gradient(to right, rgba(0, 45, 86, 0.12), transparent)'
                          : 'none',
                      },
                    }}>
                    {`${room.roomName}-${room.partitionNumber}`}
                  </TableCell>
                  {times.slice(0, -1).map((time, timeIndex) => {
                    const slotStart = parse(
                      `${selectedDate} ${time}`,
                      'yyyy-MM-dd HH:mm',
                      new Date(),
                    );
                    const state = getSlotState({
                      slotStart,
                      now,
                      room,
                      selection,
                    });
                    const palette = SLOT_PALETTE[state.status];

                    return (
                      <TableCell
                        key={timeIndex}
                        data-time-index={timeIndex}
                        role="button"
                        tabIndex={state.selectable ? 0 : -1}
                        aria-disabled={!state.selectable}
                        aria-label={`${room.roomName}-${room.partitionNumber} ${time} ${SLOT_LABEL[state.status] ?? state.status}`}
                        onClick={() => onCellClick(room, timeIndex, state)}
                        onKeyDown={event => {
                          if (event.key !== 'Enter' && event.key !== ' ')
                            return;
                          event.preventDefault();
                          onCellClick(room, timeIndex, state);
                        }}
                        className={
                          state.status === 'selected' ? 'selected' : ''
                        }
                        sx={{
                          padding: 0,
                          width: { xs: 44, md: 52 },
                          minWidth: { xs: 44, md: 52 },
                          height: { xs: 48, md: 53 },
                          opacity: state.outOfExtendRange ? 0.4 : 1,
                          backgroundColor: palette.background,
                          backgroundImage: palette.pattern ?? 'none',
                          border: 'none',
                          borderRight: GRID_BORDER,
                          borderBottom: GRID_BORDER,
                          borderTop: i === 0 ? GRID_BORDER : 'none',
                          cursor: state.selectable ? 'pointer' : 'not-allowed',
                          textAlign: 'center',
                          color: '#fff',
                          fontSize: '11px',
                        }}
                      />
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {edges.right && (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              right: 0,
              width: 24,
              pointerEvents: 'none',
              background: 'linear-gradient(to right, transparent, #fff)',
            }}
          />
        )}
      </Box>
    </>
  );
};

export default React.memo(ReservationTimeTable);
