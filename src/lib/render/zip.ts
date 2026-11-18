// Arma un .zip sin comprimir («stored»). Alcanza para juntar JPEG, que ya vienen comprimidos,
// y evita sumar otra dependencia. Formato: PKWARE APPNOTE, sin ZIP64 (hasta 4 GB, de sobra).
import { crc32 } from 'node:zlib'

export type ArchivoZip = { nombre: string; datos: Buffer; fecha?: Date }

function fechaDos(d: Date) {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)
  const dia = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { hora, dia }
}

export function armarZip(archivos: ArchivoZip[]): Buffer {
  const partes: Buffer[] = []
  const central: Buffer[] = []
  let desplazamiento = 0

  for (const a of archivos) {
    const nombre = Buffer.from(a.nombre, 'utf8')
    const crc = crc32(a.datos) >>> 0
    const { hora, dia } = fechaDos(a.fecha ?? new Date())
    const BANDERA_UTF8 = 0x0800

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4) // versión necesaria
    local.writeUInt16LE(BANDERA_UTF8, 6)
    local.writeUInt16LE(0, 8) // sin compresión
    local.writeUInt16LE(hora, 10)
    local.writeUInt16LE(dia, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(a.datos.length, 18)
    local.writeUInt32LE(a.datos.length, 22)
    local.writeUInt16LE(nombre.length, 26)
    local.writeUInt16LE(0, 28)
    partes.push(local, nombre, a.datos)

    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0)
    c.writeUInt16LE(20, 4) // hecho con
    c.writeUInt16LE(20, 6)
    c.writeUInt16LE(BANDERA_UTF8, 8)
    c.writeUInt16LE(0, 10)
    c.writeUInt16LE(hora, 12)
    c.writeUInt16LE(dia, 14)
    c.writeUInt32LE(crc, 16)
    c.writeUInt32LE(a.datos.length, 20)
    c.writeUInt32LE(a.datos.length, 24)
    c.writeUInt16LE(nombre.length, 28)
    c.writeUInt32LE(desplazamiento, 42)
    central.push(c, nombre)

    desplazamiento += local.length + nombre.length + a.datos.length
  }

  const directorio = Buffer.concat(central)
  const fin = Buffer.alloc(22)
  fin.writeUInt32LE(0x06054b50, 0)
  fin.writeUInt16LE(archivos.length, 8)
  fin.writeUInt16LE(archivos.length, 10)
  fin.writeUInt32LE(directorio.length, 12)
  fin.writeUInt32LE(desplazamiento, 16)
  return Buffer.concat([...partes, directorio, fin])
}
