'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db, esquema } from '@/lib/db'
import { borrarMedia } from '@/lib/media'

export async function borrarMusica(id: number) {
  const [t] = await db.delete(esquema.musica).where(eq(esquema.musica.id, Number(id))).returning()
  if (t) await borrarMedia(t.archivo)
  revalidatePath('/configuracion/creacion')
}
