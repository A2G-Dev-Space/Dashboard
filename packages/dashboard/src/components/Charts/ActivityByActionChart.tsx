import { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { statsApi } from '../../services/api';

const ACTION_COLORS = [
  '#0c8ce6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

const DATE_RANGE_OPTIONS = [
  { label: '2주', value: 14 },
  { label: '1개월', value: 30 },
  { label: '3개월', value: 90 },
  { label: '6개월', value: 180 },
  { label: '1년', value: 365 },
];

interface ActivityByActionChartProps {
  serviceId?: string;
}

export default function ActivityByActionChart({ serviceId }: ActivityByActionChartProps) {
  const [data, setData] = useState<Array<Record<string, string | number>>>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    loadData();
  }, [days, serviceId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await statsApi.activityByAction(days, serviceId);
      setData(res.data.chartData);
      setActions(res.data.actions);
    } catch (error) {
      console.error('Failed to load activity by action:', error);
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

  // Convert to cumulative data
  const cumulativeData = useMemo(() => {
    if (data.length === 0 || actions.length === 0) return [];
    const cumulative: Record<string, number> = {};
    for (const action of actions) cumulative[action] = 0;

    return data.map((item) => {
      const entry: Record<string, string | number> = { date: item.date as string };
      for (const action of actions) {
        cumulative[action] += (item[action] as number) || 0;
        entry[action] = cumulative[action];
      }
      return entry;
    });
  }, [data, actions]);

  const formatValue = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

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
          <div className="p-3 rounded-lg bg-indigo-100">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">액션별 활동 추이</h2>
            <p className="text-sm text-gray-500">
              {actions.length}개 액션 유형 (누적)
            </p>
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

      <div className="h-64">
        {cumulativeData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            데이터가 없습니다
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={cumulativeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
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
                tickFormatter={formatValue}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value: number, name: string) => [
                  `${formatValue(value)}건`,
                  name,
                ]}
                labelFormatter={(label) => `날짜: ${label}`}
              />
              <Legend />
              {actions.map((action, index) => (
                <Line
                  key={action}
                  type="monotone"
                  dataKey={action}
                  stroke={ACTION_COLORS[index % ACTION_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
