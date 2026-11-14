// Arma un nombre prolijo para las piezas a partir del nombre del ERP.
// Es solo una sugerencia: Lucas la puede cambiar y el nombre del ERP no se toca.
//
//   «PASTA FUSILLI CON CHIA WAKAS X300GRS»   → «Pasta Fusilli con Chía Wakas 300 g»
//   «Aceit Oliva E.v Org Oliovita x250cc»    → «Aceite Oliva Extra Virgen Orgánico Oliovita 250 ml»
//
// Los diccionarios están separados para poder ampliarlos sin tocar la lógica.

// Abreviaturas frecuentes en el catálogo (sin distinguir mayúsculas; el punto final es opcional).
export const ABREVIATURAS: Record<string, string> = {
  'aceit': 'Aceite',
  'e.v': 'Extra Virgen',
  'ev': 'Extra Virgen',
  'org': 'Orgánico',
  'alf': 'Alfajor',
  'ddl': 'Dulce de Leche',
  'tint': 'Tintura',
  'tost': 'Tostado',
  'inst': 'Instantáneo',
  'merm': 'Mermelada',
  'gallet': 'Galletitas',
  'edulc': 'Edulcorante',
  'barrit': 'Barrita',
  'barr': 'Barrita',
  'avell': 'Avellana',
  'nat': 'Natural',
  'int': 'Integral',
  'conc': 'Concentrado',
  'vege': 'Vegetal',
  's/a': 'sin Azúcar',
  's/az': 'sin Azúcar',
  's/tacc': 'sin TACC',
  's/sal': 'sin Sal',
  's/lactosa': 'sin Lactosa',
  'c/': 'con',
}

// Palabras que suelen venir sin tilde.
export const TILDES: Record<string, string> = {
  cafe: 'café', mani: 'maní', chia: 'chía', maiz: 'maíz', atun: 'atún', limon: 'limón',
  azucar: 'azúcar', organico: 'orgánico', organica: 'orgánica', anis: 'anís',
  arandanos: 'arándanos', proteina: 'proteína', proteinas: 'proteínas', colageno: 'colágeno',
  sesamo: 'sésamo', clasico: 'clásico', clasica: 'clásica', clasicos: 'clásicos',
  instantaneo: 'instantáneo', jamon: 'jamón', melon: 'melón', platano: 'plátano',
  acido: 'ácido', citrico: 'cítrico', vitaminico: 'vitamínico', jengibre: 'jengibre',
  te: 'té', algodon: 'algodón', limones: 'limones', energia: 'energía', galletas: 'galletas',
}

// Envases y aclaraciones de depósito que no aportan en una pieza.
export const PALABRAS_DE_ENVASE = new Set(['pet', 'doyp', 'doypack', 'lata', 'caja', 'xcaja', 'vidr', 'vidrio', 'bot', 'bolsit', 'balde'])

// Siglas que van siempre en mayúsculas.
export const SIGLAS = new Set(['TACC', 'UHT', 'ADN', 'B12', 'MCT', 'BCAA'])

// Palabras chicas que van en minúscula salvo al principio.
const MINUSCULAS = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'con', 'sin', 'y', 'e', 'en', 'a', 'al', 'para', 'por', 'o', 'u'])

// Unidades: cómo vienen escritas → cómo se muestran.
const UNIDADES: [RegExp, string][] = [
  [/^(g|gr|grs|gs|grg|grms?)$/i, 'g'],
  [/^(kg|kgs|k)$/i, 'kg'],
  [/^(ml|cc|c|cm|cm3)$/i, 'ml'],
  [/^(l|lt|lts|ltr|ltrs|ltrts|ll|litros?)$/i, 'L'],
  [/^(saq|sq|sa|saquitos?)$/i, 'saquitos'],
  [/^(sob|sobres?)$/i, 'sobres'],
  [/^(caps?|capsulas?|cápsulas?)$/i, 'cápsulas'],
  [/^(com|comp|comprimidos?)$/i, 'comprimidos'],
  [/^(u|un|uni|unid|und|unidades?)$/i, 'u.'],
  [/^hojas?$/i, 'hojas'],
]

function unidadCanonica(u: string): string | null {
  for (const [re, canon] of UNIDADES) if (re.test(u)) return canon
  return null
}

