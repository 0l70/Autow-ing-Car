#!/bin/bash

echo "🛠️  [2/2] Git MR Alias (Auto-Description) 설정을 시작합니다..."

# git config 명령어 실행
git config --global alias.mr '!f() { \
    # ------------------------------------------------------- \
    # 1. 기본 정보 추출 \
    # ------------------------------------------------------- \
    BRANCH=$(git symbolic-ref --short HEAD); \
    REPO_URL=$(git config --get remote.origin.url | sed "s/\.git$//"); \
    \
    # 타겟 브랜치 설정 (기본 develop) \
    TARGET_BRANCH="develop"; \
    \
    # ------------------------------------------------------- \
    # 2. 브랜치 이름 파싱 \
    # ------------------------------------------------------- \
    TYPE=$(echo "$BRANCH" | cut -d"/" -f1); \
    DESC_PART=$(echo "$BRANCH" | cut -d"/" -f2); \
    KEY=$(echo "$DESC_PART" | grep -oE "S[0-9]+P[0-9]+A[0-9]+-[0-9]+"); \
    DESC=$(echo "$DESC_PART" | sed "s/-$KEY.*//" | sed "s/-/ /g"); \
    \
    # ------------------------------------------------------- \
    # 3. 제목 생성 (이모지 매핑) \
    # ------------------------------------------------------- \
    case "$TYPE" in \
        "feat")     EMOJI="✨"; ENC_EMOJI="%E2%9C%A8" ;; \
        "fix")      EMOJI="🐛"; ENC_EMOJI="%F0%9F%90%9B" ;; \
        "docs")     EMOJI="📝"; ENC_EMOJI="%F0%9F%93%9D" ;; \
        "style")    EMOJI="🎨"; ENC_EMOJI="%F0%9F%8E%A8" ;; \
        "refactor") EMOJI="♻️"; ENC_EMOJI="%E2%99%BB%EF%B8%8F" ;; \
        "test")     EMOJI="✅"; ENC_EMOJI="%E2%9C%85" ;; \
        "chore")    EMOJI="🔨"; ENC_EMOJI="%F0%9F%94%A8" ;; \
        "design")   EMOJI="💄"; ENC_EMOJI="%F0%9F%92%84" ;; \
        *)          EMOJI="✨"; ENC_EMOJI="%E2%9C%A8" ;; \
    esac; \
    TYPE_CAP="$(tr "[:lower:]" "[:upper:]" <<< ${TYPE:0:1})${TYPE:1}"; \
    \
    # URL 인코딩 (제목) \
    ENC_KEY="%5B$KEY%5D"; \
    ENC_DESC=$(echo "$DESC" | sed "s/ /%20/g"); \
    FINAL_TITLE="$ENC_KEY%20$ENC_EMOJI%20$TYPE_CAP%3A%20$ENC_DESC"; \
    \
    # ------------------------------------------------------- \
    # 4. 🔥 핵심: 커밋 내역 자동 추출 (본문 생성) \
    # ------------------------------------------------------- \
    # develop 브랜치와 비교해서 추가된 커밋 로그만 가져옴 (최근 30개 제한) \
    COMMIT_LOGS=$(git log --no-merges --pretty=format:"- %s" origin/$TARGET_BRANCH..HEAD | head -n 30); \
    \
    # 템플릿 조립 (줄바꿈은 실제 줄바꿈으로 작성) \
    BODY_CONTENT="## 🛠️ 작업 내용
$COMMIT_LOGS

## 😈 주의 할 영역
- (예시) KEY.ENV 파일 최신화 (노션)

## ✅ 체크리스트
- [ ] Merge 되는 브랜치가 $TARGET_BRANCH 이(가) 맞나요?
- [ ] Assignee(본인)와 Reviewer(팀원)를 지정했나요?"; \
    \
    # ------------------------------------------------------- \
    # 5. 본문 URL 인코딩 (Python 사용 - 가장 안전함) \
    # ------------------------------------------------------- \
    if command -v python3 &> /dev/null; then \
        ENC_BODY=$(echo "$BODY_CONTENT" | python3 -c "import urllib.parse, sys; print(urllib.parse.quote(sys.stdin.read()))"); \
    else \
        # 파이썬 없을 경우 단순 sed 처리 (특수문자 많으면 깨질 수 있음) \
        ENC_BODY=$(echo "$BODY_CONTENT" | sed "s/ /%20/g" | sed "s/$/%0A/" | tr -d "\n"); \
    fi; \
    \
    # ------------------------------------------------------- \
    # 6. 최종 링크 생성 \
    # ------------------------------------------------------- \
    echo ""; \
    echo "🚀 아래 링크를 클릭하세요 (커밋 내역이 본문에 자동 삽입됩니다):"; \
    echo "$REPO_URL/-/merge_requests/new?merge_request%5Bsource_branch%5D=$BRANCH&merge_request%5Btarget_branch%5D=$TARGET_BRANCH&merge_request%5Btitle%5D=$FINAL_TITLE&merge_request%5Bdescription%5D=$ENC_BODY&merge_request%5Bforce_remove_source_branch%5D=true"; \
    echo ""; \
}; f'

echo "✅ Git MR Alias 설정 완료! (이제 본문에 커밋 내역이 자동으로 들어갑니다)"