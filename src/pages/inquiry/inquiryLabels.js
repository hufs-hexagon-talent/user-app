// 문의 category/status enum 의 한글 라벨. backoffice 앱과 문구를 그대로 공유한다
// (CATEGORY_LABELS·STATUS_LABEL 둘 다 src/api/inquiry.api.ts). 여기를 바꾸면 그쪽도 바꾼다.
export const CATEGORY_LABELS = {
  ATTENDANCE: '출석·예약 이의',
  FACILITY: '시설·키오스크 고장',
  ETC: '기타',
};

// 학생이 기다리는 것은 "처리" 가 아니라 "답변" 이다. 상태 이름이 그 말을 한다.
export const STATUS_LABELS = {
  OPEN: '답변 대기',
  RESOLVED: '답변 완료',
};
