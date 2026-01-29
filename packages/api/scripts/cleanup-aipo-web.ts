/**
 * aipo-web 서비스 데이터 정리 스크립트
 *
 * aipo-web 서비스에 연결된 모든 usage 데이터를 삭제합니다:
 * - usage_logs
 * - daily_usage_stats
 * - rating_feedbacks
 * - user_services
 *
 * 실행 방법:
 *   cd packages/api
 *   npx ts-node scripts/cleanup-aipo-web.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SERVICE_NAME = 'aipo-web';

async function main() {
  console.log(`🧹 Cleaning up data for service: ${SERVICE_NAME}\n`);

  // Step 1: 서비스 조회
  const service = await prisma.service.findFirst({
    where: { name: SERVICE_NAME },
  });

  if (!service) {
    console.log(`❌ Service '${SERVICE_NAME}' not found. Exiting.`);
    return;
  }

  const serviceId = service.id;
  console.log(`Found service: ${service.displayName} (${serviceId})\n`);

  // Step 2: 삭제 대상 카운트
  const [usageLogs, dailyStats, ratings, userServices] = await Promise.all([
    prisma.usageLog.count({ where: { serviceId } }),
    prisma.dailyUsageStat.count({ where: { serviceId } }),
    prisma.ratingFeedback.count({ where: { serviceId } }),
    prisma.userService.count({ where: { serviceId } }),
  ]);

  console.log('Records to delete:');
  console.log(`  usage_logs:        ${usageLogs}`);
  console.log(`  daily_usage_stats: ${dailyStats}`);
  console.log(`  rating_feedbacks:  ${ratings}`);
  console.log(`  user_services:     ${userServices}`);
  console.log(`  Total:             ${usageLogs + dailyStats + ratings + userServices}\n`);

  if (usageLogs + dailyStats + ratings + userServices === 0) {
    console.log('Nothing to delete. Exiting.');
    return;
  }

  // Step 3: 삭제 실행
  console.log('Deleting...');

  const result = await prisma.$transaction([
    prisma.usageLog.deleteMany({ where: { serviceId } }),
    prisma.dailyUsageStat.deleteMany({ where: { serviceId } }),
    prisma.ratingFeedback.deleteMany({ where: { serviceId } }),
    prisma.userService.deleteMany({ where: { serviceId } }),
  ]);

  console.log(`\n✅ Deleted:`);
  console.log(`  usage_logs:        ${result[0].count}`);
  console.log(`  daily_usage_stats: ${result[1].count}`);
  console.log(`  rating_feedbacks:  ${result[2].count}`);
  console.log(`  user_services:     ${result[3].count}`);
  console.log(`\nDone!`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
