// Sube una foto con barra de avance (fetch no informa el avance de subida; XMLHttpRequest sí).
export const TAMANO_MAXIMO = 20 * 1024 * 1024

export function subirFoto(productoId: number, archivo: File, alAvanzar?: (porcentaje: number) => void): Promise<{ url: string }> {
  return new Promise((resolver, rechazar) => {
    if (archivo.size > TAMANO_MAXIMO) return rechazar(new Error('La foto pesa más de 20 MB.'))
    const datos = new FormData()
    datos.append('foto', archivo)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/productos/${productoId}/foto`)
    xhr.upload.onprogress = (e) => e.lengthComputable && alAvanzar?.(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      let r: { url?: string; error?: string } = {}
      try {
        r = JSON.parse(xhr.responseText)
      } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && r.url) resolver({ url: r.url })
      else rechazar(new Error(r.error ?? `No se pudo subir (error ${xhr.status}).`))
    }
    xhr.onerror = () => rechazar(new Error('Sin conexión. Probá de nuevo.'))
    xhr.send(datos)
  })
}
