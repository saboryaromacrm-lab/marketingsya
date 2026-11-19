CREATE TABLE "ia_chat" (
	"id" serial PRIMARY KEY NOT NULL,
	"rol" text NOT NULL,
	"texto" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ia_consumos" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"modelo" text NOT NULL,
	"entrada" integer NOT NULL,
	"salida" integer NOT NULL,
	"cache_lectura" integer DEFAULT 0 NOT NULL,
	"cache_escritura" integer DEFAULT 0 NOT NULL,
	"costo" numeric(12, 6) NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ia_ideas" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"clave" text NOT NULL,
	"datos" jsonb NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promos" ADD COLUMN "texto_posteo" text;--> statement-breakpoint
CREATE INDEX "ia_consumos_fecha" ON "ia_consumos" USING btree ("creado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "ia_ideas_tipo_clave" ON "ia_ideas" USING btree ("tipo","clave");