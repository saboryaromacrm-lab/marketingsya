import { pgTable, bigserial, text, timestamp, boolean, index } from 'drizzle-orm/pg-core'

// Cada intento de ingreso queda registrado: sirve para frenar a quien prueba
// contraseñas al azar y para que Lucas vea desde dónde se entró.
export const intentosIngreso = pgTable(
  'intentos_ingreso',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    ip: text('ip').notNull(),
    exitoso: boolean('exitoso').notNull(),
    navegador: text('navegador'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('intentos_ingreso_ip_fecha').on(t.ip, t.creadoEn)],
)
