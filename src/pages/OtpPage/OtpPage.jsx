import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode.react';
import { Button } from 'flowbite-react';
import { RotateCw } from 'lucide-react';

import { Link, useSearchParams } from 'react-router-dom';
import { useUserReservation } from '../../api/reservation.api';
import {
  canOpenReservationQr,
  formatReservationTime,
  formatRoom,
} from '../inquiry/reservationView';
import { useOtp } from '../../api/checkin.api';
import {
  getOtpView,
  getRemainingSeconds,
  getRemainingValidMinutes,
  isOtpExpired,
  OTP_TTL_MS,
} from './otpTimer';

const TimerCircularProgressBar = ({ radius, strokeWidth, progress }) => {
  const center = radius + strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference + (progress / 100) * circumference;

  return (
    <svg width={radius * 2 + strokeWidth} height={radius * 2 + strokeWidth}>
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        stroke="#E0E0E0"
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        stroke="#002D56"
        strokeDasharray={circumference}
        strokeDashoffset={progressOffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${center} ${center})`}
      />
    </svg>
  );
};

export const ReservationQrCode = ({ reservation }) => {
  const [now, setNow] = useState(() => Date.now());
  const [radius, setRadius] = useState(170);

  const {
    data: otp,
    refetch,
    dataUpdatedAt,
    isPending,
    isError,
    isFetching,
  } = useOtp(reservation.reservationId);

  // 값이 없거나 만료된 QR 은 대봐야 출석이 되지 않는다. 정상처럼 보이는 QR 을
  // 그려두면 학생이 그대로 대다가 출석 시간을 넘기므로 아예 그리지 않는다.
  // 다만 재조회하는 동안이나 재조회에 실패했을 때는 이전 QR 이 아직 유효(300초)하므로
  // 그대로 보여 준다. 실패는 그 아래에 남은 시간과 다시 시도를 함께 둔다.
  const otpValue = otp?.verificationCode;
  const hasOtp = Boolean(otpValue);
  const timer = getRemainingSeconds(dataUpdatedAt, now);
  // 만료는 기기 시계끼리 비교한다(받은 시각 + 서버 유효 시간). 서버가 준 expiresAt 을
  // 기기 시계와 비교하면 기기 시계가 앞서 있을 때 받자마자 만료로 보여 QR 을 영영 못 본다.
  const isExpired = hasOtp && isOtpExpired(dataUpdatedAt + OTP_TTL_MS, now);
  const view = getOtpView({
    hasOtp,
    isPending,
    isFetching,
    isError,
    isExpired,
  });
  const showQr = view === 'ready' || view === 'stale';
  const isStale = view === 'stale';
  const staleMinutes = getRemainingValidMinutes(dataUpdatedAt, now);
  const isLoadingOtp = view === 'loading';
  const statusMessage = isLoadingOtp
    ? 'QR 을 불러오는 중입니다'
    : view === 'error'
      ? 'QR 을 불러오지 못했습니다'
      : 'QR 이 만료되었습니다. 다시 발급받아 주세요.';

  useEffect(() => {
    const handleResize = () => {
      const newRadius = Math.min(
        170,
        Math.max(100, (window.innerWidth - 48) / 2),
      );
      setRadius(newRadius);
    };

    handleResize();

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1초 시계는 QR 을 받은 시각에 맞춰 다시 시작한다. 그래야 카운트다운과 재조회
  // 시점이 어긋나지 않는다.
  useEffect(() => {
    if (!dataUpdatedAt) return undefined;

    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);

    return () => clearInterval(tick);
  }, [dataUpdatedAt]);

  // 카운트다운이 끝나면 새 QR 을 받아온다. 실패했을 때는 학생이 다시 시도 버튼을
  // 누르게 두고 자동으로 반복하지 않는다.
  useEffect(() => {
    if (timer > 0 || !hasOtp || isFetching || isError) return;

    refetch({ cancelRefetch: false });
  }, [timer, hasOtp, isFetching, isError, refetch]);

  return (
    <div>
      <h1 className="text-center text-3xl mt-12">출석 QR</h1>
      <p className="mt-3 text-center font-medium">
        {reservation.roomName}호 · {reservation.partitionNumber}번 자리
        <span className="mt-1 block text-sm font-normal">
          {formatReservationTime(reservation)}
        </span>
      </p>
      <div className="flex justify-center mt-10 relative">
        <TimerCircularProgressBar
          radius={radius}
          strokeWidth={15}
          progress={showQr ? (timer / 30) * 100 : 0}
        />
        {showQr ? (
          <QRCode
            value={otpValue}
            level="H"
            size={140}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"
          />
        ) : (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 text-center">
            {isLoadingOtp && (
              <RotateCw
                aria-hidden
                size={24}
                className="mx-auto mb-3 animate-spin text-gray-400"
              />
            )}
            <span className="text-gray-600">{statusMessage}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-3 px-10 pt-10 pb-5 mb-5">
        {view === 'ready' && (
          <span className="ml-2">
            {timer > 0
              ? `${timer}초 남았습니다`
              : 'QR 을 다시 발급하는 중입니다'}
          </span>
        )}
        {/* 새 QR 을 못 받았어도 화면의 QR 은 아직 유효하다. 남은 시간을 분 단위로 알려 문 앞의
            학생이 그대로 대도 된다는 것을 안다. 자동 재조회는 실패 뒤 멈추므로 버튼을 같이 둔다. */}
        {isStale && (
          <p
            role="status"
            aria-live="polite"
            className="w-64 text-center text-sm text-gray-700 break-keep">
            새 QR 을 받지 못했습니다. 지금 QR 은{' '}
            {staleMinutes >= 1
              ? `${staleMinutes}분 뒤까지 쓸 수 있어요.`
              : '곧 만료돼요.'}
          </p>
        )}
        {(isStale || (!showQr && (isError || isExpired))) && (
          <Button
            size="sm"
            color="dark"
            onClick={() => refetch()}
            disabled={isFetching}>
            {isFetching ? '다시 발급하는 중' : '다시 시도'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default function OtpPage() {
  const [params] = useSearchParams();
  const id = params.get('reservationId');
  const query = useUserReservation();
  const choices = (query.data ?? [])
    .filter(canOpenReservationQr)
    .sort(
      (a, b) =>
        new Date(a.reservationStartTime) - new Date(b.reservationStartTime),
    );
  const selected = choices.find(row => String(row.reservationId) === id);
  if (selected)
    return (
      <section className="mx-auto max-w-xl px-3 text-center">
        <ReservationQrCode
          key={selected.reservationId}
          reservation={selected}
        />
        <Link className="inline-block p-3 font-medium underline" to="/otp">
          다른 예약 선택
        </Link>
        <Link
          className="inline-block p-3 font-medium underline"
          to={historyUrl(params)}>
          내 예약 조회
        </Link>
      </section>
    );
  return (
    <section className="mx-auto my-12 max-w-xl px-5">
      <h1 className="text-2xl font-semibold">출석 QR</h1>
      <p className="mt-2 text-gray-700">
        {query.isPending
          ? '예약을 불러오는 중입니다.'
          : query.isError
            ? '예약을 불러오지 못했습니다.'
            : id
              ? '이 예약의 QR을 열 수 없습니다.'
              : choices.length
                ? 'QR을 열 예약을 선택해 주세요.'
                : '출석 QR을 열 수 있는 예약이 없습니다.'}
      </p>
      {query.isError && (
        <button className="p-3 underline" onClick={() => query.refetch()}>
          다시 시도
        </button>
      )}
      <ul className="mt-5 divide-y border-y">
        {choices.map(row => (
          <li key={row.reservationId}>
            <Link
              className="block py-4 hover:underline focus-visible:outline"
              to={`/otp?reservationId=${row.reservationId}&page=${Number(params.get('page')) || 1}`}>
              <strong>{formatRoom(row)}</strong>
              <span className="block text-sm">
                {formatReservationTime(row)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        className="mt-4 inline-block py-3 underline"
        to={historyUrl(params)}>
        내 예약 조회
      </Link>
    </section>
  );
}

function historyUrl(params) {
  const page = Number(params.get('page'));
  return page > 1 && Number.isSafeInteger(page)
    ? `/check?page=${page}`
    : '/check';
}
