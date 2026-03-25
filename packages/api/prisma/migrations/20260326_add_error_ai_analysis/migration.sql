-- Add AI analysis columns to error_logs (all nullable — no data loss)
ALTER TABLE "error_logs" ADD COLUMN IF NOT EXISTS "severity" TEXT;
ALTER TABLE "error_logs" ADD COLUMN IF NOT EXISTS "ai_analysis" TEXT;
ALTER TABLE "error_logs" ADD COLUMN IF NOT EXISTS "analyzed_at" TIMESTAMP(3);

-- Index for severity filtering
CREATE INDEX IF NOT EXISTS "error_logs_severity_idx" ON "error_logs"("severity");

-- Dashboard config table (key-value store for internal settings)
CREATE TABLE IF NOT EXISTS "dashboard_config" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "dashboard_config_pkey" PRIMARY KEY ("key")
);
