/**
 * LLM Test Routes
 *
 * LLM 테스트 쌍 관리 및 테스트 실행
 * - 질문자 LLM이 질문 생성
 * - 테스트 LLM이 응답
 * - 질문자 LLM이 응답 평가 (1-100점)
 */

import { Router, RequestHandler } from 'express';
import { prisma } from '../index.js';
import { authenticateToken, requireAdmin, requireWriteAccess, AuthenticatedRequest } from '../middleware/auth.js';
import { z } from 'zod';

export const llmTestRoutes = Router();

// Apply authentication and admin check to all routes
llmTestRoutes.use(authenticateToken);
llmTestRoutes.use(requireAdmin as RequestHandler);

const LLM_TEST_TIMEOUT_MS = 60000; // 60초

// ==================== Validation Schemas ====================

const createTestPairSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  enabled: z.boolean().default(true),
  intervalMinutes: z.number().min(1).max(60).default(5),
  questionerModelName: z.string().min(1, 'Questioner model name is required'),
  questionerEndpoint: z.string().url('Invalid questioner endpoint URL'),
  questionerApiKey: z.string().optional(),
  testModelName: z.string().min(1, 'Test model name is required'),
  testEndpoint: z.string().url('Invalid test endpoint URL'),
  testApiKey: z.string().optional(),
  questionPrompt: z.string().optional(),
  evaluationPrompt: z.string().optional(),
});

const updateTestPairSchema = createTestPairSchema.partial();

// ==================== Helper Functions ====================

/**
 * fetch 요청 with timeout
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * endpointUrl에서 chat completions URL 구성
 */
function buildChatCompletionUrl(endpointUrl: string): string {
  let url = endpointUrl.trim().replace(/\/+$/, '');
  if (url.endsWith('/chat/completions')) return url;
  if (url.endsWith('/completions')) return url.replace(/\/completions$/, '/chat/completions');
  if (url.endsWith('/v1')) return `${url}/chat/completions`;
  return `${url}/chat/completions`;
}

const MAX_RETRIES = 3;

/**
 * 텍스트에서 JSON 추출 (reasoning 태그 등 제거)
 * <think>...</think> 같은 태그가 있어도 JSON을 찾아서 파싱
 */
function extractJSON<T>(content: string): T {
  // 1. 먼저 전체 내용이 JSON인지 시도
  try {
    return JSON.parse(content) as T;
  } catch {
    // 계속 진행
  }

  // 2. <think>...</think> 등의 태그 제거 후 시도
  const withoutTags = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .trim();

  try {
    return JSON.parse(withoutTags) as T;
  } catch {
    // 계속 진행
  }

  // 3. JSON 객체 패턴 찾기 (가장 바깥쪽 { } 찾기)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]) as T;
    } catch {
      // 계속 진행
    }
  }

  // 4. 마지막 시도: 줄바꿈으로 분리된 JSON 찾기
  const lines = content.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed) as T;
      } catch {
        // 계속 진행
      }
    }
  }

  throw new Error(`No valid JSON found in response`);
}

/**
 * LLM에 JSON 형식 요청 보내기 (structured output)
 * - OpenAI 호환 API: response_format 사용
 * - 비호환 API: 프롬프트만으로 JSON 유도 + extractJSON으로 파싱
 */
