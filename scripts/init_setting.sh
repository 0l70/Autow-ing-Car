#!/bin/bash

# 스크립트가 위치한 디렉토리 (./scripts)
SCRIPT_DIR=$(dirname "$0")
# 현재 실행 중인 파일 이름 (init_setting.sh) - 무한 루프 방지용
THIS_SCRIPT=$(basename "$0")

echo "=========================================="
echo "🚀 [Auto Setup] scripts 폴더의 모든 설정을 실행합니다..."
echo "=========================================="

# 1. 안전장치: 디렉토리 확인
if [ ! -d "$SCRIPT_DIR" ]; then
    echo "❌ 오류: $SCRIPT_DIR 폴더를 찾을 수 없습니다."
    exit 1
fi

# 2. 반복문: scripts 폴더 내의 모든 .sh 파일 찾기 (이름순 정렬됨)
for file in "$SCRIPT_DIR"/*.sh; do
    
    # 파일명만 추출
    filename=$(basename "$file")

    # 자기 자신(init_setting.sh)이면 건너뛰기
    if [ "$filename" == "$THIS_SCRIPT" ]; then
        continue
    fi

    # 파일이 실제로 존재하는지 확인 (빈 폴더일 경우 대비)
    if [ -f "$file" ]; then
        echo ""
        echo "▶️  실행 중: $filename"
        
        # 실행 권한 부여
        chmod +x "$file"
        
        # 스크립트 실행
        "$file"
        
        # 실행 결과 확인
        if [ $? -eq 0 ]; then
            echo "✅ $filename 완료"
        else
            echo "⚠️  $filename 실행 중 경고가 발생했을 수 있습니다."
        fi
    fi
done

echo ""
echo "=========================================="
echo "🎁 모든 초기 설정이 완료되었습니다!"
echo "📝 세부 설명은 docs/CONTRIBUTING.md를 확인하세요"
echo "=========================================="