/**
 * Error Analysis Service
 *
 * 에러 로그를 LLM으로 자동 분석하여 severity + 원인 분석 결과를 저장한다.
 * POST /report 시점에 fire-and-forget으로 호출된다.
 */

import { PrismaClient } from '@prisma/client';

const CONFIG_KEY_MODEL_ID = 'dashboard_llm_model_id';

interface ErrorLogForAnalysis {
  id: string;
  errorName: string;
  errorCode: string;
  errorMessage: string;
  stackTrace: string | null;
  isRecoverable: boolean;
  context: unknown;
  source: string;
  appVersion: string;
  platform: string | null;
  user?: { loginid: string; username: string; deptname: string };
  service?: { name: string; displayName: string } | null;
}

/**
 * 에러 로그를 LLM으로 분석하고 DB에 결과를 저장한다.
 * @returns true면 분석 성공, false면 실패 (LLM 미설정/에러 등)
 */
export async function analyzeAndSaveError(
  prisma: PrismaClient,
  errorLog: ErrorLogForAnalysis,
): Promise<boolean> {
  try {
    const config = await prisma.dashboardConfig.findUnique({
      where: { key: CONFIG_KEY_MODEL_ID },
    });

    if (!config?.value) return false; // LLM 미설정이면 무시

    const model = await prisma.model.findUnique({
      where: { id: config.value },
      include: {
        subModels: {
          where: { enabled: true },
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
      },
    });

    if (!model || !model.enabled) return false;

    // 엔드포인트 결정 (서브모델 우선)
    const subModel = model.subModels?.[0];
    const endpointUrl = subModel?.endpointUrl || model.endpointUrl;
    const apiKey = subModel?.apiKey || model.apiKey;
    const modelName = subModel?.modelName || model.name;
    const extraHeaders = (subModel?.extraHeaders || model.extraHeaders) as Record<string, string> | null;

    const contextStr = errorLog.context ? JSON.stringify(errorLog.context, null, 2) : 'N/A';
    const stackStr = errorLog.stackTrace ? errorLog.stackTrace.slice(0, 3000) : 'N/A';

    const prompt = `You are an expert error analyst for a software platform. Analyze the following error and provide:

1. **Severity**: Classify as exactly one of: CRITICAL, HIGH, MEDIUM, LOW
   - CRITICAL: Service down, data loss, security breach, affects all users
   - HIGH: Major feature broken, affects many users, no workaround
   - MEDIUM: Feature partially broken, workaround exists, limited user impact
   - LOW: Minor issue, cosmetic, rarely occurs, easily recoverable

2. **Root Cause Analysis**: What is the most likely cause of this error?

3. **Expected Impact**: Who and what is affected?

4. **Recommended Action**: What should the team do to fix/prevent this?

Error Details:
- Error Name: ${errorLog.errorName}
- Error Code: ${errorLog.errorCode}
- Message: ${errorLog.errorMessage}
- Source: ${errorLog.source}
- App Version: ${errorLog.appVersion}
- Platform: ${errorLog.platform || 'unknown'}
- Recoverable: ${errorLog.isRecoverable}
- Service: ${errorLog.service?.displayName || 'N/A'}
- User Dept: ${errorLog.user?.deptname || 'N/A'}
- Context: ${contextStr}
- Stack Trace (truncated): ${stackStr}

Respond in Korean. Start your response with the severity on the first line in this exact format:
SEVERITY: <CRITICAL|HIGH|MEDIUM|LOW>

Then provide the analysis.`;

    let chatUrl = endpointUrl.trim();
    if (!chatUrl.endsWith('/chat/completions')) {
      if (chatUrl.endsWith('/')) chatUrl = chatUrl.slice(0, -1);
      chatUrl = `${chatUrl}/chat/completions`;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
    if (extraHeaders) Object.assign(headers, extraHeaders);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(chatUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1024,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      clearTimeout(timeoutId);
      const errorText = await response.text();
      console.error(`[ErrorAnalysis] LLM error ${response.status}: ${errorText.slice(0, 200)}`);
      return false;
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    clearTimeout(timeoutId);

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('[ErrorAnalysis] LLM returned empty response');
      return false;
    }

    const severityMatch = content.match(/SEVERITY:\s*(CRITICAL|HIGH|MEDIUM|LOW)/i);
    const severity = severityMatch ? severityMatch[1].toUpperCase() : 'MEDIUM';
    const analysis = content.replace(/^SEVERITY:\s*(CRITICAL|HIGH|MEDIUM|LOW)\s*/i, '').trim() || content;

    await prisma.errorLog.update({
      where: { id: errorLog.id },
      data: {
        severity,
        aiAnalysis: analysis,
        analyzedAt: new Date(),
      },
    });

    console.log(`[ErrorAnalysis] Analyzed error ${errorLog.id} → ${severity}`);
    return true;
  } catch (error) {
    console.error(`[ErrorAnalysis] Failed to analyze error ${errorLog.id}:`, error);
    return false;
  }
}
