-- AlterTable
ALTER TABLE "models" ADD COLUMN "allowed_business_units" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Fix businessUnit for users with "팀이름(사업부)" format (e.g. "S/W혁신팀(S.LSI)" → "S.LSI")
-- Previously only "/" split was used, missing the parentheses pattern
UPDATE "users"
SET "business_unit" = substring("deptname" FROM '\(([^)]+)\)')
WHERE "deptname" ~ '\([^)]+\)'
  AND ("business_unit" IS NULL OR "business_unit" != substring("deptname" FROM '\(([^)]+)\)'));
