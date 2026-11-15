ALTER TABLE "productos" ADD COLUMN "imagen_propia_archivo" text;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "imagen_propia_cuadrada" text;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "imagen_propia_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "excluir_de_piezas" boolean DEFAULT false NOT NULL;