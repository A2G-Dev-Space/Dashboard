---
layout: home

hero:
  name: "Nexus Coder"
  text: "완벽한 코딩 자동화를 꿈꾸며"
  tagline: 삼성 DS를 위한 Vibe Coder
  actions:
    - theme: brand
      text: 시작하기
      link: /guide/getting-started
    - theme: alt
      text: Vibe Coding 데모
      link: /demos/

features:
  - icon: 🎯
    title: Vibe Coding
    details: 자연어로 요구사항을 설명하면 AI가 코드를 작성합니다. 복잡한 프로젝트도 대화로 완성하세요.
    link: /demos/vibe-coding-react
    linkText: 데모 보기
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
  - icon: 🎯
    title: Planning Mode
    details: 복잡한 작업을 TODO 리스트로 분해하여 체계적으로 실행합니다.
    link: /guide/advanced-usage
    linkText: 더 알아보기
  - icon: 🔒
    title: Air-Gapped Ready
    details: 폐쇄망 환경에서 완벽하게 동작하도록 설계되었습니다.
    link: /guide/getting-started
    linkText: 설치 방법
  - icon: ⚡
    title: Context Management
    details: 긴 대화도 자동 압축으로 컨텍스트를 효율적으로 관리합니다.
    link: /guide/compact
    linkText: 자세히 보기
---

## 빠른 시작

::: warning 필수 환경
- **Linux 또는 WSL 환경에서만 동작합니다** (PowerShell/VWP 미지원)
- NO_PROXY 설정 필수: `export NO_PROXY="10.229.95.228,10.229.95.220,a2g.samsungds.net,genai.samsungds.net,$NO_PROXY"`
:::

Node.js 설치 없이 바이너리로 바로 실행:

```bash
# 0. NO_PROXY 설정 (필수)
echo 'export NO_PROXY="10.229.95.228,10.229.95.220,a2g.samsungds.net,genai.samsungds.net,$NO_PROXY"' >> ~/.bashrc
echo 'export no_proxy="10.229.95.228,10.229.95.220,a2g.samsungds.net,genai.samsungds.net,$no_proxy"' >> ~/.bashrc
source ~/.bashrc

# 1. 다운로드
mkdir -p ~/nexus-download && cd ~/nexus-download
wget http://a2g.samsungds.net:13000/nexus-coder/cli/nexus-5.0.2.gz
wget http://a2g.samsungds.net:13000/nexus-coder/cli/yoga.wasm

# 2. 압축 해제 및 실행
gunzip nexus-5.0.2.gz && mv nexus-5.0.2 nexus && chmod +x nexus
./nexus

# 3. 셸 리로드 후 어디서든 실행
source ~/.bashrc && nexus
```

자세한 설치 방법은 [Getting Started](/guide/getting-started)를 참조하세요.
