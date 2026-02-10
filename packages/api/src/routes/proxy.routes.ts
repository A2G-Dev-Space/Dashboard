/**
 * LLM Proxy Routes
 *
 * Proxies /v1/* requests to actual LLM endpoints
 * 폐쇄망 환경: 인증 없이 사용 가능
 * Usage tracking: LLM 응답에서 토큰 사용량 추출하여 DB에 저장
 */

import { Router, Request, Response } from 'express';
import { prisma, redis } from '../index.js';
import { incrementUsage, trackActiveUser } from '../services/redis.service.js';

export const proxyRoutes = Router();

// ============================================
// 라운드로빈 엔드포인트 선택
// ============================================

interface EndpointInfo {
  endpointUrl: string;
  apiKey: string | null;
  modelName: string;  // 엔드포인트별 모델명
  extraHeaders: Record<string, string> | null;  // LLM 호출 시 추가 헤더
}

/**
 * 모델의 모든 엔드포인트 가져오기 (parent + subModels)
 * subModels가 없으면 parent만 반환
 */
async function getModelEndpoints(modelId: string, parentEndpoint: EndpointInfo): Promise<EndpointInfo[]> {
  const subModels = await prisma.subModel.findMany({
    where: { parentId: modelId, enabled: true },
    orderBy: { sortOrder: 'asc' },
    select: { endpointUrl: true, apiKey: true, modelName: true, extraHeaders: true },
  });

  if (subModels.length === 0) {
    return [parentEndpoint];
  }

  // parent도 엔드포인트 풀에 포함
  // subModel.modelName이 null이면 parent.modelName 사용
  return [
    parentEndpoint,
    ...subModels.map(s => ({
      endpointUrl: s.endpointUrl,
      apiKey: s.apiKey,
      modelName: s.modelName || parentEndpoint.modelName,
      extraHeaders: s.extraHeaders as Record<string, string> | null,
    })),
  ];
}

/**
 * 라운드로빈 시작 인덱스 반환
 * Redis에 인덱스 저장하여 서버 재시작에도 유지
 * Redis 실패 시 0 (parent) 반환
 */
async function getRoundRobinIndex(modelId: string, endpointCount: number): Promise<number> {
  if (endpointCount <= 1) {
    return 0;
  }

  try {
    const key = `model_rr:${modelId}`;
    const index = await redis.incr(key);
    // 첫 요청이면 expire 설정 (7일)
    if (index === 1) {
      await redis.expire(key, 7 * 24 * 60 * 60);
    }

    return (index - 1) % endpointCount;
  } catch (error) {
    // Redis 실패 시 parent(0) 사용
    console.error('[RoundRobin] Redis error, falling back to parent endpoint:', error);
    return 0;
  }
}

// 기본 사용자 정보 (폐쇄망에서 인증 없이 사용 시)
const DEFAULT_USER = {
  loginid: 'anonymous',
  username: 'Anonymous User',
  deptname: 'Unknown',
};

/**
 * 요청에서 서비스 ID 추출
 * X-Service-Id 헤더가 있으면 해당 서비스, 없으면 기본 서비스
 * @returns { serviceId: string | null, error: string | null }
 */
async function getServiceIdFromRequest(req: Request): Promise<{ serviceId: string | null; error: string | null }> {
  const serviceHeader = req.headers['x-service-id'] as string | undefined;

  if (serviceHeader) {
    // 헤더에 서비스가 지정된 경우 해당 서비스 조회
    const service = await prisma.service.findFirst({
      where: {
        OR: [
          { id: serviceHeader },
          { name: serviceHeader },
        ],
      },
      select: { id: true },
    });

    if (service) {
      return { serviceId: service.id, error: null };
    }
    // 명시적으로 서비스를 지정했지만 등록되지 않은 경우 → 거부
    console.warn(`[Service] Unregistered service '${serviceHeader}' rejected`);
    return { serviceId: null, error: `Service '${serviceHeader}' is not registered. Please contact admin to register your service.` };
  }

  // 헤더가 없는 경우 → 에러 반환 (X-Service-Id 필수)
  const loginid = (req.headers['x-user-id'] as string) || 'unknown';
  const path = req.originalUrl || req.url;
  console.warn(`[Service] ⚠️ Missing X-Service-Id header: user=${loginid}, path=${path} → rejected`);
  return { serviceId: null, error: 'X-Service-Id header is required. Please update your tool to the latest version following the guide at https://a2g.samsungds.net:4090/docs' };
}

