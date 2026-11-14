# Plataforma de marketing · Sabor y Aroma

Plataforma propia para generar carruseles y promos desde el catálogo del ERP, publicarlos
en Instagram y Facebook, y lanzar campañas pagas. Un solo usuario: Lucas Lorenzo, el dueño.

## Forma de trabajo (importante, respetar siempre)

- **Antes de desarrollar, hacer todas las preguntas necesarias** (grandes y chicas) y **esperar el ok**.
- **Preguntar antes de instalar** cualquier programa, paquete o herramienta.
- **Primero borrador barato** (captura o PNG), después la versión final.
- Priorizar lo **dinámico**: todo se carga solo desde la API, nada hardcodeado.
- Hablar en **español rioplatense, con voseo** («elegí», «pedí», «aprobás»).

## Negocio

- Sabor y Aroma: distribuidora y dietética de productos saludables en **Formosa Capital**.
- 4 sucursales: Distribuidora (id 1), Express 1 (id 2), Express 3 (id 4), Fontana (id 5).
- Tienda online minorista: `tiendaonline.saboryaroma.com`. Sin mínimo de compra, se entra con WhatsApp.
- Vende a minorista y a mayorista.
- Instagram: `@saboryaroma__`. Una sola cuenta para todo.

## API del catálogo

`GET https://api.saboryaroma.com/api/catalogo-externo` — JSON público, sin autenticación.

Devuelve todo en una sola respuesta, sin paginación:

- `cantidad`: ~2150 productos
- `sucursales[]`: `id`, `nombre`
- `listas[]`: Minorista (id 3), Lista 1 / Mayorista (id 1), Promo (id 23)
- `marcas[]`: `id`, `nombre`, `logo` (URL o vacío), `productos` (cantidad)
- `productos[]`: `id`, `nombre`, `descripcion`, `codigo`, `codigoBarras`, `dun`, `marcaId`,
  `marca`, `categoria`, `subcategoria`, `etiquetas[]`, `tipo`, `unidad`, `estado`, `iva`,
  `imagen`, `precios[]`, `stock` (objeto indexado por id de sucursal), `presentaciones[]`
- `precios[]`: `listaId`, `lista`, `modalidad`, `precio`, `unidades`, `precioFormato`,
  `unidadesMinimas`, `codigoBarras`

Imágenes bajo `api.saboryaroma.com/api/tienda/imagenes/` con parámetro `?v=`. WebP 800×800, fondo blanco.

**Cosas a tener en cuenta:**

- La sincronización es **manual**: un botón, no un cron. Así lo pidió el cliente.
- Hay **errores de codificación** en varios nombres («MAÃ‘ANITA» por «MAÑANITA»). Corregir al importar.
- Muchos productos **no tienen imagen** y varias marcas no tienen logo. Las fotos las sube el cliente.
- Los stocks son **unidades reales**.
- Los productos a granel **no tienen marca**: se usan igual.
- No filtrar por stock, el cliente pidió ignorarlo.
- Solo productos **saludables** en las piezas: excluir gaseosas y golosinas comunes.
- Marcas sin logo en el catálogo: La Serenísima, Arcor, Saint Gottard.

## Diseño de la interfaz

La plataforma tiene que verse como el ERP Sabor y Aroma. **Los tokens, componentes y medidas
están en `DISENO.md`: leerlo antes de tocar cualquier pantalla.**

Van dos paletas separadas: la **interfaz** usa los colores del ERP (`DISENO.md`) y las **piezas
generadas** (carruseles, promos, placas) usan la paleta de marca del manual. No mezclarlas.

## Marca (solo para las piezas generadas)

**Hay un conflicto sin resolver entre el manual de identidad y los carruseles aprobados.**
No escribir el sistema de diseño de las piezas hasta que el cliente elija.

| | Manual de identidad | Carruseles aprobados |
| --- | --- | --- |
| Títulos | Utendo | Fraunces (cursiva 800) |
| Textos | Utendo | Nunito |
| Cursiva | Bluestars | Fraunces itálica |
| Verde principal | `#086633` | `#0b3b2e` |
| Verde secundario | `#3ed1a1` | `#137a52` |
| Verde claro | `#c0e67d` | `#6E9A35` |
| Naranja | `#ff8f00` | `#ff8f00` (coincide) |

Utendo y Bluestars son tipografías comerciales, no de Google Fonts: hacen falta los archivos
y una licencia que permita render en servidor.

