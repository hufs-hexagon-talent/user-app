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

// 학생 앱 전용 부제. 유형마다 묻는 것이 달라졌으므로 고르기 전에 무엇을 묻는지 보여준다.
// 백오피스는 이 문구를 쓰지 않는다(CATEGORY_LABELS 만 공유).
export const CATEGORY_HINTS = {
  ATTENDANCE: '출석했는데 미출석으로 표시돼요',
  FACILITY: '스캐너·에어컨·책상 등이 고장났어요',
  ETC: '그 밖의 문의·건의',
};
