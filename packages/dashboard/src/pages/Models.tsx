import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Server, Check, X, GripVertical, Layers, ChevronDown, ChevronRight, Play, CheckCircle, XCircle, Loader2, Eye, Shield } from 'lucide-react';
import { modelsApi, serviceApi } from '../services/api';

interface SubModel {
  id: string;
  modelName: string | null;  // 엔드포인트별 모델명 (null이면 parent.name 사용)
  endpointUrl: string;
  apiKey: string | null;
  extraHeaders: Record<string, string> | null;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
}

interface Model {
  id: string;
  name: string;
  displayName: string;
  endpointUrl: string;
  apiKey: string | null;
  extraHeaders: Record<string, string> | null;
  maxTokens: number;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  creator?: { loginid: string };
  serviceId?: string;
  service?: { id: string; name: string; displayName: string };
  supportsVision: boolean;
  superAdminOnly?: boolean;
  allowedBusinessUnits?: string[];
  subModels?: SubModel[];
}

interface HealthCheckResult {
  healthy: boolean;
  checks: {
    chatCompletion: { passed: boolean; status?: number; message: string; latencyMs: number };
    toolCall: { passed: boolean; status?: number; message: string; latencyMs: number };
  };
  message: string;
  totalLatencyMs: number;
}

interface ServiceInfo {
  id: string;
  name: string;
  displayName: string;
}

interface ModelsProps {
  serviceId?: string;
}

