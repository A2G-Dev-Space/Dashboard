-- aipo-web, nexus-coder-for-windows 서비스 데이터 전체 삭제
-- 실행: docker exec -i dashboard-db psql -U nexuscoder -d nexuscoder < packages/api/scripts/cleanup-services.sql

\echo '=== 삭제 대상 서비스 ==='
SELECT id, name, "displayName" FROM services WHERE name IN ('aipo-web', 'nexus-coder-for-windows');

\echo ''
\echo '=== 삭제 전 건수 ==='
SELECT s.name,
  (SELECT COUNT(*) FROM usage_logs WHERE service_id = s.id) AS usage_logs,
  (SELECT COUNT(*) FROM daily_usage_stats WHERE service_id = s.id) AS daily_stats,
  (SELECT COUNT(*) FROM rating_feedbacks WHERE service_id = s.id) AS ratings,
  (SELECT COUNT(*) FROM user_services WHERE service_id = s.id) AS user_services
FROM services s
WHERE s.name IN ('aipo-web', 'nexus-coder-for-windows');

\echo ''
\echo '=== 삭제 실행 ==='
BEGIN;
DELETE FROM usage_logs WHERE service_id IN (SELECT id FROM services WHERE name IN ('aipo-web', 'nexus-coder-for-windows'));
DELETE FROM daily_usage_stats WHERE service_id IN (SELECT id FROM services WHERE name IN ('aipo-web', 'nexus-coder-for-windows'));
DELETE FROM rating_feedbacks WHERE service_id IN (SELECT id FROM services WHERE name IN ('aipo-web', 'nexus-coder-for-windows'));
DELETE FROM user_services WHERE service_id IN (SELECT id FROM services WHERE name IN ('aipo-web', 'nexus-coder-for-windows'));
COMMIT;

\echo ''
\echo '=== 완료 ==='
