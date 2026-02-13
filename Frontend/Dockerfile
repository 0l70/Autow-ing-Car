# 1. Build Stage
FROM node:22-alpine AS builder
WORKDIR /app

# GitLab에서 --build-arg로 넘겨줄 변수들을 정의합니다.
ARG VITE_WS_BASE_URL
ARG VITE_API_BASE_URL

# 빌드 도구(Vite 등)가 인식할 수 있도록 환경변수로 설정합니다.
ENV VITE_WS_BASE_URL=$VITE_WS_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Install pnpm
RUN npm install -g pnpm

# Cache dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build source
COPY . .

# [IMPORTANT] 기존 .env 파일들 삭제 후 빌드 시점에 주입된 변수로 새로 생성
RUN rm -f .env .env.local .env.production .env.development
RUN printf "VITE_API_BASE_URL=%s\nVITE_WS_BASE_URL=%s\n" "$VITE_API_BASE_URL" "$VITE_WS_BASE_URL" > .env

# 디버깅용 로그: 생성된 .env 파일의 마스킹된 내용 확인
RUN echo "--- Verifying .env for build ---" && cat .env && echo "----------------------------"

# 이제 이 단계에서 위에서 설정한 .env 값이 정적 파일에 삽입됩니다.
RUN pnpm run build

# 2. Production Stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]