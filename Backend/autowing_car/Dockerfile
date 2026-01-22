# =========================
# 1. Build Stage
# =========================
FROM gradle:8.5.0-jdk17 AS builder
WORKDIR /app

# 캐시 최적화
COPY gradle gradle
COPY gradlew build.gradle settings.gradle ./
RUN chmod +x gradlew
RUN ./gradlew dependencies || true

# 소스 복사 & 빌드
COPY . .
RUN ./gradlew clean build -x test

# =========================
# 2. Runtime Stage
# =========================
FROM eclipse-temurin:17-jre
WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

# 환경변수 안전하게 적용
ENTRYPOINT ["sh", "-c", "java -jar -Dspring.profiles.active=${SPRING_PROFILES_ACTIVE} app.jar"]
