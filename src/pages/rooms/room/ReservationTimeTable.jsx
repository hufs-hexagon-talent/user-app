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

// 스티키 호실명 열의 폭. 좌측 페이드 위치도 이 값 하나로 맞춰서
// MUI(sx)와 Tailwind가 서로 다른 브레이크포인트에서 어긋나지 않게 한다.
const STICKY_COL_WIDTH = { xs: 52, md: 100 };

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
          // 페이드는 이 wrapper 를 기준으로 절대 위치를 잡는다. marginLeft/width 를
          // TableContainer 에 두면 표시되는 표의 실제 가장자리와 페이드 기준점이 어긋난다.
          // width 를 지정하지 않고 좌우 margin 만 준다. calc(100% - N) 과 marginLeft: N 을
          // 함께 쓰면 왼쪽 N + 폭(100%-N) 이 100% 가 되어 오른쪽 여백이 0 이 됐다.
          marginX: TABLE_GUTTER_SX,
        }}>
        <TableContainer
          ref={containerRef}
          onScroll={handleScroll}
          sx={{
            overflowX: 'auto',
            marginTop: '20px',
          }}>
          <Table>
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
                    align="center"
                    sx={{
                      border: 'none',
                      padding: { xs: '6px 0', md: '10px 0' },
                      width: { xs: 44, md: 52 },
                      minWidth: { xs: 44, md: 52 },
                      fontSize: { xs: '10.5px', md: '12px' },
                      color: '#555',
                      whiteSpace: 'nowrap',
                    }}>
                    {time}
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
                      border: '1px solid #ccc',
                      whiteSpace: 'nowrap',
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      backgroundColor: '#fff',
                      fontSize: { xs: '11.5px', md: '14px' },
                      width: STICKY_COL_WIDTH,
                      minWidth: STICKY_COL_WIDTH,
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
                          border: '1px solid #ccc',
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
        {edges.left && (
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: STICKY_COL_WIDTH,
              width: 24,
              pointerEvents: 'none',
              background: 'linear-gradient(to left, transparent, #fff)',
            }}
          />
        )}
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
