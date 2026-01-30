import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Activity } from 'lucide-react';
import { statsApi } from '../../services/api';

interface ActivityData {
  date: string;
  activityCount: number;
}

const DATE_RANGE_OPTIONS = [
  { label: '2주', value: 14 },
  { label: '1개월', value: 30 },
  { label: '3개월', value: 90 },
  { label: '6개월', value: 180 },
  { label: '1년', value: 365 },
];

interface DailyActivityChartProps {
  serviceId?: string;
}

export default function DailyActivityChart({ serviceId }: DailyActivityChartProps) {
  const [data, setData] = useState<ActivityData[]>([]);
  const [totalActivities, setTotalActivities] = useState(0);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadData();
  }, [days, serviceId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await statsApi.activityDaily(days, serviceId);
      setData(res.data.chartData);
      setTotalActivities(res.data.totalActivities);
    } catch (error) {
      console.error('Failed to load activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const tickInterval = useMemo(() => {
    if (days <= 14) return 1;
    if (days <= 30) return 2;
    if (days <= 90) return 7;
    if (days <= 180) return 14;
    return 30;
  }, [days]);

  const stats = useMemo(() => {
    if (data.length === 0) return { avg: 0, max: 0, today: 0 };
    const counts = data.map((d) => d.activityCount);
    return {
      avg: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length),
      max: Math.max(...counts),
      today: counts[counts.length - 1] || 0,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-card p-6">
        <div className="flex items-center justify-center h-80">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nexus-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-lg bg-violet-100">
            <Activity className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">일별 활동 수</h2>
            <p className="text-sm text-gray-500">총 {totalActivities}건</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {DATE_RANGE_OPTIONS.map((option) => (
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

      {/* Stats summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900">{stats.today}</p>
          <p className="text-xs text-gray-500">오늘</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <p className="text-2xl font-bold text-gray-900">{stats.avg}</p>
          <p className="text-xs text-gray-500">일평균</p>
        </div>
        <div className="text-center p-3 bg-violet-50 rounded-lg">
          <p className="text-2xl font-bold text-violet-600">{stats.max}</p>
          <p className="text-xs text-gray-500">최대</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            데이터가 없습니다
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value: number) => [`${value}건`, '활동 수']}
                labelFormatter={(label) => `날짜: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="activityCount"
                stroke="#8b5cf6"
                strokeWidth={2}
                fill="url(#activityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
