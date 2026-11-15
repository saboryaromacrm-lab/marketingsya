ALTER TABLE "productos" ADD COLUMN "precios_lista" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "busqueda" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "productos_busqueda" ON "productos" USING gin ("busqueda" gin_trgm_ops);