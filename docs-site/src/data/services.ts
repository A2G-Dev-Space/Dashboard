export interface ServiceInfo {
  id: string;
  name: string;
  tagline: string;
  description: string;
  icon: string;
  gradient: string;
  path: string;
  status: 'stable' | 'beta' | 'new';
  features: { icon: string; title: string; description: string }[];
  guides: { path: string; label: string }[];
  downloadUrl?: string;
  version?: string;
}

export const services: ServiceInfo[] = [
  {
    id: 'nexus-coder',
    name: 'Nexus Coder',
    tagline: 'AI Vibe Coding Agent for WSL',
    description: '자연어로 요구사항을 설명하면 AI가 코드를 작성합니다. Jira, Confluence 자동 연동 + Knox Messenger로 모바일에서도 사용 가능.',
    icon: '⚡',
    gradient: 'from-blue-500 to-cyan-400',
    path: '/nexus-coder',
    status: 'stable',
    version: '5.2.0',
    // CLI는 자동 업데이트 — 수동 다운로드 없음
    features: [
      { icon: '🎯', title: 'Vibe Coding', description: '자연어 대화로 코드 작성, 리팩토링, 디버깅을 모두 처리합니다.' },
      { icon: '📱', title: 'Knox Messenger 연동', description: '모바일/PC Knox Messenger에서 Jarvis에게 원격으로 업무 지시. 어디서든 내 컴퓨터의 AI 비서를 조작할 수 있습니다.' },
      { icon: '🔍', title: 'Jira / Confluence 자동 연동', description: '"나한테 할당된 이슈 정리해줘" 한마디로 Jira 이슈 조회, Confluence 멘션 페이지 검색을 자동으로 수행합니다.' },
      { icon: '🤖', title: 'Jarvis 자율 비서', description: '근무시간(9~18시) 동안 입력이 없으면 자동으로 Jira/Confluence/TODO를 체크하고 Knox Messenger로 알려줍니다.' },
      { icon: '🧠', title: '모델 변경 & 장기기억', description: '"모델 바꿔줘", "장기기억 알려줘" 등 채팅으로 LLM 모델 전환 및 영구 기억 관리가 가능합니다.' },
      { icon: '🌐', title: 'Browser Automation', description: 'Chrome/Edge를 직접 제어하여 Jira 이슈 생성, Confluence 페이지 편집을 자동화합니다.' },
      { icon: '📄', title: 'Office Automation', description: 'Word, Excel, PowerPoint를 AI가 직접 조작합니다.' },
      { icon: '📋', title: 'Planning Mode', description: '복잡한 작업을 TODO 리스트로 분해하여 체계적으로 실행합니다.' },
      { icon: '🗜️', title: 'Context Compression', description: '모델 컨텍스트 70% 초과 시 장기기억 자동 저장 후 대화 압축. 긴 대화도 끊김 없이.' },
    ],
    guides: [
      { path: '/guide/getting-started', label: '시작하기' },
      { path: '/guide/basic-usage', label: '기본 사용법' },
      { path: '/guide/advanced-usage', label: '고급 사용법' },
      { path: '/guide/browser-tools', label: 'Browser Tools' },
      { path: '/guide/office-tools', label: 'Office Tools' },
      { path: '/guide/deep-research', label: 'Deep Research' },
      { path: '/guide/confluence', label: 'Confluence 연동' },
      { path: '/guide/jira', label: 'Jira 연동' },
      { path: '/guide/knox-messenger', label: 'Knox Messenger (Jarvis)' },
      { path: '/guide/jarvis-memory', label: 'Jarvis 장기기억 & 모델 관리' },
      { path: '/guide/compact', label: 'Context 관리' },
      { path: '/guide/wsl-setup', label: 'WSL 설정' },
    ],
  },
  {
    id: 'nexus-bot',
    name: 'Nexus Bot',
    tagline: 'Windows Native AI Coding Agent',
    description: 'WSL 없이 Windows에서 바로 사용하는 GUI 기반 AI 코딩 에이전트. Knox Messenger 연동, Jira/Confluence 자동 확인, Jarvis 자율 비서 모드 탑재.',
    icon: '💻',
    gradient: 'from-violet-500 to-purple-400',
    path: '/nexus-bot',
    status: 'stable',
    version: '5.2.0',
    downloadUrl: 'http://a2g.samsungds.net:13000/nexus-coder-for-windows/Nexus%20Bot%20(For%20Windows)-Setup-5.2.0.exe',
    features: [
      { icon: '💻', title: 'Native Windows', description: 'WSL 설치 없이 Windows 10/11에서 .exe로 바로 실행됩니다.' },
      { icon: '📱', title: 'Knox Messenger 연동', description: '"자비스 연결" 버튼 한번으로 Knox Messenger와 연결. 어디서든 원격으로 내 PC의 AI에 작업 지시 가능.' },
      { icon: '🤖', title: 'Jarvis 자율 비서', description: '근무시간 동안 Jira 할당 이슈, Confluence 멘션, FREE TODO를 자동 확인하고 Knox Messenger로 보고합니다.' },
      { icon: '🧠', title: '모델 변경 & 장기기억', description: '채팅으로 "모델 뭐 쓸 수 있어?", "장기기억 알려줘", "이거 추가해줘" 등 자연어로 AI 설정 관리.' },
      { icon: '🔍', title: 'Jira / Confluence 조회', description: '"나한테 할당된 이슈 정리해줘", "컨플에서 내 이름 검색해줘" — 사내 시스템 자동 연동.' },
      { icon: '🔐', title: 'SSO 자동 로그인', description: 'Samsung DS SSO를 통해 자동 인증. Knox ID도 자동 연동됩니다.' },
      { icon: '🔄', title: '자동 업데이트', description: '앱 시작 시 자동으로 최신 버전을 확인하고 업데이트합니다.' },
      { icon: '🎯', title: 'Vibe Coding', description: 'CLI와 동일한 AI 엔진으로 GUI 채팅 + Jira/Confluence/Office/Browser 모든 기능 사용 가능.' },
    ],
    guides: [
      { path: '/guide-windows/getting-started', label: '시작하기' },
      { path: '/guide-windows/basic-usage', label: '기본 사용법' },
      { path: '/guide-windows/knox-messenger', label: 'Knox Messenger (Jarvis)' },
      { path: '/guide-windows/jarvis-memory', label: 'Jarvis 장기기억 & 모델 관리' },
      { path: '/guide-windows/faq', label: 'FAQ' },
    ],
  },
  {
    id: 'once',
    name: 'ONCE',
    tagline: 'AI-Powered Knowledge Management',
    description: 'AI가 자동으로 정리·분류하는 차세대 노트·지식·할일 관리 서비스. 쓰기만 하면 AI가 구조화합니다.',
    icon: '📝',
    gradient: 'from-emerald-500 to-teal-400',
    path: '/once',
    status: 'beta',
    features: [
      { icon: '🤖', title: 'AI 자동 정리', description: '내용을 입력하면 AI가 제목, 태그, 카테고리를 자동 생성합니다.' },
      { icon: '🔍', title: '시맨틱 검색', description: '의미 기반 검색으로 원하는 노트를 빠르게 찾습니다.' },
      { icon: '📊', title: 'Todo & Gantt', description: '할일 관리와 간트 차트로 프로젝트를 체계적으로 관리합니다.' },
      { icon: '👥', title: '팀 협업', description: '팀 스페이스에서 블록 단위 코멘트와 실시간 공유가 가능합니다.' },
    ],
    guides: [
      { path: '/once/guide/getting-started', label: '시작하기' },
      { path: '/once/guide/basic-usage', label: '기본 사용법' },
      { path: '/once/guide/collaboration', label: '팀 협업' },
      { path: '/once/guide/advanced', label: '고급 기능' },
      { path: '/once/faq', label: 'FAQ' },
    ],
  },
  {
    id: 'free',
    name: 'FREE',
    tagline: 'AI Weekly Report Aggregation',
    description: '주간보고 작성의 고통을 끝냅니다. 개인 업무를 입력하면 AI가 팀·파트·그룹 보고서를 자동 생성합니다.',
    icon: '📊',
    gradient: 'from-amber-500 to-orange-400',
    path: '/free',
    status: 'beta',
    features: [
      { icon: '✍️', title: '간편 입력', description: 'Jira, 채팅, 이메일 등 다양한 소스에서 업무를 간편하게 입력합니다.' },
      { icon: '🤖', title: 'AI 자동 분류', description: '입력된 내용을 AI가 자동으로 항목별로 분리·정리합니다.' },
      { icon: '📋', title: '자동 보고서', description: '파트→그룹→팀 계층 구조에 맞춰 보고서를 자동 생성합니다.' },
      { icon: '📤', title: '다양한 내보내기', description: 'Word, Excel, Markdown 포맷으로 보고서를 내보낼 수 있습니다.' },
    ],
    guides: [
      { path: '/free/guide/getting-started', label: '시작하기' },
      { path: '/free/guide/basic-usage', label: '기본 사용법' },
      { path: '/free/guide/reports', label: '보고서 관리' },
      { path: '/free/guide/admin', label: '관리자 가이드' },
      { path: '/free/faq', label: 'FAQ' },
    ],
  },
];

export const demos = [
  { id: 'office-automation', title: 'Office 자동화', description: 'Word, Excel, PowerPoint를 AI로 제어합니다.', icon: 'file' },
  { id: 'windows-auto-update', title: 'Windows 자동 업데이트', description: 'Desktop 앱의 자동 업데이트 과정을 확인합니다.', icon: 'refresh' },
];