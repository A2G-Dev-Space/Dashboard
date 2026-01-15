---
layout: home

hero:
  name: "AI Services"
  text: "Enterprise AI Platform"
  tagline: 삼성 DS를 위한 AI 서비스 문서 포털
  actions:
    - theme: brand
      text: Nexus Coder 시작하기
      link: /guide/getting-started
    - theme: alt
      text: Vibe Coding 데모
      link: /demos/

features:
  - icon: 🚀
    title: Nexus Coder
    details: CLI 기반 AI Coding Agent. Vibe Coding, Browser/Office Automation으로 완벽한 개발 자동화를 제공합니다.
    link: /guide/getting-started
    linkText: 문서 보기
  - icon: 🎯
    title: Planning Mode
    details: 복잡한 작업을 TODO 리스트로 분해하여 체계적으로 실행합니다.
    link: /guide/advanced-usage
    linkText: 더 알아보기
  - icon: 🌐
    title: Browser Automation
    details: Chrome 브라우저를 직접 제어하여 Frontend 개발을 완벽하게 자동화합니다.
    link: /guide/browser-tools
    linkText: 사용법 보기
  - icon: 📄
    title: Office Automation
    details: Word, Excel, PowerPoint를 AI가 직접 조작하여 문서화까지 한 번에 처리합니다.
    link: /guide/office-tools
    linkText: 사용법 보기
  - icon: 🔒
    title: Air-Gapped Ready
    details: 폐쇄망 환경에서 완벽하게 동작하도록 설계되었습니다.
    link: /guide/installation
    linkText: 설치 방법
  - icon: ⚡
    title: Context Management
    details: 긴 대화도 자동 압축으로 컨텍스트를 효율적으로 관리합니다.
    link: /guide/compact
    linkText: 자세히 보기
---

## 빠른 시작 - Nexus Coder

Node.js 설치 없이 바이너리로 바로 실행:

```bash
# 1. 다운로드
mkdir -p ~/nexus-download && cd ~/nexus-download
wget https://github.samsungds.net/syngha-han/nexus-coder/raw/main/nexus.gz --no-check-certificate
wget https://github.samsungds.net/syngha-han/nexus-coder/raw/main/yoga.wasm --no-check-certificate

# 2. 압축 해제 및 실행
gunzip nexus.gz && chmod +x nexus
./nexus

# 3. 셸 리로드 후 어디서든 실행
source ~/.bashrc && nexus
```

자세한 설치 방법은 [Installation](/guide/installation)을 참조하세요.