/**
 * deptname에서 businessUnit 추출
 * "S/W혁신팀(S.LSI)" → "S.LSI", "DS/AI팀" → "DS"
 */
function extractBusinessUnit(deptname: string): string {
  if (!deptname) return '';
  // "팀이름(사업부)" 형식에서 사업부 추출
  const match = deptname.match(/\(([^)]+)\)/);
  if (match) return match[1];
  // "사업부/팀이름" 형식
  const parts = deptname.split('/');
  return parts[0]?.trim() || '';
}

/**
 * URL 인코딩된 텍스트 디코딩 (한글 등)
 * 디코딩 실패 시 원본 반환
 */
function safeDecodeURIComponent(text: string): string {
  if (!text) return text;
  try {
    // 이미 디코딩된 텍스트인지 확인 (% 문자가 없으면 디코딩 불필요)
    if (!text.includes('%')) return text;
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * 사용자 조회 또는 생성 (upsert)
 * X-User-Id 헤더가 있으면 해당 사용자, 없으면 기본 사용자
 */
async function getOrCreateUser(req: Request) {
  const loginid = (req.headers['x-user-id'] as string) || DEFAULT_USER.loginid;
  // URL 인코딩된 한글 디코딩
  const username = safeDecodeURIComponent((req.headers['x-user-name'] as string) || DEFAULT_USER.username);
  const deptname = safeDecodeURIComponent((req.headers['x-user-dept'] as string) || DEFAULT_USER.deptname);
  const businessUnit = extractBusinessUnit(deptname);

  const user = await prisma.user.upsert({
    where: { loginid },
    update: {
      lastActive: new Date(),
      deptname,  // 조직개편 시 자동 갱신
      businessUnit,
    },
    create: {
      loginid,
      username,
      deptname,
      businessUnit,
    },
  });

  return user;
}

/**
 * Usage 저장 (DB + Redis + UserService)
 */
async function recordUsage(
  userId: string,
  loginid: string,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  serviceId: string | null,
  latencyMs?: number
) {
  const totalTokens = inputTokens + outputTokens;

  // DB에 usage_logs 저장
  await prisma.usageLog.create({
    data: {
      userId,
      modelId,
      inputTokens,
      outputTokens,
      totalTokens,
      serviceId,
      latencyMs,
    },
  });

  // UserService 업데이트 (서비스별 사용자 활동 추적)
  if (serviceId) {
    await prisma.userService.upsert({
      where: {
        userId_serviceId: {
          userId,
          serviceId,
        },
      },
      update: {
        lastActive: new Date(),
        requestCount: { increment: 1 },
      },
      create: {
        userId,
        serviceId,
        firstSeen: new Date(),
        lastActive: new Date(),
        requestCount: 1,
      },
    });
  }

  // Redis 카운터 업데이트
  await incrementUsage(redis, userId, modelId, inputTokens, outputTokens);

  // 활성 사용자 추적
  await trackActiveUser(redis, loginid);

  console.log(`[Usage] Recorded: user=${loginid}, model=${modelId}, service=${serviceId}, tokens=${totalTokens} (in=${inputTokens}, out=${outputTokens}), latency=${latencyMs || 'N/A'}ms`);
}

/**
 * endpointUrl에 /chat/completions가 없으면 자동 추가
 */
function buildChatCompletionsUrl(endpointUrl: string): string {
  let url = endpointUrl.trim();

  // 이미 /chat/completions로 끝나면 그대로 반환
  if (url.endsWith('/chat/completions')) {
    return url;
  }

  // 끝에 슬래시 제거
  if (url.endsWith('/')) {
    url = url.slice(0, -1);
  }

  // /v1으로 끝나면 /chat/completions 추가
  if (url.endsWith('/v1')) {
    return `${url}/chat/completions`;
  }

  // 그 외의 경우도 /chat/completions 추가
  return `${url}/chat/completions`;
}

/**
 * GET /v1/models
 * Returns list of available models for the specified service
 * - X-Service-Id 헤더가 있으면 해당 서비스의 모델만 반환
 * - 헤더가 없으면 기본 서비스(nexus-coder)의 모델만 반환
 */
proxyRoutes.get('/models', async (req: Request, res: Response) => {
  try {
    // Get service ID from header or use default
    const { serviceId, error: serviceError } = await getServiceIdFromRequest(req);

    // Reject requests from unregistered services
    if (serviceError) {
      res.status(403).json({ error: serviceError });
      return;
    }

    // Build where clause based on service
    const whereClause: { enabled: boolean; serviceId?: string | null } = { enabled: true };
    if (serviceId) {
      whereClause.serviceId = serviceId;
    }

    const models = await prisma.model.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        displayName: true,
        maxTokens: true,
        sortOrder: true,
        supportsVision: true,
        allowedBusinessUnits: true,
        service: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { sortOrder: 'asc' },
        { displayName: 'asc' },  // sortOrder가 같으면 displayName 순
      ],
    });

    // 사업부 제한 필터링: X-User-Dept 헤더에서 businessUnit 추출
    const deptname = safeDecodeURIComponent((req.headers['x-user-dept'] as string) || '');
    const businessUnit = extractBusinessUnit(deptname);
    const hasRestricted = models.some((m) => m.allowedBusinessUnits.length > 0);

    let filtered = models;
    if (hasRestricted && !businessUnit) {
      // X-User-Dept 헤더 없이 호출 → 경고 로그만 남기고 전체 반환
      const loginid = (req.headers['x-user-id'] as string) || 'unknown';
      const serviceHeader = (req.headers['x-service-id'] as string) || 'unknown';
      console.warn(`[BU-Filter] GET /v1/models called without X-User-Dept header: user=${loginid}, service=${serviceHeader}`);
    } else if (businessUnit) {
      filtered = models.filter(
        (m) => m.allowedBusinessUnits.length === 0 || m.allowedBusinessUnits.includes(businessUnit)
      );
    }

    // OpenAI-compatible format
    res.json({
      object: 'list',
      data: filtered.map(model => ({
        id: model.name,
        object: 'model',
        created: Date.now(),
        owned_by: model.service?.name || 'unknown',
        permission: [],
        root: model.name,
        parent: null,
        // Custom fields
        _nexus: {
          id: model.id,
          modelName: model.name,
          displayName: model.displayName,
          maxTokens: model.maxTokens,
          supportsVision: model.supportsVision,
        },
      })),
    });
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({ error: 'Failed to get models' });
  }
});

