// 시작~끝 분 차이를 사람이 읽는 말로 바꾼다. 예약 확인 모달에서만 쓴다.
export const durationLabel = minutes => {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${rest}분`;
  if (rest === 0) return `${hours}시간`;
  return `${hours}시간 ${rest}분`;
};
