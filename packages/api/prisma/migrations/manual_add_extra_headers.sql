-- Add extra headers to models and sub_models
ALTER TABLE "models" ADD COLUMN IF NOT EXISTS "extra_headers" JSONB;
ALTER TABLE "sub_models" ADD COLUMN IF NOT EXISTS "extra_headers" JSONB;

-- Add extra headers to LLM test pairs
ALTER TABLE "llm_test_pairs" ADD COLUMN IF NOT EXISTS "questioner_extra_headers" JSONB;
ALTER TABLE "llm_test_pairs" ADD COLUMN IF NOT EXISTS "test_extra_headers" JSONB;
