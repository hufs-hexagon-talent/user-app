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

import { dateChipLabel, monthDayLabel } from './dateLabel';
import { MINUTES_PER_DAY } from './operationWindow';
import { SLOT_LABEL, SLOT_PALETTE } from './slotPalette';
import { getSlotState, initialScrollIndex } from './slotState';
import { TABLE_GUTTER_SX } from './tableGutter';
import useTimeTableScroll from './useTimeTableScroll';

const STICKY_COL_WIDTH = { xs: 52, md: 100 };
const GRID_BORDER = '1px solid #B6B4B0';
const HALF_HOUR_BORDER = '1px solid #D6D3CF';
// 익일 꼬리가 붙은 날, 23:30 칸과 다음 날 00:00 칸 사이의 자정선
const MIDNIGHT_BORDER = '2px solid #002D56';

// 칸 오른쪽 경계. 정시는 실선, 30분은 옅은 선이다. 오른쪽 경계의 시각으로 구분해야 09:30 시작도 맞는다.
// 표의 마지막 경계는 종료 시각에 관계없이 실선으로 닫는다.
const cellBorderRight = (slot, isLast, hasNextDay) => {
  if (hasNextDay && slot.endMinute === MINUTES_PER_DAY) return MIDNIGHT_BORDER;
  return slot.endMinute % 60 === 0 || isLast ? GRID_BORDER : HALF_HOUR_BORDER;
};

// slots: operationWindow.buildSlots 가 만든 칸 목록. 칸마다 분·절대 시각·라벨을 갖고 있어
// 여기서 시각 문자열을 날짜와 붙여 다시 읽지 않는다. 익일 꼬리 칸(nextDay)은 접근 이름에 날짜를 넣는다.
const ReservationTimeTable = ({
  rooms,
  slots,
  selectedDate,
  now,
  selection,
  onCellClick,
}) => {
  // 첫 위치는 날짜·첫 칸 분·칸 수가 바뀔 때만 다시 잡는다. now 가 30초마다 바뀌어도 스크롤이
  // 되돌아가지 않게 한다. 날짜만 키로 쓰면 시작 시각이 다른 날로 옮길 때 이전 날의 칸 목록으로
  // 계산한 위치가 그대로 남는다.
  const scrollKey = `${selectedDate}|${slots[0]?.startMinute ?? ''}|${slots.length}`;
  const initialIndexRef = useRef(null);
  if (
    initialIndexRef.current === null ||
    initialIndexRef.current.key !== scrollKey
  ) {
    initialIndexRef.current = {
      key: scrollKey,
      index: initialScrollIndex({ slots, now, selectedDate }),
    };
  }

  const hasNextDay = slots.some(slot => slot.nextDay);

  const { containerRef, edges, handleScroll } = useTimeTableScroll({
    scrollToIndex: initialIndexRef.current?.index ?? 0,
    resetKey: scrollKey,
    // 빈 표에서 실제 열이 채워지는 순간(예: scrollToIndex 가 0 그대로인 날짜)에도
    // 가장자리 표시를 다시 재게 하려고 렌더된 열 수를 함께 넘긴다.
    columnCount: slots.length,
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
                    // 처음에는 시작 시각이 경계 중앙에 온전히 보이게 한다.
                    // 가로로 넘기면 고정 호실 열 뒤로 들어온 시간 라벨을 가린다.
                    backgroundColor: edges.left ? '#fff' : 'transparent',
                    border: 'none',
                    padding: 0,
                    width: STICKY_COL_WIDTH,
                    minWidth: STICKY_COL_WIDTH,
                  }}
                />
                {slots.map((slot, timeIndex) => (
                  <TableCell
                    key={timeIndex}
                    data-time-index={timeIndex}
                    component="th"
                    scope="col"
                    align="left"
                    aria-label={
                      slot.nextDay
                        ? `${monthDayLabel(slot.startAt)} ${slot.label}~${slot.endLabel}`
                        : `${slot.label}~${slot.endLabel}`
                    }
                    sx={{
                      border: 'none',
                      position: 'relative',
                      padding: { xs: '6px 0 8px', md: '10px 0' },
                      width: { xs: 44, md: 52 },
                      minWidth: { xs: 44, md: 52 },
                      fontSize: { xs: '10.5px', md: '12px' },
                      color: '#555',
                      whiteSpace: 'nowrap',
                      fontVariantNumeric: 'tabular-nums',
                      // 날짜 칩이 있는 날에도 시각 라벨이 한 줄에 맞도록 아래에 붙인다
                      verticalAlign: 'bottom',
                    }}>
                    {slot.startMinute === MINUTES_PER_DAY && (
                      <Box
                        component="span"
                        aria-hidden
                        sx={{
                          display: 'table',
                          position: 'relative',
                          left: '-0.5px',
                          transform: 'translateX(-50%)',
                          marginBottom: '3px',
                          padding: '2px 6px',
                          borderRadius: '999px',
                          backgroundColor: '#002D56',
                          color: '#fff',
                          fontSize: { xs: '10px', md: '11px' },
                          fontWeight: 700,
                          lineHeight: 1.2,
                        }}>
                        {dateChipLabel(slot.startAt)}
                      </Box>
                    )}
                    {(slot.startMinute % 60 === 0 || timeIndex === 0) && (
                      <Box
                        component="span"
                        sx={{
                          display: 'inline-block',
                          position: 'relative',
                          // 시간은 칸 중앙이 아니라 시작 경계 위에 놓는다.
                          left: '-0.5px',
                          transform: 'translateX(-50%)',
                        }}>
                        {slot.label}
                      </Box>
                    )}
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
                  {slots.map((slot, timeIndex) => {
                    const state = getSlotState({
                      slotStart: slot.startAt,
                      slotMinute: slot.startMinute,
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
                        aria-label={`${room.roomName}-${room.partitionNumber} ${slot.nextDay ? `${monthDayLabel(slot.startAt)} ` : ''}${slot.label} ${SLOT_LABEL[state.status] ?? state.status}`}
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
                          height: { xs: 56, md: 53 },
                          opacity: state.outOfExtendRange ? 0.4 : 1,
                          backgroundColor: palette.background,
                          backgroundImage: palette.pattern ?? 'none',
                          border: 'none',
                          borderRight: cellBorderRight(
                            slot,
                            timeIndex === slots.length - 1,
                            hasNextDay,
                          ),
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
