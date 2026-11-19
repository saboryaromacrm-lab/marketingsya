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

**Resuelto (15/11/2026):** las piezas usan la **paleta de los carruseles aprobados** (columna derecha)
y **las dos familias tipográficas**: Fraunces y Nunito ya, Utendo y Bluestars cuando Lucas pase los archivos
(hay que confirmar que la licencia permita render en servidor). El fucsia **no** entra.

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
- **Login:** un **PIN numérico de 4 a 8 dígitos** (pedido de Lucas, 18/11/2026; hash scrypt en la tabla `ajustes`),
  sesión de 30 días por dispositivo. Dos frenos: 5 fallos en 15 min por IP, y **freno general** de 20 fallos
  en una hora desde cualquier IP (sin él, un PIN de 4 dígitos se adivina rápido con muchas IP). La IP es la
  última de `X-Forwarded-For` (la agrega Traefik; las anteriores se pueden falsificar). El PIN se crea en
  la pantalla de ingreso con el `CODIGO_INSTALACION`; se cambia en Configuración; se recupera con
  `REINICIAR_CLAVE=si` + publicar. Antes de conectar Meta (etapas 5 y 6), recomendar un PIN más largo.
  El secreto de sesión se genera solo.
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
- **Fotos propias:** una por producto, reemplazable. Se guardan dos WebP en `MEDIA_DIR/propias/productos/`:
  la original (hasta 1600 px, girada según el celular) y una cuadrada de 1200×1200 con fondo blanco para las piezas.
  Foto efectiva = propia cuadrada, si no la del ERP. Tope 20 MB; HEIC del iPhone se rechaza con explicación
  (sharp no lo abre). Se suben por `POST /api/productos/[id]/foto` (las acciones de servidor cortan en 1 MB)
  y `proxyClientMaxBodySize` está en 25 MB (por defecto Next corta en 10 MB sin avisar).
- **Fotos en lote:** el nombre del archivo se busca como código de barras (del producto, fraccionados o DUN),
  después código interno, después ID. Vista previa antes de subir; repetidas y ambiguas no se suben.
- **«No usar en piezas»:** interruptor por producto y acción masiva sobre lo filtrado (solo con búsqueda exacta).
  La sincronización nunca pisa foto propia, nombre para piezas ni exclusión.
- **Precio de granel en pantallas:** el propio por kilo si lo tiene; si no, el fraccionado de 1 kg.
- **Instalación:** Dokploy, un solo Docker Compose (`docker-compose.yml`): `app` (1 GB), `db` PostgreSQL 16 propia
  (512 MB) y `respaldo` (pg_dump diario 4 h de Formosa, 14 días, espera a que existan las tablas).
  Migraciones al arrancar (`instrumentation.ts`). Imagen Debian slim por sharp. Guía: `docs/INSTALACION.md`.
  Probado entero en Docker: instalación nueva, sincronización real (~6 min la primera), reinicio, recuperación
  de contraseña y restauración de la copia. Uso medido: app ~110 MB, base ~55 MB.