async function sendLLMRequestJSON<T>(
  endpoint: string,
  modelName: string,
  apiKey: string | null,
  messages: { role: string; content: string }[],
  jsonSchema?: { name: string; schema: object }
): Promise<{ data: T; latencyMs: number }> {
  const url = buildChatCompletionUrl(endpoint);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  let lastError: Error | null = null;
  let useStructuredOutput = true; // 첫 시도는 structured output 사용

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const startTime = Date.now();

    try {
      const requestBody: Record<string, unknown> = {
        model: modelName,
        messages,
        temperature: 0.7,
      };

      // 첫 번째 시도: structured output 사용
      // 실패하면 두 번째부터는 structured output 없이 시도
      if (useStructuredOutput && jsonSchema) {
        requestBody.response_format = {
          type: 'json_schema',
          json_schema: {
            name: jsonSchema.name,
            strict: true,
            schema: jsonSchema.schema,
          },
        };
      }

      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      }, LLM_TEST_TIMEOUT_MS);

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        // structured output 지원 안하면 다음 시도에서 제외
        if (response.status === 400 && errorText.includes('response_format')) {
          useStructuredOutput = false;
        }
        throw new Error(`LLM request failed (${response.status}): ${errorText.slice(0, 200)}`);
      }

      const responseData = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = responseData.choices?.[0]?.message?.content || '';

      // JSON 추출 (태그 등 제거)
      const parsed = extractJSON<T>(content);
      return { data: parsed, latencyMs };

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      console.warn(`[LLMTest] Attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}`);

      // JSON 파싱 실패 시 다음 시도에서 structured output 제외
      if (lastError.message.includes('No valid JSON') || lastError.message.includes('JSON parse')) {
        useStructuredOutput = false;
      }

      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  throw lastError || new Error('All retries failed');
}


// JSON 스키마 정의
const QUESTION_SCHEMA = {
  name: 'question_response',
  schema: {
    type: 'object',
    properties: {
      question: { type: 'string', description: 'The generated question' },
    },
    required: ['question'],
    additionalProperties: false,
  },
};

const ANSWER_SCHEMA = {
  name: 'answer_response',
  schema: {
    type: 'object',
    properties: {
      answer: { type: 'string', description: 'The answer to the question' },
      confidence: { type: 'string', enum: ['high', 'medium', 'low'], description: 'Confidence level' },
    },
    required: ['answer', 'confidence'],
    additionalProperties: false,
  },
};

const EVALUATION_SCHEMA = {
  name: 'evaluation_response',
  schema: {
    type: 'object',
    properties: {
      score: { type: 'number', description: 'Score from 1-100' },
      reasoning: { type: 'string', description: 'Brief reasoning for the score' },
    },
    required: ['score', 'reasoning'],
    additionalProperties: false,
  },
};

interface QuestionResponse {
  question: string;
}

interface AnswerResponse {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
}

interface EvaluationResponse {
  score: number;
  reasoning: string;
}

/**
 * 테스트 실행 (Structured JSON Output)
 */
