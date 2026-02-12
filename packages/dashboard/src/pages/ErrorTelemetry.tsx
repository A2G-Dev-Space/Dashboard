/**
 * Error Telemetry Admin Page
 *
 * CLI/Electron에서 수집된 에러 로그를 조회하고 관리하는 SUPER_ADMIN 전용 페이지
 */

import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  RefreshCw,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  Monitor,
  Terminal,
  Clock,
  Users,
  Bug,
  Filter,
  Copy,
  Check,
  CheckSquare,
} from 'lucide-react';
import { errorTelemetryApi, type ErrorLogItem } from '../services/api';

interface ErrorStats {
  totalErrors: number;
  affectedUsers: number;
  errorsByCode: Array<{ errorCode: string; count: number }>;
  errorsBySource: Array<{ source: string; count: number }>;
  dailyTrend: Array<{ date: string; count: number }>;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function ErrorTelemetry() {
  const [logs, setLogs] = useState<ErrorLogItem[]>([]);
  const [stats, setStats] = useState<ErrorStats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ErrorLogItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [copySuccess, setCopySuccess] = useState(false);

  // 필터
  const [filterSource, setFilterSource] = useState<string>('');
  const [filterErrorCode, setFilterErrorCode] = useState<string>('');
  const [filterDays, setFilterDays] = useState<number>(7);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        errorTelemetryApi.logs({
          page: pagination.page,
          limit: pagination.limit,
          source: filterSource || undefined,
          errorCode: filterErrorCode || undefined,
          days: filterDays,
        }),
        errorTelemetryApi.stats(filterDays),
      ]);

      setLogs(logsRes.data.logs);
      setPagination(logsRes.data.pagination);
      setStats(statsRes.data);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Failed to load error telemetry:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filterSource, filterErrorCode, filterDays]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (id: string) => {
    if (!confirm('이 에러 로그를 삭제하시겠습니까?')) return;
    try {
      await errorTelemetryApi.delete(id);
      loadData();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const handleCleanup = async () => {
    if (!confirm('30일 지난 모든 에러 로그를 삭제하시겠습니까?')) return;
    try {
      const res = await errorTelemetryApi.cleanup();
      alert(`${res.data.deleted}건이 삭제되었습니다.`);
      loadData();
    } catch (error) {
      console.error('Failed to cleanup:', error);
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSourceIcon = (source: string) => {
    return source === 'electron' ? (
      <Monitor className="w-3.5 h-3.5" />
    ) : (
      <Terminal className="w-3.5 h-3.5" />
    );
  };

  const getCodeColor = (code: string) => {
    if (code.includes('TIMEOUT') || code.includes('CONNECTION'))
      return 'bg-amber-100 text-amber-700';
    if (code.includes('API_ERROR') || code.includes('NETWORK'))
      return 'bg-red-100 text-red-700';
    if (code.includes('TOKEN') || code.includes('CONTEXT') || code.includes('RATE'))
      return 'bg-orange-100 text-orange-700';
    if (code.includes('QUOTA'))
      return 'bg-purple-100 text-purple-700';
    return 'bg-pastel-100 text-pastel-700';
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === logs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(logs.map((l) => l.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`선택한 ${selectedIds.size}건의 에러 로그를 삭제하시겠습니까?`)) return;
    try {
      const res = await errorTelemetryApi.bulkDelete(Array.from(selectedIds));
      alert(`${res.data.deleted}건이 삭제되었습니다.`);
      setSelectedIds(new Set());
      loadData();
    } catch (error) {
      console.error('Failed to bulk delete:', error);
      alert('삭제에 실패했습니다.');
    }
  };

  const handleCopySelected = async () => {
    const selected = logs
      .filter((l) => selectedIds.has(l.id))
      .map((l) => ({
        id: l.id,
        timestamp: l.timestamp,
        source: l.source,
        appVersion: l.appVersion,
        platform: l.platform,
        errorName: l.errorName,
        errorCode: l.errorCode,
        errorMessage: l.errorMessage,
        isRecoverable: l.isRecoverable,
        stackTrace: l.stackTrace || null,
        context: l.context || null,
        user: {
          loginid: l.user.loginid,
          username: l.user.username,
          deptname: l.user.deptname,
        },
        service: l.service
          ? { name: l.service.name, displayName: l.service.displayName }
          : null,
      }));

    try {
      await navigator.clipboard.writeText(JSON.stringify(selected, null, 2));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = JSON.stringify(selected, null, 2);
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-50 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-pastel-800">에러 텔레메트리</h1>
            <p className="text-sm text-pastel-500">CLI/Electron 에러 수집 및 분석</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCleanup}
            className="px-3 py-2 text-sm text-pastel-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4 inline mr-1" />
            30일 정리
          </button>
          <button
            onClick={loadData}
            className="px-3 py-2 text-sm bg-samsung-blue text-white hover:bg-samsung-blue/90 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4 inline mr-1" />
            새로고침
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-pastel-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <Bug className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-pastel-800">{stats.totalErrors.toLocaleString()}</p>
                <p className="text-xs text-pastel-500">총 에러</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-pastel-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-pastel-800">{stats.errorsByCode.length}</p>
                <p className="text-xs text-pastel-500">에러 유형</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-pastel-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-pastel-800">{stats.affectedUsers}</p>
                <p className="text-xs text-pastel-500">영향받은 사용자</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-pastel-200 p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-50 rounded-lg">
                <Clock className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-pastel-800">
                  {stats.dailyTrend.length > 0
                    ? Math.round(stats.totalErrors / Math.max(stats.dailyTrend.length, 1))
                    : 0}
                </p>
                <p className="text-xs text-pastel-500">일평균 에러</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 에러 코드별 분포 */}
      {stats && stats.errorsByCode.length > 0 && (
        <div className="bg-white rounded-xl border border-pastel-200 p-5">
          <h3 className="text-sm font-semibold text-pastel-700 mb-3">에러 코드별 분포</h3>
          <div className="flex flex-wrap gap-2">
            {stats.errorsByCode.map((e) => (
              <button
                key={e.errorCode}
                onClick={() => { setFilterErrorCode(filterErrorCode === e.errorCode ? '' : e.errorCode); setPagination(p => ({ ...p, page: 1 })); }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filterErrorCode === e.errorCode
                    ? 'bg-samsung-blue text-white ring-2 ring-samsung-blue/30'
                    : getCodeColor(e.errorCode)
                }`}
              >
                {e.errorCode}
                <span className="font-bold">{e.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="bg-white rounded-xl border border-pastel-200 p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm text-pastel-500">
            <Filter className="w-4 h-4" />
            필터
          </div>
          <select
            value={filterSource}
            onChange={(e) => { setFilterSource(e.target.value); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-1.5 text-sm border border-pastel-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-samsung-blue/50"
          >
            <option value="">전체 소스</option>
            <option value="cli">CLI</option>
            <option value="electron">Electron</option>
          </select>
          <select
            value={filterDays}
            onChange={(e) => { setFilterDays(Number(e.target.value)); setPagination(p => ({ ...p, page: 1 })); }}
            className="px-3 py-1.5 text-sm border border-pastel-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-samsung-blue/50"
          >
            <option value={1}>최근 1일</option>
            <option value={7}>최근 7일</option>
            <option value={14}>최근 14일</option>
            <option value={30}>최근 30일</option>
          </select>
          {(filterSource || filterErrorCode) && (
            <button
              onClick={() => { setFilterSource(''); setFilterErrorCode(''); }}
              className="px-2 py-1 text-xs text-pastel-500 hover:text-pastel-700 hover:bg-pastel-100 rounded-lg transition-colors"
            >
              <X className="w-3.5 h-3.5 inline mr-0.5" />
              필터 초기화
            </button>
          )}
          <div className="ml-auto text-xs text-pastel-400">
            총 {pagination.total}건
          </div>
        </div>
      </div>

      {/* 에러 로그 테이블 */}
      <div className="bg-white rounded-xl border border-pastel-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-samsung-blue border-t-transparent rounded-full animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <AlertTriangle className="w-12 h-12 text-pastel-300 mx-auto mb-3" />
            <p className="text-sm text-pastel-500">에러 로그가 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pastel-100 bg-pastel-50/50">
                  <th className="w-10 px-3 py-3">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleSelectAll(); }}
                      className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-all ${
                        logs.length > 0 && selectedIds.size === logs.length
                          ? 'bg-samsung-blue border-samsung-blue text-white'
                          : selectedIds.size > 0
                            ? 'bg-samsung-blue/20 border-samsung-blue text-samsung-blue'
                            : 'border-pastel-300 hover:border-pastel-400'
                      }`}
                    >
                      {selectedIds.size > 0 && <Check className="w-3 h-3" strokeWidth={3} />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-pastel-500 uppercase">시간</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-pastel-500 uppercase">에러</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-pastel-500 uppercase">사용자</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-pastel-500 uppercase">소스</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-pastel-500 uppercase">버전</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-pastel-500 uppercase">메시지</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-pastel-500 uppercase w-16"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`border-b border-pastel-50 hover:bg-pastel-50/50 cursor-pointer transition-colors ${
                      selectedIds.has(log.id) ? 'bg-samsung-blue/5' : ''
                    }`}
                  >
                    <td className="px-3 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(log.id); }}
                        className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-all ${
                          selectedIds.has(log.id)
                            ? 'bg-samsung-blue border-samsung-blue text-white'
                            : 'border-pastel-300 hover:border-samsung-blue'
                        }`}
                      >
                        {selectedIds.has(log.id) && <Check className="w-3 h-3" strokeWidth={3} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-pastel-500 whitespace-nowrap">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCodeColor(log.errorCode)}`}>
                        {log.errorCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-pastel-700 text-xs">
                      <div>{log.user.username}</div>
                      <div className="text-pastel-400 text-[10px]">{log.user.loginid}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs text-pastel-600">
                        {getSourceIcon(log.source)}
                        {log.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-pastel-500 font-mono">
                      {log.appVersion}
                    </td>
                    <td className="px-4 py-3 text-xs text-pastel-600 max-w-xs truncate">
                      {log.errorMessage}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(log.id); }}
                        className="p-1 text-pastel-400 hover:text-red-500 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 페이지네이션 */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-pastel-100">
            <p className="text-xs text-pastel-500">
              {(pagination.page - 1) * pagination.limit + 1}-
              {Math.min(pagination.page * pagination.limit, pagination.total)}
              {' / '}
              {pagination.total}건
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
                className="p-1.5 text-pastel-500 hover:text-pastel-700 hover:bg-pastel-100 rounded-lg disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs text-pastel-600">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 text-pastel-500 hover:text-pastel-700 hover:bg-pastel-100 rounded-lg disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 선택 액션 바 */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 animate-slide-up">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-samsung-blue" />
            <span className="text-sm font-medium">{selectedIds.size}건 선택</span>
          </div>
          <div className="w-px h-5 bg-white/20" />
          <button
            onClick={handleCopySelected}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              copySuccess
                ? 'bg-green-500 text-white'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            {copySuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                복사됨!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                JSON 복사
              </>
            )}
          </button>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-500/80 hover:bg-red-500 text-white transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            선택 삭제
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 상세 모달 */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setSelectedLog(null)}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 모달 헤더 */}
            <div className="sticky top-0 bg-white border-b border-pastel-100 px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedLog.isRecoverable ? 'bg-amber-50' : 'bg-red-50'}`}>
                  <AlertTriangle className={`w-5 h-5 ${selectedLog.isRecoverable ? 'text-amber-500' : 'text-red-500'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-pastel-800">{selectedLog.errorName}</h3>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCodeColor(selectedLog.errorCode)}`}>
                    {selectedLog.errorCode}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 text-pastel-400 hover:text-pastel-600 hover:bg-pastel-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 모달 내용 */}
            <div className="px-6 py-4 space-y-4">
              {/* 메타 정보 */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-pastel-400">사용자</span>
                  <p className="text-pastel-700">{selectedLog.user.username}</p>
                </div>
                <div>
                  <span className="text-xs text-pastel-400">사번/ID</span>
                  <p className="text-pastel-700">{selectedLog.user.loginid}</p>
                </div>
                <div>
                  <span className="text-xs text-pastel-400">부서</span>
                  <p className="text-pastel-700">{selectedLog.user.deptname || '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-pastel-400">소스</span>
                  <p className="text-pastel-700 flex items-center gap-1">
                    {getSourceIcon(selectedLog.source)} {selectedLog.source}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-pastel-400">버전</span>
                  <p className="text-pastel-700 font-mono">{selectedLog.appVersion}</p>
                </div>
                <div>
                  <span className="text-xs text-pastel-400">플랫폼</span>
                  <p className="text-pastel-700">{selectedLog.platform || '-'}</p>
                </div>
                <div>
                  <span className="text-xs text-pastel-400">복구 가능</span>
                  <p className={selectedLog.isRecoverable ? 'text-green-600' : 'text-red-600'}>
                    {selectedLog.isRecoverable ? '예' : '아니오'}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-pastel-400">서비스</span>
                  <p className="text-pastel-700">{selectedLog.service?.displayName || '-'}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-pastel-400">시간</span>
                  <p className="text-pastel-700">{formatDate(selectedLog.timestamp)}</p>
                </div>
              </div>

              {/* 에러 메시지 */}
              <div>
                <span className="text-xs text-pastel-400">에러 메시지</span>
                <pre className="mt-1 p-3 bg-pastel-50 rounded-lg text-xs text-pastel-700 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">
                  {selectedLog.errorMessage}
                </pre>
              </div>

              {/* 스택 트레이스 */}
              {selectedLog.stackTrace && (
                <div>
                  <span className="text-xs text-pastel-400">스택 트레이스</span>
                  <pre className="mt-1 p-3 bg-slate-900 rounded-lg text-xs text-green-400 whitespace-pre-wrap break-all max-h-48 overflow-y-auto font-mono">
                    {selectedLog.stackTrace}
                  </pre>
                </div>
              )}

              {/* Context */}
              {selectedLog.context && Object.keys(selectedLog.context).length > 0 && (
                <div>
                  <span className="text-xs text-pastel-400">Context</span>
                  <pre className="mt-1 p-3 bg-pastel-50 rounded-lg text-xs text-pastel-700 whitespace-pre-wrap break-all max-h-32 overflow-y-auto font-mono">
                    {JSON.stringify(selectedLog.context, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="border-t border-pastel-100 px-6 py-3 flex justify-end gap-2">
              <button
                onClick={() => { handleDelete(selectedLog.id); setSelectedLog(null); }}
                className="px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                삭제
              </button>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-3 py-1.5 text-xs bg-pastel-100 text-pastel-700 hover:bg-pastel-200 rounded-lg transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
