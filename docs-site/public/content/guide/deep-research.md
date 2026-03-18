# Deep Research (자체 웹 검색)

Nexus Coder는 외부 검색 API(Tavily, SerpAPI, Google API) 없이 **자체 headless Chrome 엔진**으로 웹 리서치를 수행합니다.

## 개요

`search_request` 도구는 자동으로 호출되며, Naver와 Google을 동시에 검색하고 실제 소스 페이지를 방문하여 정보를 수집합니다. **Samsung Confluence (`https://confluence.samsungds.net`)도 기본으로 함께 검색**합니다.

::: tip 별도 설정 불필요
브라우저가 설치되어 있으면 바로 사용할 수 있습니다. API 키나 외부 서비스 등록이 필요 없습니다. Samsung Confluence 검색도 자동으로 포함됩니다.
:::

## 동작 방식

### 검색 엔진

| 엔진 | 역할 | 특징 |
|------|------|------|
| **Naver** | 1차 검색 | headless에서 안정적, CAPTCHA 없음 |
| **Google** | 2차 검색 | CAPTCHA 발생 시 자동 건너뜀 |
| **Samsung Confluence** | 사내 검색 | `confluence.samsungds.net` 자동 검색 |
| **StackOverflow** | 코딩 쿼리 | 기술 질문에 자동 활용 |
| **Wikipedia** | 사실 확인 | headless에서 항상 접근 가능 |

### 리서치 워크플로우

```
1. 쿼리 분석 (주제, 필요한 정보, 최신성 판단)
     ↓
2. Naver 검색 → 결과 추출 (상위 8건)
     ↓
3. 소스 페이지 2~3개 방문 → 본문 추출
     ↓
4. Google 검색 (Naver 결과 부족 시)
     ↓
5. 추가 소스 방문 → 교차 검증
     ↓
6. Samsung Confluence 검색 → 관련 페이지 방문
     ↓
7. 종합 답변 생성 (출처 포함)
```

### 주요 특징

- **Samsung Confluence 자동 검색**: 별도 설정 없이 `confluence.samsungds.net`을 항상 검색
- **교차 검증**: 숫자/가격 등은 반드시 2개 이상의 독립 소스에서 확인
- **날짜 인식**: 오늘 날짜를 자동 주입하여 최신 정보 여부 판단
- **차단 사이트 자동 우회**: Cloudflare 등으로 차단된 사이트는 즉시 건너뛰고 대안 소스 방문
- **출처 명시**: 모든 답변에 소스 URL과 추출된 핵심 정보 포함

## 추가 내부 소스 등록 (researchUrls)

Samsung Confluence 외에 다른 사내 시스템도 검색 대상에 추가할 수 있습니다.

### 설정 방법

`~/.nexus-coder/config.json`에서 `researchUrls`를 추가합니다:

```json
{
  "researchUrls": [
    { "name": "사내 위키", "url": "https://wiki.samsungds.net" }
  ]
}
```

::: info
Samsung Confluence는 자동 포함이므로 researchUrls에 별도로 추가할 필요 없습니다.
:::

### 반복 횟수 계산

```
기본: 40회 (Samsung Confluence 포함)
+ 추가 researchUrls 수 × 10회
```

## Planning LLM 연동

Planning LLM은 Samsung Confluence와 설정된 `researchUrls`를 자동으로 인식합니다. 리서치가 필요한 작업을 요청하면 Planning LLM이 `search_request` 도구를 활용하는 TODO를 자동 생성합니다.

## 사용 예시

### 기본 웹 + Confluence 리서치

```
"DRAM 테스트 자동화 프레임워크에 대해 조사해줘"
→ Naver/Google 검색 → Samsung Confluence 검색 → 관련 페이지 방문 → 종합 답변
```

### 순수 Confluence 리서치

```
"우리 팀의 CI/CD 파이프라인 설정을 찾아줘"
→ Naver/Google에서 일반 정보 검색 → Confluence에서 사내 문서 검색 → 종합 답변
```

## 제한사항

- headless 브라우저를 차단하는 사이트(openai.com, anthropic.com 등)는 직접 방문 불가
- Google CAPTCHA 발생 시 Google 검색 전체 건너뜀
- Confluence 접근에 SSO 인증이 필요할 수 있음 (최초 1회 로그인 필요)