async function runTest(pair: {
  id: string;
  questionerModelName: string;
  questionerEndpoint: string;
  questionerApiKey: string | null;
  testModelName: string;
  testEndpoint: string;
  testApiKey: string | null;
  questionPrompt: string;
  evaluationPrompt: string;
}): Promise<{
  latencyMs: number;
  score: number | null;
  status: string;
  errorMessage: string | null;
}> {
  try {
    // 1. 질문자가 질문 생성 (JSON 형식)
    console.log(`[LLMTest] Generating question for pair ${pair.id}...`);
    const questionSystemPrompt = `You are a question generator. Always respond in JSON format: {"question": "your question here"}`;
    const questionResult = await sendLLMRequestJSON<QuestionResponse>(
      pair.questionerEndpoint,
      pair.questionerModelName,
      pair.questionerApiKey,
      [
        { role: 'system', content: questionSystemPrompt },
        { role: 'user', content: pair.questionPrompt },
      ],
      QUESTION_SCHEMA
    );
    const question = questionResult.data.question;
    console.log(`[LLMTest] Question generated: "${question.slice(0, 100)}..."`);

    // 2. 테스트 LLM이 응답 (JSON 형식)
    console.log(`[LLMTest] Sending question to test LLM...`);
    const testSystemPrompt = `You are a helpful AI assistant. Answer the question accurately and concisely. Always respond in JSON format: {"answer": "your answer", "confidence": "high|medium|low"}`;
    const testResult = await sendLLMRequestJSON<AnswerResponse>(
      pair.testEndpoint,
      pair.testModelName,
      pair.testApiKey,
      [
        { role: 'system', content: testSystemPrompt },
        { role: 'user', content: question },
      ],
      ANSWER_SCHEMA
    );
    // latencyMs는 sendLLMRequestJSON에서 반환 (재시도 시 마지막 성공한 요청의 latency)
    const testLatencyMs = testResult.latencyMs;
    const answer = testResult.data.answer;
    const confidence = testResult.data.confidence;
    console.log(`[LLMTest] Test LLM responded in ${testLatencyMs}ms (confidence: ${confidence}): "${answer.slice(0, 100)}..."`);

    // 3. 질문자가 응답 평가 (JSON 형식)
    console.log(`[LLMTest] Evaluating response...`);
    const evalSystemPrompt = `You are an AI response evaluator. Always respond in JSON format: {"score": <1-100>, "reasoning": "brief explanation"}`;
    const evalUserPrompt = `${pair.evaluationPrompt}

Question: ${question}

Response to evaluate:
${answer}

(Model's self-reported confidence: ${confidence})`;

    const evalResult = await sendLLMRequestJSON<EvaluationResponse>(
      pair.questionerEndpoint,
      pair.questionerModelName,
      pair.questionerApiKey,
      [
        { role: 'system', content: evalSystemPrompt },
        { role: 'user', content: evalUserPrompt },
      ],
      EVALUATION_SCHEMA
    );

    const score = Math.min(100, Math.max(1, Math.round(evalResult.data.score)));
    console.log(`[LLMTest] Score: ${score}, Reasoning: ${evalResult.data.reasoning.slice(0, 100)}...`);

    return {
      latencyMs: testLatencyMs,
      score,
      status: 'SUCCESS',
      errorMessage: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error
      ? (error.name === 'AbortError' ? 'Request timed out' : error.message)
      : 'Unknown error';
    console.error(`[LLMTest] Error running test for pair ${pair.id}:`, errorMessage);

    return {
      latencyMs: 0,
      score: null,
      status: error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'ERROR',
      errorMessage,
    };
  }
}

// ==================== Routes ====================

/**
 * GET /llm-test/pairs
 * 모든 테스트 쌍 조회
 */
llmTestRoutes.get('/pairs', async (_req, res) => {
  try {
    const pairs = await prisma.lLMTestPair.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { results: true },
        },
      },
    });

    // API 키 마스킹
    const maskedPairs = pairs.map((pair: {
      questionerApiKey: string | null;
      testApiKey: string | null;
      [key: string]: unknown;
    }) => ({
      ...pair,
      questionerApiKey: pair.questionerApiKey ? '********' : null,
      testApiKey: pair.testApiKey ? '********' : null,
    }));

    res.json({ pairs: maskedPairs });
  } catch (error) {
    console.error('Failed to list LLM test pairs:', error);
    res.status(500).json({ error: 'Failed to list test pairs' });
  }
});

/**
 * GET /llm-test/pairs/:id
 * 특정 테스트 쌍 조회
 */
llmTestRoutes.get('/pairs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const pair = await prisma.lLMTestPair.findUnique({
      where: { id },
      include: {
        _count: {
          select: { results: true },
        },
      },
    });

    if (!pair) {
      return res.status(404).json({ error: 'Test pair not found' });
    }

    // API 키 마스킹
    const maskedPair = {
      ...pair,
      questionerApiKey: pair.questionerApiKey ? '********' : null,
      testApiKey: pair.testApiKey ? '********' : null,
    };

    res.json({ pair: maskedPair });
  } catch (error) {
    console.error('Failed to get LLM test pair:', error);
    res.status(500).json({ error: 'Failed to get test pair' });
  }
});

/**
 * POST /llm-test/pairs
 * 새 테스트 쌍 생성
 */
