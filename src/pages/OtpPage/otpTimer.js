// 화면에서 QR 을 새로 받아오는 주기. 서버 OTP 유효 시간(300초)보다 훨씬 짧아서
// 재조회가 끝날 때까지 이전 QR 을 그대로 대도 출석이 된다.
export const OTP_REFRESH_INTERVAL_MS = 30000;

// 서버 OTP 유효 시간(OTPService 300초). 만료 판정은 서버 expiresAt 을 기기 시계와 비교하지
// 않고, QR 을 받은 시각(dataUpdatedAt)에 이 값을 더해 기기 시계끼리 비교한다.
export const OTP_TTL_MS = 300000;

// 서버는 만료 시각을 ISO-8601 문자열로 준다. 형식이 이상하면 null 로 두어
// 화면이 서버 만료 판정을 건너뛰게 한다.
export const parseExpiresAt = value => {
  if (value == null || value === '') return null;

  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

// 카운트다운은 마지막으로 QR 을 받은 시각(dataUpdatedAt)에서 계산한다.
// 별도 타이머를 같은 시점에 두 개 돌리면 위상이 어긋나 0 이 된 뒤에도 재조회가 늦어진다.
export const getRemainingSeconds = (
  dataUpdatedAt,
  now,
  intervalMs = OTP_REFRESH_INTERVAL_MS,
) => {
  if (!dataUpdatedAt) return 0;

  const remaining = Math.ceil((dataUpdatedAt + intervalMs - now) / 1000);
  return Math.min(Math.max(remaining, 0), intervalMs / 1000);
};

// 만료는 30초 카운트다운이 아니라 유효 시간이 다 지났을 때(재조회가 5분 내내 실패)로 판정한다.
export const isOtpExpired = (expiresAt, now) =>
  Number.isFinite(expiresAt) && now >= expiresAt;

// 화면에 무엇을 보여줄지 정한다. 이전 QR 이 유효하면(받은 뒤 300초 안) 재조회 중이든 실패했든
// 그대로 보여 준다 — 서버 유효 시간이 재조회 주기(30초)보다 훨씬 길어 그 QR 로 출석이 된다.
// 실패는 'stale' 로 구분해 화면이 "새 QR 을 못 받았다" 는 사실과 남은 시간을 함께 알린다.
// QR 을 감추는 것은 보여 줄 값이 없거나 정말 만료됐을 때뿐이다. 문 앞의 학생이 대면 출석에
// 쓸 수 있는 수단을 재조회 실패 한 번으로 잃지 않게 한다.
export const getOtpView = ({
  hasOtp,
  isPending,
  isFetching,
  isError,
  isExpired,
}) => {
  if (hasOtp && !isExpired) return isError ? 'stale' : 'ready';
  if (isPending || isFetching) return 'loading';
  if (hasOtp && isExpired) return 'expired';
  if (isError) return 'error';
  return 'expired';
};

// stale 안내에 쓰는 남은 유효 시간(분, 내림). 초 단위로 흔들리면 읽기 어렵다.
export const getRemainingValidMinutes = (dataUpdatedAt, now) =>
  Math.max(0, Math.floor((dataUpdatedAt + OTP_TTL_MS - now) / 60000));
