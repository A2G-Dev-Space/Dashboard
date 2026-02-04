import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Play,
  Trash2,
  Edit2,
  X,
  ChevronDown,
  ChevronRight,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
} from 'recharts';
import { llmTestApi, LLMTestPair, LLMTestResult, CreateLLMTestPairData } from '../services/api';

// Color palette for different test pairs
const PAIR_COLORS = [
  '#0c8ce6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
];

const DATE_RANGE_OPTIONS = [
  { label: '1일', value: 1 },
  { label: '3일', value: 3 },
  { label: '7일', value: 7 },
  { label: '14일', value: 14 },
  { label: '30일', value: 30 },
];

interface LLMTestProps {
  serviceId?: string;
}

export default function LLMTest({ serviceId: _serviceId }: LLMTestProps) {
  const [pairs, setPairs] = useState<LLMTestPair[]>([]);
  const [chartData, setChartData] = useState<LLMTestResult[]>([]);
  const [stats, setStats] = useState<{
    totalPairs: number;
    enabledPairs: number;
    recentTestCount: number;
    successRate: number;
    avgLatency: number;
    avgScore: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [days, setDays] = useState(7);
  const [selectedPairIds, setSelectedPairIds] = useState<string[]>([]);
  const [expandedPairId, setExpandedPairId] = useState<string | null>(null);
  const [pairResults, setPairResults] = useState<Record<string, LLMTestResult[]>>({});
  const [showModal, setShowModal] = useState(false);
  const [editingPair, setEditingPair] = useState<LLMTestPair | null>(null);
  const [runningTestId, setRunningTestId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // pairs 로드 시 초기 선택
  useEffect(() => {
    if (pairs.length > 0 && selectedPairIds.length === 0) {
      setSelectedPairIds(pairs.map(p => p.id));
    }
  }, [pairs]); // selectedPairIds 제외 - 무한 루프 방지

  // 차트 데이터 로드 (days나 selectedPairIds 변경 시)
  useEffect(() => {
    if (selectedPairIds.length > 0) {
      loadChartData();
    }
  }, [days, selectedPairIds]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pairsRes, statsRes] = await Promise.all([
        llmTestApi.listPairs(),
        llmTestApi.getStats(),
      ]);
      setPairs(pairsRes.data.pairs);
      setStats(statsRes.data);
      // 초기 선택
      if (pairsRes.data.pairs.length > 0 && selectedPairIds.length === 0) {
        setSelectedPairIds(pairsRes.data.pairs.map(p => p.id));
      }
    } catch (error) {
      console.error('Failed to load LLM test data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadChartData = async () => {
    if (selectedPairIds.length === 0) {
      setChartData([]);
      return;
    }
    setChartLoading(true);
    try {
      const res = await llmTestApi.getChartData({ pairIds: selectedPairIds, days });
      setChartData(res.data.results);
    } catch (error) {
      console.error('Failed to load chart data:', error);
    } finally {
      setChartLoading(false);
    }
  };

  const loadPairResults = async (pairId: string) => {
    try {
      const res = await llmTestApi.getResults(pairId, { days, limit: 50 });
      setPairResults(prev => ({ ...prev, [pairId]: res.data.results }));
    } catch (error) {
      console.error('Failed to load pair results:', error);
    }
  };

  const handleToggleExpand = async (pairId: string) => {
    if (expandedPairId === pairId) {
      setExpandedPairId(null);
    } else {
      setExpandedPairId(pairId);
      if (!pairResults[pairId]) {
        await loadPairResults(pairId);
      }
    }
  };

  const handleRunTest = async (pairId: string) => {
    setRunningTestId(pairId);
    try {
      await llmTestApi.runTest(pairId);
      // 결과 새로고침
      await loadData();
      await loadChartData();
      if (expandedPairId === pairId) {
        await loadPairResults(pairId);
      }
    } catch (error) {
      console.error('Failed to run test:', error);
      alert('테스트 실행에 실패했습니다.');
    } finally {
      setRunningTestId(null);
    }
  };

  const handleDeletePair = async (pairId: string) => {
    if (!confirm('이 테스트 쌍을 삭제하시겠습니까? 모든 결과 데이터도 함께 삭제됩니다.')) {
      return;
    }
    try {
      await llmTestApi.deletePair(pairId);
      setSelectedPairIds(prev => prev.filter(id => id !== pairId));
      if (expandedPairId === pairId) setExpandedPairId(null);
      await loadData();
    } catch (error) {
      console.error('Failed to delete pair:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  const handleTogglePairSelection = (pairId: string) => {
    setSelectedPairIds(prev =>
      prev.includes(pairId)
        ? prev.filter(id => id !== pairId)
        : [...prev, pairId]
    );
  };

  // 차트 데이터 변환 - Scatter plot용
  const scatterChartData = useMemo(() => {
    return chartData
      .filter(r => r.status === 'SUCCESS' && r.score !== null)
      .map(r => ({
        ...r,
        timestamp: new Date(r.timestamp).getTime(),
        pairName: r.pair?.name || 'Unknown',
        pairId: r.pairId,
      }));
  }, [chartData]);

  // 시계열 차트 데이터 - 라인차트용 (시간별 평균)
  const timeSeriesData = useMemo(() => {
    if (chartData.length === 0) return [];

    // 시간대별로 그룹화 (1시간 단위)
    const grouped: Record<string, Record<string, {
      latencySum: number;
      latencyCount: number;
      scoreSum: number;
      scoreCount: number;
    }>> = {};

    chartData.forEach(r => {
      if (r.status !== 'SUCCESS') return;
      const date = new Date(r.timestamp);
      // 1시간 단위로 반올림
      date.setMinutes(0, 0, 0);
      const timeKey = date.toISOString();

      if (!grouped[timeKey]) {
        grouped[timeKey] = {};
      }
      if (!grouped[timeKey][r.pairId]) {
        grouped[timeKey][r.pairId] = { latencySum: 0, latencyCount: 0, scoreSum: 0, scoreCount: 0 };
      }

      grouped[timeKey][r.pairId].latencySum += r.latencyMs;
      grouped[timeKey][r.pairId].latencyCount += 1;
      if (r.score !== null) {
        grouped[timeKey][r.pairId].scoreSum += r.score;
        grouped[timeKey][r.pairId].scoreCount += 1;
      }
    });

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, pairData]) => {
        const item: Record<string, number | string> = { time };
        Object.entries(pairData).forEach(([pairId, data]) => {
          item[`${pairId}_latency`] = data.latencyCount > 0
            ? Math.round(data.latencySum / data.latencyCount)
            : 0;
          item[`${pairId}_score`] = data.scoreCount > 0
            ? Math.round(data.scoreSum / data.scoreCount)
            : 0;
        });
        return item;
      });
  }, [chartData]);

  const formatTime = (timeStr: string): string => {
    const date = new Date(timeStr);
    if (days <= 1) {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit' });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'ERROR':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'TIMEOUT':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getPairColor = (index: number) => PAIR_COLORS[Math.abs(index) % PAIR_COLORS.length];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-samsung-blue"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">테스트 쌍</p>
              <p className="text-xl font-bold text-gray-900">
                {stats?.enabledPairs || 0} / {stats?.totalPairs || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">성공률 (7일)</p>
              <p className="text-xl font-bold text-gray-900">{stats?.successRate || 0}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">평균 Latency</p>
              <p className="text-xl font-bold text-gray-900">
                {stats?.avgLatency ? `${(stats.avgLatency / 1000).toFixed(1)}s` : '-'}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-card p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Activity className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">평균 점수</p>
              <p className="text-xl font-bold text-gray-900">{stats?.avgScore ?? '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 차트 섹션 */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Latency & Score 추이</h2>
            <p className="text-sm text-gray-500 mt-1">테스트 LLM의 응답 시간과 평가 점수</p>
          </div>
          <div className="flex items-center gap-4">
            {/* 쌍 선택 */}
            <div className="flex flex-wrap gap-2">
              {pairs.map((pair, index) => (
                <button
                  key={pair.id}
                  onClick={() => handleTogglePairSelection(pair.id)}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                    selectedPairIds.includes(pair.id)
                      ? 'border-transparent text-white'
                      : 'border-gray-300 text-gray-500 bg-white'
                  }`}
                  style={{
                    backgroundColor: selectedPairIds.includes(pair.id)
                      ? getPairColor(index)
                      : undefined,
                  }}
                >
                  {pair.name}
                </button>
              ))}
            </div>
            {/* 기간 선택 */}
            <div className="flex items-center gap-1">
              {DATE_RANGE_OPTIONS.map(option => (
                <button
                  key={option.value}
                  onClick={() => setDays(option.value)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    days === option.value
                      ? 'bg-samsung-blue text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {chartLoading ? (
          <div className="h-80 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-samsung-blue"></div>
          </div>
        ) : timeSeriesData.length === 0 ? (
          <div className="h-80 flex items-center justify-center text-gray-400">
            데이터가 없습니다
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Latency 차트 */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Latency (ms)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeriesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="time"
                      tickFormatter={formatTime}
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                      tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}s` : `${v}ms`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                      labelFormatter={(label) => formatTime(label as string)}
                      formatter={(value: number, name: string) => {
                        const pairId = name.replace('_latency', '');
                        const pair = pairs.find(p => p.id === pairId);
                        return [`${value}ms`, pair?.name || pairId];
                      }}
                    />
                    <Legend
                      formatter={(value: string) => {
                        const pairId = value.replace('_latency', '');
                        const pair = pairs.find(p => p.id === pairId);
                        return pair?.name || pairId;
                      }}
                    />
                    {selectedPairIds.map((pairId) => (
                      <Line
                        key={pairId}
                        type="monotone"
                        dataKey={`${pairId}_latency`}
                        name={`${pairId}_latency`}
                        stroke={getPairColor(pairs.findIndex(p => p.id === pairId))}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Score 차트 */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Score (1-100)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={timeSeriesData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="time"
                      tickFormatter={formatTime}
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#6b7280', fontSize: 10 }}
                      tickLine={false}
                      axisLine={{ stroke: '#e5e7eb' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                      }}
                      labelFormatter={(label) => formatTime(label as string)}
                      formatter={(value: number, name: string) => {
                        const pairId = name.replace('_score', '');
                        const pair = pairs.find(p => p.id === pairId);
                        return [value, pair?.name || pairId];
                      }}
                    />
                    <Legend
                      formatter={(value: string) => {
                        const pairId = value.replace('_score', '');
                        const pair = pairs.find(p => p.id === pairId);
                        return pair?.name || pairId;
                      }}
                    />
                    {selectedPairIds.map((pairId) => (
                      <Line
                        key={pairId}
                        type="monotone"
                        dataKey={`${pairId}_score`}
                        name={`${pairId}_score`}
                        stroke={getPairColor(pairs.findIndex(p => p.id === pairId))}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Scatter plot - Latency vs Score */}
        {scatterChartData.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Latency vs Score 분포</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    type="number"
                    dataKey="latencyMs"
                    name="Latency"
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}s` : `${v}ms`}
                    label={{ value: 'Latency', position: 'bottom', fontSize: 12 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="score"
                    name="Score"
                    domain={[0, 100]}
                    tick={{ fill: '#6b7280', fontSize: 10 }}
                    label={{ value: 'Score', angle: -90, position: 'insideLeft', fontSize: 12 }}
                  />
                  <ZAxis range={[50, 50]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === 'Latency') return [`${value}ms`, 'Latency'];
                      return [value, name];
                    }}
                    labelFormatter={(_, payload) => {
                      if (payload && payload[0]) {
                        const data = payload[0].payload as { pairName?: string; timestamp?: number };
                        return `${data.pairName} - ${new Date(data.timestamp || 0).toLocaleString('ko-KR')}`;
                      }
                      return '';
                    }}
                  />
                  {selectedPairIds.map((pairId) => {
                    const pairIndex = pairs.findIndex(p => p.id === pairId);
                    const pair = pairs[pairIndex];
                    return (
                      <Scatter
                        key={pairId}
                        name={pair?.name || pairId}
                        data={scatterChartData.filter(d => d.pairId === pairId)}
                        fill={getPairColor(pairIndex)}
                      />
                    );
                  })}
                  <Legend />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* 테스트 쌍 목록 */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">테스트 쌍 관리</h2>
          <button
            onClick={() => {
              setEditingPair(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-samsung-blue text-white rounded-lg hover:bg-samsung-blue/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>새 테스트 쌍</span>
          </button>
        </div>

        {pairs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            등록된 테스트 쌍이 없습니다. 새 테스트 쌍을 추가해주세요.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pairs.map((pair, index) => (
              <div key={pair.id}>
                <div className="px-6 py-4 flex items-center gap-4">
                  <button
                    onClick={() => handleToggleExpand(pair.id)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {expandedPairId === pair.id ? (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    )}
                  </button>

                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getPairColor(index) }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{pair.name}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          pair.enabled
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {pair.enabled ? '활성' : '비활성'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">
                      질문자: {pair.questionerModelName} | 테스트: {pair.testModelName}
                    </p>
                  </div>

                  <div className="text-right text-sm text-gray-500">
                    <p>테스트 {pair._count?.results || 0}회</p>
                    <p className="text-xs">
                      {pair.lastRunAt
                        ? `마지막: ${new Date(pair.lastRunAt).toLocaleString('ko-KR')}`
                        : '아직 실행 안됨'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRunTest(pair.id)}
                      disabled={runningTestId === pair.id}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                      title="테스트 실행"
                    >
                      {runningTestId === pair.id ? (
                        <RefreshCw className="w-5 h-5 animate-spin" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setEditingPair(pair);
                        setShowModal(true);
                      }}
                      className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                      title="수정"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeletePair(pair.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="삭제"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* 확장된 결과 목록 */}
                {expandedPairId === pair.id && (
                  <div className="px-6 pb-4 bg-gray-50">
                    <div className="ml-10">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">최근 결과</h4>
                      {!pairResults[pair.id] ? (
                        <div className="flex items-center gap-2 py-4 text-gray-400">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          로딩 중...
                        </div>
                      ) : pairResults[pair.id].length === 0 ? (
                        <p className="py-4 text-gray-400">결과가 없습니다</p>
                      ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {pairResults[pair.id].map(result => (
                            <div
                              key={result.id}
                              className="flex items-center gap-4 p-3 bg-white rounded-lg"
                            >
                              {getStatusIcon(result.status)}
                              <span className="text-sm text-gray-600">
                                {new Date(result.timestamp).toLocaleString('ko-KR')}
                              </span>
                              <span className="text-sm font-medium">
                                {result.latencyMs}ms
                              </span>
                              {result.score !== null && (
                                <span
                                  className={`text-sm font-medium ${
                                    result.score >= 80
                                      ? 'text-green-600'
                                      : result.score >= 50
                                      ? 'text-yellow-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  점수: {result.score}
                                </span>
                              )}
                              {result.errorMessage && (
                                <span className="text-sm text-red-500 truncate flex-1">
                                  {result.errorMessage}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 생성/수정 모달 */}
      {showModal && (
        <TestPairModal
          pair={editingPair}
          onClose={() => {
            setShowModal(false);
            setEditingPair(null);
          }}
          onSave={async (data) => {
            try {
              if (editingPair) {
                await llmTestApi.updatePair(editingPair.id, data);
              } else {
                await llmTestApi.createPair(data as CreateLLMTestPairData);
              }
              setShowModal(false);
              setEditingPair(null);
              await loadData();
            } catch (error) {
              console.error('Failed to save pair:', error);
              alert('저장에 실패했습니다.');
            }
          }}
        />
      )}
    </div>
  );
}

// 테스트 쌍 생성/수정 모달
interface TestPairModalProps {
  pair: LLMTestPair | null;
  onClose: () => void;
  onSave: (data: CreateLLMTestPairData) => Promise<void>;
}

function TestPairModal({ pair, onClose, onSave }: TestPairModalProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<CreateLLMTestPairData>({
    name: pair?.name || '',
    enabled: pair?.enabled ?? true,
    intervalMinutes: pair?.intervalMinutes || 5,
    questionerModelName: pair?.questionerModelName || '',
    questionerEndpoint: pair?.questionerEndpoint || '',
    questionerApiKey: pair?.questionerApiKey || '',
    testModelName: pair?.testModelName || '',
    testEndpoint: pair?.testEndpoint || '',
    testApiKey: pair?.testApiKey || '',
    questionPrompt: pair?.questionPrompt || 'Generate a short, creative question that tests the AI\'s knowledge, reasoning, or problem-solving ability. The question should be clear and answerable.',
    evaluationPrompt: pair?.evaluationPrompt || 'Evaluate the AI response based on: accuracy (is it correct?), helpfulness (does it answer the question?), and clarity (is it well-explained?). Score from 1-100.',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
        <div className="sticky top-0 bg-white px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {pair ? '테스트 쌍 수정' : '새 테스트 쌍'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 기본 정보 */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">기본 정보</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  이름 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  테스트 주기 (분)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={formData.intervalMinutes}
                  onChange={(e) => setFormData({ ...formData, intervalMinutes: parseInt(e.target.value) || 5 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-4 h-4 text-samsung-blue border-gray-300 rounded focus:ring-samsung-blue"
              />
              <label htmlFor="enabled" className="text-sm text-gray-700">
                활성화
              </label>
            </div>
          </div>

          {/* 질문자 LLM */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">질문자 LLM (질문 생성 & 평가)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  모델명 *
                </label>
                <input
                  type="text"
                  value={formData.questionerModelName}
                  onChange={(e) => setFormData({ ...formData, questionerModelName: e.target.value })}
                  placeholder="gpt-4o-mini"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={formData.questionerApiKey}
                  onChange={(e) => setFormData({ ...formData, questionerApiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Endpoint URL *
              </label>
              <input
                type="url"
                value={formData.questionerEndpoint}
                onChange={(e) => setFormData({ ...formData, questionerEndpoint: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* 테스트 LLM */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">테스트 LLM (테스트 대상)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  모델명 *
                </label>
                <input
                  type="text"
                  value={formData.testModelName}
                  onChange={(e) => setFormData({ ...formData, testModelName: e.target.value })}
                  placeholder="claude-3-opus"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="password"
                  value={formData.testApiKey}
                  onChange={(e) => setFormData({ ...formData, testApiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Endpoint URL *
              </label>
              <input
                type="url"
                value={formData.testEndpoint}
                onChange={(e) => setFormData({ ...formData, testEndpoint: e.target.value })}
                placeholder="https://api.anthropic.com/v1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
                required
              />
            </div>
          </div>

          {/* 프롬프트 */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900">프롬프트 설정</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                질문 생성 프롬프트
              </label>
              <textarea
                value={formData.questionPrompt}
                onChange={(e) => setFormData({ ...formData, questionPrompt: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">질문자 LLM에게 질문을 생성하라고 보낼 프롬프트</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                평가 프롬프트
              </label>
              <textarea
                value={formData.evaluationPrompt}
                onChange={(e) => setFormData({ ...formData, evaluationPrompt: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">질문자 LLM에게 응답을 평가하라고 보낼 프롬프트 (질문과 응답이 자동으로 추가됨)</p>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-white bg-samsung-blue rounded-lg hover:bg-samsung-blue/90 transition-colors disabled:opacity-50"
            >
              {saving ? '저장 중...' : pair ? '수정' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
