---
layout: home

hero:
  name: "AI Services"
  text: "Enterprise AI Platform"
  tagline: 삼성 DS를 위한 AI 서비스 포털

features:
  - icon: 🚀
    title: Nexus Coder
    details: Vibe Coding Tool for WSL - CLI 기반 AI Coding Agent로 완벽한 개발 자동화를 제공합니다.
    link: /nexus-coder
    linkText: 시작하기
  - icon: 💻
    title: Nexus Coder for Windows
    details: Vibe Coding Tool for Windows - Windows 환경에서 직접 사용 가능한 Coding Agent입니다.
    link: /nexus-coder-windows
    linkText: Coming Soon
  - icon: ✨
    title: Aipo
    details: Smart Posting App - 개인 업무 효율화를 위한 AI 포스팅 도구입니다.
    link: /aipo
    linkText: Coming Soon
---

<style>
/* Coming Soon 스타일 */
.VPFeature:has(a[href="/nexus-coder-windows"]),
.VPFeature:has(a[href="/aipo"]) {
  opacity: 0.6;
  position: relative;
}

.VPFeature:has(a[href="/nexus-coder-windows"])::after,
.VPFeature:has(a[href="/aipo"])::after {
  content: "개발중";
  position: absolute;
  top: 12px;
  right: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}
</style>
