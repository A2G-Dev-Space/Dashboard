/**
 * Dashboard LLM Routes
 *
 * Dashboard 내부 LLM 설정 및 수동 에러 분석 엔드포인트
 * (자동 분석은 POST /error-telemetry/report 에서 fire-and-forget으로 실행됨)
 *
 * GET  /config           — 현재 LLM 설정 조회
 * PUT  /config           — LLM 모델 선택 (기존 서비스 모델 중)
 * GET  /available-models — 선택 가능한 모델 목록
 * POST /analyze          — 단건 에러 수동 재분석
 * POST /analyze-batch    — 미분석 에러 일괄 분석
 */

import { Router, type Response } from 'express';
import { prisma } from '../index.js';
import {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import { analyzeAndSaveError } from '../services/error-analysis.service.js';

export const dashboardLlmRoutes = Router();

const CONFIG_KEY_MODEL_ID = 'dashboard_llm_model_id';

// ============================================
// GET /config — 현재 Dashboard LLM 설정 조회
// ============================================
dashboardLlmRoutes.get(
  '/config',
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const config = await prisma.dashboardConfig.findUnique({
        where: { key: CONFIG_KEY_MODEL_ID },
      });

      let model = null;
      if (config?.value) {
        model = await prisma.model.findUnique({
          where: { id: config.value },
          select: {
            id: true,
            name: true,
            displayName: true,
            endpointUrl: true,
            enabled: true,
            service: { select: { id: true, name: true, displayName: true } },
          },
        });
      }

      res.json({ modelId: config?.value || null, model });
    } catch (error) {
      console.error('Dashboard LLM config get error:', error);
      res.status(500).json({ error: 'Failed to get config' });
    }
  },
);

// ============================================
// PUT /config — Dashboard LLM 모델 설정
// ============================================
dashboardLlmRoutes.put(
  '/config',
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { modelId } = req.body;

      if (!modelId) {
        await prisma.dashboardConfig.deleteMany({
          where: { key: CONFIG_KEY_MODEL_ID },
        });
        res.json({ modelId: null, model: null });
        return;
      }

      const model = await prisma.model.findUnique({
        where: { id: modelId },
        select: {
          id: true,
          name: true,
          displayName: true,
          endpointUrl: true,
          enabled: true,
          service: { select: { id: true, name: true, displayName: true } },
        },
      });

      if (!model) {
        res.status(404).json({ error: 'Model not found' });
        return;
      }

      await prisma.dashboardConfig.upsert({
        where: { key: CONFIG_KEY_MODEL_ID },
        update: { value: modelId },
        create: { key: CONFIG_KEY_MODEL_ID, value: modelId },
      });

      res.json({ modelId, model });
    } catch (error) {
      console.error('Dashboard LLM config update error:', error);
      res.status(500).json({ error: 'Failed to update config' });
    }
  },
);

// ============================================
// GET /available-models — 선택 가능한 모델 목록
// ============================================
dashboardLlmRoutes.get(
  '/available-models',
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const models = await prisma.model.findMany({
        where: { enabled: true },
        select: {
          id: true,
          name: true,
          displayName: true,
          endpointUrl: true,
          service: { select: { id: true, name: true, displayName: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { displayName: 'asc' }],
      });

      res.json({ models });
    } catch (error) {
      console.error('Dashboard LLM available models error:', error);
      res.status(500).json({ error: 'Failed to get available models' });
    }
  },
);

// ============================================
// POST /analyze — 단건 에러 수동 (재)분석
// ============================================
dashboardLlmRoutes.post(
  '/analyze',
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { errorLogId } = req.body;
      if (!errorLogId) {
        res.status(400).json({ error: 'errorLogId is required' });
        return;
      }

      const errorLog = await prisma.errorLog.findUnique({
        where: { id: errorLogId },
        include: {
          user: { select: { loginid: true, username: true, deptname: true } },
          service: { select: { name: true, displayName: true } },
        },
      });

      if (!errorLog) {
        res.status(404).json({ error: 'Error log not found' });
        return;
      }

      const success = await analyzeAndSaveError(prisma, errorLog);
      if (!success) {
        res.status(500).json({ error: 'LLM analysis failed. Check LLM config and model availability.' });
        return;
      }

      const updated = await prisma.errorLog.findUnique({
        where: { id: errorLogId },
        select: { severity: true, aiAnalysis: true, analyzedAt: true },
      });

      res.json({
        severity: updated?.severity,
        aiAnalysis: updated?.aiAnalysis,
        analyzedAt: updated?.analyzedAt,
      });
    } catch (error) {
      console.error('Dashboard LLM analyze error:', error);
      res.status(500).json({ error: 'Failed to analyze error' });
    }
  },
);

// ============================================
// POST /analyze-batch — 미분석 에러 일괄 분석
// ============================================
dashboardLlmRoutes.post(
  '/analyze-batch',
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = Math.min(req.body.limit || 10, 10); // nginx proxy_read_timeout(600s) 내에 완료되도록 상한 10

      const unanalyzed = await prisma.errorLog.findMany({
        where: { severity: null },
        include: {
          user: { select: { loginid: true, username: true, deptname: true } },
          service: { select: { name: true, displayName: true } },
        },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      if (unanalyzed.length === 0) {
        res.json({ analyzed: 0, total: 0, message: 'No unanalyzed errors' });
        return;
      }

      let analyzed = 0;
      let failed = 0;

      for (const errorLog of unanalyzed) {
        const success = await analyzeAndSaveError(prisma, errorLog);
        if (success) {
          analyzed++;
        } else {
          failed++;
        }
      }

      res.json({ analyzed, failed, total: unanalyzed.length });
    } catch (error) {
      console.error('Dashboard LLM batch analyze error:', error);
      res.status(500).json({ error: 'Failed to batch analyze errors' });
    }
  },
);
