CREATE TABLE "exportaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"referencia_id" integer,
	"placas" jsonb NOT NULL,
	"estado" text NOT NULL,
	"avance" integer DEFAULT 0 NOT NULL,
	"archivos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"zip" text,
	"error" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"terminado_en" timestamp with time zone
);
