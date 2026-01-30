/**
 * Service Routes
 *
 * 멀티 서비스 관리를 위한 API 엔드포인트
 * - GET /services: 모든 서비스 목록
 * - GET /services/:id: 서비스 상세
 * - POST /services: 서비스 생성 (SUPER_ADMIN)
 * - PUT /services/:id: 서비스 수정 (SUPER_ADMIN)
 * - DELETE /services/:id: 서비스 삭제 (SUPER_ADMIN)
 */

import { Router, Request, RequestHandler } from 'express';
import { prisma, redis } from '../index.js';
import { authenticateToken, requireAdmin, requireSuperAdmin, AuthenticatedRequest } from '../middleware/auth.js';
import { trackActiveUser } from '../services/redis.service.js';
import { getOrCreateUser } from '../utils/user.js';
import { z } from 'zod';

export const serviceRoutes = Router();

// Validation schemas
const createServiceSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Name must be lowercase alphanumeric with hyphens'),
  displayName: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  iconUrl: z.string().url().optional().nullable(),
  enabled: z.boolean().default(true),
  activityEnabled: z.boolean().default(false).optional(),
});

const updateServiceSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  iconUrl: z.string().url().optional().nullable(),
  enabled: z.boolean().optional(),
  activityEnabled: z.boolean().optional(),
});

const activitySchema = z.object({
  action: z.string().min(1).max(100),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * GET /services
 * 모든 서비스 목록 조회 (인증된 사용자)
 */
serviceRoutes.get('/', authenticateToken, async (_req: AuthenticatedRequest, res) => {
  try {
    const services = await prisma.service.findMany({
      where: { enabled: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        displayName: true,
        description: true,
        iconUrl: true,
        enabled: true,
        activityEnabled: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            models: true,
            usageLogs: true,
          },
        },
      },
    });

    res.json({ services });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({ error: 'Failed to get services' });
  }
});

/**
 * GET /services/all
 * 모든 서비스 목록 (비활성 포함, Admin 전용)
 */
serviceRoutes.get(
  '/all',
  authenticateToken,
  requireAdmin as RequestHandler,
  async (_req: AuthenticatedRequest, res) => {
    try {
      const services = await prisma.service.findMany({
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          displayName: true,
          description: true,
          iconUrl: true,
          enabled: true,
          activityEnabled: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              models: true,
              usageLogs: true,
              feedbacks: true,
              adminServices: true,
            },
          },
        },
      });

      res.json({ services });
    } catch (error) {
      console.error('Get all services error:', error);
      res.status(500).json({ error: 'Failed to get services' });
    }
  }
);

/**
 * GET /services/:id
 * 서비스 상세 조회
 */
serviceRoutes.get('/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const id = req.params.id as string;

    const service = await prisma.service.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            models: true,
            usageLogs: true,
            feedbacks: true,
            adminServices: true,
          },
        },
      },
    });

    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }

    res.json({ service });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({ error: 'Failed to get service' });
  }
});

/**
 * POST /services
 * 서비스 생성 (SUPER_ADMIN 전용)
 */
serviceRoutes.post(
  '/',
  authenticateToken,
  requireSuperAdmin as RequestHandler,
  async (req: AuthenticatedRequest, res) => {
    try {
      const validation = createServiceSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Invalid request', details: validation.error.issues });
        return;
      }

      // Check duplicate name
      const existing = await prisma.service.findUnique({
        where: { name: validation.data.name },
      });
      if (existing) {
        res.status(409).json({ error: 'Service with this name already exists' });
        return;
      }

      const service = await prisma.service.create({
        data: validation.data,
      });

      res.status(201).json({ service });
    } catch (error) {
      console.error('Create service error:', error);
      res.status(500).json({ error: 'Failed to create service' });
    }
  }
);

/**
 * PUT /services/:id
 * 서비스 수정 (SUPER_ADMIN 전용)
 */