/**
 * POST /v1/chat/completions
 * Proxy chat completion request to actual LLM
 */
proxyRoutes.post('/chat/completions', async (req: Request, res: Response) => {
  try {
    const { model: modelName, messages, stream, ...otherParams } = req.body;

    if (!modelName || !messages) {
      res.status(400).json({ error: 'model and messages are required' });
      return;
    }

    // Resolve service ID FIRST (서비스별 모델 구분을 위해 모델 조회 전에 수행)
    const { serviceId, error: serviceError } = await getServiceIdFromRequest(req);

    // Reject requests from unregistered services
    if (serviceError) {
      res.status(403).json({ error: serviceError });
      return;
    }

    // Find model in database (서비스 우선 조회 → 폴백)
    // 같은 이름의 모델이 여러 서비스에 등록될 수 있으므로, 요청 서비스의 모델을 우선 탐색
    let model = serviceId
      ? await prisma.model.findFirst({
          where: { name: modelName, serviceId, enabled: true },
        })
      : null;

    // 폴백: 서비스 특정 모델이 없으면 이름 또는 UUID로 전체 검색 (하위 호환)
    if (!model) {
      model = await prisma.model.findFirst({
        where: {
          OR: [
            { name: modelName },
            { id: modelName },
          ],
          enabled: true,
        },
      });
    }

    if (!model) {
      res.status(404).json({ error: `Model '${modelName}' not found or disabled` });
      return;
    }

    // 사업부 제한 체크 (soft enforcement: 헤더 없으면 경고 로그만 남기고 통과)
    if (model.allowedBusinessUnits.length > 0) {
      const deptname = safeDecodeURIComponent((req.headers['x-user-dept'] as string) || '');
      const userBU = extractBusinessUnit(deptname);
      if (!userBU) {
        const loginid = (req.headers['x-user-id'] as string) || 'unknown';
        const serviceHeader = (req.headers['x-service-id'] as string) || 'unknown';
        console.warn(`[BU-Filter] POST /v1/chat/completions called without X-User-Dept header: user=${loginid}, service=${serviceHeader}, model=${modelName}, allowedBU=[${model.allowedBusinessUnits.join(',')}]`);
      } else if (!model.allowedBusinessUnits.includes(userBU)) {
        res.status(403).json({ error: `Model '${modelName}' is not available for your business unit (${userBU})` });
        return;
      }
    }

    // Get or create user for usage tracking
    const user = await getOrCreateUser(req);

    // 라운드로빈 + Failover: parent + subModels에서 엔드포인트 선택
    const endpoints = await getModelEndpoints(model.id, {
      endpointUrl: model.endpointUrl,
      apiKey: model.apiKey,
      modelName: model.name,
      extraHeaders: model.extraHeaders as Record<string, string> | null,
    });
    const startIdx = await getRoundRobinIndex(model.id, endpoints.length);

    if (endpoints.length > 1) {
      console.log(`[RoundRobin] Model "${model.name}" has ${endpoints.length} endpoints, starting at index ${startIdx}`);
    }

    // Failover loop: 각 엔드포인트를 한 번씩 시도
    let lastFailoverError: string | undefined;

    for (let attempt = 0; attempt < endpoints.length; attempt++) {
      const idx = (startIdx + attempt) % endpoints.length;
      const endpoint = endpoints[idx]!;

      if (attempt > 0) {
        console.log(`[Failover] Model "${model.name}" trying endpoint ${attempt + 1}/${endpoints.length}: ${endpoint.endpointUrl}`);
      }

      // 이 엔드포인트용 헤더 + 바디 구성
      const llmRequestBody = {
        model: endpoint.modelName,
        messages,
        stream: stream || false,
        ...otherParams,
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (endpoint.apiKey) {
        headers['Authorization'] = `Bearer ${endpoint.apiKey}`;
      }

      if (endpoint.extraHeaders) {
        for (const [key, value] of Object.entries(endpoint.extraHeaders)) {
          const lowerKey = key.toLowerCase();
          if (lowerKey !== 'content-type' && lowerKey !== 'authorization') {
            headers[key] = value;
          }
        }
      }

      const effectiveModel = {
        ...model,
        endpointUrl: endpoint.endpointUrl,
        apiKey: endpoint.apiKey,
      };

      // 요청 시도: true = 응답 전송 완료 (성공 or 클라이언트 에러), false = failover 필요
      let handled: boolean;
      if (stream) {
        handled = await handleStreamingRequest(res, effectiveModel, llmRequestBody, headers, user, serviceId);
      } else {
        handled = await handleNonStreamingRequest(res, effectiveModel, llmRequestBody, headers, user, serviceId);
      }

      if (handled) return; // 응답 전송 완료 → 끝

      // failover: 다음 엔드포인트 시도
      lastFailoverError = `Endpoint ${endpoint.endpointUrl} failed`;
    }

    // 모든 엔드포인트 실패
    console.error(`[Failover] All ${endpoints.length} endpoints failed for model "${model.name}"`);
    res.status(503).json({
      error: 'Service temporarily unavailable',
      message: `All ${endpoints.length} endpoint(s) failed. Please try again later.`,
      details: lastFailoverError,
    });

  } catch (error) {
    console.error('Chat completion proxy error:', error);
    res.status(500).json({ error: 'Failed to process chat completion' });
  }
});

/**
 * 요청 설정
 */
const REQUEST_TIMEOUT_MS = 120000; // 2분 타임아웃

/**
 * max_tokens 관련 에러인지 확인 (두 가지 패턴)
 * 1. "max_tokens must be at least ..." (너무 작음)
 * 2. "max_tokens is too large" / "ContextWindowExceededError" (context window 초과)
 */
function isMaxTokensError(errorText: string): boolean {
  return errorText.includes('max_tokens') && errorText.includes('must be at least');
}

/**
 * Context window 초과 에러인지 확인
 * max_tokens + input_tokens > context_window 일 때 발생
 * → max_tokens를 제거하고 재시도하면 해결 가능
 */
function isContextWindowExceededError(errorText: string): boolean {
  const lower = errorText.toLowerCase();
  return (
    lower.includes('contextwindowexceedederror') ||
    (lower.includes('max_tokens') && lower.includes('too large')) ||
    (lower.includes('max_completion_tokens') && lower.includes('too large')) ||
    (lower.includes('context length') && lower.includes('input tokens'))
  );
}

/**
 * LLM 에러 상세 로그
 * 디버깅을 위해 요청/응답 정보를 구조화하여 출력
 */
function logLLMError(
  context: string,
  url: string,
  status: number,
  errorBody: string,
  requestBody: any,
  user: { loginid: string; username: string; deptname: string },
  model: { name: string },
  serviceId: string | null
) {
  const requestBodyStr = JSON.stringify(requestBody);
  const messages = requestBody.messages || [];
  const tools = requestBody.tools || [];

  // 메시지별 role과 content 길이
  const messageSummary = messages.map((m: any, i: number) => {
    const contentLen = typeof m.content === 'string' ? m.content.length : JSON.stringify(m.content || '').length;
    const toolCalls = m.tool_calls ? ` tool_calls=${m.tool_calls.length}` : '';
    return `  [${i}] role=${m.role} content_len=${contentLen}${toolCalls}`;
  }).join('\n');

  // tools 요약
  const toolsSummary = tools.length > 0
    ? tools.map((t: any, i: number) => {
        const fn = t.function || t;
        const paramLen = JSON.stringify(fn.parameters || {}).length;
        return `  [${i}] ${fn.name || 'unknown'} params_len=${paramLen}`;
      }).join('\n')
    : '  (none)';

  // LLM 응답 body (너무 길면 자름)
  const maxErrorLen = 2000;
  const truncatedError = errorBody.length > maxErrorLen
    ? errorBody.substring(0, maxErrorLen) + `... (truncated, total ${errorBody.length} chars)`
    : errorBody;

  console.error(
    `[LLM-Error] ${context}\n` +
    `  User: ${user.loginid} (${user.username}, ${user.deptname})\n` +
    `  Model: ${model.name} | Service: ${serviceId || 'none'}\n` +
    `  URL: ${url}\n` +
    `  Status: ${status}\n` +
    `  Request Body Size: ${requestBodyStr.length} bytes\n` +
    `  Messages (${messages.length}):\n${messageSummary}\n` +
    `  Tools (${tools.length}):\n${toolsSummary}\n` +
    `  stream: ${requestBody.stream || false} | max_tokens: ${requestBody.max_tokens || 'default'} | temperature: ${requestBody.temperature ?? 'default'}\n` +
    `  LLM Response Body:\n${truncatedError}`
  );
}

/**
 * Handle non-streaming chat completion
 * @returns true = 응답 전송 완료 (성공 or 클라이언트 에러), false = 서버/네트워크 에러 (failover 필요)
 */
async function handleNonStreamingRequest(
  res: Response,
  model: { id: string; name: string; endpointUrl: string; apiKey: string | null },
  requestBody: any,
  headers: Record<string, string>,
  user: { id: string; loginid: string; username: string; deptname: string },
  serviceId: string | null
): Promise<boolean> {
  const url = buildChatCompletionsUrl(model.endpointUrl);
  console.log(`[Proxy] user=${user.loginid} (${user.username}, ${user.deptname}) model=${model.name} endpoint=${url} (non-streaming)`);

  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        logLLMError('Non-Streaming', url, response.status, errorText, requestBody, user, model, serviceId);

        // Context window 초과 → max_tokens 제거 후 재시도
        if (response.status === 400 && isContextWindowExceededError(errorText) && (requestBody.max_tokens || requestBody.max_completion_tokens)) {
          console.log(`[Proxy] Context window exceeded, retrying without max_tokens (was ${requestBody.max_tokens || requestBody.max_completion_tokens})`);
          const { max_tokens: _mt, max_completion_tokens: _mct, ...bodyWithoutMaxTokens } = requestBody;
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), REQUEST_TIMEOUT_MS);
          try {
            const retryResponse = await fetch(url, {
              method: 'POST',
              headers,
              body: JSON.stringify(bodyWithoutMaxTokens),
              signal: retryController.signal,
            });
            clearTimeout(retryTimeoutId);
            const retryLatencyMs = Date.now() - startTime;

            if (retryResponse.ok) {
              const data = await retryResponse.json() as {
                usage?: { prompt_tokens?: number; completion_tokens?: number };
                [key: string]: unknown;
              };
              if (data.usage) {
                const inputTokens = data.usage.prompt_tokens || 0;
                const outputTokens = data.usage.completion_tokens || 0;
                recordUsage(user.id, user.loginid, model.id, inputTokens, outputTokens, serviceId, retryLatencyMs).catch((err) => {
                  console.error('[Usage] Failed to record usage:', err);
                });
              }
              res.json(data);
              return true;
            }
            // 재시도도 실패 → 원래 에러 반환
            const retryErrorText = await retryResponse.text();
            res.status(retryResponse.status).json({ error: 'LLM request failed', details: retryErrorText });
            return true;
          } catch {
            clearTimeout(retryTimeoutId);
            // 재시도 네트워크 에러 → 원래 에러 반환
          }
        }

        // 4xx 클라이언트 에러 → 응답 전송, failover 안 함
        if (response.status >= 400 && response.status < 500) {
          if (response.status === 400 && isMaxTokensError(errorText)) {
            res.status(400).json({
              error: 'Input too long',
              message: 'The input prompt exceeds the model\'s maximum context length. Please reduce the input size.',
              details: errorText,
            });
          } else {
            res.status(response.status).json({ error: 'LLM request failed', details: errorText });
          }
          return true; // 응답 전송 완료
        }

        // 5xx 서버 에러 → failover 가능
        console.error(`[Failover] Endpoint ${url} returned ${response.status}, will try next`);
        return false;
      }

      const data = await response.json() as {
        usage?: { prompt_tokens?: number; completion_tokens?: number };
        [key: string]: unknown;
      };

      if (data.usage) {
        const inputTokens = data.usage.prompt_tokens || 0;
        const outputTokens = data.usage.completion_tokens || 0;
        recordUsage(user.id, user.loginid, model.id, inputTokens, outputTokens, serviceId, latencyMs).catch((err) => {
          console.error('[Usage] Failed to record usage:', err);
        });
      }

      res.json(data);
      return true; // 성공

    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }

  } catch (error) {
    console.error(`[Failover] Endpoint ${url} connection failed:`, error instanceof Error ? error.message : error);
    return false; // 네트워크/타임아웃 에러 → failover
  }
}

