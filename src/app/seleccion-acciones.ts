'use server'

import { revalidatePath } from 'next/cache'
import { db, esquema } from '@/lib/db'
import { aplicarSeleccion } from '@/lib/seleccion'

const { seleccion } = esquema

export async function marcarProductos(ids: number[], marcar: boolean) {
  await aplicarSeleccion(Array.isArray(ids) ? ids : [], marcar)
  // La selección se ve en el catálogo (las pantallas de Creación se actualizan solas con lo que devuelven sus acciones)
  revalidatePath('/catalogo')
}

export async function vaciarSeleccion() {
  await db.delete(seleccion)
  revalidatePath('/catalogo')
}