function numero(n: string): string {
  return n.replace('.', ',')
}

// «x300GRS» → «300 g». También «x 300 grs», «PETX1L» y «x3 5kg» (3,5 kg).
function normalizarMedidas(texto: string): string {
  let t = texto.replace(/([a-záéíóúñ])x(\d)/gi, '$1 x$2')
  t = t.replace(/(^|\s)x\s?(\d+)\s(\d)(kg|g|l)\b/gi, '$1x$2,$3$4')
  return t.replace(/(^|\s)x\s?(\d+(?:[.,]\d+)?)\s?([a-záéíóú.]*)(?=\s|$)/gi, (todo, antes: string, n: string, u: string) => {
    const unidad = u.replace(/\.$/, '')
    if (!unidad) return todo
    const canon = unidadCanonica(unidad)
    if (!canon) return todo
    if (canon === 'u.' && Number(n.replace(',', '.')) === 1) return antes // «x1un» no aporta
    return `${antes}${numero(n)} ${canon}`
  })
}

function capitalizar(p: string): string {
  return p.charAt(0).toLocaleUpperCase('es') + p.slice(1)
}

function estaEnMayusculas(texto: string): boolean {
  const letras = texto.replace(/[^a-záéíóúñ]/gi, '')
  if (letras.length < 4) return false
  const mayus = letras.replace(/[^A-ZÁÉÍÓÚÑ]/g, '').length
  return mayus / letras.length > 0.8
}

export function nombreSugerido(nombreErp: string): string {
  let texto = nombreErp.trim().replace(/\s+/g, ' ')
  const todoMayus = estaEnMayusculas(texto)

  // «Tint.madre» → «Tint. madre» para poder reconocer la abreviatura
  texto = texto.replace(/([a-z])\.([a-z]{2,})/gi, (m, a: string, b: string) => (`${a}.${b}`.toLowerCase() === 'e.v' ? m : `${a}. ${b}`))
  texto = normalizarMedidas(texto)
  // «a Granel» es una aclaración de depósito
  texto = texto.replace(/\s+a\s+granel\b/gi, '')

  const palabras = texto.split(' ').filter(Boolean)
  const salida: string[] = []
  for (const original of palabras) {
    const clave = original.toLowerCase().replace(/\.$/, '')
    if (PALABRAS_DE_ENVASE.has(clave)) continue

    if (ABREVIATURAS[clave]) {
      salida.push(ABREVIATURAS[clave])
      continue
    }
    if (SIGLAS.has(original.toUpperCase().replace(/\.$/, ''))) {
      salida.push(original.toUpperCase())
      continue
    }
    // Medidas ya normalizadas («300», «g», «saquitos», «3,5»): se dejan como están.
    // Medida sin unidad reconocible («x500»): queda igual, con «x» minúscula.
    if (/^x\d/i.test(original)) {
      salida.push('x' + original.slice(1))
      continue
    }
    if (/^\d/.test(original) || ['g', 'kg', 'ml', 'L', 'u.', 'saquitos', 'sobres', 'cápsulas', 'comprimidos', 'hojas'].includes(original)) {
      salida.push(original)
      continue
    }

    // Todo en minúscula si el nombre entero venía en mayúsculas, o si es una palabra
    // en mayúsculas dentro de un nombre normal (marcas como «CUMANA»).
    const palabraEnMayus = original.length >= 4 && original === original.toLocaleUpperCase('es') && /[A-ZÁÉÍÓÚÑ]/.test(original)
    let palabra = todoMayus || palabraEnMayus ? original.toLocaleLowerCase('es') : original
    const conTilde = TILDES[palabra.toLowerCase()]
    if (conTilde && !(palabra.toLowerCase() === 'te' && salida.length > 0)) {
      palabra = /^[A-ZÁÉÍÓÚÑ]/.test(palabra) || todoMayus ? capitalizar(conTilde) : conTilde
    }

    const primera = salida.length === 0
    if (MINUSCULAS.has(palabra.toLowerCase()) && !primera) palabra = palabra.toLowerCase()
    else palabra = capitalizar(palabra)
    salida.push(palabra)
  }
  return salida.join(' ')
}
