# syntax=docker/dockerfile:1
FROM node:22.23.5-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS build-stage
ARG BUILDKIT_SBOM_SCAN_STAGE=true
WORKDIR /app

# 의존성 파일 복사 및 설치
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# 소스 코드 복사 및 애플리케이션 빌드
COPY . .
RUN yarn build

# 두 번째 단계: Nginx를 사용하여 빌드된 앱을 서빙
FROM nginx:1.30.7-alpine@sha256:caf4e1e032a20f9c3c5e28fc7f25ffd768ad8677b4975c54193075997b3a97e3 AS production-stage
COPY entrypoint.sh /entrypoint.sh
RUN apk upgrade --no-cache && chmod +x /entrypoint.sh

COPY --from=build-stage /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
