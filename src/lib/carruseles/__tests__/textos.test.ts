import { describe, expect, it } from 'vitest'
import { comoOracion, enUnaLinea, etiquetaDeCategoria, fraseSugerida, lineaChica, nombreCorto, nombreEnPlaca, partirEnDos, renglones, sinMarca, textoIngrediente, textoPosteo } from '../textos'
import { datosIniciales, idsDe, limpiarDatos, placasDe, type DatosLanzamiento, type DatosNutriofertas, type DatosRecetas } from '../tipos'

describe('textos de las placas', () => {
  const mani = { nombre: 'Pasta de Maní Natural Entrenuts 370 g', marca: 'ENTRENUTS', categoria: 'Untables y Dulces' }
  const almendras = { nombre: 'Almendra Nompareil', marca: null, granel: true, categoria: 'Frutos Secos y Semillas', presentaciones: [{ tamano: '1 kg', kg: 1 }, { tamano: '250 g', kg: 0.25 }, { tamano: '90 g', kg: 0.09 }] }
  it('renglones con «/»', () => {
    expect(renglones('Pasta de / maní natural')).toEqual(['Pasta de', 'maní natural'])
    expect(enUnaLinea('¡Lanzamos / nuestra / tienda online!')).toBe('¡Lanzamos nuestra tienda online!')
  })
  it('nombre en la placa: sin marca ni medida, en minúscula de oración y en 2 renglones', () => {
    expect(sinMarca('Pasta de Maní Natural Entrenuts', 'ENTRENUTS')).toBe('Pasta de Maní Natural')
    expect(comoOracion('Pasta de Maní Natural MCT')).toBe('Pasta de maní natural MCT')
    expect(nombreEnPlaca(mani)).toBe('Pasta de / maní natural')
    expect(partirEnDos('Almendras')).toBe('Almendras')
    expect(nombreCorto(mani)).toBe('Pasta de maní natural')
  })
  it('línea chica: marca y medida; granel con sus fraccionados de menor a mayor', () => {
    expect(lineaChica(mani)).toBe('Entrenuts · 370 g')
    expect(lineaChica(almendras)).toBe('A granel · 90 g, 250 g y 1 kg')
  })
  it('etiqueta de categoría, frase sugerida e ingrediente', () => {
    expect(etiquetaDeCategoria('Frutos Secos y Semillas')).toBe('frutos secos')
    expect(etiquetaDeCategoria('Cereales, Granos y Legumbres')).toBe('cereales')
    expect(fraseSugerida('Untables y Dulces')).toBe('Ideal para tus desayunos y meriendas.')
    expect(fraseSugerida(null)).toBe('Lo que hace bien, conviene.')
    expect(textoIngrediente(almendras)).toBe('de almendra nompareil')
  })
  it('texto del posteo con la tienda, el WhatsApp y los hashtags', () => {
    const t = textoPosteo('nutriofertas', { titulo: 'NutriOfertas', productos: ['Pasta de maní natural', 'Almendras', 'Miel'] })
    expect(t).toContain('pasta de maní natural, almendras y miel')
    expect(t).toContain('tiendaonline.saboryaroma.com')
    expect(t).toContain('370 462-1563')
  })
})

describe('contenido de los carruseles', () => {
  it('cada estilo arranca con los productos elegidos y sus placas', () => {
    const n = datosIniciales('nutriofertas', [10, 20, 30]) as DatosNutriofertas
    expect(n.productos.map((p) => p.id)).toEqual([10, 20, 30])
    expect(placasDe('nutriofertas', n).map((p) => p.clave)).toEqual(['portada', 'producto-0', 'producto-1', 'producto-2', 'cierre'])
    const l = datosIniciales('lanzamiento', [1, 2, 3, 4, 5, 6, 7]) as DatosLanzamiento
    expect(l.productos.items).toHaveLength(6)
    expect(placasDe('lanzamiento', l)).toHaveLength(5)
    const r = datosIniciales('recetas', [1, 2]) as DatosRecetas
    expect(idsDe('recetas', r).sort()).toEqual([1, 2])
    expect(r.preparacion.pasos).toHaveLength(3)
  })
  it('sacar placas: lanzamiento sin «cómo comprar» queda en 4', () => {
    const l = datosIniciales('lanzamiento', [1, 2]) as DatosLanzamiento
    l.placas.comoComprar = false
    expect(placasDe('lanzamiento', l).map((p) => p.clave)).toEqual(['portada', 'productos', 'porQue', 'cierre'])
  })
  it('limpieza: campos desconocidos fuera, tipos y topes corregidos', () => {
    const sucio = { ...datosIniciales('nutriofertas', [1]), hackeo: 'x', productos: Array.from({ length: 9 }, (_, i) => ({ id: i + 1, descuento: 500, nombre: 3, frase: '  Hola   mundo ' })) }
    const d = limpiarDatos('nutriofertas', sucio) as DatosNutriofertas
    expect('hackeo' in d).toBe(false)
    expect(d.productos).toHaveLength(6)
    expect(d.productos[0].descuento).toBe(0)
    expect(d.productos[0].frase).toBe('Hola mundo')
    expect(d.productos[0].nombre).toBeNull()
    const r = limpiarDatos('recetas', { preparacion: { pasos: [] }, ingredientes: { items: [] } }) as DatosRecetas
    expect(r.preparacion.pasos.length).toBeGreaterThanOrEqual(2)
    expect(r.ingredientes.items).toHaveLength(1)
    const l = limpiarDatos('lanzamiento', { portada: { productos: [5, 'x', 7] } }) as DatosLanzamiento
    expect(l.portada.productos).toEqual([5, null])
  })
})
