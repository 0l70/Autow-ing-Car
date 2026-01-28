# 1. Build Stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Cache dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build source
COPY . .
RUN pnpm run build

# 2. Production Stage
FROM nginx:alpine
# Copy build artifacts
COPY --from=builder /app/dist /usr/share/nginx/html
# Copy Nginx config
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
