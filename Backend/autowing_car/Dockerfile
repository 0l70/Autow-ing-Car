# 1. Base Image (Java 17 실행 환경)
FROM openjdk:17-jdk-slim

# 2. 작업 디렉토리 설정
WORKDIR /app

# 3. 빌드된 JAR 파일 복사
# (Gradle 빌드 후 생성된 jar를 컨테이너 안으로 복사)
COPY build/libs/*.jar app.jar

# 4. 실행 명령어 (프로파일은 환경변수로 받음)
ENTRYPOINT ["java", "-jar", "-Dspring.profiles.active=${PROFILE}", "/app.jar"]