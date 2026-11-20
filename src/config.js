// 런타임 설정. 배포 컨테이너는 public/config.js(window.env)를 기동 시점에 채우고,
// 개발 서버에서는 치환되지 않은 자리표시자가 그대로 오므로 걸러낸다.
const runtime = value =>
  value && !String(value).startsWith('APP__REPLACE_ME__') ? value : undefined;

const config = {
  API_URL:
    runtime(window.env?.REACT_APP_API_URL) ||
    import.meta.env.REACT_APP_API_URL ||
    'https://api.studyroom.computer.hufs.ac.kr',
  DEPARTMENT_ID: runtime(window.env?.REACT_APP_DEPARTMENT_ID) || 1,
};

export default config;
