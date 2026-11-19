CREATE TABLE "carruseles" (
	"id" serial PRIMARY KEY NOT NULL,
	"estilo" text NOT NULL,
	"titulo" text NOT NULL,
	"lista_id" integer DEFAULT 3 NOT NULL,
	"datos" jsonb NOT NULL,
	"texto_posteo" text,
	"exportacion_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "frase_piezas" text;