/**
 * Handle streaming chat completion
 * @returns true = 응답 전송 완료 (성공 or 클라이언트 에러), false = 서버/네트워크 에러 (failover 필요)
 * 주의: SSE 헤더가 이미 전송된 후에는 failover 불가 → 항상 true 반환
 */
async function handleStreamingRequest(
  res: Response,
  model: { id: string; name: string; endpointUrl: string; apiKey: string | null },
  requestBody: any,
  headers: Record<string, string>,
  user: { id: string; loginid: string; username: string; deptname: string },
  serviceId: string | null
): Promise<boolean> {
  const url = buildChatCompletionsUrl(model.endpointUrl);
  console.log(`[Proxy] user=${user.loginid} (${user.username}, ${user.deptname}) model=${model.name} endpoint=${url} (streaming)`);

  const startTime = Date.now();
  let sseStarted = false;

  try {
    let contextWindowRetried = false;
    const requestWithUsage = {
      ...requestBody,
      stream_options: { include_usage: true },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: globalThis.Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestWithUsage),
        signal: controller.signal,
      });

      // stream_options 지원 안 하는 LLM → 원본 요청으로 재시도
      if (!response.ok && response.status === 400) {
        const errorText = await response.text();

        if (isMaxTokensError(errorText)) {
          clearTimeout(timeoutId);
          res.status(400).json({
            error: 'Input too long',
            message: 'The input prompt exceeds the model\'s maximum context length. Please reduce the input size.',
            details: errorText,
          });
          return true;
        }

        // Context window 초과 → max_tokens 제거 후 재시도
        if (isContextWindowExceededError(errorText) && (requestBody.max_tokens || requestBody.max_completion_tokens)) {
          contextWindowRetried = true;
          console.log(`[Proxy] Context window exceeded (streaming), retrying without max_tokens (was ${requestBody.max_tokens || requestBody.max_completion_tokens})`);
          const { max_tokens: _mt, max_completion_tokens: _mct, stream_options: _so, ...bodyWithoutMaxTokens } = requestBody;
          response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...bodyWithoutMaxTokens, stream: true }),
            signal: controller.signal,
          });
        } else {
          console.log('[Proxy] Retrying without stream_options');
          response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal,
          });
        }
      }

      clearTimeout(timeoutId);

    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }

    if (!response.ok) {
      const errorText = await response.text();
      logLLMError('Streaming', url, response.status, errorText, requestBody, user, model, serviceId);

      // Context window 초과 → max_tokens 제거 후 재시도 (stream_options 없이 온 경우, 아직 재시도하지 않은 경우만)
      if (!contextWindowRetried && response.status === 400 && isContextWindowExceededError(errorText) && (requestBody.max_tokens || requestBody.max_completion_tokens)) {
        console.log(`[Proxy] Context window exceeded (streaming, 2nd check), retrying without max_tokens`);
        const { max_tokens: _mt, max_completion_tokens: _mct, ...bodyWithoutMaxTokens } = requestBody;
        try {
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), REQUEST_TIMEOUT_MS);
          const retryResponse = await fetch(buildChatCompletionsUrl(model.endpointUrl), {
            method: 'POST',
            headers,
            body: JSON.stringify({ ...bodyWithoutMaxTokens, stream: true }),
            signal: retryController.signal,
          });
          clearTimeout(retryTimeoutId);
          if (retryResponse.ok) {
            // 재시도 성공 → response를 교체하여 아래 스트리밍 로직으로 진행
            response = retryResponse;
          } else {
            const retryErrorText = await retryResponse.text();
            res.status(retryResponse.status).json({ error: 'LLM request failed', details: retryErrorText });
            return true;
          }
        } catch {
          // 재시도 실패 → 원래 에러 반환
          res.status(response.status).json({ error: 'LLM request failed', details: errorText });
          return true;
        }
      } else {
        // 4xx 클라이언트 에러 → 응답 전송, failover 안 함
        if (response.status >= 400 && response.status < 500) {
          if (response.status === 400 && isMaxTokensError(errorText)) {
            res.status(400).json({
              error: 'Input too long',
              message: 'The input prompt exceeds the model\'s maximum context length. Please reduce the input size.',
              details: errorText,
            });
          } else {
            res.status(response.status).json({ error: 'LLM request failed', details: errorText });
          }
          return true;
        }

        // 5xx 서버 에러 → failover 가능
        console.error(`[Failover] Endpoint ${url} returned ${response.status}, will try next`);
        return false;
      }
    }

    // === SSE 스트리밍 시작 (이 이후로는 failover 불가) ===
    sseStarted = true;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body?.getReader();
    if (!reader) {
      res.status(500).json({ error: 'Failed to get response stream' });
      return true;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let usageData: { prompt_tokens?: number; completion_tokens?: number } | null = null;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);

            if (dataStr === '[DONE]') {
              res.write('data: [DONE]\n\n');
              continue;
            }

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.usage) {
                usageData = parsed.usage;
              }
            } catch {
              // Not valid JSON, ignore
            }

            res.write(`data: ${dataStr}\n\n`);
          } else if (line.trim()) {
            res.write(`${line}\n`);
          }
        }
      }

      if (buffer.trim()) {
        res.write(`${buffer}\n`);
      }

    } finally {
      reader.releaseLock();
    }

    const latencyMs = Date.now() - startTime;

    if (usageData) {
      const inputTokens = usageData.prompt_tokens || 0;
      const outputTokens = usageData.completion_tokens || 0;
      recordUsage(user.id, user.loginid, model.id, inputTokens, outputTokens, serviceId, latencyMs).catch((err) => {
        console.error('[Usage] Failed to record streaming usage:', err);
      });
    } else {
      console.log('[Usage] No usage data in streaming response');
    }

    res.end();
    return true; // 스트리밍 완료

  } catch (error) {
    if (sseStarted) {
      // SSE 이미 시작됐으면 failover 불가 → 응답 종료
      console.error(`[Streaming] Error after SSE started, ending response:`, error instanceof Error ? error.message : error);
      try { res.end(); } catch {}
      return true;
    }
    console.error(`[Failover] Endpoint ${url} connection failed:`, error instanceof Error ? error.message : error);
    return false; // 연결 실패 → failover 가능
  }
}

