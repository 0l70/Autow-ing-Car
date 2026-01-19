#!/bin/bash

echo "🛠️  [2/2] Git MR Alias 설정을 시작합니다..."

# git config 명령어 실행
git config --global alias.mr '!f() { \
    BRANCH=$(git symbolic-ref --short HEAD); \
    REPO_URL=$(git config --get remote.origin.url | sed "s/\.git$//"); \
    TYPE=$(echo "$BRANCH" | cut -d"/" -f1); \
    DESC_PART=$(echo "$BRANCH" | cut -d"/" -f2); \
    KEY=$(echo "$DESC_PART" | grep -oE "S[0-9]+P[0-9]+A[0-9]+-[0-9]+"); \
    DESC=$(echo "$DESC_PART" | sed "s/-$KEY.*//" | sed "s/-/ /g"); \
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
    ENC_KEY="%5B$KEY%5D"; \
    ENC_DESC=$(echo "$DESC" | sed "s/ /%20/g"); \
    ENC_TITLE="$ENC_KEY%20$ENC_EMOJI%20$TYPE_CAP%3A%20$ENC_DESC"; \
    echo ""; \
    echo "🚀 아래 링크를 클릭하세요 (git mr):"; \
    echo "$REPO_URL/-/merge_requests/new?merge_request%5Bsource_branch%5D=$BRANCH&merge_request%5Btarget_branch%5D=develop&merge_request%5Btitle%5D=$ENC_TITLE&merge_request%5Bforce_remove_source_branch%5D=true"; \
    echo ""; \
}; f'

echo "✅ Git MR Alias 설정 완료! (사용법: git mr)"