llmTestRoutes.post('/pairs', requireWriteAccess as RequestHandler, async (req, res) => {
  try {
    const validation = createTestPairSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors
      });
    }

    const data = validation.data;

    // undefined인 필드는 제외하여 Prisma 기본값 사용
    const createData: Record<string, unknown> = {
      name: data.name,
      enabled: data.enabled,
      intervalMinutes: data.intervalMinutes,
      questionerModelName: data.questionerModelName,
      questionerEndpoint: data.questionerEndpoint,
      questionerApiKey: data.questionerApiKey || null,
      testModelName: data.testModelName,
      testEndpoint: data.testEndpoint,
      testApiKey: data.testApiKey || null,
    };

    // 프롬프트가 제공된 경우에만 설정 (undefined면 Prisma 기본값 사용)
    if (data.questionPrompt !== undefined) {
      createData.questionPrompt = data.questionPrompt;
    }
    if (data.evaluationPrompt !== undefined) {
      createData.evaluationPrompt = data.evaluationPrompt;
    }

    const pair = await prisma.lLMTestPair.create({
      data: createData as any,
    });

    console.log(`[LLMTest] Created test pair: ${pair.id} (${pair.name})`);

    // API 키 마스킹
    const maskedPair = {
      ...pair,
      questionerApiKey: pair.questionerApiKey ? '********' : null,
      testApiKey: pair.testApiKey ? '********' : null,
    };

    res.status(201).json({ pair: maskedPair });
  } catch (error) {
    console.error('Failed to create LLM test pair:', error);
    res.status(500).json({ error: 'Failed to create test pair' });
  }
});

/**
 * PUT /llm-test/pairs/:id
 * 테스트 쌍 수정
 */
llmTestRoutes.put('/pairs/:id', requireWriteAccess as RequestHandler, async (req, res) => {
  try {
    const { id } = req.params;
    const validation = updateTestPairSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.error.errors
      });
    }

    const existing = await prisma.lLMTestPair.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Test pair not found' });
    }

    const data = validation.data;

    // API 키가 '********'이면 기존 값 유지
    const updateData: Record<string, unknown> = { ...data };
    if (data.questionerApiKey === '********') {
      delete updateData.questionerApiKey;
    }
    if (data.testApiKey === '********') {
      delete updateData.testApiKey;
    }

    const pair = await prisma.lLMTestPair.update({
      where: { id },
      data: updateData,
    });

    console.log(`[LLMTest] Updated test pair: ${pair.id} (${pair.name})`);

    // API 키 마스킹
    const maskedPair = {
      ...pair,
      questionerApiKey: pair.questionerApiKey ? '********' : null,
      testApiKey: pair.testApiKey ? '********' : null,
    };

    res.json({ pair: maskedPair });
  } catch (error) {
    console.error('Failed to update LLM test pair:', error);
    res.status(500).json({ error: 'Failed to update test pair' });
  }
});

/**
 * DELETE /llm-test/pairs/:id
 * 테스트 쌍 삭제
 */
llmTestRoutes.delete('/pairs/:id', requireWriteAccess as RequestHandler, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.lLMTestPair.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Test pair not found' });
    }

    await prisma.lLMTestPair.delete({ where: { id } });

    console.log(`[LLMTest] Deleted test pair: ${id}`);
    res.json({ message: 'Test pair deleted' });
  } catch (error) {
    console.error('Failed to delete LLM test pair:', error);
    res.status(500).json({ error: 'Failed to delete test pair' });
  }
});

/**
 * POST /llm-test/pairs/:id/run
 * 수동으로 테스트 실행
 */