serviceRoutes.put(
  '/:id',
  authenticateToken,
  requireSuperAdmin as RequestHandler,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id as string;

      const validation = updateServiceSchema.safeParse(req.body);
      if (!validation.success) {
        res.status(400).json({ error: 'Invalid request', details: validation.error.issues });
        return;
      }

      const existing = await prisma.service.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }

      const service = await prisma.service.update({
        where: { id },
        data: validation.data,
      });

      res.json({ service });
    } catch (error) {
      console.error('Update service error:', error);
      res.status(500).json({ error: 'Failed to update service' });
    }
  }
);

/**
 * DELETE /services/:id
 * 서비스 삭제 (SUPER_ADMIN 전용)
 * 주의: 연결된 데이터가 있으면 삭제 불가
 */
serviceRoutes.delete(
  '/:id',
  authenticateToken,
  requireSuperAdmin as RequestHandler,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id as string;

      const existing = await prisma.service.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              models: true,
              usageLogs: true,
              feedbacks: true,
            },
          },
        },
      }) as { _count: { models: number; usageLogs: number; feedbacks: number } } | null;

      if (!existing) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }

      // Check for dependent data
      const hasData =
        existing._count.models > 0 || existing._count.usageLogs > 0 || existing._count.feedbacks > 0;

      if (hasData) {
        res.status(409).json({
          error: 'Cannot delete service with existing data',
          details: {
            models: existing._count.models,
            usageLogs: existing._count.usageLogs,
            feedbacks: existing._count.feedbacks,
          },
        });
        return;
      }

      // Delete AdminService entries first
      await prisma.adminService.deleteMany({ where: { serviceId: id } });

      // Delete service
      await prisma.service.delete({ where: { id } });

      res.json({ message: 'Service deleted successfully' });
    } catch (error) {
      console.error('Delete service error:', error);
      res.status(500).json({ error: 'Failed to delete service' });
    }
  }
);

/**
 * POST /services/:id/reset-data
 * 서비스 데이터 초기화 (SUPER_ADMIN 전용)
 * 모델은 유지하고 사용 기록/통계/피드백/평가 데이터만 삭제
 */
serviceRoutes.post(
  '/:id/reset-data',
  authenticateToken,
  requireSuperAdmin as RequestHandler,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id as string;

      const existing = await prisma.service.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }

      const [usageLogs, dailyStats, ratings, userServices, feedbacks, activityLogs] = await prisma.$transaction([
        prisma.usageLog.deleteMany({ where: { serviceId: id } }),
        prisma.dailyUsageStat.deleteMany({ where: { serviceId: id } }),
        prisma.ratingFeedback.deleteMany({ where: { serviceId: id } }),
        prisma.userService.deleteMany({ where: { serviceId: id } }),
        prisma.feedback.deleteMany({ where: { serviceId: id } }),
        prisma.activityLog.deleteMany({ where: { serviceId: id } }),
      ]);

      res.json({
        message: 'Service data reset successfully',
        deleted: {
          usageLogs: usageLogs.count,
          dailyStats: dailyStats.count,
          ratings: ratings.count,
          userServices: userServices.count,
          feedbacks: feedbacks.count,
          activityLogs: activityLogs.count,
        },
      });
    } catch (error) {
      console.error('Reset service data error:', error);
      res.status(500).json({ error: 'Failed to reset service data' });
    }
  }
);

/**
 * GET /services/:id/stats
 * 서비스별 통계 요약
 */
