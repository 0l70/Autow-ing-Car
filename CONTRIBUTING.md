# 📜 프로젝트 기여 가이드 (CONTRIBUTING)

이 문서는 우리 팀의 **Git 브랜치 전략, 커밋 메시지 규칙, Merge Request(MR) 프로세스**를 정의합니다.
원활한 협업과 지라(Jira) 연동을 위해 모든 팀원은 아래 규칙을 준수해 주세요.

---

## 1. 🌿 브랜치 이름 규칙 (Branch Naming)

브랜치 이름은 **작업 종류, 설명, 지라 이슈, 파트**를 명확히 알 수 있도록 작성합니다.

### ✅ 명명 구조

> **`타입/설명-지라키[-컴포넌트]`**

* **타입 (Type):** 작업의 성격 (폴더로 구분)
* **설명 (Description):** 작업 내용 (영어 소문자, 띄어쓰기는 하이픈 `-`)
* **지라키 (Jira Key):** `S14P11A402-번호` (필수)
* **컴포넌트 (Component):** `fe`, `be`, `pm`, `em` (선택 사항)

### 📝 작성 예시

* **Front-end:** `feat/login-ui-S14P11A402-56-fe`
* **Back-end:** `fix/jwt-token-error-S14P11A402-58-be`
* **Embedded:** `feat/camera-node-connect-S14P11A402-61-em`
* **Common/PM:** `docs/readme-commit-rule-S14P11A402-56-pm`

---

## 2. 💬 커밋 메시지 규칙 (Commit Message)

지라 연동을 위해 **이슈 키**를 포함해야 하며, **Gitmoji**를 사용하여 가독성을 높입니다.
*(아래 4번 항목의 자동화 스크립트를 적용하면 이 규칙이 자동으로 적용됩니다!)*

### ✅ 커밋 헤더 포맷

> **`[이슈키] [컴포넌트] 이모지 태그: 제목`**

* **Bad ❌:** `로그인 기능 구현`
* **Good ⭕:** `[S14P11A402-56] [FE] ✨ Feat: 로그인 기능 구현`

### 🎨 이모지 및 태그 리스트

| 이모지 | 단축키 | 태그 (Type) | 설명 |
| --- | --- | --- | --- |
| ✨ | `:sparkles:` | **Feat** | 새로운 기능 추가 |
| 🐛 | `:bug:` | **Fix** | 버그 수정 |
| 💄 | `:lipstick:` | **Design** | CSS, UI/UX 디자인 변경 (로직 변경 없음) |
| 📝 | `:memo:` | **Docs** | 문서 수정 (README, 주석, 위키 등) |
| ♻️ | `:recycle:` | **Refactor** | 코드 리팩토링 (기능 변경 없음, 구조 개선) |
| 🎨 | `:art:` | **Style** | 코드 포맷팅, 공백 등 (동작 영향 없음) |
| ✅ | `:white_check_mark:` | **Test** | 테스트 코드 추가 및 리팩토링 |
| 🔨 | `:hammer:` | **Chore** | 빌드 설정, 패키지 매니저, 라이브러리 설치 |

---

## 3. 🔀 Merge Request (MR) 규칙

코드를 `develop` 브랜치에 병합할 때 지켜야 할 프로세스입니다.

### 1️⃣ 기본 설정 (필수 🚨)

* **Change branches:** Target을 `master` ➡️ **`develop`**으로 반드시 변경!
* **Title:** `[지라키] 이모지 태그: 핵심 내용` (예: `[S14P11A402-56] ✨ Feat: 로그인 API 생성`)
* **Assignee:** 본인 지정 (`Assign to me`)
* **Reviewer:** 팀원 최소 1명 지정

### 2️⃣ Merge Options

* ✅ **Delete source branch:** **체크 (필수)** (머지 후 브랜치 삭제)
* ⬜ **Squash commits:** **체크 해제** (커밋 히스토리 보존)

### 3️⃣ MR 내용 템플릿

MR 생성 시 Description에 아래 내용을 작성합니다.

```markdown
## 📝 작업 요약
- (예시) 카카오톡 API 연동

## 😈 주의 해야 할 점
- (예시) KEY.env 파일 최신화 할 것

## ✅ 체크리스트
- [ ] Merge 되는 브랜치가 `develop`이 맞나요?
- [ ] 리뷰어를 지정했나요?

```

---

## 4. ⚡ 개발 환경 자동화 (필수 적용)

