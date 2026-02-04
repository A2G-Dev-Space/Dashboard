-- LLM Test Tables Migration
-- Run this manually: psql $DATABASE_URL < manual_add_llm_test_tables.sql

-- Create LLM Test Pairs table
CREATE TABLE IF NOT EXISTS "llm_test_pairs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "interval_minutes" INTEGER NOT NULL DEFAULT 5,
    "questioner_model_name" TEXT NOT NULL,
    "questioner_endpoint" TEXT NOT NULL,
    "questioner_api_key" TEXT,
    "test_model_name" TEXT NOT NULL,
    "test_endpoint" TEXT NOT NULL,
    "test_api_key" TEXT,
    "question_prompt" TEXT NOT NULL DEFAULT 'Generate a short, creative question that tests the AI''s knowledge, reasoning, or problem-solving ability. The question should be clear and answerable.',
    "evaluation_prompt" TEXT NOT NULL DEFAULT 'Evaluate the AI response based on: accuracy (is it correct?), helpfulness (does it answer the question?), and clarity (is it well-explained?). Score from 1-100.',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_run_at" TIMESTAMP(3),

    CONSTRAINT "llm_test_pairs_pkey" PRIMARY KEY ("id")
);

-- Create LLM Test Results table
CREATE TABLE IF NOT EXISTS "llm_test_results" (
    "id" TEXT NOT NULL,
    "pair_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latency_ms" INTEGER NOT NULL,
    "score" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "error_message" TEXT,

    CONSTRAINT "llm_test_results_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "llm_test_pairs_enabled_idx" ON "llm_test_pairs"("enabled");
CREATE INDEX IF NOT EXISTS "llm_test_results_pair_id_idx" ON "llm_test_results"("pair_id");
CREATE INDEX IF NOT EXISTS "llm_test_results_timestamp_idx" ON "llm_test_results"("timestamp");

-- Add foreign key constraint
ALTER TABLE "llm_test_results"
ADD CONSTRAINT "llm_test_results_pair_id_fkey"
FOREIGN KEY ("pair_id") REFERENCES "llm_test_pairs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
