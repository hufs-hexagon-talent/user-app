import { format } from 'date-fns';

// 서버(OccurredAtRule)와 같은 범위: 미래(시계 오차 5분 허용)·30일 초과는 거절. 화면은 두 방향을 따로 말한다.
export const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const FUTURE_MESSAGE = '발생 시각은 미래일 수 없습니다.';
export const TOO_OLD_MESSAGE = '발생 시각은 최근 30일 안이어야 합니다.';
export const INVALID_MESSAGE = '발생 시각을 다시 확인해 주세요.';

// datetime-local 의 값('yyyy-MM-ddTHH:mm', 로컬 벽시계)을 검사한다. 빈 값은 "지정 안 함".
export const occurredAtProblem = (value, now = new Date()) => {
  if (!value) return null;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return INVALID_MESSAGE;
  if (at.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) return FUTURE_MESSAGE;
  if (at.getTime() < now.getTime() - MAX_AGE_MS) return TOO_OLD_MESSAGE;
  return null;
};

// 서버는 ISO(UTC) Instant 를 받는다.
export const toInstant = value =>
  value ? new Date(value).toISOString() : null;

// 서버 값(UTC ISO) → datetime-local 초기값(로컬). UTC 문자열을 그대로 자르면 9시간 어긋난다.
export const toDateTimeLocal = iso =>
  iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : '';