/**
 * POST /v1/completions
 * Proxy legacy completion request (non-chat)
 */
proxyRoutes.post('/completions', async (_req: Request, res: Response) => {
  res.status(501).json({ error: 'Legacy completions endpoint not implemented. Use /v1/chat/completions instead.' });
});

/**
 * GET /v1/health
 * Health check endpoint for CLI
 */
proxyRoutes.get('/health', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /v1/models/:model
 * Get specific model info for the specified service
 */
proxyRoutes.get('/models/:modelName', async (req: Request, res: Response) => {
  try {
    const { modelName } = req.params;

    // Get service ID from header or use default
    const { serviceId, error: serviceError } = await getServiceIdFromRequest(req);

    // Reject requests from unregistered services
    if (serviceError) {
      res.status(403).json({ error: serviceError });
      return;
    }

    // Build where clause
    const whereClause: {
      OR: Array<{ name: string } | { id: string }>;
      enabled: boolean;
      serviceId?: string | null;
    } = {
      OR: [
        { name: modelName },
        { id: modelName },
      ],
      enabled: true,
    };

    if (serviceId) {
      whereClause.serviceId = serviceId;
    }

    const model = await prisma.model.findFirst({
      where: whereClause,
      select: {
        id: true,
        name: true,
        displayName: true,
        maxTokens: true,
        supportsVision: true,
        allowedBusinessUnits: true,
        service: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    // 사업부 제한 체크 (soft enforcement: 헤더 없으면 경고 로그만 남기고 통과)
    if (model.allowedBusinessUnits.length > 0) {
      const deptname = safeDecodeURIComponent((req.headers['x-user-dept'] as string) || '');
      const userBU = extractBusinessUnit(deptname);
      if (!userBU) {
        const loginid = (req.headers['x-user-id'] as string) || 'unknown';
        const serviceHeader = (req.headers['x-service-id'] as string) || 'unknown';
        console.warn(`[BU-Filter] GET /v1/models/${modelName} called without X-User-Dept header: user=${loginid}, service=${serviceHeader}, allowedBU=[${model.allowedBusinessUnits.join(',')}]`);
      } else if (!model.allowedBusinessUnits.includes(userBU)) {
        res.status(403).json({ error: `Model '${modelName}' is not available for your business unit (${userBU})` });
        return;
      }
    }

    res.json({
      id: model.name,
      object: 'model',
      created: Date.now(),
      owned_by: model.service?.name || 'unknown',
      permission: [],
      root: model.name,
      parent: null,
      _nexus: {
        id: model.id,
        modelName: model.name,
        displayName: model.displayName,
        maxTokens: model.maxTokens,
        supportsVision: model.supportsVision,
      },
    });
  } catch (error) {
    console.error('Get model error:', error);
    res.status(500).json({ error: 'Failed to get model' });
  }
});
