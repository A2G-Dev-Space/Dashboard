import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { demos } from '../data/services';

export default function DemosIndex() {
  return (
    <div className="min-h-screen">
      <section className="relative bg-surface pt-32 pb-16 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute -top-40 right-0 w-[400px] h-[400px] rounded-full bg-accent/15 blur-[120px]" />
        </div>
        <div className="relative max-w-5xl mx-auto px-6">
          <p className="text-sm font-semibold text-brand-400 uppercase tracking-wider mb-3">Demos</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">실전 활용 사례</h1>
          <p className="text-lg text-gray-400 max-w-2xl">Nexus Coder로 실제 개발 작업을 자동화하는 방법을 확인하세요.</p>
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid sm:grid-cols-2 gap-6">
            {demos.map((d) => (
              <Link key={d.id} to={`/demos/${d.id}`} className="group p-6 rounded-2xl border border-gray-100 hover:shadow-xl hover:border-brand-200 transition-all hover:-translate-y-1">
                <span className="text-3xl">{d.icon}</span>
                <h3 className="text-xl font-bold text-gray-900 mt-4 group-hover:text-brand-600 transition-colors">{d.title}</h3>
                <p className="text-gray-500 mt-2">{d.description}</p>
                <div className="flex items-center gap-1 text-sm font-medium text-brand-500 mt-4">
                  자세히 보기 <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
