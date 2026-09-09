/* eslint-env node */
// 발생 시각(occurredAt) 변환 테스트는 한국 시간대(UTC+9)를 전제로 기대값을 고정한다. CI(ubuntu) 는
// TZ 가 UTC 라 로컬↔UTC 변환을 빼먹은 구현도 통과시키므로, 워커가 뜨기 전에 개발 환경과 같게 맞춘다.
module.exports = async () => {
  process.env.TZ = 'Asia/Seoul';
};
