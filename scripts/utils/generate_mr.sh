#!/bin/bash
# 저장 위치: scripts/utils/generate_mr.sh

REPO_ROOT=$(git rev-parse --show-toplevel)
BRANCH=$(git symbolic-ref --short HEAD)
REPO_URL=$(git config --get remote.origin.url | sed "s/\.git$//")
TARGET_BRANCH="develop"

# 브랜치 파싱
TYPE=$(echo "$BRANCH" | cut -d"/" -f1)
DESC_PART=$(echo "$BRANCH" | cut -d"/" -f2)
KEY=$(echo "$DESC_PART" | grep -oE "S[0-9]+P[0-9]+A[0-9]+-[0-9]+")
DESC=$(echo "$DESC_PART" | sed "s/-$KEY.*//" | sed "s/-/ /g")

# 이모지 매핑
case "$TYPE" in
    "feat")     EMOJI="✨"; ENC_EMOJI="%E2%9C%A8" ;;
    "fix")      EMOJI="🐛"; ENC_EMOJI="%F0%9F%90%9B" ;;
    "docs")     EMOJI="📝"; ENC_EMOJI="%F0%9F%93%9D" ;;
    "style")    EMOJI="🎨"; ENC_EMOJI="%F0%9F%8E%A8" ;;
    "refactor") EMOJI="♻️"; ENC_EMOJI="%E2%99%BB%EF%B8%8F" ;;
    "test")     EMOJI="✅"; ENC_EMOJI="%E2%9C%85" ;;
    "chore")    EMOJI="🔨"; ENC_EMOJI="%F0%9F%94%A8" ;;
    "design")   EMOJI="💄"; ENC_EMOJI="%F0%9F%92%84" ;;
    *)          EMOJI="✨"; ENC_EMOJI="%E2%9C%A8" ;;
esac
TYPE_CAP="$(tr "[:lower:]" "[:upper:]" <<< ${TYPE:0:1})${TYPE:1}"

# 제목 생성
ENC_KEY="%5B$KEY%5D"
ENC_DESC=$(echo "$DESC" | sed "s/ /%20/g")
FINAL_TITLE="$ENC_KEY%20$ENC_EMOJI%20$TYPE_CAP%3A%20$ENC_DESC"

# 로그 추출 (안전장치 포함)
echo "🔍 커밋 로그를 검색합니다..."
COMMIT_LOGS=$(git log --reverse --no-merges --pretty=format:"- %s" origin/$TARGET_BRANCH..HEAD 2>/dev/null | head -n 20 | tr -d '\r')

if [ -z "$COMMIT_LOGS" ]; then
    echo "⚠️  비교 대상을 찾지 못해 최근 커밋을 가져옵니다."
    COMMIT_LOGS=$(git log --no-merges --pretty=format:"- %s" -n 10 | tr -d '\r')
fi

# 본문 작성 (괄호 없는 Clean 버전)
BODY_CONTENT="## 🛠️ 작업 내용
$COMMIT_LOGS

## 😈 주의 할 영역
- (예시) KEY.ENV 파일 최신화

## ✅ 체크리스트
- [ ] Merge 되는 브랜치가 $TARGET_BRANCH 인가요?
- [ ] Assignee / Reviewer를 지정했나요?"

# URL 인코딩
ENC_BODY=$(echo "$BODY_CONTENT" | tr -d '\r' | \
    sed "s/%/%25/g" | sed "s/(/%28/g" | sed "s/)/%29/g" | \
    sed "s/#/%23/g" | sed "s/\[/%5B/g" | sed "s/\]/%5D/g" | \
    sed "s/-/%2D/g" | sed "s/ /%20/g" | \
    awk '{printf "%s%%0A", $0}')

# 출력
echo ""
echo "🚀 아래 링크를 클릭하세요:"
echo "$REPO_URL/-/merge_requests/new?merge_request%5Bsource_branch%5D=$BRANCH&merge_request%5Btarget_branch%5D=$TARGET_BRANCH&merge_request%5Btitle%5D=$FINAL_TITLE&merge_request%5Bdescription%5D=$ENC_BODY&merge_request%5Bforce_remove_source_branch%5D=true"
echo ""