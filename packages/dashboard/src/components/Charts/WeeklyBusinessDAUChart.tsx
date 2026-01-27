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
import { Calendar } from 'lucide-react';
import { statsApi } from '../../services/api';

interface ServiceInfo {
  id: string;
  name: string;
  displayName: string;
}

interface ChartDataItem {
  week: string;
  [serviceId: string]: string | number;
}

// Color palette for different services
const SERVICE_COLORS = [
  '#0c8ce6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
];

const DATE_RANGE_OPTIONS = [
  { label: '1개월', value: 30 },
  { label: '3개월', value: 90 },
  { label: '6개월', value: 180 },
  { label: '1년', value: 365 },
];

export default function WeeklyBusinessDAUChart() {
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [chartData, setChartData] = useState<ChartDataItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);

  useEffect(() => {
    loadData();
  }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await statsApi.weeklyBusinessDau(days);
      setServices(response.data.services);
      setChartData(response.data.chartData);
    } catch (error) {
      console.error('Failed to load weekly business DAU data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatWeek = (weekStr: string): string => {
    const date = new Date(weekStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}/${day}`;
  };

  // Calculate tick interval based on number of weeks
  const tickInterval = useMemo(() => {
    const weeks = chartData.length;
    if (weeks <= 6) return 0;
    if (weeks <= 13) return 1;
    if (weeks <= 26) return 2;
    return 3;
  }, [chartData.length]);

  // Calculate stats for each service
  const serviceStats = useMemo(() => {
    if (chartData.length === 0 || services.length === 0) return {};

    const stats: Record<string, { avg: number; max: number; latest: number }> = {};

    for (const service of services) {
      const values = chartData.map((d) => (d[service.id] as number) || 0);
      const nonZeroValues = values.filter((v) => v > 0);

      stats[service.id] = {
        avg: nonZeroValues.length > 0
          ? Math.round(nonZeroValues.reduce((a, b) => a + b, 0) / nonZeroValues.length)
          : 0,
        max: Math.max(...values),
        latest: values[values.length - 1] || 0,
      };
    }

    return stats;
  }, [chartData, services]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-card p-6">
        <div className="flex items-center justify-center h-80">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-samsung-blue"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-50 rounded-xl">
            <Calendar className="w-5 h-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">서비스별 주간 평균 DAU (영업일)</h2>
            <p className="text-sm text-gray-500 mt-0.5">주말 및 휴일 제외한 주간 평균 일일 활성 사용자</p>
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

      {/* Service Stats Summary */}
      {services.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {services.map((service, index) => {
            const stats = serviceStats[service.id];
            return (
              <div
                key={service.id}
                className="p-3 bg-gray-50 rounded-lg border-l-4"
                style={{ borderLeftColor: SERVICE_COLORS[index % SERVICE_COLORS.length] }}
              >
                <p className="text-xs text-gray-500 truncate">{service.displayName}</p>
                <p className="text-lg font-bold text-gray-900">{stats?.avg || 0}</p>
                <p className="text-[10px] text-gray-400">평균 DAU</p>
              </div>
            );
          })}
        </div>
      )}

      {chartData.length === 0 || services.length === 0 ? (
        <div className="h-80 flex items-center justify-center text-gray-400">
          데이터가 없습니다
        </div>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="week"
                tickFormatter={formatWeek}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#e5e7eb' }}
                interval={tickInterval}
              />
              <YAxis
                tick={{ fill: '#6b7280', fontSize: 11 }}
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
                formatter={(value: number, name: string) => {
                  const service = services.find((s) => s.id === name);
                  return [`${value}명`, service?.displayName || name];
                }}
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 주`;
                }}
              />
              <Legend
                formatter={(value: string) => {
                  const service = services.find((s) => s.id === value);
                  return service?.displayName || value;
                }}
              />
              {services.map((service, index) => (
                <Line
                  key={service.id}
                  type="monotone"
                  dataKey={service.id}
                  name={service.id}
                  stroke={SERVICE_COLORS[index % SERVICE_COLORS.length]}
                  strokeWidth={2}
                  dot={{ r: 3, strokeWidth: 2 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
