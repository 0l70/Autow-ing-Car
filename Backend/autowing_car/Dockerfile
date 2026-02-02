# =========================
# 1. Build Stage
# =========================
FROM gradle:8.5.0-jdk17 AS builder
WORKDIR /app

# ---- 캐시 최적화용 최소 파일 먼저 복사 ----
COPY gradle gradle
COPY gradlew build.gradle settings.gradle ./

# 실행 권한 부여 (★★★ 핵심 ★★★)
RUN chmod +x ./gradlew

# 의존성만 먼저 다운로드 (캐시용)
RUN ./gradlew dependencies || true

# ---- 전체 소스 복사 후 빌드 ----
COPY . .

RUN ./gradlew clean build -x test

# =========================
# 2. Runtime Stage
# =========================
FROM eclipse-temurin:17-jre
WORKDIR /app

COPY --from=builder /app/build/libs/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["sh", "-c", "java -jar -Dspring.profiles.active=${SPRING_PROFILES_ACTIVE} app.jar"]
