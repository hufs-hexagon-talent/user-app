import { CATEGORY_LABELS, STATUS_LABELS } from './inquiryLabels';

// 이 문구는 backoffice 앱(src/api/inquiry.api.ts 의 STATUS_LABEL)과
// 같아야 한다. 레포가 갈려 있어 교차 검증은 못 하므로, 여기서 바꾸면 그쪽도 바꾸라는
// 표지로 리터럴을 고정한다.
describe('inquiryLabels', () => {
  it('상태 라벨은 답변 대기 / 답변 완료 다', () => {
    expect(STATUS_LABELS).toEqual({ OPEN: '답변 대기', RESOLVED: '답변 완료' });
  });

  it('유형 라벨은 세 가지다', () => {
    expect(CATEGORY_LABELS).toEqual({
      ATTENDANCE: '출석·예약 이의',
      FACILITY: '시설·키오스크 고장',
      ETC: '기타',
    });
  });
});
