import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, Menu, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useLatestVersion } from '../hooks/useLatestVersion';

interface SidebarItem {
  path: string;
  label: string;
}

interface DocLayoutProps {
  title: string;
  sidebarItems: SidebarItem[];
  contentPath: string;
}

function MarkdownLink({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const navigate = useNavigate();
  if (href && href.startsWith('/') && !href.startsWith('//')) {
    return (
      <a
        {...props}
        href={href}
        onClick={(e) => {
          e.preventDefault();
          navigate(href);
        }}
      >
        {children}
      </a>
    );
  }
  return <a href={href} {...props}>{children}</a>;
}

export default function DocLayout({ title, sidebarItems, contentPath }: DocLayoutProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { version } = useLatestVersion();

  useEffect(() => {
    setLoading(true);
    fetch(`/docs/content/${contentPath}?t=${Date.now()}`)
      .then((r) => r.ok ? r.text() : '# 페이지를 찾을 수 없습니다')
      .then((text) => {
        // Strip VitePress frontmatter
        const cleaned = text.replace(/^---[\s\S]*?---\n*/m, '');
        // Convert ::: tip/warning/danger blocks to blockquotes
        const processed = cleaned
          .replace(/::: details(.*)\n([\s\S]*?):::/g, (_m, title, body) => {
            const summary = (title || '').trim() || '상세 보기';
            // Convert markdown inside details to HTML since ReactMarkdown doesn't parse md inside raw HTML
            let html = body.trim()
              // Tables: convert markdown table to HTML table
              .replace(/\|(.+)\|\n\|[-| :]+\|\n((?:\|.+\|\n?)*)/g, (_tm: string, header: string, rows: string) => {
                const ths = header.split('|').filter((c: string) => c.trim()).map((c: string) => `<th>${c.trim()}</th>`).join('');
                const trs = rows.trim().split('\n').map((row: string) => {
                  const tds = row.split('|').filter((c: string) => c.trim()).map((c: string) => `<td>${c.trim()}</td>`).join('');
                  return `<tr>${tds}</tr>`;
                }).join('');
                return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
              })
              // Bold
              .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
              // Inline code
              .replace(/`([^`]+)`/g, '<code>$1</code>')
              // Links
              .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
              // List items
              .replace(/^- (.+)$/gm, '<li>$1</li>')
              // Wrap consecutive <li> in <ul>
              .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
            return `<details>\n<summary>${summary}</summary>\n${html}\n</details>\n`;
          })
          .replace(/::: (tip|warning|danger|info)(.*)\n([\s\S]*?):::/g, (_m, type, title, body) => {
            const icons: Record<string, string> = { tip: '💡', warning: '⚠️', danger: '🚨', info: 'ℹ️' };
            const icon = icons[type] || 'ℹ️';
            const heading = (title || '').trim();
            const lines = body.trim().split('\n').map((l: string) => `> ${l}`).join('\n');
            return heading
              ? `> ${icon} **${heading}**\n>\n${lines}\n`
              : `> ${icon}\n>\n${lines}\n`;
          });
        // Replace {{VERSION}} placeholders with latest version from MinIO
        const withVersion = processed.replace(/\{\{VERSION\}\}/g, version);
        setContent(withVersion);
        setLoading(false);
      })
      .catch(() => { setContent('# 로딩 실패'); setLoading(false); });
    window.scrollTo(0, 0);
  }, [contentPath, version]);

  return (
    <div className="min-h-screen bg-white pt-16">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed bottom-6 right-6 z-40 p-3 bg-brand-500 text-white rounded-full shadow-lg shadow-brand-500/30"
      >
        {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <aside className={`fixed lg:sticky top-16 left-0 h-[calc(100vh-4rem)] w-72 bg-white lg:bg-transparent border-r border-gray-100 lg:border-r-0 z-30 overflow-y-auto transform transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</h3>
            <ul className="space-y-1">
              {sidebarItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                        isActive
                          ? 'bg-brand-50 text-brand-600 font-medium'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {isActive && <ChevronRight className="w-3.5 h-3.5 text-brand-500" />}
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 px-6 lg:px-12 py-10 lg:ml-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <article className="prose max-w-3xl">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]} components={{ a: MarkdownLink }}>
                {content}
              </ReactMarkdown>
            </article>
          )}
        </main>
      </div>
    </div>
  );
}
