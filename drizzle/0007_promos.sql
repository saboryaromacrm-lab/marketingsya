CREATE TABLE "promo_filas" (
	"id" serial PRIMARY KEY NOT NULL,
	"promo_id" integer NOT NULL,
	"orden" integer NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text,
	"descuento" numeric(5, 2),
	"cantidad_minima" integer,
	"precio_fijo" numeric(14, 2),
	"origen" text DEFAULT 'manual' NOT NULL,
	"productos" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promos" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" text DEFAULT 'PROMOCIONES' NOT NULL,
	"desde" text NOT NULL,
	"hasta" text NOT NULL,
	"lista_id" integer DEFAULT 3 NOT NULL,
	"diseno" text DEFAULT '1' NOT NULL,
	"formatos" jsonb DEFAULT '{"historia":true,"feed":true,"uno":false}'::jsonb NOT NULL,
	"exportacion_id" integer,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seleccion" (
	"producto_id" integer PRIMARY KEY NOT NULL,
	"agregado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promo_filas" ADD CONSTRAINT "promo_filas_promo_id_promos_id_fk" FOREIGN KEY ("promo_id") REFERENCES "public"."promos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seleccion" ADD CONSTRAINT "seleccion_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "promo_filas_promo" ON "promo_filas" USING btree ("promo_id","orden");