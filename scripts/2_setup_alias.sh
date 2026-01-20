#!/bin/bash
# git mr 명령어가 utils 폴더의 스크립트를 실행하도록 연결합니다.

echo "🔨 Git MR Alias를 연결합니다..."

# git alias 등록 (경로를 동적으로 찾아서 실행)
git config --global alias.mr '!sh "$(git rev-parse --show-toplevel)/scripts/utils/generate_mr.sh"'

echo "✅ Alias 연결 완료"