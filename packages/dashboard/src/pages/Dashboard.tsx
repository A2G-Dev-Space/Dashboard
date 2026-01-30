import { useState, useEffect } from 'react';
import { Users, Server, Activity, Zap, RotateCcw, X } from 'lucide-react';
import { statsApi, serviceApi } from '../services/api';

type AdminRole = 'SUPER_ADMIN' | 'SERVICE_ADMIN' | 'VIEWER' | 'SERVICE_VIEWER' | null;
import UserStatsChart from '../components/Charts/UserStatsChart';
import ModelUsageChart from '../components/Charts/ModelUsageChart';
import UsersByModelChart from '../components/Charts/UsersByModelChart';
import ModelRatingChart from '../components/Charts/ModelRatingChart';

interface OverviewStats {
  activeUsers: number;
  todayUsage: {
    inputTokens: number;
    outputTokens: number;
    requests: number;
  };
  totalUsers: number;
  totalModels: number;
}

interface ServiceStats {
  serviceId: string;
  avgDailyActiveUsers: number;
  avgDailyActiveUsersExcluding: number;
}

interface ServiceInfo {
  id: string;
  name: string;
  displayName: string;
  description?: string;
}

interface DashboardProps {
  serviceId?: string;
  adminRole?: AdminRole;
}