**Reglas del manual:** se escribe «Sabor y Aroma», nunca «Sabor Y Aroma», «Sabor & Aroma» ni
«Aroma y Sabor». No modificar, rotar, distorsionar ni recolorear el logo, ni usarlo como máscara
de imágenes, ni aplicarle sombras o degradados.

**Slogans aprobados:** «Distribuimos bienestar.» · «Lo que hace bien, conviene.» ·
«Donde lo saludable conviene.» · «Más natural. Más ahorro.» · «Precios sanos. Productos reales.» ·
«Natural que rinde.» · «Calidad consciente.» · «Tu proveedor natural.» · «Natural + Ahorro.» ·
«Natural siempre.» · «Elegí sano.»

**Reglas de diseño que pidió el cliente:** que predomine el producto con fotos grandes, texto
grande y legible en el celular, nada recargado, los carruseles parecidos pero no iguales,
y la URL siempre bien visible.

## Los 3 estilos de carrusel (Instagram, 1080×1350, 5 placas)

Son HTML, hechos antes en claude.ai. El cliente los tiene que pasar al repo.

1. **Lanzamiento, orgánico:** papel crema con textura, manchas de acuarela, ramita de olivo
   panorámica que continúa de una placa a la otra, fotos en formas orgánicas, etiquetas tipo washi.
2. **NutriOfertas, ondas:** fondo blanco cálido, onda durazno, trazo de pincel texturado que abraza
   un plato redondo con la foto, sello circular con hojitas. Naranja de acento. Lleva lugar para el precio.
3. **Recetas, ondas en verde lima:** mismo sistema que el 2 pero en lima/salvia.

## Infraestructura

- **VPS Hostinger** KVM 4: 4 CPU, 16 GB RAM, 200 GB disco, Ubuntu 24.04 con **Dokploy**.
  Comparte servidor con el ERP, así que la plataforma va en contenedor aparte con límite de memoria.
- **Dominio:** `marketing.saboryaroma.com` (ya creado).
- **Repo:** `github.com/saboryaromacrm-lab/marketingsya`
- Backups del VPS: semanales. Falta decidir si se suma uno diario.

## Stack

TypeScript de punta a punta: Next.js para interfaz y API, PostgreSQL para la copia del catálogo
y las promos, cola de tareas para sincronización, render y publicación. Las piezas se arman con
los estilos HTML y un navegador sin pantalla que exporta **JPEG** (Instagram rechaza PNG).
Las imágenes se sirven desde el subdominio porque Meta necesita una URL pública.

## Etapas

1. Base y catálogo: login con contraseña, importar los 2150 productos, buscador y botón de sincronizar.
2. Motor de carruseles: los 3 estilos como plantillas que se llenan desde el catálogo.
3. Promos: % off, 2x1, combos, packs, liquidación. Con vigencia, precio tachado y público.
   **Solo diseñan, no tocan precios en el ERP.**
4. Asesor con IA (API de Claude): qué promocionar, calendario de contenido, copys.
5. Publicación a Instagram y Facebook, siempre con aprobación previa del cliente.
6. Pautado en Meta: presupuesto y objetivo configurables, siempre confirmando el monto.

Las etapas 1 a 4 no dependen de Meta. El trámite de Meta arranca en paralelo desde el día uno.

## Meta

Publicamos solo en cuentas propias y el cliente es dueño de la app, así que probablemente
alcance con acceso estándar y nos ahorremos la revisión larga (2 a 4 semanas).
Límite: 100 posteos por día; un carrusel cuenta como uno solo.
El Instagram tiene que estar como cuenta de **empresa**, no de creador.

## Presupuesto de IA

Tope de **30 USD por mes** entre la API de Claude y la IA de imágenes.
Poner contador visible y corte automático al llegar al tope.

## Decisiones tomadas (14/11/2026)

- **Interfaz:** fuente Nunito Sans (vía `next/font`) e íconos Material Icons rellenos, como el ERP.
  Solo modo claro, con vista para celular (la barra lateral pasa a ser un cajón).
