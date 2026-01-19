#!/bin/bash

echo "🛠️  [1/2] Git Commit Hook 설정을 시작합니다..."

# 1. 안전장치: .git 폴더 확인
if [ ! -d ".git" ]; then
  echo "❌ 오류: Git 프로젝트 루트 폴더가 아닙니다. (.git 폴더가 있는 위치로 이동해주세요)"
  exit 1
fi

# 2. 훅 파일 작성
HOOK_FILE=".git/hooks/prepare-commit-msg"

cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash
COMMIT_MSG_FILE=$1
BRANCH_NAME=$(git symbolic-ref --short HEAD)

# --- Part 1. 이모지 변환 ---
sed -i.bak -e 's/^[fF][eE][aA][tT]:/✨ Feat:/' "$COMMIT_MSG_FILE"
sed -i.bak -e 's/^[fF][iI][xX]:/🐛 Fix:/' "$COMMIT_MSG_FILE"
sed -i.bak -e 's/^[dD][eE][sS][iI][gG][nN]:/💄 Design:/' "$COMMIT_MSG_FILE"
sed -i.bak -e 's/^[dD][oO][cC][sS]:/📝 Docs:/' "$COMMIT_MSG_FILE"
sed -i.bak -e 's/^[rR][eE][fF][aA][cC][tT][oO][rR]:/♻️ Refactor:/' "$COMMIT_MSG_FILE"
sed -i.bak -e 's/^[sS][tT][yY][lL][eE]:/🎨 Style:/' "$COMMIT_MSG_FILE"
sed -i.bak -e 's/^[tT][eE][sS][tT]:/✅ Test:/' "$COMMIT_MSG_FILE"
sed -i.bak -e 's/^[cC][hH][oO][rR][eE]:/🔨 Chore:/' "$COMMIT_MSG_FILE"

# --- Part 2. [키] [컴포넌트] 추가 ---
JIRA_KEY=$(echo "$BRANCH_NAME" | grep -oE 'S[0-9]+P[0-9]+A[0-9]+-[0-9]+')

# 컴포넌트 추출 및 대문자 변환
COMPONENT=""
if [[ "$BRANCH_NAME" =~ -(fe|be|pm|em|common)$ ]]; then
    RAW_COMP=$(echo "$BRANCH_NAME" | awk -F'-' '{print $NF}')
    UPPER_COMP=$(echo "$RAW_COMP" | tr '[:lower:]' '[:upper:]')
    COMPONENT="[$UPPER_COMP] "
fi

if [ -n "$JIRA_KEY" ]; then
    if ! grep -q "$JIRA_KEY" "$COMMIT_MSG_FILE"; then
        sed -i.bak -e "1s/^/[$JIRA_KEY] $COMPONENT/" "$COMMIT_MSG_FILE"
    fi
fi
rm -f "$COMMIT_MSG_FILE.bak"
EOF

# 3. 실행 권한 부여
chmod +x "$HOOK_FILE"
echo "✅ Git Hook 설정 완료!"