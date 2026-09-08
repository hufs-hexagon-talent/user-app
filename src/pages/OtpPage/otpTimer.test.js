import {
  getOtpView,
  getRemainingSeconds,
  isOtpExpired,
  OTP_REFRESH_INTERVAL_MS,
  parseExpiresAt,
} from './otpTimer';

describe('parseExpiresAt', () => {
  it('서버가 준 ISO-8601 문자열을 밀리초로 바꾼다', () => {
    expect(parseExpiresAt('2026-08-28T01:00:00Z')).toBe(
      Date.UTC(2026, 7, 28, 1, 0, 0),
    );
    expect(parseExpiresAt('2026-08-28T01:00:00.123456Z')).toBe(
      Date.UTC(2026, 7, 28, 1, 0, 0, 123),
    );
  });

  it('값이 없거나 형식이 이상하면 null 로 둔다', () => {
    expect(parseExpiresAt(undefined)).toBeNull();
    expect(parseExpiresAt(null)).toBeNull();
    expect(parseExpiresAt('')).toBeNull();
    expect(parseExpiresAt('not-a-date')).toBeNull();
  });
});

describe('getRemainingSeconds', () => {
  const receivedAt = 1_000_000;

  it('QR 을 받은 시각부터 30초를 1초 단위로 센다', () => {
    expect(getRemainingSeconds(receivedAt, receivedAt)).toBe(30);
    expect(getRemainingSeconds(receivedAt, receivedAt + 500)).toBe(30);
    expect(getRemainingSeconds(receivedAt, receivedAt + 1000)).toBe(29);
    expect(getRemainingSeconds(receivedAt, receivedAt + 29_500)).toBe(1);
    expect(getRemainingSeconds(receivedAt, receivedAt + 30_000)).toBe(0);
  });

  it('30초가 지나도 0 아래로 내려가지 않고, 시계가 앞서도 30 을 넘지 않는다', () => {
    expect(getRemainingSeconds(receivedAt, receivedAt + 45_000)).toBe(0);
    expect(getRemainingSeconds(receivedAt, receivedAt - 3_000)).toBe(30);
  });

  it('아직 QR 을 받은 적이 없으면 0 이다', () => {
    expect(getRemainingSeconds(0, receivedAt)).toBe(0);
    expect(getRemainingSeconds(undefined, receivedAt)).toBe(0);
  });

  it('주기를 바꾸면 그 주기로 센다', () => {
    expect(getRemainingSeconds(receivedAt, receivedAt, 10_000)).toBe(10);
    expect(OTP_REFRESH_INTERVAL_MS).toBe(30_000);
  });
});

describe('isOtpExpired', () => {
  it('서버 만료 시각을 지나야 만료다', () => {
    expect(isOtpExpired(2_000, 1_999)).toBe(false);
    expect(isOtpExpired(2_000, 2_000)).toBe(true);
    expect(isOtpExpired(2_000, 2_001)).toBe(true);
  });

  it('만료 시각을 모르면 만료로 보지 않는다', () => {
    expect(isOtpExpired(null, 2_000)).toBe(false);
    expect(isOtpExpired(undefined, 2_000)).toBe(false);
    expect(isOtpExpired(NaN, 2_000)).toBe(false);
  });
});

describe('getOtpView', () => {
  const base = {
    hasOtp: true,
    isPending: false,
    isFetching: false,
    isError: false,
    isExpired: false,
  };

  it('유효한 QR 이 있으면 보여 준다', () => {
    expect(getOtpView(base)).toBe('ready');
  });

  it('재조회 중에도 이전 QR 이 유효하면 그대로 보여 준다', () => {
    expect(getOtpView({ ...base, isFetching: true })).toBe('ready');
  });

  it('처음 불러오는 동안은 불러오는 중이다', () => {
    expect(
      getOtpView({ ...base, hasOtp: false, isPending: true, isFetching: true }),
    ).toBe('loading');
  });

  // 서버 OTP 유효 시간은 300초인데 재조회는 30초마다다. 재조회가 실패했다고 아직 4분 넘게
  // 유효한 QR 을 감추면, 문 앞의 학생이 대면 출석에 쓸 수 있던 수단을 잃는다.
  it('재조회에 실패해도 이전 QR 이 유효하면 그대로 보여 주되 stale 로 표시한다', () => {
    expect(getOtpView({ ...base, isError: true })).toBe('stale');
  });

  it('실패 뒤 다시 시도하는 동안에도 이전 QR 을 유지한다', () => {
    expect(getOtpView({ ...base, isError: true, isFetching: true })).toBe(
      'stale',
    );
  });

  it('보여 줄 QR 이 없이 실패하면 실패로 안내한다', () => {
    expect(getOtpView({ ...base, hasOtp: false, isError: true })).toBe(
      'error',
    );
  });

  it('실패한 채 유효 시간이 다 지나면 만료다', () => {
    expect(getOtpView({ ...base, isError: true, isExpired: true })).toBe(
      'expired',
    );
  });

  it('서버 만료 시각을 지난 QR 은 감추고 만료로 안내한다', () => {
    expect(getOtpView({ ...base, isExpired: true })).toBe('expired');
    expect(getOtpView({ ...base, isExpired: true, isFetching: true })).toBe(
      'loading',
    );
  });
});
