export default function QuickDemoSection() {
  return (
    <section className="relative bg-surface py-20">
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-8">
          <p className="text-sm font-semibold text-brand-400 uppercase tracking-wider mb-3">Quick Demo</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            AI 에이전트 실전 활용
          </h2>
          <p className="max-w-xl mx-auto mt-3 text-gray-400">
            도구를 활용해 실제 업무를 자동화하는 모습을 확인하세요
          </p>
        </div>
        <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10 glow">
          <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
            <iframe
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
              src="https://www.youtube.com/embed/4pfKEyp2RQE?autoplay=1&mute=1&loop=1&playlist=4pfKEyp2RQE"
              title="Quick Demo"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </section>
  );
}
