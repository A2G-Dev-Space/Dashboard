---
layout: home

hero:
  name: "Nexus Coder for Windows"
  text: "Windows 네이티브 Vibe Coding Tool"
  tagline: WSL 없이 Windows에서 바로 사용하는 AI Coding Agent
  actions:
    - theme: brand
      text: 다운로드 (v4.0.10)
      link: http://a2g.samsungds.net:13000/nexus-coder-for-windows/Nexus%20Coder%20(For%20Windows)-Setup-4.0.10.exe
    - theme: alt
      text: 사용 가이드
      link: /guide-windows/getting-started

features:
  - icon: 💻
    title: Native Windows Support
    details: WSL 설치 없이 Windows 10/11에서 설치 파일(.exe)로 바로 실행됩니다. GUI 기반 채팅 인터페이스를 제공합니다.
  - icon: 🔐
    title: SSO 자동 로그인
    details: Samsung DS GenAI Portal SSO를 통해 자동으로 인증됩니다. 별도 API Key 설정이 필요 없습니다.
  - icon: 🔄
    title: 자동 업데이트
    details: 앱 시작 시 자동으로 최신 버전을 확인하고 백그라운드에서 업데이트합니다.
  - icon: 🎯
    title: Vibe Coding
    details: 자연어로 요구사항을 설명하면 AI가 코드를 작성합니다. 복잡한 프로젝트도 대화로 완성하세요.
    link: /demos/vibe-coding-react
    linkText: 데모 보기
  - icon: 📄
    title: Office Automation
    details: Word, Excel, PowerPoint를 AI가 직접 조작하여 문서 작성부터 데이터 분석까지 자동화합니다.
    link: /guide/office-tools
    linkText: 사용법 보기
  - icon: 🌐
    title: Browser Automation
    details: Chrome/Edge 브라우저를 제어하여 웹 테스트, 스크린샷, 데이터 수집 등을 자동화합니다.
    link: /guide/browser-tools
    linkText: 사용법 보기
---

## 빠른 시작

::: tip 설치 환경
- **Windows 10/11 (x64)** 에서 동작합니다
- 사내망 접속이 가능해야 합니다
:::

### 1. 다운로드

아래 버튼을 클릭하여 설치 파일을 다운로드합니다:

**[Nexus Coder (For Windows) Setup 4.0.10 다운로드](http://a2g.samsungds.net:13000/nexus-coder-for-windows/Nexus%20Coder%20(For%20Windows)-Setup-4.0.10.exe)** (~99MB)

::: warning 다운로드가 안 될 경우
- 사내망에 연결되어 있는지 확인하세요
- 브라우저에서 `http://a2g.samsungds.net:13001/browser/nexus-coder-for-windows` 에 접속하여 직접 다운로드할 수 있습니다
:::

### 2. 설치

다운로드한 `Nexus Coder (For Windows)-Setup-4.0.10.exe`를 실행합니다.

- 설치 경로를 선택하고 **Install** 클릭
- 기본 경로: `C:\Users\{사용자}\AppData\Local\Programs\Nexus Coder (For Windows)`

### 3. 실행

설치 완료 후 바탕화면 아이콘 또는 시작 메뉴에서 **Nexus Coder (For Windows)** 를 실행합니다.

1. SSO 로그인 페이지가 브라우저에서 자동으로 열립니다
2. Samsung 계정으로 로그인합니다
3. 로그인 완료 후 앱으로 돌아가면 사용 준비 완료!

자세한 설치 방법은 [Getting Started](/guide-windows/getting-started)를 참조하세요.

<style>
.VPHero .text {
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #ec4899 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
</style>
