---
layout: home

hero:
  name: "AI Services"
  text: "Enterprise AI Platform"
  tagline: 삼성 DS를 위한 AI 서비스 포털
---

<div class="services-container">
  <h2 class="services-title">🎯 Available Services</h2>

  <a href="/docs/nexus-coder" class="service-card active">
    <div class="service-icon">🚀</div>
    <div class="service-content">
      <div class="service-header">
        <h3>Nexus Coder</h3>
        <span class="status-badge available">Available</span>
      </div>
      <p class="service-subtitle">Vibe Coding Tool for WSL</p>
      <p class="service-desc">
        CLI 기반 AI Coding Agent로 완벽한 개발 자동화를 제공합니다.<br>
        코드 작성, 리팩토링, 디버깅을 AI와 함께 수행하세요.
      </p>
      <div class="service-tags">
        <span class="tag">WSL</span>
        <span class="tag">CLI</span>
        <span class="tag">Coding Agent</span>
      </div>
    </div>
    <div class="service-arrow">→</div>
  </a>

  <a href="/docs/nexus-coder-windows" class="service-card coming-soon">
    <div class="service-icon">💻</div>
    <div class="service-content">
      <div class="service-header">
        <h3>Nexus Coder for Windows</h3>
        <span class="status-badge soon">Coming Soon</span>
      </div>
      <p class="service-subtitle">Vibe Coding Tool for Windows</p>
      <p class="service-desc">
        Windows 환경에서 직접 사용 가능한 Coding Agent입니다.<br>
        WSL 없이 네이티브 Windows에서 실행됩니다.
      </p>
      <div class="service-tags">
        <span class="tag">Windows</span>
        <span class="tag">Native</span>
        <span class="tag">Coding Agent</span>
      </div>
    </div>
    <div class="service-arrow">→</div>
  </a>

  <a href="/docs/aipo" class="service-card coming-soon">
    <div class="service-icon">✨</div>
    <div class="service-content">
      <div class="service-header">
        <h3>Aipo</h3>
        <span class="status-badge soon">Coming Soon</span>
      </div>
      <p class="service-subtitle">Smart Posting App</p>
      <p class="service-desc">
        개인 업무 효율화를 위한 AI 포스팅 도구입니다.<br>
        문서 작성, 요약, 번역 등 다양한 기능을 제공합니다.
      </p>
      <div class="service-tags">
        <span class="tag">Productivity</span>
        <span class="tag">Writing</span>
        <span class="tag">AI Assistant</span>
      </div>
    </div>
    <div class="service-arrow">→</div>
  </a>
</div>

<style>
.services-container {
  max-width: 900px;
  margin: 0 auto;
  padding: 24px 24px;
}

.services-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin-bottom: 16px;
  text-align: center;
}

.service-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  margin-bottom: 12px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  text-decoration: none !important;
  color: inherit;
  transition: all 0.3s ease;
}

.service-card * {
  text-decoration: none !important;
}

.service-card:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
  text-decoration: none !important;
}

.service-card.coming-soon {
  opacity: 0.7;
}

.service-card.coming-soon:hover {
  opacity: 0.85;
}

.service-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--vp-c-brand-soft) 0%, var(--vp-c-bg) 100%);
  border-radius: 12px;
}

.service-content {
  flex: 1;
  min-width: 0;
}

.service-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 2px;
}

.service-header h3 {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.status-badge {
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.status-badge.available {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
}

.status-badge.soon {
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  color: white;
}

.service-subtitle {
  margin: 0 0 4px 0;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
  font-weight: 500;
}

.service-desc {
  margin: 0 0 8px 0;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
  line-height: 1.5;
}

.service-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.tag {
  padding: 2px 8px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  font-size: 0.7rem;
  color: var(--vp-c-text-2);
}

.service-arrow {
  font-size: 1.25rem;
  color: var(--vp-c-text-3);
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.service-card:hover .service-arrow {
  transform: translateX(4px);
  color: var(--vp-c-brand-1);
}

@media (max-width: 640px) {
  .service-card {
    flex-direction: column;
    text-align: center;
    padding: 16px;
  }

  .service-header {
    justify-content: center;
    flex-wrap: wrap;
  }

  .service-tags {
    justify-content: center;
  }

  .service-arrow {
    display: none;
  }
}
</style>
