CREATE TABLE "piezas_video" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" text NOT NULL,
	"contenido" jsonb NOT NULL,
	"formatos" jsonb NOT NULL,
	"texto_posteo" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"archivo" text,
	"miniatura" text,
	"temporal" text,
	"tamano" bigint DEFAULT 0 NOT NULL,
	"recibido" bigint DEFAULT 0 NOT NULL,
	"duracion" numeric(8, 2),
	"ancho" integer,
	"alto" integer,
	"con_audio" boolean DEFAULT false NOT NULL,
	"estado" text NOT NULL,
	"avance" integer DEFAULT 0 NOT NULL,
	"error" text,
	"productos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conservar" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"usado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "videos_estado" ON "videos" USING btree ("estado");