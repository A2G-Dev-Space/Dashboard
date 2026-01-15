import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Activity, Zap, Building2, TrendingUp, ArrowRight, Server } from 'lucide-react';
import { statsApi, serviceApi } from '../services/api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface Service {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  iconUrl?: string;
  enabled: boolean;
  _count: {
    models: number;
    usageLogs: number;
  };
}

interface GlobalOverviewService {
  serviceId: string;
  serviceName: string;
  serviceDisplayName: string;
  totalUsers: number;
  avgDailyActiveUsers: number;
  totalTokens: number;
  totalRequests: number;
}

interface ServiceDailyData {
  date: string;
  serviceId: string;
  serviceName: string;
  requests: number;
  totalTokens: number;
}

interface DeptStats {
  deptname: string;
  cumulativeUsers: number;
  avgDailyActiveUsers: number;
  totalTokens: number;
  tokensByModel: { modelName: string; tokens: number }[];
}

export default function MainDashboard() {
  const [services, setServices] = useState<Service[]>([]);
  const [globalOverview, setGlobalOverview] = useState<GlobalOverviewService[]>([]);
  const [serviceDaily, setServiceDaily] = useState<ServiceDailyData[]>([]);
  const [deptStats, setDeptStats] = useState<DeptStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [servicesRes, globalRes, serviceDailyRes, deptRes] = await Promise.all([
        serviceApi.list(),
        statsApi.globalOverview(),
        statsApi.globalByService(30),
        statsApi.globalByDept(30),
      ]);

      setServices(servicesRes.data.services || []);
      setGlobalOverview(globalRes.data.services || []);
      setServiceDaily(serviceDailyRes.data.dailyData || []);
      setDeptStats(deptRes.data.deptStats || []);
    } catch (error) {
      console.error('Failed to load main dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // Calculate totals
  const totalUsers = globalOverview.reduce((sum, s) => sum + s.totalUsers, 0);
  const avgDailyActive = globalOverview.reduce((sum, s) => sum + s.avgDailyActiveUsers, 0);
  const totalTokens = globalOverview.reduce((sum, s) => sum + s.totalTokens, 0);
  const totalRequests = globalOverview.reduce((sum, s) => sum + s.totalRequests, 0);

  // Prepare chart data for service daily usage
  const uniqueDates = [...new Set(serviceDaily.map(d => d.date))].sort();
  const uniqueServices = [...new Set(serviceDaily.map(d => d.serviceName))];

  const colors = [
    { bg: 'rgba(59, 130, 246, 0.5)', border: 'rgb(59, 130, 246)' },
    { bg: 'rgba(16, 185, 129, 0.5)', border: 'rgb(16, 185, 129)' },
    { bg: 'rgba(245, 158, 11, 0.5)', border: 'rgb(245, 158, 11)' },
    { bg: 'rgba(139, 92, 246, 0.5)', border: 'rgb(139, 92, 246)' },
    { bg: 'rgba(236, 72, 153, 0.5)', border: 'rgb(236, 72, 153)' },
  ];

  const serviceChartData = {
    labels: uniqueDates.map(d => d.slice(5)), // MM-DD format
    datasets: uniqueServices.map((serviceName, index) => ({
      label: serviceName,
      data: uniqueDates.map(date => {
        const entry = serviceDaily.find(d => d.date === date && d.serviceName === serviceName);
        return entry?.requests || 0;
      }),
      backgroundColor: colors[index % colors.length].bg,
      borderColor: colors[index % colors.length].border,
      borderWidth: 2,
      fill: false,
      tension: 0.3,
    })),
  };

  // Prepare dept chart data
  const deptChartData = {
    labels: deptStats.slice(0, 10).map(d => d.deptname.length > 15 ? d.deptname.slice(0, 15) + '...' : d.deptname),
    datasets: [
      {
        label: '누적 사용자',
        data: deptStats.slice(0, 10).map(d => d.cumulativeUsers),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
      },
      {
        label: '일평균 활성 사용자',
        data: deptStats.slice(0, 10).map(d => Math.round(d.avgDailyActiveUsers)),
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
      },
    ],
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-samsung-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Global Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <div className="bg-white rounded-2xl shadow-card p-5 hover:shadow-soft transition-shadow duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">전체 사용자</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(totalUsers)}</p>
              <p className="text-xs text-gray-400 mt-1">모든 서비스 합계</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-50">
              <Users className="w-5 h-5 text-samsung-blue" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5 hover:shadow-soft transition-shadow duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">일평균 활성 사용자</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(Math.round(avgDailyActive))}</p>
              <p className="text-xs text-gray-400 mt-1">최근 30일 평균</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50">
              <Activity className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5 hover:shadow-soft transition-shadow duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">총 토큰 사용량</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(totalTokens)}</p>
              <p className="text-xs text-gray-400 mt-1">누적 합계</p>
            </div>
            <div className="p-3 rounded-xl bg-violet-50">
              <TrendingUp className="w-5 h-5 text-violet-500" />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl shadow-card p-5 hover:shadow-soft transition-shadow duration-300">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">총 API 요청</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{formatNumber(totalRequests)}</p>
              <p className="text-xs text-gray-400 mt-1">누적 합계</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50">
              <Zap className="w-5 h-5 text-amber-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Service Cards */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">서비스별 현황</h2>
          <span className="text-sm text-gray-500">{services.length}개 서비스</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {globalOverview.map((service) => {
            const serviceInfo = services.find(s => s.id === service.serviceId);
            return (
              <Link
                key={service.serviceId}
                to={`/service/${service.serviceId}`}
                className="block p-4 border border-gray-100 rounded-xl hover:border-samsung-blue/30 hover:shadow-md transition-all duration-200 group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {serviceInfo?.iconUrl ? (
                      <img src={serviceInfo.iconUrl} alt={service.serviceDisplayName} className="w-10 h-10 rounded-lg" />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-samsung-blue to-blue-600 rounded-lg flex items-center justify-center">
                        <Server className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-gray-900">{service.serviceDisplayName}</h3>
                      <p className="text-xs text-gray-500">{service.serviceName}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-samsung-blue transition-colors" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-gray-900">{formatNumber(service.totalUsers)}</p>
                    <p className="text-xs text-gray-500">사용자</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-gray-900">{formatNumber(Math.round(service.avgDailyActiveUsers))}</p>
                    <p className="text-xs text-gray-500">일평균</p>
                  </div>
                  <div className="p-2 bg-gray-50 rounded-lg">
                    <p className="text-lg font-bold text-gray-900">{formatNumber(service.totalTokens)}</p>
                    <p className="text-xs text-gray-500">토큰</p>
                  </div>
                </div>
              </Link>
            );
          })}
          {globalOverview.length === 0 && (
            <div className="col-span-full text-center py-8 text-gray-500">
              등록된 서비스가 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* Service Daily Usage Chart */}
      {serviceDaily.length > 0 && (
        <div className="bg-white rounded-2xl shadow-card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">서비스별 일일 요청 추이</h2>
          <div className="h-80">
            <Line
              data={serviceChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: (value) => formatNumber(Number(value)),
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* Department Stats */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-samsung-blue" />
          <h2 className="text-lg font-semibold text-gray-900">사업부별 통계</h2>
        </div>

        {deptStats.length > 0 ? (
          <>
            {/* Department Chart */}
            <div className="h-64 mb-6">
              <Bar
                data={deptChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top',
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                    },
                    x: {
                      ticks: {
                        maxRotation: 45,
                        minRotation: 45,
                      },
                    },
                  },
                }}
              />
            </div>

            {/* Department Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">사업부</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">누적 사용자</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">일평균 활성</th>
                    <th className="text-right py-3 px-2 font-semibold text-gray-700">총 토큰</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-700">모델별 토큰</th>
                  </tr>
                </thead>
                <tbody>
                  {deptStats.slice(0, 15).map((dept, index) => (
                    <tr key={dept.deptname} className={index % 2 === 0 ? 'bg-gray-50/50' : ''}>
                      <td className="py-3 px-2 font-medium text-gray-900">{dept.deptname}</td>
                      <td className="text-right py-3 px-2 text-gray-700">{formatNumber(dept.cumulativeUsers)}</td>
                      <td className="text-right py-3 px-2 text-gray-700">{dept.avgDailyActiveUsers.toFixed(1)}</td>
                      <td className="text-right py-3 px-2 text-gray-700">{formatNumber(dept.totalTokens)}</td>
                      <td className="py-3 px-2">
                        <div className="flex flex-wrap gap-1">
                          {dept.tokensByModel.slice(0, 3).map((model) => (
                            <span
                              key={model.modelName}
                              className="inline-flex items-center px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded"
                            >
                              {model.modelName.length > 12 ? model.modelName.slice(0, 12) + '...' : model.modelName}: {formatNumber(model.tokens)}
                            </span>
                          ))}
                          {dept.tokensByModel.length > 3 && (
                            <span className="text-xs text-gray-500">+{dept.tokensByModel.length - 3}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {deptStats.length > 15 && (
                <p className="text-center text-sm text-gray-500 mt-4">
                  {deptStats.length - 15}개 사업부 더 있음
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-gray-500">
            사업부별 통계 데이터가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
