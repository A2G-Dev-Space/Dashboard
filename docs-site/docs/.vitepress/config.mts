import { defineConfig } from 'vitepress'

// 서비스 정의 (새 서비스 추가 시 여기에 추가)
const services = [
  {
    id: 'nexus-coder',
    name: 'Nexus Coder',
    description: 'Vibe Coding Tool for WSL',
    basePath: '/nexus-coder',
    icon: '🚀',
    enabled: true,
  },
  {
    id: 'nexus-coder-windows',
    name: 'Nexus Coder for Windows',
    description: 'Vibe Coding Tool for Windows',
    basePath: '/nexus-coder-windows',
    icon: '💻',
    enabled: true,
  },
  {
    id: 'aipo-web',
    name: 'ONCE',
    description: '자동 지식 저장/공유 시스템',
    basePath: '/aipo-web',
    icon: '📝',
    enabled: true,
  },
]

export default defineConfig({
  title: 'AI Services',
  description: 'Enterprise AI Services Documentation',

  // /docs 경로에서 서빙되므로 base 설정 필수
  base: '/docs/',

  // 폐쇄망용: 외부 리소스 비활성화
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/docs/images/logo.png' }],
    // 외부 리소스 차단 - CSP 설정
    ['meta', {
      'http-equiv': 'Content-Security-Policy',
      content: "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; img-src 'self' data:; font-src 'self' data:;"
    }],
  ],

  // 라이트모드를 기본으로 설정
  appearance: 'light',

  // 정적 빌드 설정 (docker-compose에서 docs/.vitepress/dist 마운트)
  // config.mts 위치 기준 상대경로
  outDir: './../.vitepress/dist',

  themeConfig: {
    logo: '/images/logo.png',

    nav: [
      { text: 'Home', link: '/' },
      {
        text: 'Services',
        items: services.map(s => ({
          text: `${s.icon} ${s.name}${s.enabled ? '' : ' (Coming Soon)'}`,
          link: s.basePath
        }))
      },
      { text: 'Demos', link: '/demos/' },
      { text: 'Feedback', link: '/feedback', target: '_self' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '🚀 Nexus Coder',
          collapsed: false,
          items: [
            {
              text: 'Introduction',
              items: [
                { text: 'Getting Started', link: '/guide/getting-started' },
              ]
            },
            {
              text: 'Usage',
              items: [
                { text: 'Basic Usage', link: '/guide/basic-usage' },
                { text: 'Advanced Usage', link: '/guide/advanced-usage' },
                { text: 'Compact Mode', link: '/guide/compact' },
              ]
            },
            {
              text: 'Tools',
              items: [
                { text: 'Browser Tools', link: '/guide/browser-tools' },
                { text: 'Office Tools', link: '/guide/office-tools' },
                { text: 'WSL Setup', link: '/guide/wsl-setup' },
              ]
            }
          ]
        }
      ],
      '/demos/': [
        {
          text: '🎬 Demos',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/demos/' },
            { text: 'Understanding Codebase', link: '/demos/understanding-codebase' },
            { text: 'Vibe Coding Streamlit', link: '/demos/vibe-coding-streamlit' },
            { text: 'Vibe Coding React', link: '/demos/vibe-coding-react' },
            { text: 'Office Automation', link: '/demos/office-automation' },
            { text: 'Git Automation', link: '/demos/git-automation' },
          ]
        }
      ],
      '/aipo-web/': [
        {
          text: '📝 ONCE',
          collapsed: false,
          items: [
            { text: 'Overview', link: '/aipo-web/' },
            {
              text: 'Guide',
              items: [
                { text: '시작하기', link: '/aipo-web/guide/getting-started' },
                { text: '기본 사용법', link: '/aipo-web/guide/basic-usage' },
                { text: '팀 협업', link: '/aipo-web/guide/collaboration' },
                { text: '고급 기능', link: '/aipo-web/guide/advanced' },
              ]
            },
            {
              text: 'Reference',
              items: [
                { text: 'FAQ', link: '/aipo-web/faq' },
              ]
            }
          ]
        }
      ],
      '/guide-windows/': [
        {
          text: '💻 Nexus Coder for Windows',
          collapsed: false,
          items: [
            {
              text: 'Introduction',
              items: [
                { text: 'Getting Started', link: '/guide-windows/getting-started' },
              ]
            },
            {
              text: 'Usage',
              items: [
                { text: 'Basic Usage', link: '/guide-windows/basic-usage' },
              ]
            },
            {
              text: 'Reference',
              items: [
                { text: 'FAQ', link: '/guide-windows/faq' },
              ]
            }
          ]
        }
      ]
    },

    socialLinks: [
      // 폐쇄망이므로 외부 링크 제거 또는 내부 링크로 변경
    ],

    footer: {
      message: 'Developed by syngha.han',
      copyright: 'AX Portal - Internal Use Only'
    },

    search: {
      provider: 'local'  // 로컬 검색 (외부 Algolia 대신)
    }
  },

  // Markdown 설정
  markdown: {
    lineNumbers: true
  },

  // Vite 설정 (폐쇄망 최적화)
  vite: {
    // 외부 리소스 차단
    build: {
      rollupOptions: {
        external: []
      }
    }
  }
})
