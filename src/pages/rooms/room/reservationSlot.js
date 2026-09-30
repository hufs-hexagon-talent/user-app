import { areIntervalsOverlapping } from 'date-fns';

import {
  endMinuteLabel,
  isSlotInsideWindow,
  MINUTES_PER_DAY,
  roomOperationWindow,
  slotBoundaries,
  toMinutes,
} from './operationWindow';

export { normalizeOperationTime } from './operationWindow';

// 제품 코드의 예약표는 operationWindow.buildSlots 로 칸을 만든다. 이 함수는 기존 테스트의 기대값을
// 지키려고 남긴 호환 함수이고, 칸 경계는 buildSlots 와 같은 slotBoundaries 로 센다.
// 예약 현황 표의 칸 경계 라벨을 만든다. 경계는 분 단위로 세고(operationWindow 와 같은 규칙) 라벨만 붙인다.
// 마지막 항목은 표 본문에서 렌더하지 않고 그 앞 칸의 오른쪽 경계로만 쓰인다.
// 마지막 항목을 운영 종료 시각으로 덮어쓰면 실제 칸 길이와 라벨이 어긋나므로 덮어쓰지 않는다.
// 종료 { hour: 24, minute: 0 } 은 자정이다. 마지막 칸이 23:30~24:00 이 된다.
export const createTimeTable = config => {
  const { startTime, endTime, intervalMinute } = config;
  const start = startTime.hour * 60 + startTime.minute;
  const end = Math.min(endTime.hour * 60 + endTime.minute, MINUTES_PER_DAY);
  return slotBoundaries(start, end, intervalMinute).map(endMinuteLabel);
};

// 칸 전체가 호실의 운영창 안에 있지 않으면 잠근다. 운영 시작 전 칸, 종료 시각과 같은 칸이 여기에 든다.
// slot 은 칸 시작의 분(그날 0시부터) 또는 "HH:mm" 이다. 자정 정책(endsAtMidnight)이면 23:30 칸까지 연다.
export const isOutsideOperationHours = (
  slot,
  operationStartTime,
  operationEndTime,
  endsAtMidnight = false,
) => {
  const slotMinute = toMinutes(slot);
  const range = roomOperationWindow({
    operationStartTime,
    operationEndTime,
    endsAtMidnight,
  });
  if (slotMinute === null || !range) return false;
  return !isSlotInsideWindow(slotMinute, range);
};

// [from, to) 안에 이미 잡힌 예약이 하나라도 있는지. 연장 선택이 남의 예약을 건너뛰지 못하게 한다.
export const hasReservedSlotInRange = (reservationTimeRanges, from, to) => {
  if (!from || !to || !Array.isArray(reservationTimeRanges)) return false;
  return reservationTimeRanges.some(reservation =>
    areIntervalsOverlapping(
      { start: from, end: to },
      {
        start: new Date(reservation.startDateTime),
        end: new Date(reservation.endDateTime),
      },
    ),
  );
};

// 최대 예약 시간을 학생 문구로. 90 → "1시간 30분", 60 → "1시간", 30 → "30분"
export const formatMaxMinutes = minutes => {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) return null;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest}분`;
  if (rest === 0) return `${hours}시간`;
  return `${hours}시간 ${rest}분`;
};

export const maxMinutesExceededMessage = minutes => {
  const text = formatMaxMinutes(minutes);
  return text
    ? `최대 ${text}까지 예약할 수 있습니다.`
    : '최대 예약 시간을 넘어 선택할 수 없습니다.';
};

// 서버 코드 문자열에 선행 공백이 섞인 것(" RESERVATION-006")이 있어 정리해서 비교한다.
export const normalizeErrorCode = code =>
  typeof code === 'string' ? code.trim() : null;

const RESERVE_ERROR_MESSAGES = {
  'RESERVATION-004': '미출석이 누적되어 예약이 제한되었습니다.',
  'RESERVATION-005':
    '예약 시간이 올바르지 않습니다. 시간을 다시 선택해 주세요.',
  'RESERVATION-006': '최대 예약 시간을 넘었습니다. 시간을 다시 선택해 주세요.',
  'RESERVATION-007':
    '출석하지 않은 예약이 있습니다. 해당 예약에 출석한 뒤 다시 예약해 주세요.',
  'RESERVATION-008': '하루에 예약할 수 있는 횟수를 모두 사용했습니다.',
  'RESERVATION-009':
    '선택한 시간에 이미 다른 예약이 있습니다. 시간을 다시 선택해 주세요.',
  'RESERVATION-012':
    '이미 지난 시간대는 예약할 수 없습니다. 시간을 다시 선택해 주세요.',
  'RESERVATION-013':
    '예약은 30분 단위로만 할 수 있습니다. 시간을 다시 선택해 주세요.',
  'POLICY-001':
    '선택한 날짜에는 세미나실 운영 정책이 없습니다. 다른 날짜를 선택해 주세요.',
  'POLICY-003':
    '선택한 시간은 해당 세미나실의 운영시간이 아닙니다. 다른 시간을 선택해 주세요.',
};

export const RESERVE_FAILED_MESSAGE =
  '예약에 실패했습니다. 잠시 뒤 다시 시도해 주세요.';

// 세션 만료가 아닌 인증 오류(403 권한 없음, 만료된 역할 등). 서버 원문은 쓰지 않는다.
export const RESERVE_AUTH_FAILED_MESSAGE =
  '예약할 권한이 없습니다. 다시 로그인한 뒤 시도해 주세요.';

// 예약 실패 응답의 코드를 학생용 문구로 바꾼다. 서버 원문은 쓰지 않는다.
// blockedUntil: 노쇼 차단 해제일("yyyy-MM-dd"). 있으면 문구에 넣는다.
export const getReserveErrorMessage = (code, { blockedUntil } = {}) => {
  const normalized = normalizeErrorCode(code);
  if (normalized === 'RESERVATION-004' && blockedUntil) {
    return `미출석이 누적되어 ${blockedUntil}까지 예약이 제한됩니다.`;
  }
  return RESERVE_ERROR_MESSAGES[normalized] ?? RESERVE_FAILED_MESSAGE;
};
