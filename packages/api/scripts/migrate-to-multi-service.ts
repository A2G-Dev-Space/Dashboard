/**
 * Multi-Service Migration Script
 *
 * 이 스크립트는 기존 단일 서비스 구조를 멀티 서비스 구조로 마이그레이션합니다.
 *
 * 실행 방법:
 *   cd packages/api
 *   npx ts-node scripts/migrate-to-multi-service.ts
 *
 * 또는 prisma migrate 후:
 *   npx prisma migrate deploy
 *   npx ts-node scripts/migrate-to-multi-service.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 고정 UUID (일관성 유지)
const NEXUS_CODER_SERVICE_ID = 'nexus-coder-00000000-0000-0000-0000-000000000001';

async function main() {
  console.log('🚀 Multi-Service Migration Starting...\n');

  // Step 1: nexus-coder 서비스 생성 (이미 있으면 스킵)
  console.log('Step 1: Creating nexus-coder service...');
  const existingService = await prisma.service.findUnique({
    where: { name: 'nexus-coder' },
  });

  let serviceId: string;
  if (existingService) {
    console.log('  ✓ nexus-coder service already exists');
    serviceId = existingService.id;
  } else {
    const service = await prisma.service.create({
      data: {
        id: NEXUS_CODER_SERVICE_ID,
        name: 'nexus-coder',
        displayName: 'Nexus Coder',
        description: 'CLI 기반 AI Coding Assistant',
        enabled: true,
      },
    });
    serviceId = service.id;
    console.log(`  ✓ Created nexus-coder service (id: ${serviceId})`);
  }

  // Step 2: Model 테이블 업데이트
  console.log('\nStep 2: Updating models with serviceId...');
  const modelsWithoutService = await prisma.model.count({
    where: { serviceId: null },
  });
  if (modelsWithoutService > 0) {
    await prisma.model.updateMany({
      where: { serviceId: null },
      data: { serviceId },
    });
    console.log(`  ✓ Updated ${modelsWithoutService} models`);
  } else {
    console.log('  ✓ All models already have serviceId');
  }

  // Step 3: UsageLog 테이블 업데이트
  console.log('\nStep 3: Updating usage_logs with serviceId...');
  const logsWithoutService = await prisma.usageLog.count({
    where: { serviceId: null },
  });
  if (logsWithoutService > 0) {
    // 대량 업데이트를 위해 배치 처리
    const batchSize = 10000;
    let updated = 0;
    while (updated < logsWithoutService) {
      await prisma.$executeRaw`
        UPDATE usage_logs
        SET service_id = ${serviceId}::uuid
        WHERE service_id IS NULL
        LIMIT ${batchSize}
      `;
      updated += batchSize;
      console.log(`  ... updated ${Math.min(updated, logsWithoutService)}/${logsWithoutService}`);
    }
    console.log(`  ✓ Updated ${logsWithoutService} usage logs`);
  } else {
    console.log('  ✓ All usage logs already have serviceId');
  }

  // Step 4: DailyUsageStat 테이블 업데이트
  console.log('\nStep 4: Updating daily_usage_stats with serviceId...');
  const statsWithoutService = await prisma.dailyUsageStat.count({
    where: { serviceId: null },
  });
  if (statsWithoutService > 0) {
    await prisma.dailyUsageStat.updateMany({
      where: { serviceId: null },
      data: { serviceId },
    });
    console.log(`  ✓ Updated ${statsWithoutService} daily usage stats`);
  } else {
    console.log('  ✓ All daily usage stats already have serviceId');
  }

  // Step 5: Feedback 테이블 업데이트
  console.log('\nStep 5: Updating feedbacks with serviceId...');
  const feedbacksWithoutService = await prisma.feedback.count({
    where: { serviceId: null },
  });
  if (feedbacksWithoutService > 0) {
    await prisma.feedback.updateMany({
      where: { serviceId: null },
      data: { serviceId },
    });
    console.log(`  ✓ Updated ${feedbacksWithoutService} feedbacks`);
  } else {
    console.log('  ✓ All feedbacks already have serviceId');
  }

  // Step 6: RatingFeedback 테이블 업데이트
  console.log('\nStep 6: Updating rating_feedbacks with serviceId...');
  const ratingsWithoutService = await prisma.ratingFeedback.count({
    where: { serviceId: null },
  });
  if (ratingsWithoutService > 0) {
    await prisma.ratingFeedback.updateMany({
      where: { serviceId: null },
      data: { serviceId },
    });
    console.log(`  ✓ Updated ${ratingsWithoutService} rating feedbacks`);
  } else {
    console.log('  ✓ All rating feedbacks already have serviceId');
  }

  // Step 7: Admin -> AdminService 마이그레이션
  console.log('\nStep 7: Creating AdminService entries for existing admins...');
  const admins = await prisma.admin.findMany();
  let createdAdminServices = 0;

  for (const admin of admins) {
    const existingAdminService = await prisma.adminService.findUnique({
      where: {
        adminId_serviceId: {
          adminId: admin.id,
          serviceId,
        },
      },
    });

    if (!existingAdminService) {
      await prisma.adminService.create({
        data: {
          adminId: admin.id,
          serviceId,
          role: admin.role,
        },
      });
      createdAdminServices++;
    }
  }

  if (createdAdminServices > 0) {
    console.log(`  ✓ Created ${createdAdminServices} admin-service entries`);
  } else {
    console.log('  ✓ All admin-service entries already exist');
  }

  // Step 8: 통계 출력
  console.log('\n📊 Migration Summary:');
  const totalServices = await prisma.service.count();
  const totalModels = await prisma.model.count();
  const totalUsers = await prisma.user.count();
  const totalLogs = await prisma.usageLog.count();
  const totalStats = await prisma.dailyUsageStat.count();
  const totalFeedbacks = await prisma.feedback.count();
  const totalAdminServices = await prisma.adminService.count();

  console.log(`  - Services: ${totalServices}`);
  console.log(`  - Models: ${totalModels}`);
  console.log(`  - Users: ${totalUsers}`);
  console.log(`  - Usage Logs: ${totalLogs}`);
  console.log(`  - Daily Stats: ${totalStats}`);
  console.log(`  - Feedbacks: ${totalFeedbacks}`);
  console.log(`  - Admin-Service entries: ${totalAdminServices}`);

  console.log('\n✅ Migration completed successfully!');
  console.log('\n⚠️  Next steps:');
  console.log('  1. Verify data integrity in the database');
  console.log('  2. Update schema to make serviceId NOT NULL (optional, for stricter enforcement)');
  console.log('  3. Deploy updated API and Dashboard');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
