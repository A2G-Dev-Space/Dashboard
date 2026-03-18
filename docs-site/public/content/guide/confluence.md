# Confluence 연동

Nexus Coder는 Samsung Confluence (`https://confluence.samsungds.net`) 페이지를 자유롭게 검색하고 편집할 수 있습니다. **별도 설정 없이 바로 사용 가능**합니다.

| 기능 | 도구 | 설명 |
|------|------|------|
| **검색** | `search_request` | Deep Research 시 Confluence 자동 검색 (설정 불필요) |
| **편집/생성** | `confluence_request` | 특정 페이지를 열어 직접 수정 (항상 활성화) |

::: tip Samsung Confluence 기본 내장
`https://confluence.samsungds.net`이 기본으로 등록되어 있어 별도 설정 없이 검색과 편집이 모두 가능합니다.
:::

## Confluence 검색 (search_request)

Deep Research 실행 시 웹 검색(Naver/Google) 이후 자동으로 Samsung Confluence 검색을 수행합니다.

### 동작 방식

1. Confluence 검색 페이지로 이동 (`confluence.samsungds.net/wiki/search?text={query}`)
2. 검색 결과에서 관련 페이지 선택
3. 페이지 방문 후 내용 추출
4. 웹 검색 결과와 함께 종합 답변 생성

### 사용 예시

```
"프로젝트 인증 가이드를 찾아서 정리해줘"
→ Google/Naver 검색 + Samsung Confluence 검색 → 관련 페이지 방문 → 종합 답변
```

## Confluence 편집 (confluence_request)

`confluence_request`는 브라우저를 직접 열어 Confluence 페이지를 수정합니다.

::: warning 가시적 브라우저
편집 시 브라우저가 화면에 보입니다 (headless: false). 에이전트가 페이지를 열고 수정하는 과정을 직접 확인할 수 있습니다.
:::

### 파라미터

| 파라미터 | 필수 | 설명 |
|----------|------|------|
| `target_url` | O | 편집할 페이지 URL 또는 생성할 스페이스 URL |
| `instruction` | O | 수정/생성할 내용에 대한 상세 지시 |

### 지원 기능

#### 에디터 자동 감지

Confluence Cloud (ProseMirror)와 Server (TinyMCE) 에디터를 자동으로 감지합니다.

#### 매크로 지원

| 매크로 | Cloud | Server |
|--------|-------|--------|
| 코드 블록 | `<div data-node-type="codeBlock">` | `{code:language=js}` |
| 정보 패널 | `<div data-panel-type="info">` | `{info}...{info}` |
| 경고 패널 | `<div data-panel-type="warning">` | `{warning}...{warning}` |
| 확장/축소 | `{expand:title}...{expand}` | 동일 |
| 상태 라벨 | `<span data-macro-name="status">` | 동일 |

Cloud에서는 `/` 입력으로 매크로 메뉴를 열어 삽입합니다.

#### 테이블 편집

- 테이블 구조 읽기 (행/열 수, 헤더, 미리보기)
- 특정 셀 클릭 후 내용 수정
- 행/열 추가 (Cloud: "+" 버튼, Server: 도구막대)

#### 리치 텍스트 서식

| 서식 | 단축키/방법 |
|------|------------|
| 굵게 | `Ctrl+B` |
| 기울임 | `Ctrl+I` |
| 제목 (H1~H3) | `# `, `## `, `### ` 입력 |
| 글머리 기호 목록 | `* ` 또는 `- ` 입력 |
| 번호 목록 | `1. ` 입력 |
| 링크 | `Ctrl+K` |
| 멘션 | `@이름` 입력 |

### 사용 예시

#### 기존 페이지 수정

```
"이 Confluence 페이지의 '배포 절차' 섹션에 Docker 배포 단계를 추가해줘"
→ target_url: https://confluence.samsungds.net/wiki/spaces/TEAM/pages/12345
→ instruction: '배포 절차' 섹션 하단에 Docker 배포 3단계 추가
```

#### 새 페이지 생성

```
"TEAM 스페이스에 '온보딩 가이드' 페이지를 만들어줘"
→ target_url: https://confluence.samsungds.net/wiki/spaces/TEAM/pages/create
→ instruction: 온보딩 가이드 작성 (계정 설정, 개발환경, 코드 리뷰 절차)
```

## 인증

Samsung SSO 인증이 필요합니다. 에이전트가 로그인 페이지를 감지하면 인증을 시도합니다. 이전에 브라우저 프로필에서 로그인한 적이 있으면 세션이 유지됩니다.

::: info 브라우저 프로필
서브에이전트는 전용 브라우저 프로필(`~/.nexus-coder/browser-profile/`)을 사용합니다. 한번 SSO 로그인하면 세션이 유지되어 이후 접근 시 재인증이 필요 없습니다.
:::
