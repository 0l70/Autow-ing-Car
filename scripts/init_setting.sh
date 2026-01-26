#!/bin/bash

# 스크립트 디렉토리
SCRIPT_DIR=$(dirname "$0")
THIS_SCRIPT=$(basename "$0")

echo "=========================================="
echo "🚀 [Auto Setup] 프로젝트 개발 환경을 설정합니다..."
echo "=========================================="

# 1. 실행할 .sh 파일 개수 세기 (자기 자신 제외)
# ls로 목록을 뽑고, grep으로 자신을 빼고, wc -l로 줄 수를 셉니다.
TOTAL_FILES=$(find "$SCRIPT_DIR" -maxdepth 1 -name "*.sh" ! -name "$THIS_SCRIPT" | wc -l)
CURRENT_COUNT=1

if [ ! -d "$SCRIPT_DIR" ]; then
    echo "❌ 오류: $SCRIPT_DIR 폴더를 찾을 수 없습니다."
    exit 1
fi

# 2. 반복문 실행
for file in "$SCRIPT_DIR"/*.sh; do
    filename=$(basename "$file")

    # 자기 자신은 패스
    if [ "$filename" == "$THIS_SCRIPT" ]; then
        continue
    fi

    if [ -f "$file" ]; then
        # [현재/전체] 형식으로 출력 (예: [1/2])
        echo ""
        echo "▶️  [$CURRENT_COUNT/$TOTAL_FILES] 실행 중: $filename"
        
        chmod +x "$file"
        "$file"
        
        if [ $? -eq 0 ]; then
            echo "✅ $filename 완료"
        else
            echo "⚠️  $filename 실행 중 경고가 발생했을 수 있습니다."
        fi
        
        # 카운트 증가
        ((CURRENT_COUNT++))
    fi
done

echo ""
echo "=========================================="
echo "🎉 모든 설정($TOTAL_FILES개)이 완료되었습니다!"
echo "=========================================="