- **Logo:** se sube desde Configuración (PNG/SVG, hasta 512 px, sin recortar ni deformar).
- **Etapa 2 (carruseles), decidido el 15/11/2026:**
  - Paleta de los carruseles aprobados: `#0b3b2e`, `#137a52`, `#6E9A35`, naranja `#ff8f00`. Sin fucsia.
  - Tipografías: Fraunces + Nunito y también Utendo + Bluestars (archivos pendientes).
  - De 1 a 3 productos por placa, según la placa.
  - Granel: Lucas elige en cada pieza si va el precio por kilo o el de un fraccionado.
  - Siempre visibles: `tiendaonline.saboryaroma.com`, WhatsApp **370 462-1563** y `@saboryaroma__`.
  - Variación: cada carrusel cambia detalles solo y además se puede elegir la variante.
  - Textos: los escribe Lucas (con los slogans aprobados para elegir); el nombre sale de «nombre para piezas».
  - Fotos con su fondo blanco, como vienen (sin quitar fondo por ahora).
  - Flujo: estilo → casillas en el catálogo → 5 placas en vivo → editar textos → .zip con los JPEG.
  - Se guardan los carruseles (borradores y terminados).
  - Render: Chromium sin pantalla (`playwright-core`) dentro de la imagen; tope de memoria de `app` a ~2 GB.
  - **Hecho el 19/11/2026** con los 15 HTML que pasó Lucas (5 placas por estilo), pasados a plantillas en
    `src/lib/carruseles/plantillas.ts` y servidos en `/render/carrusel/[id]?placa=N`:
    - **Lanzamiento:** portada (2 fotos), productos (hasta 6, etiqueta washi desde la categoría), cómo comprar,
      ¿por qué Sabor y Aroma? y cierre con QR. Las 3 del medio se pueden sacar. Sin precio.
    - **NutriOfertas:** portada, una placa por producto (1 a 6, platos alternados solos) y cierre. Precio = lista
      elegida − % (0 de entrada) con «antes» tachado si hay descuento; granel «el kg» y línea «A granel · 90 g, 250 g y 1 kg».
    - **Recetas:** portada, ingredientes (hasta 5, con cantidad), preparación (2 a 4 pasos, «En N pasos» solo),
      ¿por qué te hace bien? (se puede sacar; hasta 4) y cierre. Sin precio. Lucas escribe la receta (IA en etapa 4).
    - Recursos creados por nosotros porque no venían (`public/piezas/`): papel crema, panorámica de acuarelas y
      ramita de olivo de 5400 px (continúa de placa en placa), trazos de pincel verde y lima, y el QR de la tienda
      (generado sin bibliotecas; **Lucas confirmó el 19/11 que escanea bien**). Fraunces (OFL) en `public/fuentes/`.
    - Textos automáticos desde el catálogo: nombre en la placa (sin marca ni medida, minúscula de oración, 2 renglones),
      línea chica, etiqueta, frase sugerida por categoría. La frase que escribe Lucas se guarda en `productos.frase_piezas`.
    - Fotos: granel ampliado llenando la forma; envasado completo con margen. Textos que se achican solos sin «…».
    - Editor igual al de promos: placa elegida en la tira → panel de esa placa; buscador para elegir cada producto;
      revisión antes de exportar (falta producto o foto, pasos vacíos); texto del posteo automático y editable.
    - Las casillas del catálogo sirven para promos y carruseles («Armar carrusel» en la barra de abajo).

- **Etapa 3 (promos), adelantada el 18/11/2026.** Flyer igual al de referencia que pasó Lucas, con su marca:
  - Formatos: historia/WhatsApp 1080×1920, feed 1080×1350 y «uno por producto» 1080×1350. Si no entra, se parte
    solo en varias placas con la misma cabeza (los grupos largos, por líneas de 4, con «(sigue)»).
  - Dos diseños: 1 logo verde en círculo con aro naranja; 2 cinta verde a todo el ancho con logo blanco y logo
    horizontal en el pie. Cada promo nueva alterna; se elige con su miniatura. Logos en `public/marca/` (vectores).
  - Reglas: «X6 -15%» = llevando 6 o más, 15 % c/u; «-10%» = sin mínimo. Precio promo = lista elegida − %, con
    centavos («$ 6.797,45»). Tachado «antes» solo en «uno por producto». **Solo diseña: nunca toca el ERP.**
  - Las promos de la lista **Promo del ERP** se suman solas (precio fijo del ERP, sin descuento editable).
  - Filas: producto, variantes (un precio, varios sabores) o grupo (columnas con precio cada uno). Lucas las arma
    juntando y separando; títulos sugeridos y editables; nombres cortos automáticos y editables.
  - Elegir productos: casillas en el catálogo (tabla `seleccion`, no se pierde al cambiar de página) y barra fija
    abajo con «Armar promo». Sin foto, dado de baja o «no va en piezas» no se pueden elegir.
  - Editor con guardado automático, vista previa en vivo (la misma página que exporta el motor) y .zip con
    `historia-1.jpg`, `feed-1.jpg`, `uno-1.jpg`… La placa declara su tamaño con `<meta name="pieza-tamano">`.
  - Historial en `/promos` con estado vigente / por empezar / vencida, duplicar y descargar el último .zip.
  - **Revisión del 18/11/2026 (pedida por Lucas):**
    - Precio con su unidad: «c/u»; granel **por kilo** de entrada («el kg») o la medida del fraccionado («x250 g»).
    - Variantes con precios distintos: el más bajo con «desde». Grupos: cada producto con su precio.
    - Promos del ERP por cantidad: un solo precio, «3 × $ 2.300» (etiqueta «PROMO»). Sin foto **no se suman**:
      el editor avisa con enlace para subirla.
    - Sin «,00» cuando el precio es entero; los centavos solo cuando existen.
    - Título hasta 24 letras: se achica solo. Nombres sin «…»: la letra baja hasta entrar; la medida en su renglón.
    - Con pocos productos las filas crecen (hasta ×1,5) y el resto se reparte; las placas se parten parejas.
    - Nunca se exporta con productos sin foto ni sin formatos (cuadro «Para exportar falta» / «Antes de exportar»).
    - Buscador dentro del editor para sumar productos (solo los que tienen foto y van en piezas).
    - «Sorprendeme» se sacó: dos diseños con miniatura y cada promo nueva alterna sola.