llmTestRoutes.post('/pairs/:id/run', requireWriteAccess as RequestHandler, async (req, res) => {
  try {
    const { id } = req.params;

    const pair = await prisma.lLMTestPair.findUnique({ where: { id } });
    if (!pair) {
      return res.status(404).json({ error: 'Test pair not found' });
    }

    console.log(`[LLMTest] Manual test run for pair: ${id} (${pair.name})`);

    const result = await runTest(pair);

    // 결과 저장
    const savedResult = await prisma.lLMTestResult.create({
      data: {
        pairId: id,
        latencyMs: result.latencyMs,
        score: result.score,
        status: result.status,
        errorMessage: result.errorMessage,
      },
    });

    // lastRunAt 업데이트
    await prisma.lLMTestPair.update({
      where: { id },
      data: { lastRunAt: new Date() },
    });

    res.json({ result: savedResult });
  } catch (error) {
    console.error('Failed to run LLM test:', error);
    res.status(500).json({ error: 'Failed to run test' });
  }
});

/**
 * GET /llm-test/pairs/:id/results
 * 테스트 결과 조회
 */
llmTestRoutes.get('/pairs/:id/results', async (req, res) => {
  try {
    const { id } = req.params;
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const days = parseInt(req.query.days as string) || 7;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const results = await prisma.lLMTestResult.findMany({
      where: {
        pairId: id,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    });

    const total = await prisma.lLMTestResult.count({
      where: {
        pairId: id,
        timestamp: { gte: since },
      },
    });

    res.json({ results, total, limit, offset });
  } catch (error) {
    console.error('Failed to get LLM test results:', error);
    res.status(500).json({ error: 'Failed to get test results' });
  }
});

/**
 * GET /llm-test/results/chart
 * 차트용 데이터 조회 (여러 쌍의 데이터를 시간순으로)
 */
llmTestRoutes.get('/results/chart', async (req, res) => {
  try {
    const pairIds = (req.query.pairIds as string)?.split(',').filter(Boolean) || [];
    const days = parseInt(req.query.days as string) || 7;

    const since = new Date();
    since.setDate(since.getDate() - days);

    const whereClause: { timestamp: { gte: Date }; pairId?: { in: string[] } } = {
      timestamp: { gte: since },
    };
    if (pairIds.length > 0) {
      whereClause.pairId = { in: pairIds };
    }

    const results = await prisma.lLMTestResult.findMany({
      where: whereClause,
      orderBy: { timestamp: 'asc' },
      include: {
        pair: {
          select: { id: true, name: true, testModelName: true },
        },
      },
    });

    // 쌍별로 그룹화된 데이터
    const pairs = await prisma.lLMTestPair.findMany({
      where: pairIds.length > 0 ? { id: { in: pairIds } } : {},
      select: { id: true, name: true, testModelName: true },
    });

    res.json({ results, pairs });
  } catch (error) {
    console.error('Failed to get chart data:', error);
    res.status(500).json({ error: 'Failed to get chart data' });
  }
});

/**
 * GET /llm-test/stats
 * 전체 통계
 */
llmTestRoutes.get('/stats', async (_req, res) => {
  try {
    const totalPairs = await prisma.lLMTestPair.count();
    const enabledPairs = await prisma.lLMTestPair.count({ where: { enabled: true } });

    const since = new Date();
    since.setDate(since.getDate() - 7);

    const recentResults = await prisma.lLMTestResult.findMany({
      where: { timestamp: { gte: since } },
      select: { latencyMs: true, score: true, status: true },
    });

    const successCount = recentResults.filter(r => r.status === 'SUCCESS').length;
    const avgLatency = recentResults.length > 0
      ? Math.round(recentResults.reduce((sum, r) => sum + r.latencyMs, 0) / recentResults.length)
      : 0;
    const scores = recentResults.filter(r => r.score !== null).map(r => r.score!);
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : null;

    res.json({
      totalPairs,
      enabledPairs,
      recentTestCount: recentResults.length,
      successRate: recentResults.length > 0 ? Math.round((successCount / recentResults.length) * 100) : 0,
      avgLatency,
      avgScore,
    });
  } catch (error) {
    console.error('Failed to get LLM test stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});
