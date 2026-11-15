CREATE TABLE "listas" (
	"id" integer PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"modalidad" text NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marcas" (
	"id" integer PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"nombre_erp" text NOT NULL,
	"logo_erp_url" text,
	"logo_erp_version" text,
	"logo_archivo" text,
	"cantidad_productos" integer DEFAULT 0 NOT NULL,
	"huella" text NOT NULL,
	"dada_de_baja" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" integer PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"nombre_erp" text NOT NULL,
	"nombre_sugerido" text NOT NULL,
	"nombre_piezas" text,
	"marca_id" integer,
	"categoria" text,
	"subcategoria" text,
	"etiquetas" text[] DEFAULT '{}'::text[] NOT NULL,
	"tipo" text NOT NULL,
	"estado" text NOT NULL,
	"codigo" text DEFAULT '' NOT NULL,
	"codigo_barras" text DEFAULT '' NOT NULL,
	"precio_minorista" numeric(14, 2),
	"erp" jsonb NOT NULL,
	"huella" text NOT NULL,
	"imagen_erp_version" text,
	"imagen_archivo" text,
	"dado_de_baja" boolean DEFAULT false NOT NULL,
	"baja_en" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sincronizacion_cambios" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sincronizacion_id" integer NOT NULL,
	"entidad" text NOT NULL,
	"entidad_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"tipo" text NOT NULL,
	"antes" jsonb,
	"despues" jsonb
);
--> statement-breakpoint
CREATE TABLE "sincronizaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"estado" text NOT NULL,
	"etapa" text,
	"avance" integer DEFAULT 0 NOT NULL,
	"etag" text,
	"generado_erp" timestamp with time zone,
	"resumen" jsonb,
	"error" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"iniciada_en" timestamp with time zone,
	"terminada_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sucursales" (
	"id" integer PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_marca_id_marcas_id_fk" FOREIGN KEY ("marca_id") REFERENCES "public"."marcas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sincronizacion_cambios" ADD CONSTRAINT "sincronizacion_cambios_sincronizacion_id_sincronizaciones_id_fk" FOREIGN KEY ("sincronizacion_id") REFERENCES "public"."sincronizaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "productos_marca" ON "productos" USING btree ("marca_id");--> statement-breakpoint
CREATE INDEX "productos_categoria" ON "productos" USING btree ("categoria","subcategoria");--> statement-breakpoint
CREATE INDEX "cambios_por_sincronizacion" ON "sincronizacion_cambios" USING btree ("sincronizacion_id","tipo");--> statement-breakpoint
CREATE UNIQUE INDEX "una_sincronizacion_activa" ON "sincronizaciones" USING btree ((true)) WHERE "sincronizaciones"."estado" in ('en_cola', 'corriendo');