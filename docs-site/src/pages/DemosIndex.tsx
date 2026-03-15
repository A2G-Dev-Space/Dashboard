import { Link } from 'react-router-dom';
import { ArrowRight, FileText, RefreshCw } from 'lucide-react';

const demos = [
  { id: 'office-automation', title: 'Office 자동화', description: 'Word, Excel, PowerPoint를 AI로 제어합니다.', icon: 'file' },
  { id: 'windows-auto-update', title: 'Windows 자동 업데이트', description: 'Desktop 앱의 자동 업데이트 과정을 확인합니다.', icon: 'refresh' },
];

const demoIcons: Record<string, React.ReactNode> = {
  'file': <FileText className="w-5 h-5" />,
  'refresh': <RefreshCw className="w-5 h-5" />,
};

export default function DemosIndex() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Hero */}
      <section className="relative pt-28 pb-12 sm:pt-36 sm:pb-16 px-5 sm:px-8 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-40 right-0 w-[400px] h-[400px] rounded-full opacity-[0.08]"
            style={{
              background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)',
              filter: 'blur(80px)',
            }}
          />
        </div>
        <div className="relative max-w-4xl mx-auto">
          <p className="text-[12px] font-bold text-brand-400 uppercase tracking-wider mb-3">Demos</p>
          <h1 className="text-[2rem] sm:text-4xl lg:text-5xl font-black tracking-[-0.03em] text-white mb-4">
            실전 활용 사례
          </h1>
          <p className="text-[16px] text-gray-400 max-w-2xl leading-relaxed">
            AI 에이전트로 실제 업무를 자동화하는 방법을 확인하세요.
          </p>
        </div>
      </section>

      {/* Demo grid */}
      <section className="pb-20 px-5 sm:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-5">
            {demos.map((d) => (
              <Link
                key={d.id}
                to={`/demos/${d.id}`}
                className="group p-7 rounded-2xl border border-white/10 glass hover:bg-white/10 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-11 h-11 rounded-xl bg-white/5 flex items-center justify-center text-gray-400 mb-5 group-hover:bg-brand-500/20 group-hover:text-brand-400 transition-colors">
                  {demoIcons[d.icon] || <FileText className="w-5 h-5" />}
                </div>
                <h3 className="text-[17px] font-bold text-white mb-2 group-hover:text-brand-400 transition-colors">
                  {d.title}
                </h3>
                <p className="text-[14px] text-gray-400 leading-relaxed mb-4">{d.description}</p>
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-brand-400">
                  자세히 보기
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
