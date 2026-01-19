#!/bin/bash

echo "🚀 Git Commit Hook 설정을 시작합니다..."

# 1. 훅 파일 경로 설정
HOOK_FILE=".git/hooks/prepare-commit-msg"

# 2. 훅 파일 내용 작성
# (주의: 윈도우 Git Bash 호환성을 위해 cat 방식을 사용)
cat > "$HOOK_FILE" << 'EOF'
#!/bin/bash

COMMIT_MSG_FILE=$1
BRANCH_NAME=$(git symbolic-ref --short HEAD)

# =========================================================
# Part 1. 이모지 자동 변환 (대소문자 무시)
# =========================================================

# Windows Git Bash의 sed는 -i 옵션 사용 시 백업 파일 확장자를 붙여야 안전합니다 (.bak)
sed -i.bak -e 's/^[fF][eE][aA][tT]:/✨ Feat:/' "$COMMIT_MSG_FILE"
sed -i.bak -e 's/^[fF][iI][xX]:/🐛 Fix:/' "$COMMIT_MSG_FILE"
sed -i.bak -e 's/^[dD][eE][sS][iI][gG][nN]:/💄 Design:/' "$COMMIT_MSG_FILE"
sed -i.bak -e 's/^[dD][oO][cC][sS]:/📝 Docs:/' "$COMMIT_MSG_FILE"
sed -i.bak -e 's/^[rR][eE][fF][aA][cC][tT][oO][rR]:/♻️ Refactor:/' "$COMMIT_MSG_FILE"
sed -i.bak -e 's/^[sS][tT][yY][lL][eE]:/🎨 Style:/' "$COMMIT_MSG_FILE"
sed -i.bak -e 's/^[tT][eE][sS][tT]:/✅ Test:/' "$COMMIT_MSG_FILE"
sed -i.bak -e 's/^[cC][hH][oO][rR][eE]:/🔨 Chore:/' "$COMMIT_MSG_FILE"

# =========================================================
# Part 2. Jira 키 + 컴포넌트 자동 추가
# =========================================================

ISSUE_KEY=$(echo "$BRANCH_NAME" | grep -oE 'S[0-9]+P[0-9]+A[0-9]+-[0-9]+(-[a-zA-Z0-9]+)?')

if [ -n "$ISSUE_KEY" ]; then
  if ! grep -q "$ISSUE_KEY" "$COMMIT_MSG_FILE"; then
    sed -i.bak -e "1s/$/ [$ISSUE_KEY]/" "$COMMIT_MSG_FILE"
  fi
fi
EOF

# 3. 실행 권한 부여
chmod +x "$HOOK_FILE"

echo "✅ 설정 완료! 이제 'FEAT: 제목'이나 'feat: 제목' 모두 자동으로 변환됩니다."