- **Menú:** las etapas que todavía no existen se muestran en gris con «ETAPA n».
- **Precio en piezas:** Minorista (lista 3) por defecto, con opción de elegir otra lista.
- **Sucursales:** la id 3 (Express 2) cerró; son solo las 4 del catálogo.
- **Cola de tareas:** `pg-boss`, guardada en el mismo PostgreSQL (sin Redis).
- **Imágenes:** quedan públicas solo las de `/media` (las necesita Meta); todo lo demás pide sesión.
- **Recetas:** el contenido es mezcla: la IA propone a partir del catálogo y Lucas edita.
- **Login:** una sola contraseña (hash scrypt en `CLAVE_HASH`), sesión de 30 días por dispositivo,
  bloqueo de 15 minutos después de 5 intentos fallidos desde la misma IP.
- **Catálogo:** campo «nombre para piezas» editable con sugerencia automática; el nombre del ERP no se toca.
  Etiquetas y subcategorías repetidas se unifican al importar. Los productos que desaparecen de la API
  se marcan «dado de baja», no se borran. Si Lucas sube una foto, gana la suya y se guardan las dos.
  Las fotos subidas van al disco del VPS, en un volumen de Dokploy.
- **Sincronización:** manual (botón), en segundo plano con `pg-boss`, una sola a la vez (índice único en la base).
  Copia las fotos al servidor. Historial de cambios por 6 meses. Si el ERP devuelve menos de la mitad
  de los productos, no aplica nada (protege de dar de baja medio catálogo por una respuesta cortada).
- **Búsqueda del catálogo:** columna `busqueda` (nombre, sugerido, marca, categoría, etiquetas y códigos,
  en minúscula y sin tildes) con índice `pg_trgm`. Primero exacta (palabras de ≤3 letras, enteras);
  si no hay nada, por parecido (`word_similarity` ≥ 0,4) y avisa. El orden suma similitud estricta,
  si la palabra está en el nombre y si es la primera palabra del nombre (probado con el catálogo real).
  Filtros en la dirección de la página (`/catalogo?q=…&marca=…`). 50 por página.
- **Precio de granel en pantallas:** el propio por kilo si lo tiene; si no, el fraccionado de 1 kg.
- **Pendiente para la etapa 2:** qué precio de granel va en las piezas (fraccionado o kilo).

## Lo que muestra el catálogo real (relevado el 14/11/2026)

- 2.184 productos, 260 marcas (77 con logo), 27 categorías; 26 productos sin categoría.
- 139 productos sin foto; 13 sin precio minorista en ningún lado.
- El único nombre mal codificado es la marca «MAÃ‘ANITA»: es doble codificación **cp1252**
  (no latin1), así que el arreglo tiene que usar la tabla cp1252.
- 246 productos a granel: el precio está en `presentaciones[]` (fraccionados de 1 kg, 500 g, 150 g),
  cada una con su precio, código de barras y stock. 6 granel no tienen fraccionados.
- El mayorista a veces se vende por bulto: `unidades: 12` → `precio` es por unidad y `precioFormato` por bulto.
- La lista Promo (23) tiene un solo producto. `descripcion` casi siempre repite el nombre en mayúsculas.
- La API responde con `ETag` estable y contesta `304` a `If-None-Match`: si no cambió, no se reprocesa.
  Se guarda como `v<VERSION_NORMALIZACION>:<etag>`; subir esa versión en `normalizar.ts` cuando cambien
  las reglas de limpieza, así se reprocesa todo aunque el ERP no haya cambiado.
- **El ERP limita los pedidos:** con ~1.200 fotos en un minuto empezó a responder `429`. La copia de fotos
  va a 8 pedidos por segundo, y ante un 429 frena todo, espera (Retry-After o 20 s) y reintenta hasta 5 veces.
- Fotos y logos copiados ocupan ~65 MB (2.045 fotos + 77 logos), en `MEDIA_DIR/erp/`.

## Decisiones pendientes (bloquean el arranque)

- [ ] Paleta: ¿la del manual o la de los carruseles?
- [ ] Tipografías: ¿Fraunces y Nunito, o Utendo y Bluestars con sus archivos?
- [ ] ¿El fucsia entra en la paleta? (el manual lo nombra pero muestra naranja)
- [ ] Los 3 HTML de los carruseles, al repo
- [ ] Backup: ¿el de Hostinger (24.799 ARS/mes) o uno gratuito hacia Google Drive?
- [ ] ¿Dónde se administra el DNS: Hostinger, Cloudflare u otro?
- [ ] ¿Qué servicio de IA de imágenes?
- [ ] Credenciales de Meta: app ID, cuenta publicitaria, token
