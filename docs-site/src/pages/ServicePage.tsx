import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, Download } from 'lucide-react';
import { services } from '../data/services';
import { useLatestVersion } from '../hooks/useLatestVersion';

export default function ServicePage() {
  const location = useLocation();
  const service = services.find((s) => s.path === location.pathname);
  const latestVersion = useLatestVersion();
  if (!service) return <div className="min-h-screen flex items-center justify-center pt-16 text-gray-500">서비스를 찾을 수 없습니다.</div>;

  // Nexus Coder / Nexus Bot: use dynamic version from MinIO
  const isNexus = service.id === 'nexus-coder' || service.id === 'nexus-bot';
  const displayVersion = isNexus ? latestVersion.version : service.version;
  const displayDownloadUrl = service.id === 'nexus-bot' ? latestVersion.downloadUrl : service.downloadUrl;

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative bg-surface pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0">
          <div className={`absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-gradient-to-br ${service.gradient} opacity-15 blur-[120px]`} />
          <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] rounded-full bg-accent/10 blur-[120px]" />
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px]" />

        <div className="relative max-w-5xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">{service.icon}</span>
            {service.status !== 'stable' && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full uppercase ${
                service.status === 'beta' ? 'bg-amber-500/20 text-amber-300' : 'bg-blue-500/20 text-blue-300'
              }`}>
                {service.status}
              </span>
            )}
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight mb-4">
            {service.name}
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mb-10">
            {service.description}
          </p>

          <div className="flex flex-wrap gap-4">
            {service.guides.length > 0 && (
              <Link
                to={service.guides[0].path}
                className="group px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-brand-500 to-brand-600 rounded-xl hover:shadow-lg hover:shadow-brand-500/25 transition-all hover:-translate-y-0.5 flex items-center gap-2"
              >
                시작하기 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
            {displayDownloadUrl && (
              <a
                href={displayDownloadUrl}
                className="px-6 py-3 text-sm font-semibold text-gray-300 glass rounded-xl hover:bg-white/10 transition-all flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                다운로드 v{displayVersion}
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-10">주요 기능</h2>
          <div className="grid sm:grid-cols-2 gap-6">
            {service.features.map((f, i) => (
              <div key={i} className="p-6 rounded-2xl border border-gray-100 hover:border-brand-200 hover:shadow-lg transition-all group">
                <span className="text-2xl">{f.icon}</span>
                <h3 className="text-lg font-semibold text-gray-900 mt-3 group-hover:text-brand-600 transition-colors">{f.title}</h3>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Guides */}
      <section className="bg-gray-50 py-20">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-10">문서 가이드</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {service.guides.map((g) => (
              <Link
                key={g.path}
                to={g.path}
                className="group flex items-center justify-between p-5 rounded-xl bg-white border border-gray-100 hover:shadow-md hover:border-brand-200 transition-all"
              >
                <span className="text-sm font-medium text-gray-700 group-hover:text-brand-600 transition-colors">{g.label}</span>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