- **Etapa 4 (asesor con IA), hecha el 19/11/2026:**
  - **Claude Opus 5.5** por defecto (se elige en Configuración: Opus 5.5, Sonnet 5.5 o Haiku 5.5), con el paquete oficial
    `@anthropic-ai/sdk`. Profundidad rápida/normal/a fondo = effort low/medium/high. En Opus y Sonnet va el respaldo del
    servidor ante rechazos (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`).
  - **Clave:** Lucas la pega en Configuración › Asesor IA; se prueba (gratis, `models.retrieve`) y se guarda cifrada
    (AES-256-GCM con llave derivada de `SESION_SECRETO`, ajuste `ia_clave`). Solo se ven los últimos 4. Si no hay, usa `ANTHROPIC_API_KEY`.
  - **Gasto:** cada pedido queda en `ia_consumos` con su costo (precios en `src/lib/ia/precios.ts`). Tope total 30 USD,
    20 para texto (10 reservados para imágenes), aviso al 80 % y corte automático al tope (mes calendario de Formosa).
    Contador visible en el asesor, en Inicio y en Configuración. Cada botón muestra el costo aproximado.
  - **Asesor (`/asesor`):** calendario semanal según los días de Configuración (con fechas especiales de Argentina,
    Pascua y domingos móviles calculados) y «Armar borrador» (carrusel, promo, o receta escrita por la IA); qué promocionar
    (nuevos sin contar la primera importación, bajaron de precio, época, sin usar en piezas) → armar promo o carrusel;
    recetas solo con productos del catálogo con foto → carrusel Recetas lleno; chat con historial (`ia_chat`).
  - **Textos:** «Mejorar con IA» en el texto del posteo de carruseles y promos (las promos ahora tienen texto del posteo,
    `promos.texto_posteo`), y «Sugerir» en frases y títulos de los carruseles.
  - **Reglas para la IA (en las instrucciones, en caché):** voz de la marca, voseo, slogans tal cual, «Sabor y Aroma» bien
    escrito, lista «nunca decir» (sin promesas medicinales), solo saludables, no inventar precios ni productos (por id).
  - **Configuración** ahora tiene secciones: General (logo y **datos de contacto**, que salen en todas las placas; el **QR
    se genera solo** con la dirección de la tienda, `src/lib/piezas/qr.ts`, idéntico al probado), Piezas (lista, descuento,
    vigencia y formatos de entrada), Asesor IA (conexión, modelo, profundidad, presupuesto, voz, calendario, criterios),
    Seguridad (PIN e ingresos) y Motor. Todo se guarda en el ajuste `configuracion` y se valida en `limpiarConfig`.
  - **Pruebas sin gastar:** un servidor de prueba imita la API (`ANTHROPIC_BASE_URL`); la prueba de punta a punta no usa IA real.

- **Etapa 5 (publicación en Instagram y Facebook), hecha el 19/11/2026:**
  - **Conexión:** token del **usuario del sistema** del portafolio comercial (no vence), pegado en Configuración › Meta,
    probado contra Meta y guardado cifrado (AES-256-GCM, llave propia derivada de `SESION_SECRETO`, ajuste `meta_token`).
    Página e Instagram de empresa se detectan solos con `me/accounts` (ajuste `meta_cuentas`; si hay varias páginas, se elige).
    «Probar conexión»: token, vencimiento, permisos, cupo del día (`content_publishing_limit`) y que la dirección pública responda.
    Sin paquetes: pedidos HTTP a la Graph API (`src/lib/meta/`), versión configurable (v24.0 de entrada).
  - **Destinos:** carrusel → feed de Instagram (carrusel) + página de Facebook (un posteo con todas las fotos). Promo: feed y «uno por
    producto» al feed; historias a historias de Instagram y de Facebook (cada historia es un destino aparte). Interruptores por publicación;
    los de entrada, en Configuración. Primero Instagram, después Facebook. Si Facebook rechaza la historia, lo demás sale igual.
  - **Pantalla «Publicar»** (`/publicaciones/nueva?carrusel=N` o `?promo=N`, botón «Publicar» en los editores y en el calendario del asesor):
    imágenes en orden (se pueden destildar), texto del posteo (el mismo del editor; lo editado acá queda en la pieza), «Mejorar con IA»,
    texto alternativo automático editable, Ahora (con confirmación) o Programar (día y hora de Formosa, UTC−3; programar ya es la aprobación).
    Horas sugeridas 10:00 feed y 19:00 historias (Configuración); desde el calendario propone el día de la idea. Hasta 75 días adelante.
  - **Revisión antes de aprobar** (pantalla y servidor): productos con foto y no dados de baja, 1 a 10 imágenes por posteo en Instagram,
    texto ≤ 2.200 letras, ≤ 30 hashtags y ≤ 20 menciones, Meta conectado, hora futura.
  - **Imágenes al día:** cada exportación guarda la **huella** del HTML de sus placas. Si la pieza, un precio, una foto o el contacto cambiaron,
    al aprobar se exporta de nuevo; si no, se reusa. Meta descarga los JPEG desde `/media` en la dirección pública (Configuración › Meta › Avanzado).
  - **Motor** (`src/lib/publicaciones/motor.ts`): tablas `publicaciones` y `publicacion_destinos` (estado por destino). Una revisión cada 20 s
    manda a la cola `publicar-meta` (pg-boss) lo que ya tiene que salir; la publicación se toma de forma atómica (nunca dos a la vez).
    Reintentos: 3 de entrada, cada 5 minutos (configurable 0 a 5), **solo de lo que falló**. No se reintenta: token vencido o revocado
    (corta todo y pide cargar otro), falta de permisos, tope de 100 por día, medida rechazada. Si la conexión se corta justo al publicar
    (o el servidor se reinicia en ese momento), queda «no sabemos si salió» y no se reintenta solo: así nunca sale dos veces.
  - **Historial** (`/publicaciones`): programada / publicando / reintentando / publicada / salió en parte / falló / cancelada, con el motivo,
    enlaces «Ver en Instagram/Facebook», cancelar programadas y «Reintentar» (solo lo que falló). Se actualiza solo mientras algo está en curso.
    En el celular, tarjetas. Inicio muestra las fallas de la semana y la próxima programada. Instagram no deja borrar por la API.
  - **Política de privacidad pública** en `/privacidad` (la pide Meta para el modo «Activo»), con el contacto de Configuración.
  - Arreglado de paso: el navegador de render se podía cerrar por inactividad en medio de una exportación que arrancaba justo a los 3 minutos.
  - **Pruebas sin Meta real:** un servidor que imita la Graph API (`META_GRAPH_URL`) y descarga las imágenes como Meta. La prueba final
    es la primera publicación de verdad. Fuera de alcance por ahora: etiquetar productos, ubicación, colaboradores y comentarios.

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

- [x] Paleta: la de los carruseles aprobados
- [x] Tipografías: las dos familias (faltan los archivos de Utendo y Bluestars)
- [x] El fucsia no entra
- [x] Los 3 HTML de los carruseles (recibidos el 19/11; los recursos los creamos nosotros)
- [ ] Backup fuera del servidor: ¿el de Hostinger (24.799 ARS/mes) o uno gratuito hacia Google Drive? (la copia diaria local ya está)
- [x] DNS: registro A `marketing` creado; la plataforma ya anda en `marketing.saboryaroma.com`
- [ ] ¿Qué servicio de IA de imágenes?
- [ ] Credenciales de Meta: el token de publicación lo carga Lucas en Configuración › Meta (guía en `docs/INSTALACION.md`, paso 6); la cuenta publicitaria hace falta en la etapa 6