serviceRoutes.get(
  '/:id/stats',
  authenticateToken,
  requireAdmin as RequestHandler,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id as string;

      // Verify service exists
      const service = await prisma.service.findUnique({ where: { id } });
      if (!service) {
        res.status(404).json({ error: 'Service not found' });
        return;
      }

      const todayStart = new Date(new Date().setHours(0, 0, 0, 0));

      if (service.activityEnabled) {
        // Activity-based service stats
        const [totalUsers, totalActivities, todayActivities] = await Promise.all([
          prisma.activityLog.groupBy({
            by: ['userId'],
            where: { serviceId: id },
          }).then((r) => r.length),
          prisma.activityLog.count({ where: { serviceId: id } }),
          prisma.activityLog.count({
            where: { serviceId: id, timestamp: { gte: todayStart } },
          }),
        ]);

        res.json({
          serviceId: id,
          activityEnabled: true,
          stats: {
            totalUsers,
            totalModels: 0,
            totalRequests: 0,
            todayRequests: 0,
            totalActivities,
            todayActivities,
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalTokens: 0,
          },
        });
      } else {
        // LLM-based service stats
        const [totalUsers, totalModels, totalRequests, todayRequests] = await Promise.all([
          prisma.usageLog.groupBy({
            by: ['userId'],
            where: { serviceId: id },
          }).then((r) => r.length),
          prisma.model.count({ where: { serviceId: id } }),
          prisma.usageLog.count({ where: { serviceId: id } }),
          prisma.usageLog.count({
            where: { serviceId: id, timestamp: { gte: todayStart } },
          }),
        ]);

        const tokenUsage = await prisma.usageLog.aggregate({
          where: { serviceId: id },
          _sum: { inputTokens: true, outputTokens: true, totalTokens: true },
        });

        res.json({
          serviceId: id,
          activityEnabled: false,
          stats: {
            totalUsers,
            totalModels,
            totalRequests,
            todayRequests,
            totalInputTokens: tokenUsage._sum?.inputTokens || 0,
            totalOutputTokens: tokenUsage._sum?.outputTokens || 0,
            totalTokens: tokenUsage._sum?.totalTokens || 0,
          },
        });
      }
    } catch (error) {
      console.error('Get service stats error:', error);
      res.status(500).json({ error: 'Failed to get service stats' });
    }
  }
);

/**
 * POST /services/:id/activity
 * 외부 서비스에서 사용자 활동을 기록 (인증 불필요, 헤더 기반 사용자 식별)
 * activityEnabled가 true인 서비스만 허용
 * :id는 서비스 UUID 또는 name 모두 가능
 */
serviceRoutes.post('/:id/activity', async (req: Request, res) => {
  try {
    const idOrName = req.params.id as string;

    // 서비스 조회 (ID 또는 name)
    // UUID 형식이면 id로, 아니면 name으로 조회
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrName);
    const service = await prisma.service.findFirst({
      where: isUuid ? { id: idOrName } : { name: idOrName },
      select: { id: true, name: true, activityEnabled: true },
    });

    if (!service) {
      res.status(404).json({ error: 'Service not found' });
      return;
    }

    if (!service.activityEnabled) {
      res.status(400).json({ error: 'Activity tracking is not enabled for this service' });
      return;
    }

    // Body 검증
    const validation = activitySchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: 'Invalid request', details: validation.error.issues });
      return;
    }

    // 사용자 조회/생성
    const user = await getOrCreateUser(req);

    // ActivityLog 생성
    const activityLog = await prisma.activityLog.create({
      data: {
        userId: user.id,
        serviceId: service.id,
        action: validation.data.action,
        metadata: validation.data.metadata ? JSON.parse(JSON.stringify(validation.data.metadata)) : undefined,
      },
    });

    // UserService upsert
    await prisma.userService.upsert({
      where: { userId_serviceId: { userId: user.id, serviceId: service.id } },
      update: { lastActive: new Date(), requestCount: { increment: 1 } },
      create: { userId: user.id, serviceId: service.id, firstSeen: new Date(), lastActive: new Date(), requestCount: 1 },
    });

    // Redis 활성 사용자 추적
    await trackActiveUser(redis, user.loginid);

    console.log(`[Activity] ${user.loginid} → ${service.name} (${validation.data.action})`);
    res.status(201).json({ activityLog: { id: activityLog.id, action: activityLog.action, timestamp: activityLog.timestamp } });
  } catch (error) {
    console.error('Record activity error:', error);
    res.status(500).json({ error: 'Failed to record activity' });
  }
});
