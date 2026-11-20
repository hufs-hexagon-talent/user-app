# HUFS CSE Studyroom Reservation System

한국외국어대학교 컴퓨터공학부 세미나실 예약 시스템입니다.

## 고정 이미지 배포

배포 workflow는 QA에서 한 번 만든 image digest를 사용한다. QA의 실제 서버 receipt를 확인한 실행만 release artifact를 남긴다. qa→main 병합 후 main의 `workflow_dispatch`에 검증한 `qa_run_id`를 지정하면, 전체 소스 tree와 QA 실행·revision·digest를 확인해 같은 이미지를 운영으로 승격한다. main push는 새 이미지를 만들거나 자동으로 운영을 바꾸지 않는다.

서버 infra의 웹 controller와 환경×서비스 제한 SSH key를 먼저 설치한다. 각 GitHub environment의 `WEB_DEPLOY_ENABLED`, `WEB_DEPLOY_PATH`, `WEB_DEPLOY_SSH_HOST/USER/PORT` 변수와 `WEB_DEPLOY_SSH_KEY`, `WEB_DEPLOY_SSH_KNOWN_HOSTS` 비밀을 사용한다. CI key는 지정 환경·서비스의 deploy만 할 수 있고 controller나 환경 파일을 업로드하지 않는다.

웹 재생성은 짧은 중단이 있을 수 있어 운영 배포는 04:00~04:29 KST에 시작하며 30분 안에 적용·복구한다. 이전 이미지와 실제 환경을 서버의 비공개 snapshot으로 복구한다. API와 스택 잠금을 공유하고 sequence는 서비스별로 관리한다. Watchtower 전환·수동 rollback·서버 준비 절차는 infra `deploy/README.md`를 따른다.

Node 22.23.5와 nginx 1.30.7 이미지는 digest로 고정한다. 최종 이미지의 SBOM/provenance에는 [빌드 stage 의존성도 포함](https://docs.docker.com/build/metadata/attestations/sbom/)하며, source dependency와 최종 image 취약점 보고서를 각각 보존한다. 보고서 생성 성공이 취약점 해소 완료를 뜻하지 않는다.
