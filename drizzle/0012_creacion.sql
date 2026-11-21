CREATE TABLE "musica" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"archivo" text NOT NULL,
	"duracion" numeric(8, 2) NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "carruseles" ADD COLUMN "formatos" jsonb;--> statement-breakpoint
ALTER TABLE "carruseles" ADD COLUMN "animacion" jsonb;--> statement-breakpoint
ALTER TABLE "exportaciones" ADD COLUMN "formato" text;--> statement-breakpoint
ALTER TABLE "promos" ADD COLUMN "animacion" jsonb;--> statement-breakpoint
ALTER TABLE "publicaciones" ADD COLUMN "formato" text DEFAULT 'imagenes' NOT NULL;--> statement-breakpoint
ALTER TABLE "publicaciones" ADD COLUMN "opciones" jsonb;