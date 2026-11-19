CREATE TABLE "publicacion_destinos" (
	"id" serial PRIMARY KEY NOT NULL,
	"publicacion_id" integer NOT NULL,
	"red" text NOT NULL,
	"ubicacion" text NOT NULL,
	"placas" jsonb NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"error" text,
	"meta_id" text,
	"enlace" text,
	"publicado_en" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "publicaciones" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" text NOT NULL,
	"referencia_id" integer NOT NULL,
	"titulo" text NOT NULL,
	"texto" text DEFAULT '' NOT NULL,
	"texto_alt" text,
	"exportacion_id" integer,
	"programada_para" timestamp with time zone NOT NULL,
	"proximo_intento" timestamp with time zone,
	"intentos" integer DEFAULT 0 NOT NULL,
	"estado" text NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"terminado_en" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "exportaciones" ADD COLUMN "huella" text;--> statement-breakpoint
ALTER TABLE "publicacion_destinos" ADD CONSTRAINT "publicacion_destinos_publicacion_id_publicaciones_id_fk" FOREIGN KEY ("publicacion_id") REFERENCES "public"."publicaciones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "publicaciones" ADD CONSTRAINT "publicaciones_exportacion_id_exportaciones_id_fk" FOREIGN KEY ("exportacion_id") REFERENCES "public"."exportaciones"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "publicacion_destinos_pub" ON "publicacion_destinos" USING btree ("publicacion_id");--> statement-breakpoint
CREATE INDEX "publicaciones_estado" ON "publicaciones" USING btree ("estado","programada_para");--> statement-breakpoint
CREATE INDEX "publicaciones_pieza" ON "publicaciones" USING btree ("tipo","referencia_id");