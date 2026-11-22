ALTER TABLE "productos" ADD COLUMN "stock" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "stock_total" numeric(14, 2) DEFAULT 0 NOT NULL;