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
# 이제 이 단계에서 위에서 설정한 ENV 값들이 정적 파일에 삽입됩니다.
RUN pnpm run build

# 2. Production Stage (이하 동일)
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]