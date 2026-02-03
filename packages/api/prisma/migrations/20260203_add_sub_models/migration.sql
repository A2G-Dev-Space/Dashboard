-- CreateTable
CREATE TABLE "sub_models" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT NOT NULL,
    "endpoint_url" TEXT NOT NULL,
    "api_key" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sub_models_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sub_models_parent_id_idx" ON "sub_models"("parent_id");

-- AddForeignKey
ALTER TABLE "sub_models" ADD CONSTRAINT "sub_models_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "models"("id") ON DELETE CASCADE ON UPDATE CASCADE;