export default function Dashboard({ serviceId, adminRole }: DashboardProps) {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [serviceInfo, setServiceInfo] = useState<ServiceInfo | null>(null);
  const [serviceStats, setServiceStats] = useState<ServiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [serviceId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [overviewRes, globalRes] = await Promise.all([
        statsApi.overview(serviceId),
        statsApi.globalOverview(),
      ]);
      setOverview(overviewRes.data);

      // Extract service-specific stats from global overview
      if (serviceId && globalRes.data.services) {
        const svcStats = globalRes.data.services.find(
          (s: ServiceStats) => s.serviceId === serviceId
        );
        if (svcStats) {
          setServiceStats(svcStats);
        }
      }

      // Load service info if serviceId is provided
      if (serviceId) {
        const serviceRes = await serviceApi.get(serviceId);
        setServiceInfo(serviceRes.data.service);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetData = async () => {
    if (!serviceId) return;
    setResetting(true);
    setResetResult(null);
    try {
      const res = await serviceApi.resetData(serviceId);
      const d = res.data.deleted;
      setResetResult(
        `삭제 완료: 사용 기록 ${d.usageLogs}건, 일일 통계 ${d.dailyStats}건, 평가 ${d.ratings}건, 사용자 연결 ${d.userServices}건, 피드백 ${d.feedbacks}건`
      );
      loadData();
      window.dispatchEvent(new CustomEvent('services-updated'));
    } catch {
      setResetResult('데이터 초기화에 실패했습니다.');
    } finally {
      setResetting(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-samsung-blue border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const stats = [
    {
      label: '활성 사용자',
      value: overview?.activeUsers || 0,
      icon: Activity,
      color: 'bg-emerald-500',
      bgLight: 'bg-emerald-50',
      description: '최근 30분',
    },
    {
      label: '전체 사용자',
      value: overview?.totalUsers || 0,
      icon: Users,
      color: 'bg-samsung-blue',
      bgLight: 'bg-blue-50',
      description: '등록된 사용자',
    },
    {
      label: '일평균 활성(영업일)',
      value: serviceStats?.avgDailyActiveUsersExcluding || 0,
      icon: Activity,
      color: 'bg-orange-500',
      bgLight: 'bg-orange-50',
      description: '최근 한달, 주말/휴일 제외',
      highlight: true,
    },
    {
      label: '활성 모델',
      value: overview?.totalModels || 0,
      icon: Server,
      color: 'bg-violet-500',
      bgLight: 'bg-violet-50',
      description: '사용 가능한 모델',
    },
    {
      label: '오늘 요청',
      value: overview?.todayUsage?.requests || 0,
      icon: Zap,
      color: 'bg-amber-500',
      bgLight: 'bg-amber-50',
      description: 'API 호출 수',
    },
  ];

  const todayTokens = overview?.todayUsage
    ? overview.todayUsage.inputTokens + overview.todayUsage.outputTokens
    : 0;

  return (
    <div className="space-y-6">
      {/* Service Info Banner (only for service-specific dashboard) */}
      {serviceInfo && (
        <div className="bg-gradient-to-r from-samsung-blue to-blue-600 rounded-2xl p-6 text-white">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold">{serviceInfo.displayName}</h1>
              {serviceInfo.description && (
                <p className="text-blue-100 mt-1">{serviceInfo.description}</p>
              )}
              <p className="text-blue-200 text-sm mt-2">서비스 ID: {serviceInfo.name}</p>
            </div>
            {adminRole === 'SUPER_ADMIN' && (
              <button
                onClick={() => { setResetResult(null); setShowResetModal(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white text-sm rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                기록 초기화
              </button>
            )}
          </div>
        </div>
      )}

      {/* Data Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">기록 초기화</h3>
              <button onClick={() => { if (!resetting) setShowResetModal(false); }} className={`p-1 transition-colors ${resetting ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-gray-600'}`}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">{serviceInfo?.displayName}</span>의 모든 사용 기록을 초기화하시겠습니까?
              </p>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700">사용 기록, 일일 통계, 평가, 사용자 연결, 피드백이 모두 삭제됩니다. 모델 설정은 유지됩니다.</p>
              </div>
              {resetResult && (
                <div className={`p-3 rounded-lg border ${resetResult.startsWith('삭제 완료') ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <p className={`text-sm ${resetResult.startsWith('삭제 완료') ? 'text-green-600' : 'text-red-600'}`}>{resetResult}</p>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  disabled={resetting}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {resetResult?.startsWith('삭제 완료') ? '닫기' : '취소'}
                </button>
                {!resetResult?.startsWith('삭제 완료') && (
                  <button
                    type="button"
                    onClick={handleResetData}
                    disabled={resetting}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {resetting ? '초기화 중...' : '초기화'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
        {stats.map(({ label, value, icon: Icon, color, bgLight, description, highlight }) => (
          <div
            key={label}
            className={`bg-white rounded-2xl shadow-card p-5 hover:shadow-soft transition-shadow duration-300 ${
              highlight ? 'border-l-4 border-orange-400' : ''
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{label}</p>
                <p className={`text-2xl font-bold mt-1 ${highlight ? 'text-orange-600' : 'text-gray-900'}`}>
                  {formatNumber(value)}
                </p>
                <p className="text-xs text-gray-400 mt-1">{description}</p>
              </div>
              <div className={`p-3 rounded-xl ${bgLight}`}>
                <Icon className={`w-5 h-5 ${color.replace('bg-', 'text-')}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Today's Token Usage */}
      <div className="bg-white rounded-2xl shadow-card p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">오늘의 토큰 사용량</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <p className="text-2xl font-bold text-samsung-blue">
              {formatNumber(overview?.todayUsage?.inputTokens || 0)}
            </p>
            <p className="text-sm text-gray-500 mt-1">입력 토큰</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-xl">
            <p className="text-2xl font-bold text-samsung-blue">
              {formatNumber(overview?.todayUsage?.outputTokens || 0)}
            </p>
            <p className="text-sm text-gray-500 mt-1">출력 토큰</p>
          </div>
          <div className="text-center p-4 bg-samsung-blue/5 rounded-xl border border-samsung-blue/20">
            <p className="text-2xl font-bold text-samsung-blue-dark">
              {formatNumber(todayTokens)}
            </p>
            <p className="text-sm text-gray-500 mt-1">총 토큰</p>
          </div>
        </div>
      </div>

      {/* User Stats Chart (Cumulative + Daily Active) */}
      <UserStatsChart serviceId={serviceId} />

      {/* Model Usage Chart */}
      <ModelUsageChart serviceId={serviceId} />

      {/* Model Rating Chart */}
      <ModelRatingChart serviceId={serviceId} />

      {/* Users by Model Chart */}
      <UsersByModelChart serviceId={serviceId} />
    </div>
  );
}
