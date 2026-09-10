// 내 예약 전체에서 출석한 예약의 시간을 합산한다. 실제 체류 시간이나 방문일 수가 아니다.
// 조기 체크인·이용 중인 예약도 VISITED이면 예약한 전체 시간을 포함한다.
// 조회 전이나 잘못된 출석 데이터는 0시간으로 오인하지 않도록 null로 구분한다.
export const summarizeUsage = reservations => {
  if (!Array.isArray(reservations)) return null;

  let totalMilliseconds = 0;
  let visitCount = 0;

  for (const reservation of reservations) {
    if (reservation?.reservationState !== 'VISITED') continue;

    const start = Date.parse(reservation.reservationStartTime);
    const end = Date.parse(reservation.reservationEndTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return null;
    }

    totalMilliseconds += end - start;
    visitCount += 1;
  }

  return { totalMinutes: Math.round(totalMilliseconds / 60000), visitCount };
};
