/**
 * Error Telemetry Routes
 *
 * CLI/Electron에서 발생하는 에러를 수집하고 관리하는 엔드포인트
 *
 * POST /report     — 에러 보고 (X-header 인증, CLI/Electron)
 * GET  /logs       — 에러 로그 목록 (SUPER_ADMIN)
 * GET  /stats      — 에러 통계 (SUPER_ADMIN)
 * DELETE /logs/:id — 개별 삭제 (SUPER_ADMIN)
 * POST /cleanup    — 30일 지난 로그 일괄 삭제 (SUPER_ADMIN)
 */

import { Router, type Request, type Response } from 'express';
import { prisma } from '../index.js';
import {
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  type AuthenticatedRequest,
} from '../middleware/auth.js';

export const errorTelemetryRoutes = Router();

/**
 * URL 인코딩된 텍스트 디코딩 (한글 등)
 */
function safeDecodeURIComponent(text: string): string {
  if (!text) return text;
  try {
    if (!text.includes('%')) return text;
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * deptname에서 businessUnit 추출
 * "S/W혁신팀(S.LSI)" → "S.LSI", "DS/AI팀" → "DS"
 */
function extractBusinessUnit(deptname: string): string {
  if (!deptname) return '';
  const match = deptname.match(/\(([^)]+)\)/);
  if (match) return match[1];
  const parts = deptname.split('/');
  return parts[0]?.trim() || '';
}

// ============================================
// POST /report — 에러 보고 (X-header 인증)
// ============================================
errorTelemetryRoutes.post(
  '/report',
  async (req: Request, res: Response) => {
    try {
      // X-header에서 사용자 정보 추출 (proxy.routes.ts와 동일 패턴)
      const loginid = req.headers['x-user-id'] as string | undefined;
      if (!loginid) {
        res.status(401).json({ error: 'X-User-Id header required' });
        return;
      }

      const username = safeDecodeURIComponent((req.headers['x-user-name'] as string) || '');
      const deptname = safeDecodeURIComponent((req.headers['x-user-dept'] as string) || '');
      const businessUnit = extractBusinessUnit(deptname);

      // 사용자 조회 또는 생성
      const user = await prisma.user.upsert({
        where: { loginid },
        update: {
          lastActive: new Date(),
          deptname: deptname || undefined,
          businessUnit: businessUnit || undefined,
        },
        create: {
          loginid,
          username: username || loginid,
          deptname: deptname || '',
          businessUnit,
        },
      });

      const {
        source,
        appVersion,
        platform,
        errorName,
        errorCode,
        errorMessage,
        stackTrace,
        isRecoverable,
        context,
      } = req.body;

      // 필수 필드 검증
      if (!source || !appVersion || !errorName || !errorCode || !errorMessage) {
        res.status(400).json({
          error: 'Missing required fields: source, appVersion, errorName, errorCode, errorMessage',
        });
        return;
      }

      // source 유효성 검증
      if (!['cli', 'electron'].includes(source)) {
        res.status(400).json({ error: 'source must be "cli" or "electron"' });
        return;
      }

      // X-Service-Id 헤더에서 서비스 조회
      let validServiceId: string | null = null;
      const serviceHeader = req.headers['x-service-id'] as string | undefined;
      if (serviceHeader) {
        const service = await prisma.service.findFirst({
          where: {
            OR: [
              { id: serviceHeader },
              { name: serviceHeader },
            ],
          },
          select: { id: true },
        });
        validServiceId = service?.id || null;
      }

      const errorLog = await prisma.errorLog.create({
        data: {
          userId: user.id,
          serviceId: validServiceId,
          source,
          appVersion,
          platform: platform || null,
          errorName,
          errorCode,
          errorMessage: String(errorMessage).slice(0, 10000),
          stackTrace: stackTrace ? String(stackTrace).slice(0, 50000) : null,
          isRecoverable: isRecoverable ?? false,
          context: context || null,
        },
      });

      res.status(201).json({ id: errorLog.id });
    } catch (error) {
      console.error('Error telemetry report error:', error);
      res.status(500).json({ error: 'Failed to save error report' });
    }
  },
);

// ============================================
// GET /logs — 에러 로그 목록 (SUPER_ADMIN)
// ============================================
errorTelemetryRoutes.get(
  '/logs',
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query['page'] as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string) || 50));
      const skip = (page - 1) * limit;

      // 필터
      const errorCode = req.query['errorCode'] as string | undefined;
      const source = req.query['source'] as string | undefined;
      const userId = req.query['userId'] as string | undefined;
      const serviceId = req.query['serviceId'] as string | undefined;
      const days = parseInt(req.query['days'] as string) || 30;

      const since = new Date();
      since.setDate(since.getDate() - days);

      const where: Record<string, unknown> = {
        timestamp: { gte: since },
      };

      if (errorCode) where['errorCode'] = errorCode;
      if (source) where['source'] = source;
      if (userId) where['userId'] = userId;
      if (serviceId) where['serviceId'] = serviceId;

      const [logs, total] = await Promise.all([
        prisma.errorLog.findMany({
          where,
          include: {
            user: {
              select: { id: true, loginid: true, username: true, deptname: true },
            },
            service: {
              select: { id: true, name: true, displayName: true },
            },
          },
          orderBy: { timestamp: 'desc' },
          skip,
          take: limit,
        }),
        prisma.errorLog.count({ where }),
      ]);

      res.json({
        logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      console.error('Error telemetry list error:', error);
      res.status(500).json({ error: 'Failed to get error logs' });
    }
  },
);

