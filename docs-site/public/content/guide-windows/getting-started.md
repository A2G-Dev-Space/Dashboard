# Getting Started

Nexus Bot 설치 및 시작 가이드입니다.

::: info VWP / 해외연 사용자 방화벽 설정
VWP 또는 해외연 환경에서는 아래 방화벽을 해제해야 Nexus Coder를 사용할 수 있습니다.

| 서버 IP | 포트 |
|---------|------|
| `12.81.222.45` | 13000, 4090, 8090, 443 |
| `12.81.222.41` | 36810, 8090, 443 |

**자동 업데이트 제한사항:**
- 위 방화벽 해제만으로는 **자동 업데이트가 지원되지 않습니다.**
- 자동 업데이트는 `13000` 포트로 **100MB 이상 통신이 가능한 환경**에서만 동작합니다.
- 자동 업데이트가 불가한 경우 [다운로드 페이지](/nexus-bot)에서 최신 설치 파일을 직접 다운로드하여 설치하세요.
:::

::: tip 부서 LLM 연동 안내
부서 내 서빙 중인 LLM이 있다면, **부서원 한정 공개**로 Nexus Bot에 연결해드릴 수 있습니다.
연동을 원하시면 **syngha.han**으로 연락 부탁드립니다.
:::

## 시스템 요구사항

| 항목 | 요구사항 |
|------|---------|
| **OS** | Windows 10/11 (x64) |
| **네트워크** | 사내망 접속 가능 |
| **기타** | Node.js, WSL 설치 불필요 |

::: tip CLI 버전과의 차이
Windows 버전은 **GUI 기반** 데스크톱 앱입니다. CLI(WSL) 버전과 동일한 AI 엔진을 사용하지만, 채팅형 인터페이스를 통해 더 직관적으로 사용할 수 있습니다.
:::

## 다운로드

A2G 파일 서버에서 설치 파일을 다운로드합니다:

**[Nexus Bot Setup 5.0.9 다운로드](http://a2g.samsungds.net:13000/nexus-coder-for-windows/Nexus%20Bot%20(For%20Windows)-Setup-5.0.9.exe)** (~99MB)

::: warning 다운로드가 안 될 경우
- 사내망에 연결되어 있는지 확인하세요
- MinIO 브라우저에서 직접 다운로드: [http://a2g.samsungds.net:13001/browser/nexus-coder-for-windows](http://a2g.samsungds.net:13001/browser/nexus-coder-for-windows)
- 프록시 설정이 사내 주소를 차단하고 있지 않은지 확인하세요
:::

## 설치

1. 다운로드한 `Nexus Bot (For Windows)-Setup-5.0.9.exe` 실행
2. 설치 경로 선택 (기본값 권장)
3. **Install** 클릭
4. 설치 완료 후 **Run Nexus Bot** 체크하고 **Finish**

::: info 설치 경로
기본 설치 경로: `C:\Users\{사용자}\AppData\Local\Programs\Nexus Bot (For Windows)`

설치 시 경로를 변경할 수 있습니다.
:::

## 첫 실행

앱을 처음 실행하면 SSO 로그인이 진행됩니다:

1. **앱 실행** - 바탕화면 아이콘 또는 시작 메뉴
2. **SSO 로그인** - 브라우저가 자동으로 열립니다
3. **Samsung 계정 로그인** - DS 포털 계정으로 인증
4. **사용 준비 완료** - 앱으로 돌아가면 채팅 인터페이스가 표시됩니다

::: danger NO_PROXY 설정 (중요)
Windows 환경변수에 다음 NO_PROXY 설정이 필요할 수 있습니다:

**설정 → 시스템 → 정보 → 고급 시스템 설정 → 환경 변수**

| 변수 | 값 |
|------|-----|
| `NO_PROXY` | `a2g.samsungds.net,genai.samsungds.net` |

또는 PowerShell에서:
```powershell
[Environment]::SetEnvironmentVariable("NO_PROXY", "a2g.samsungds.net,genai.samsungds.net", "User")
```
:::

## 설치 위치

| 항목 | 경로 |
|------|------|
| 앱 실행 파일 | `C:\Users\{사용자}\AppData\Local\Programs\Nexus Bot (For Windows)\` |
| 설정 파일 | `C:\Users\{사용자}\.nexus-coder\config.json` |
| 인증 정보 | `C:\Users\{사용자}\.nexus-coder\auth.json` |
| 문서 저장 | `C:\Users\{사용자}\.nexus-coder\docs\` |
| 프로젝트 로그 | `C:\Users\{사용자}\.nexus-coder\projects\` |

## 자동 업데이트

앱 시작 시 자동으로 최신 버전을 확인합니다:

1. 앱 시작 5초 후 업데이트 서버 확인
2. 새 버전이 있으면 백그라운드에서 다운로드
3. **"업데이트 준비 완료"** 다이얼로그 표시
4. **"지금 설치"** 클릭 시 자동 설치 및 재시작

::: tip 수동 업데이트
자동 업데이트가 동작하지 않으면 [다운로드 페이지](/nexus-bot)에서 최신 버전을 직접 다운로드하여 설치하세요.
:::

## 다음 단계

- [기본 사용법](/guide-windows/basic-usage) 알아보기
- [FAQ](/guide-windows/faq) 확인하기
