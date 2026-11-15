CREATE TABLE "intentos_ingreso" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"ip" text NOT NULL,
	"exitoso" boolean NOT NULL,
	"navegador" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "intentos_ingreso_ip_fecha" ON "intentos_ingreso" USING btree ("ip","creado_en");