// ============================================
// GET /stats — 에러 통계 (SUPER_ADMIN)
// ============================================
errorTelemetryRoutes.get(
  '/stats',
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const days = parseInt(req.query['days'] as string) || 30;
      const since = new Date();
      since.setDate(since.getDate() - days);

      const where = { timestamp: { gte: since } };

      const [
        totalErrors,
        errorsByCode,
        errorsBySource,
        affectedUsers,
        dailyTrend,
      ] = await Promise.all([
        // 총 에러 수
        prisma.errorLog.count({ where }),

        // 에러 코드별 집계
        prisma.errorLog.groupBy({
          by: ['errorCode'],
          where,
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 20,
        }),

        // 소스별 집계 (CLI vs Electron)
        prisma.errorLog.groupBy({
          by: ['source'],
          where,
          _count: { id: true },
        }),

        // 영향받은 사용자 수
        prisma.errorLog.groupBy({
          by: ['userId'],
          where,
          _count: { id: true },
        }).then(r => r.length),

        // 일별 트렌드 (최근 N일)
        prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
          SELECT DATE(timestamp) as date, COUNT(*) as count
          FROM error_logs
          WHERE timestamp >= ${since}
          GROUP BY DATE(timestamp)
          ORDER BY date DESC
          LIMIT ${days}
        `,
      ]);

      res.json({
        totalErrors,
        affectedUsers,
        errorsByCode: errorsByCode.map(e => ({
          errorCode: e.errorCode,
          count: e._count.id,
        })),
        errorsBySource: errorsBySource.map(e => ({
          source: e.source,
          count: e._count.id,
        })),
        dailyTrend: dailyTrend.map(d => ({
          date: d.date,
          count: Number(d.count),
        })),
      });
    } catch (error) {
      console.error('Error telemetry stats error:', error);
      res.status(500).json({ error: 'Failed to get error stats' });
    }
  },
);

// ============================================
// DELETE /logs/:id — 개별 삭제 (SUPER_ADMIN)
// ============================================
errorTelemetryRoutes.delete(
  '/logs/:id',
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id } = req.params;
      await prisma.errorLog.delete({ where: { id } });
      res.json({ success: true });
    } catch (error) {
      console.error('Error telemetry delete error:', error);
      res.status(500).json({ error: 'Failed to delete error log' });
    }
  },
);

// ============================================
// POST /cleanup — 30일 지난 로그 일괄 삭제 (SUPER_ADMIN)
// ============================================
errorTelemetryRoutes.post(
  '/cleanup',
  authenticateToken,
  requireAdmin,
  requireSuperAdmin,
  async (_req: AuthenticatedRequest, res: Response) => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const result = await prisma.errorLog.deleteMany({
        where: { timestamp: { lt: thirtyDaysAgo } },
      });

      res.json({ deleted: result.count });
    } catch (error) {
      console.error('Error telemetry cleanup error:', error);
      res.status(500).json({ error: 'Failed to cleanup error logs' });
    }
  },
);
