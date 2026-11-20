CREATE TABLE "pautas" (
	"id" serial PRIMARY KEY NOT NULL,
	"publicacion_id" integer,
	"titulo" text NOT NULL,
	"objetivo" text NOT NULL,
	"publico_nombre" text NOT NULL,
	"publico" jsonb NOT NULL,
	"ubicaciones" text NOT NULL,
	"origen" text NOT NULL,
	"por_dia" numeric(14, 2) NOT NULL,
	"desde" text NOT NULL,
	"hasta" text NOT NULL,
	"total" numeric(14, 2) NOT NULL,
	"mes" text NOT NULL,
	"estado" text NOT NULL,
	"motivo" text,
	"meta_campana" text,
	"meta_conjunto" text,
	"meta_creativo" text,
	"meta_anuncio" text,
	"gastado" numeric(14, 2) DEFAULT 0 NOT NULL,
	"resultados" jsonb,
	"sincronizado_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"terminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "pautas" ADD CONSTRAINT "pautas_publicacion_id_publicaciones_id_fk" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicaciones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pautas_estado" ON "pautas" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "pautas_mes" ON "pautas" USING btree ("mes");