export default function Models({ serviceId }: ModelsProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [serviceInfo, setServiceInfo] = useState<ServiceInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingModel, setEditingModel] = useState<Model | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const dragRef = useRef<HTMLTableRowElement | null>(null);

  // SubModel 관리
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null);
  const [showSubModelModal, setShowSubModelModal] = useState(false);
  const [editingSubModel, setEditingSubModel] = useState<{ modelId: string; subModel: SubModel | null } | null>(null);

  useEffect(() => {
    loadData();
  }, [serviceId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await modelsApi.list(serviceId);
      setModels(response.data.models);

      // Load service info if serviceId is provided
      if (serviceId) {
        const serviceRes = await serviceApi.get(serviceId);
        setServiceInfo(serviceRes.data.service);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingModel(null);
    setShowModal(true);
  };

  const handleEdit = (model: Model) => {
    setEditingModel(model);
    setShowModal(true);
  };

  const handleDelete = async (id: string, force = false) => {
    const model = models.find(m => m.id === id);
    const modelName = model?.displayName || model?.name || 'this model';

    if (!force && !confirm(`정말 "${modelName}" 모델을 삭제하시겠습니까?`)) return;

    try {
      await modelsApi.delete(id, force);
      setModels(models.filter((m) => m.id !== id));
    } catch (error: unknown) {
      console.error('Failed to delete model:', error);

      // Check if it's usage log constraint error
      const axiosError = error as { response?: { data?: { usageCount?: number; error?: string } } };
      const usageCount = axiosError.response?.data?.usageCount;
      const errorMessage = axiosError.response?.data?.error;

      if (usageCount && usageCount > 0) {
        const forceDelete = confirm(
          `${errorMessage}\n\n` +
          `사용 기록 ${usageCount.toLocaleString()}개를 포함하여 강제 삭제하시겠습니까?\n` +
          `⚠️ 이 작업은 되돌릴 수 없습니다.`
        );
        if (forceDelete) {
          handleDelete(id, true);
        }
      } else {
        alert(errorMessage || '모델 삭제에 실패했습니다.');
      }
    }
  };

  const handleToggleEnabled = async (model: Model) => {
    try {
      await modelsApi.update(model.id, { enabled: !model.enabled });
      setModels(models.map((m) => (m.id === model.id ? { ...m, enabled: !m.enabled } : m)));
    } catch (error) {
      console.error('Failed to update model:', error);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', '');
    if (dragRef.current) {
      dragRef.current.style.opacity = '0.5';
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    if (dragRef.current) {
      dragRef.current.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = async (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) {
      handleDragEnd();
      return;
    }

    // Reorder models locally
    const newModels = [...models];
    const [draggedModel] = newModels.splice(draggedIndex, 1);
    newModels.splice(dropIndex, 0, draggedModel);
    setModels(newModels);
    handleDragEnd();

    // Save to server
    setIsSavingOrder(true);
    try {
      await modelsApi.reorder(newModels.map(m => m.id));
    } catch (error) {
      console.error('Failed to save model order:', error);
      // Revert on error
      loadData();
    } finally {
      setIsSavingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nexus-600"></div>
      </div>
    );
  }

  return (
    <div>
      {/* Service Info Banner */}
      {serviceInfo && (
        <div className="bg-gradient-to-r from-samsung-blue to-blue-600 rounded-2xl p-6 text-white mb-8">
          <h1 className="text-2xl font-bold">{serviceInfo.displayName} - 모델 관리</h1>
          <p className="text-blue-200 text-sm mt-1">서비스 ID: {serviceInfo.name}</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Models</h1>
          <p className="text-gray-500 mt-1">
            {serviceInfo ? `${serviceInfo.displayName}의 LLM 엔드포인트 관리` : 'Manage LLM endpoints for AX Portal'}
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 bg-samsung-blue text-white rounded-xl hover:bg-samsung-blue-dark transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Model
        </button>
      </div>

      {/* Models Table */}
      <div className="bg-white rounded-2xl shadow-card overflow-hidden">
        {isSavingOrder && (
          <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 text-sm text-blue-600 flex items-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
            순서 저장 중...
          </div>
        )}
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10">
                <span className="sr-only">순서</span>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Model
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Endpoint
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Max Tokens
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                사업부 제한
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {models.map((model, index) => (
              <React.Fragment key={model.id}>
              <tr
                ref={draggedIndex === index ? dragRef : null}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                className={`hover:bg-gray-50 transition-colors ${
                  dragOverIndex === index ? 'bg-blue-50 border-t-2 border-blue-400' : ''
                } ${draggedIndex === index ? 'opacity-50' : ''}`}
              >
                <td className="px-3 py-4 cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-5 h-5 text-gray-400 hover:text-gray-600" />
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-samsung-blue/10 rounded-xl">
                      <Server className="w-5 h-5 text-samsung-blue" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium text-gray-900">{model.displayName}</p>
                        {model.supportsVision && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700" title="Vision Language Model">
                            <Eye className="w-3 h-3" />
                            VL
                          </span>
                        )}
                        {model.superAdminOnly && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-700" title="슈퍼 관리자 전용">
                            <Shield className="w-3 h-3" />
                            관리자
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{model.name}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-600 truncate max-w-xs" title={model.endpointUrl}>
                    {model.endpointUrl}
                  </p>
                  {model.apiKey && (
                    <p className="text-xs text-gray-400">API Key: {model.apiKey}</p>
                  )}
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-600">{model.maxTokens.toLocaleString()}</p>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => handleToggleEnabled(model)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      model.enabled
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {model.enabled ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Enabled
                      </>
                    ) : (
                      <>
                        <X className="w-3.5 h-3.5" />
                        Disabled
                      </>
                    )}
                  </button>
                </td>
                <td className="px-6 py-4">
                  {model.allowedBusinessUnits && model.allowedBusinessUnits.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {model.allowedBusinessUnits.map((bu) => (
                        <span
                          key={bu}
                          className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full"
                        >
                          {bu}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">전체 허용</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => {
                      setEditingSubModel({ modelId: model.id, subModel: null });
                      setShowSubModelModal(true);
                    }}
                    className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                    title="Add SubModel (로드밸런싱)"
                  >
                    <Layers className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEdit(model)}
                    className="p-2 text-gray-400 hover:text-samsung-blue transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(model.id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
              {/* SubModels 확장 행 */}
              {model.subModels && model.subModels.length > 0 && (
                <tr className="bg-gray-50">
                  <td></td>
                  <td colSpan={6} className="px-6 py-3">
                    <div className="flex items-center gap-2 mb-2">
                      <button
                        onClick={() => setExpandedModelId(expandedModelId === model.id ? null : model.id)}
                        className="flex items-center gap-1 text-sm text-gray-600 hover:text-samsung-blue"
                      >
                        {expandedModelId === model.id ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                        <Layers className="w-4 h-4" />
                        <span className="font-medium">서브모델 {model.subModels.length}개</span>
                        <span className="text-xs text-gray-400">(라운드로빈 로드밸런싱)</span>
                      </button>
                    </div>
                    {expandedModelId === model.id && (
                      <div className="space-y-2 pl-6">
                        {/* Parent endpoint 표시 */}
                        <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex-1">
                            <span className="text-xs font-medium text-blue-600 mr-2">Parent</span>
                            <span className="text-sm text-gray-700">{model.endpointUrl}</span>
                            {model.apiKey && (
                              <span className="text-xs text-gray-400 ml-2">API Key: {model.apiKey}</span>
                            )}
                          </div>
                        </div>
                        {/* SubModels */}
                        {model.subModels.map((sub, idx) => (
                          <div key={sub.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200">
                            <div className="flex-1">
                              <span className="text-xs font-medium text-gray-500 mr-2">#{idx + 1}</span>
                              {sub.modelName && (
                                <span className="text-xs font-medium text-purple-600 mr-2">[{sub.modelName}]</span>
                              )}
                              <span className="text-sm text-gray-700">{sub.endpointUrl}</span>
                              {sub.apiKey && (
                                <span className="text-xs text-gray-400 ml-2">API Key: {sub.apiKey}</span>
                              )}
                              {!sub.enabled && (
                                <span className="ml-2 px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">Disabled</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingSubModel({ modelId: model.id, subModel: sub });
                                  setShowSubModelModal(true);
                                }}
                                className="p-1.5 text-gray-400 hover:text-samsung-blue transition-colors"
                                title="Edit SubModel"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm('이 서브모델을 삭제하시겠습니까?')) return;
                                  try {
                                    await modelsApi.deleteSubModel(model.id, sub.id);
                                    loadData();
                                  } catch (err) {
                                    console.error('Failed to delete sub-model:', err);
                                    alert('서브모델 삭제에 실패했습니다.');
                                  }
                                }}
                                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                title="Delete SubModel"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            setEditingSubModel({ modelId: model.id, subModel: null });
                            setShowSubModelModal(true);
                          }}
                          className="flex items-center gap-1 text-sm text-samsung-blue hover:text-samsung-blue-dark"
                        >
                          <Plus className="w-4 h-4" />
                          서브모델 추가
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
            {models.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No models configured. Click "Add Model" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <ModelModal
          model={editingModel}
          serviceId={serviceId}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            loadData();
          }}
        />
      )}

      {/* SubModel Modal */}
      {showSubModelModal && editingSubModel && (
        <SubModelModal
          modelId={editingSubModel.modelId}
          parentModelName={models.find(m => m.id === editingSubModel.modelId)?.name || ''}
          subModel={editingSubModel.subModel}
          onClose={() => {
            setShowSubModelModal(false);
            setEditingSubModel(null);
          }}
          onSave={() => {
            setShowSubModelModal(false);
            setEditingSubModel(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

interface ModelModalProps {
  model: Model | null;
  serviceId?: string;
  onClose: () => void;
  onSave: () => void;
}

function ModelModal({ model, serviceId, onClose, onSave }: ModelModalProps) {
  const [formData, setFormData] = useState({
    name: model?.name || '',
    displayName: model?.displayName || '',
    endpointUrl: model?.endpointUrl || '',
    apiKey: '',
    extraHeadersJson: model?.extraHeaders && Object.keys(model.extraHeaders).length > 0 ? JSON.stringify(model.extraHeaders, null, 2) : '',
    maxTokens: model?.maxTokens || 128000,
    enabled: model?.enabled ?? true,
    supportsVision: model?.supportsVision ?? false,
    superAdminOnly: model?.superAdminOnly ?? false,
    serviceId: model?.serviceId || serviceId || '',
    allowedBusinessUnits: model?.allowedBusinessUnits || [] as string[],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [businessUnits, setBusinessUnits] = useState<string[]>([]);
  const [buLoading, setBuLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<HealthCheckResult | null>(null);
  const [testPassed, setTestPassed] = useState(false);  // 테스트 통과 여부

  useEffect(() => {
    modelsApi.businessUnits()
      .then((res) => setBusinessUnits(res.data.businessUnits))
      .catch((err) => console.error('Failed to load business units:', err))
      .finally(() => setBuLoading(false));
  }, []);

  // 편집 모드에서는 테스트 필수 아님 (기존 통과 간주)
  useEffect(() => {
    if (model) setTestPassed(true);
  }, [model]);

  const parseExtraHeaders = (): Record<string, string> | undefined => {
    if (!formData.extraHeadersJson.trim()) return undefined;
    try {
      const parsed = JSON.parse(formData.extraHeadersJson);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      return parsed;
    } catch {
      return undefined;
    }
  };

  const handleTest = async () => {
    if (!formData.endpointUrl || !formData.name) {
      setError('테스트하려면 Model Name과 Endpoint URL이 필요합니다.');
      return;
    }
    // extraHeaders JSON 유효성 검사
    if (formData.extraHeadersJson.trim()) {
      try {
        const parsed = JSON.parse(formData.extraHeadersJson);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          setError('Extra Headers는 JSON 객체 형식이어야 합니다. 예: {"X-Custom": "value"}');
          return;
        }
      } catch {
        setError('Extra Headers JSON 형식이 올바르지 않습니다.');
        return;
      }
    }
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      const res = await modelsApi.testEndpoint({
        endpointUrl: formData.endpointUrl,
        modelName: formData.name,
        apiKey: formData.apiKey || undefined,
        extraHeaders: parseExtraHeaders(),
      });
      setTestResult(res.data.healthCheck);
      setTestPassed(res.data.healthCheck.healthy);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string; details?: Array<{ path?: string[]; message?: string }> } } };
      const details = axiosError.response?.data?.details;
      const detailMsg = details?.map((d) => `${d.path?.join('.') || '?'}: ${d.message}`).join(', ');
      setError(detailMsg || axiosError.response?.data?.error || '테스트 요청에 실패했습니다.');
    } finally {
      setTesting(false);
    }
  };

  const toggleBusinessUnit = (bu: string) => {
    setFormData((prev) => ({
      ...prev,
      allowedBusinessUnits: prev.allowedBusinessUnits.includes(bu)
        ? prev.allowedBusinessUnits.filter((b) => b !== bu)
        : [...prev.allowedBusinessUnits, bu],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 새 모델 추가 시 테스트 통과 필수
    if (!testPassed) {
      setError('모델을 저장하려면 먼저 테스트를 통과해야 합니다. "Test" 버튼을 눌러 테스트해주세요.');
      return;
    }

    // extraHeaders JSON 유효성 검사
    if (formData.extraHeadersJson.trim()) {
      try {
        const parsed = JSON.parse(formData.extraHeadersJson);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          setError('Extra Headers는 JSON 객체 형식이어야 합니다.');
          return;
        }
      } catch {
        setError('Extra Headers JSON 형식이 올바르지 않습니다.');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const { extraHeadersJson, ...rest } = formData;
      // 편집 모드에서 textarea 비움 + 기존에 extraHeaders 있었으면 → {} 전송해서 삭제
      const extraHeaders = formData.extraHeadersJson.trim()
        ? parseExtraHeaders()
        : (model?.extraHeaders && Object.keys(model.extraHeaders).length > 0 ? {} : undefined);
      const data = {
        ...rest,
        apiKey: formData.apiKey || undefined,
        serviceId: formData.serviceId || undefined,
        extraHeaders,
      };

      if (model) {
        await modelsApi.update(model.id, data);
      } else {
        // 새 모델: 서버에서도 health check 수행
        await modelsApi.create(data);
      }
      onSave();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string; healthCheck?: HealthCheckResult } } };
      const healthCheck = axiosError.response?.data?.healthCheck;
      if (healthCheck) {
        setTestResult(healthCheck);
        setTestPassed(false);
        setError(`Endpoint health check 실패: ${healthCheck.message}`);
      } else {
        setError(axiosError.response?.data?.error || 'Failed to save model. Please check your inputs.');
      }
      console.error('Save model error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {model ? 'Edit Model' : 'Add Model'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => { setFormData({ ...formData, name: e.target.value }); setTestPassed(!!model); setTestResult(null); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              placeholder="e.g., gpt-4"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={formData.displayName}
              onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              placeholder="e.g., GPT-4 Turbo"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Endpoint URL
            </label>
            <input
              type="url"
              value={formData.endpointUrl}
              onChange={(e) => { setFormData({ ...formData, endpointUrl: e.target.value }); setTestPassed(!!model); setTestResult(null); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              placeholder="https://api.openai.com/v1/chat/completions"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key {model && '(leave empty to keep existing)'}
            </label>
            <input
              type="password"
              value={formData.apiKey}
              onChange={(e) => { setFormData({ ...formData, apiKey: e.target.value }); setTestPassed(!!model); setTestResult(null); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              placeholder="sk-..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Extra Headers <span className="text-gray-400 font-normal">(JSON)</span>
            </label>
            <textarea
              value={formData.extraHeadersJson}
              onChange={(e) => {
                setFormData({ ...formData, extraHeadersJson: e.target.value });
                setTestPassed(!!model); // 변경 시 재테스트 필요 (편집모드에서만 유지)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent font-mono text-sm"
              placeholder={'{\n  "X-Custom-Header": "value"\n}'}
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              LLM API 호출 시 추가할 헤더를 JSON 형식으로 입력하세요.
            </p>
          </div>

          {/* Test 버튼 및 결과 */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Endpoint Test {!model && <span className="text-red-500">*</span>}
              </label>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !formData.endpointUrl || !formData.name}
                className="flex items-center gap-2 px-3 py-1.5 bg-samsung-blue text-white text-sm rounded-lg hover:bg-samsung-blue-dark disabled:opacity-50 transition-colors"
              >
                {testing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</>
                ) : (
                  <><Play className="w-4 h-4" /> Test</>
                )}
              </button>
            </div>
            {!model && !testPassed && (
              <p className="text-xs text-amber-600">
                새 모델 추가 시 Call Test와 Tool Call Test를 통과해야 저장할 수 있습니다.
              </p>
            )}
            {testResult && (
              <div className="space-y-2">
                <div className={`flex items-center gap-2 text-sm ${testResult.checks.chatCompletion.passed ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.checks.chatCompletion.passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span className="font-medium">Call Test</span>
                  <span className="text-gray-400">({testResult.checks.chatCompletion.latencyMs}ms)</span>
                  <span className="text-xs truncate max-w-[200px]" title={testResult.checks.chatCompletion.message}>
                    {testResult.checks.chatCompletion.message}
                  </span>
                </div>
                <div className={`flex items-center gap-2 text-sm ${testResult.checks.toolCall.passed ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.checks.toolCall.passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span className="font-medium">Tool Call Test</span>
                  <span className="text-gray-400">({testResult.checks.toolCall.latencyMs}ms)</span>
                  <span className="text-xs truncate max-w-[200px]" title={testResult.checks.toolCall.message}>
                    {testResult.checks.toolCall.message}
                  </span>
                </div>
                <div className={`text-xs font-medium ${testResult.healthy ? 'text-green-600' : 'text-red-600'}`}>
                  Total: {testResult.totalLatencyMs}ms — {testResult.healthy ? 'All checks passed' : testResult.message}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Tokens
            </label>
            <input
              type="number"
              value={formData.maxTokens}
              onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              min={1}
              max={1000000}
            />
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="enabled"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                className="w-4 h-4 text-samsung-blue rounded focus:ring-samsung-blue"
              />
              <label htmlFor="enabled" className="text-sm text-gray-700">
                Enable this model
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="supportsVision"
                checked={formData.supportsVision}
                onChange={(e) => setFormData({ ...formData, supportsVision: e.target.checked })}
                className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-600"
              />
              <label htmlFor="supportsVision" className="text-sm text-gray-700 flex items-center gap-1">
                <Eye className="w-3.5 h-3.5 text-emerald-600" />
                Vision (VL) 지원
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="superAdminOnly"
                checked={formData.superAdminOnly}
                onChange={(e) => setFormData({ ...formData, superAdminOnly: e.target.checked })}
                className="w-4 h-4 text-red-600 rounded focus:ring-red-600"
              />
              <label htmlFor="superAdminOnly" className="text-sm text-gray-700 flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-red-600" />
                슈퍼 관리자 전용
              </label>
            </div>
          </div>

          {/* 사업부 제한 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              사업부 제한
            </label>
            <p className="text-xs text-gray-500 mb-2">
              선택하지 않으면 모든 사업부에서 사용 가능합니다.
            </p>
            {buLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-transparent"></div>
                로딩 중...
              </div>
            ) : businessUnits.length === 0 ? (
              <p className="text-sm text-gray-400">등록된 사업부가 없습니다.</p>
            ) : (
              <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-1">
                {businessUnits.map((bu) => (
                  <label key={bu} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                    <input
                      type="checkbox"
                      checked={formData.allowedBusinessUnits.includes(bu)}
                      onChange={() => toggleBusinessUnit(bu)}
                      className="w-4 h-4 text-samsung-blue rounded focus:ring-samsung-blue"
                    />
                    <span className="text-sm text-gray-700">{bu}</span>
                  </label>
                ))}
              </div>
            )}
            {formData.allowedBusinessUnits.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {formData.allowedBusinessUnits.map((bu) => (
                  <span
                    key={bu}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full"
                  >
                    {bu}
                    <button
                      type="button"
                      onClick={() => toggleBusinessUnit(bu)}
                      className="hover:text-amber-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, allowedBusinessUnits: [] })}
                  className="text-xs text-gray-500 hover:text-gray-700 underline ml-1"
                >
                  전체 해제
                </button>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-samsung-blue text-white rounded-xl hover:bg-samsung-blue-dark disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ==================== SubModel Modal ====================

interface SubModelModalProps {
  modelId: string;
  parentModelName: string;
  subModel: SubModel | null;
  onClose: () => void;
  onSave: () => void;
}

function SubModelModal({ modelId, parentModelName, subModel, onClose, onSave }: SubModelModalProps) {
  const [formData, setFormData] = useState({
    modelName: subModel?.modelName || '',
    endpointUrl: subModel?.endpointUrl || '',
    apiKey: '',
    extraHeadersJson: subModel?.extraHeaders && Object.keys(subModel.extraHeaders).length > 0 ? JSON.stringify(subModel.extraHeaders, null, 2) : '',
    enabled: subModel?.enabled ?? true,
    sortOrder: subModel?.sortOrder || 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<HealthCheckResult | null>(null);
  const [testPassed, setTestPassed] = useState(!!subModel);  // 편집 시 기존 통과 간주

  const parseExtraHeaders = (): Record<string, string> | undefined => {
    if (!formData.extraHeadersJson.trim()) return undefined;
    try {
      const parsed = JSON.parse(formData.extraHeadersJson);
      if (typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
      return parsed;
    } catch {
      return undefined;
    }
  };

  const handleTest = async () => {
    if (!formData.endpointUrl) {
      setError('테스트하려면 Endpoint URL이 필요합니다.');
      return;
    }
    if (formData.extraHeadersJson.trim()) {
      try {
        const parsed = JSON.parse(formData.extraHeadersJson);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          setError('Extra Headers는 JSON 객체 형식이어야 합니다.');
          return;
        }
      } catch {
        setError('Extra Headers JSON 형식이 올바르지 않습니다.');
        return;
      }
    }
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      const res = await modelsApi.testEndpoint({
        endpointUrl: formData.endpointUrl,
        modelName: formData.modelName || parentModelName,
        apiKey: formData.apiKey || undefined,
        extraHeaders: parseExtraHeaders(),
      });
      setTestResult(res.data.healthCheck);
      setTestPassed(res.data.healthCheck.healthy);
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string; details?: Array<{ path?: string[]; message?: string }> } } };
      const details = axiosError.response?.data?.details;
      const detailMsg = details?.map((d) => `${d.path?.join('.') || '?'}: ${d.message}`).join(', ');
      setError(detailMsg || axiosError.response?.data?.error || '테스트 요청에 실패했습니다.');
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!testPassed) {
      setError('서브모델을 저장하려면 먼저 테스트를 통과해야 합니다.');
      return;
    }

    if (formData.extraHeadersJson.trim()) {
      try {
        const parsed = JSON.parse(formData.extraHeadersJson);
        if (typeof parsed !== 'object' || Array.isArray(parsed)) {
          setError('Extra Headers는 JSON 객체 형식이어야 합니다.');
          return;
        }
      } catch {
        setError('Extra Headers JSON 형식이 올바르지 않습니다.');
        return;
      }
    }

    setLoading(true);
    setError('');

    try {
      const { extraHeadersJson, ...rest } = formData;
      // 편집 모드에서 textarea 비움 + 기존에 extraHeaders 있었으면 → {} 전송해서 삭제
      const extraHeaders = formData.extraHeadersJson.trim()
        ? parseExtraHeaders()
        : (subModel?.extraHeaders && Object.keys(subModel.extraHeaders).length > 0 ? {} : undefined);
      const data = {
        ...rest,
        modelName: formData.modelName || undefined,
        apiKey: formData.apiKey || undefined,
        extraHeaders,
      };

      if (subModel) {
        await modelsApi.updateSubModel(modelId, subModel.id, data);
      } else {
        await modelsApi.createSubModel(modelId, data);
      }
      onSave();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string; healthCheck?: HealthCheckResult } } };
      const healthCheck = axiosError.response?.data?.healthCheck;
      if (healthCheck) {
        setTestResult(healthCheck);
        setTestPassed(false);
        setError(`Health check 실패: ${healthCheck.message}`);
      } else {
        setError(axiosError.response?.data?.error || '서브모델 저장에 실패했습니다.');
      }
      console.error('Save sub-model error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {subModel ? '서브모델 수정' : '서브모델 추가'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            라운드로빈 로드밸런싱을 위한 추가 엔드포인트
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model Name <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <input
              type="text"
              value={formData.modelName}
              onChange={(e) => { setFormData({ ...formData, modelName: e.target.value }); setTestPassed(!!subModel); setTestResult(null); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              placeholder="비워두면 Parent 모델명 사용"
            />
            <p className="text-xs text-gray-500 mt-1">이 엔드포인트에서 사용할 모델명 (예: GLM-4, gpt-4-turbo)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Endpoint URL
            </label>
            <input
              type="url"
              value={formData.endpointUrl}
              onChange={(e) => { setFormData({ ...formData, endpointUrl: e.target.value }); setTestPassed(!!subModel); setTestResult(null); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              placeholder="https://api.example.com/v1/chat/completions"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key {subModel && '(비워두면 기존 유지)'}
            </label>
            <input
              type="password"
              value={formData.apiKey}
              onChange={(e) => { setFormData({ ...formData, apiKey: e.target.value }); setTestPassed(!!subModel); setTestResult(null); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              placeholder="sk-..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Extra Headers <span className="text-gray-400 font-normal">(JSON)</span>
            </label>
            <textarea
              value={formData.extraHeadersJson}
              onChange={(e) => { setFormData({ ...formData, extraHeadersJson: e.target.value }); setTestPassed(!!subModel); setTestResult(null); }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent font-mono text-sm"
              placeholder={'{\n  "X-Custom-Header": "value"\n}'}
              rows={3}
            />
            <p className="text-xs text-gray-500 mt-1">
              LLM API 호출 시 추가할 헤더를 JSON 형식으로 입력하세요.
            </p>
          </div>

          {/* Test 버튼 및 결과 */}
          <div className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Endpoint Test {!subModel && <span className="text-red-500">*</span>}
              </label>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !formData.endpointUrl}
                className="flex items-center gap-2 px-3 py-1.5 bg-samsung-blue text-white text-sm rounded-lg hover:bg-samsung-blue-dark disabled:opacity-50 transition-colors"
              >
                {testing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Testing...</>
                ) : (
                  <><Play className="w-4 h-4" /> Test</>
                )}
              </button>
            </div>
            {!subModel && !testPassed && (
              <p className="text-xs text-amber-600">
                서브모델 추가 시 Call Test와 Tool Call Test를 통과해야 저장할 수 있습니다.
              </p>
            )}
            {testResult && (
              <div className="space-y-2">
                <div className={`flex items-center gap-2 text-sm ${testResult.checks.chatCompletion.passed ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.checks.chatCompletion.passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span className="font-medium">Call Test</span>
                  <span className="text-gray-400">({testResult.checks.chatCompletion.latencyMs}ms)</span>
                </div>
                <div className={`flex items-center gap-2 text-sm ${testResult.checks.toolCall.passed ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.checks.toolCall.passed ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span className="font-medium">Tool Call Test</span>
                  <span className="text-gray-400">({testResult.checks.toolCall.latencyMs}ms)</span>
                </div>
                <div className={`text-xs font-medium ${testResult.healthy ? 'text-green-600' : 'text-red-600'}`}>
                  Total: {testResult.totalLatencyMs}ms — {testResult.healthy ? 'All checks passed' : testResult.message}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              정렬 순서
            </label>
            <input
              type="number"
              value={formData.sortOrder}
              onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-samsung-blue focus:border-transparent"
              min={0}
            />
            <p className="text-xs text-gray-500 mt-1">낮을수록 먼저 선택됩니다 (Parent는 항상 0순위)</p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="submodel-enabled"
              checked={formData.enabled}
              onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              className="w-4 h-4 text-samsung-blue rounded focus:ring-samsung-blue"
            />
            <label htmlFor="submodel-enabled" className="text-sm text-gray-700">
              활성화
            </label>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-samsung-blue text-white rounded-xl hover:bg-samsung-blue-dark disabled:opacity-50 transition-colors"
            >
              {loading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