매번 형식을 맞추기 번거롭다면, 아래 스크립트를 터미널에 한 번만 실행하세요.
**커밋 메시지 자동 변환**과 **MR 생성 링크** 기능을 제공합니다.

### 🛠️ 1. Git Hook 설정 (커밋 메시지 자동화)

프로젝트 루트 경로에서 아래 코드를 복사하여 터미널에 실행하세요.
*(작동: `feat: 로그인` 입력 → `[S14P...-56] [FE] ✨ Feat: 로그인` 으로 자동 변환)*

```bash
# 1. 안전장치: .git 폴더가 있는지 확인
if [ ! -d ".git" ]; then
  echo "❌ 오류: Git 프로젝트 루트 폴더가 아닙니다. (.git 폴더가 있는 위치로 이동해주세요)"
else
  # 2. 훅 파일 작성 시작
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

# 컴포넌트 추출 및 대문자 변환 (호환성 개선)
COMPONENT=""
if [[ "$BRANCH_NAME" =~ -(fe|be|pm|em|common)$ ]]; then
    RAW_COMP=$(echo "$BRANCH_NAME" | awk -F'-' '{print $NF}')
    UPPER_COMP=$(echo "$RAW_COMP" | tr '[:lower:]' '[:upper:]')
    COMPONENT="[$UPPER_COMP] "
fi

if [ -n "$JIRA_KEY" ]; then
    if ! grep -q "$JIRA_KEY" "$COMMIT_MSG_FILE"; then
        # 맨 앞에 삽입: [키] [컴포넌트] 원래제목
        sed -i.bak -e "1s/^/[$JIRA_KEY] $COMPONENT/" "$COMMIT_MSG_FILE"
    fi
fi
# 임시 백업 파일 삭제 (깔끔하게)
rm -f "$COMMIT_MSG_FILE.bak"
EOF

  # 3. 실행 권한 부여
  chmod +x "$HOOK_FILE"
  
  echo "✅ Git Hook 설정이 완료되었습니다!"
  echo "이제 'feat: 로그인' 이라고 커밋하면 👉 '[S14P...-25] [FE] ✨ Feat: 로그인' 으로 자동 변환됩니다."
fi

```

---

### 🚀 2. MR 생성 단축키 설정 (git mr)

터미널에 아래 코드를 복사하여 실행하세요. `git mr` 명령어로 **제목이 완성된 MR 링크**를 생성할 수 있습니다.

```bash
git config --global alias.mr '!f() { \
    # 1. 브랜치 및 레포 정보 추출
    BRANCH=$(git symbolic-ref --short HEAD); \
    REPO_URL=$(git config --get remote.origin.url | sed "s/\.git$//"); \
    \
    # 2. 브랜치 이름 파싱
    TYPE=$(echo "$BRANCH" | cut -d"/" -f1); \
    DESC_PART=$(echo "$BRANCH" | cut -d"/" -f2); \
    KEY=$(echo "$DESC_PART" | grep -oE "S[0-9]+P[0-9]+A[0-9]+-[0-9]+"); \
    \
    # 설명 추출
    DESC=$(echo "$DESC_PART" | sed "s/-$KEY.*//" | sed "s/-/ /g"); \
    \
    # 3. 이모지 매핑
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
    \
    # 4. 타입 대문자 변환
    TYPE_CAP="$(tr "[:lower:]" "[:upper:]" <<< ${TYPE:0:1})${TYPE:1}"; \
    \
    # 5. 최종 URL 생성
    ENC_KEY="%5B$KEY%5D"; \
    ENC_DESC=$(echo "$DESC" | sed "s/ /%20/g"); \
    ENC_TITLE="$ENC_KEY%20$ENC_EMOJI%20$TYPE_CAP%3A%20$ENC_DESC"; \
    \
    # 6. 결과 출력
    echo ""; \
    echo "🚀 아래 링크를 클릭하세요 (git mr):"; \
    echo "$REPO_URL/-/merge_requests/new?merge_request%5Bsource_branch%5D=$BRANCH&merge_request%5Btarget_branch%5D=develop&merge_request%5Btitle%5D=$ENC_TITLE&merge_request%5Bforce_remove_source_branch%5D=true"; \
    echo ""; \
}; f'

```

### 사용 방법

1. 작업 후 `git push`
2. 터미널에 `git mr` 입력
3. 나오는 링크 클릭 → **제목과 옵션이 자동 완성된 MR 페이지로 이동**