-- Agent Dashboard 정책 적용 시 x-service-id 헤더에 보낼 서비스명
ALTER TABLE "models" ADD COLUMN "agent_dashboard_service_id" TEXT;
