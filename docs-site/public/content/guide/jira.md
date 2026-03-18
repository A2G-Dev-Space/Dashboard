# Jira 연동

Hanseol은 브라우저를 직접 열어 Jira에 접속하여 이슈 관리 작업을 수행합니다. API 키 없이 브라우저 자동화로 동작합니다.

## 설정

`config.json`에 `browserServices`를 추가하면 `jira_request` 도구가 활성화됩니다:

```json
{
  "browserServices": [
    { "type": "jira", "name": "My Jira", "url": "https://jira.example.com" }
  ]
}
```

::: warning 설정 필수
`browserServices`에 Jira URL을 추가하지 않으면 `jira_request` 도구가 tool 목록에 표시되지 않습니다.
:::

## 동작 방식

### 가시적 브라우저 (Visible Mode)

Jira 도구는 **headless가 아닌 visible 모드**로 동작합니다. 에이전트가 브라우저를 열고 Jira 페이지에서 작업하는 과정을 직접 볼 수 있습니다.

### DOM 자동 탐색 (Inspect Before Act)

Jira 인스턴스마다 DOM 구조가 다를 수 있습니다 (Cloud vs Server vs Data Center, 플러그인, 커스텀 필드 등). 에이전트는 **하드코딩된 CSS 선택자를 사용하지 않고**, 매 페이지마다:

1. `browser_execute_script`로 실제 DOM 구조를 탐색
2. 발견된 요소(폼 필드, 버튼, 테이블 등)를 분석
3. 실제 선택자를 기반으로 상호작용

이 방식으로 Cloud, Server, Data Center 어떤 환경이든 적응합니다.

### 인증

SSO나 비밀번호 로그인이 필요한 경우, 에이전트가 로그인 페이지를 감지합니다:

1. 처음 접속 시 visible 모드로 로그인 페이지 표시
2. 사용자가 수동으로 로그인
3. 세션 쿠키가 브라우저 프로필에 저장
4. 이후 접속 시 자동 인증

::: info 브라우저 프로필
서브에이전트는 전용 브라우저 프로필(`~/.hanseol/browser-profile/`)을 사용합니다. 한번 로그인하면 세션이 유지됩니다.
:::

## 주요 기능

### 1. 이슈 조회 (JQL 검색)

나에게 할당된 이슈, 내가 워처(co-worker)로 등록된 이슈 등을 JQL로 검색합니다.

```
"나에게 할당된 이슈 전부 보여줘"
→ JQL: assignee = currentUser() AND status != Done ORDER BY updated DESC

"내가 워처로 등록된 이슈도 포함해서 보여줘"
→ 할당 이슈 + 워처 이슈 두 쿼리 실행 → 정리된 목록 반환
```

JQL URL 인코딩은 `encodeURIComponent()`를 통해 안전하게 처리됩니다.

### 2. 이슈 생성

Epic, Story, Task, Bug, Sub-task 등 다양한 이슈 타입을 생성합니다.

::: warning 2단계 확인 플로우
이슈 생성은 반드시 **사용자 확인 후** 제출됩니다:
1. **Phase A**: 폼 필드 탐색 → 값 입력 → 입력값 확인 요청 반환
2. **Phase B** (사용자 확인 후): 폼 재입력 → Submit
:::

#### 이슈 타입별 동적 필드 처리

Issue Type을 변경하면 폼 필드가 동적으로 바뀝니다:

| Issue Type | 추가되는 필드 |
|-----------|--------------|
| Epic | Epic Name |
| Story / Task | Epic Link (상위 Epic 연결) |
| Sub-task | Parent Issue (필수) |
| Bug | Steps to Reproduce, Expected/Actual Result |

에이전트는 타입 변경 후 **자동으로 폼을 재탐색**하여 새로 나타난 필드를 발견하고 채웁니다.

### 3. 코멘트 추가

기존 이슈에 코멘트를 추가합니다.

```
"PROJ-123에 '코드 리뷰 완료, 머지 가능' 코멘트 달아줘"
→ 이슈 페이지 접속 → 코멘트 에디터 열기 → 텍스트 입력 → 제출 → 확인
```

### 4. 이슈 상세 조회

특정 이슈의 상세 정보(제목, 상태, 담당자, 설명, 최근 코멘트 등)를 조회합니다.

```
"PROJ-456 이슈 상세 내용 보여줘"
```

### 5. 상태 전환

이슈의 워크플로우 상태를 변경합니다 (예: Open → In Progress → Done).

```
"PROJ-789를 In Progress로 변경해줘"
```

## 파라미터

| 파라미터 | 필수 | 설명 |
|----------|------|------|
| `instruction` | O | 수행할 Jira 작업에 대한 자연어 지시 |
| `source` | X | Jira URL (설정된 URL과 다른 인스턴스 사용 시) |

## 사용 예시

```
"내 이슈 전부 보여줘"
"PROJ 프로젝트에 Bug 만들어줘. 제목은 '로그인 타임아웃 수정', 담당자는 kim.dev"
"PROJ-123에 '배포 완료' 코멘트 달아줘"
"PROJ-456 상태를 Done으로 바꿔줘"
"이번 스프린트 미완료 이슈 보여줘"
```

## 지원 환경

| 환경 | 지원 |
|------|------|
| Jira Cloud | O |
| Jira Server | O |
| Jira Data Center | O |
| SSO 인증 | O (최초 1회 수동 로그인) |

::: tip maxIterations
Jira 작업은 최대 30회 반복(iteration)으로 실행됩니다. 복잡한 작업(이슈 생성 + 필드 탐색)도 충분히 처리할 수 있습니다.
:::
