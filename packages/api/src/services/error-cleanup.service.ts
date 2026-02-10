/**
 * Error Log Cleanup Service
 *
 * 매일 자정(KST) 30일 지난 에러 로그를 자동 삭제
 */

import { PrismaClient } from '@prisma/client';

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24시간
const RETENTION_DAYS = 30;

export function startErrorCleanupScheduler(prisma: PrismaClient): void {
  async function cleanup() {
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

      const result = await prisma.errorLog.deleteMany({
        where: { timestamp: { lt: cutoff } },
      });

      if (result.count > 0) {
        console.log(`[ErrorCleanup] Deleted ${result.count} error logs older than ${RETENTION_DAYS} days`);
      }
    } catch (error) {
      console.error('[ErrorCleanup] Failed to cleanup:', error);
    }
  }

  // 서버 시작 10초 후 첫 실행, 이후 24시간마다
  setTimeout(() => {
    cleanup();
    setInterval(cleanup, CLEANUP_INTERVAL_MS);
  }, 10_000);

  console.log(`[ErrorCleanup] Scheduler started (retention: ${RETENTION_DAYS} days)`);
}
