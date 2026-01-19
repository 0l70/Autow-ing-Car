#!/bin/bash
# utils 폴더에 있는 훅 파일을 .git/hooks 폴더로 복사합니다.

REPO_ROOT=$(git rev-parse --show-toplevel)
HOOK_SRC="$REPO_ROOT/scripts/utils/prepare-commit-msg"
HOOK_DEST="$REPO_ROOT/.git/hooks/prepare-commit-msg"

echo "🔨 Git Hook을 설치합니다..."

# 파일 복사
cp "$HOOK_SRC" "$HOOK_DEST"

# 실행 권한 부여
chmod +x "$HOOK_DEST"

echo "✅ Hook 설치 완료 (커밋 시 메시지가 자동 변환됩니다)"