-- CreateTable
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "service_id" TEXT,
    "source" TEXT NOT NULL,
    "app_version" TEXT NOT NULL,
    "platform" TEXT,
    "error_name" TEXT NOT NULL,
    "error_code" TEXT NOT NULL,
    "error_message" TEXT NOT NULL,
    "stack_trace" TEXT,
    "is_recoverable" BOOLEAN NOT NULL DEFAULT false,
    "context" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "error_logs_user_id_idx" ON "error_logs"("user_id");
CREATE INDEX "error_logs_service_id_idx" ON "error_logs"("service_id");
CREATE INDEX "error_logs_error_code_idx" ON "error_logs"("error_code");
CREATE INDEX "error_logs_timestamp_idx" ON "error_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "error_logs" ADD CONSTRAINT "error_logs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE SET NULL ON UPDATE CASCADE;
