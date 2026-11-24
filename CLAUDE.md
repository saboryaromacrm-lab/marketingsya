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
- Stock: al principio se ignoraba; desde el 22/11/2026 se guarda para **ordenar** la lista de Creación (de entrada no se filtra).
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
- **Menú:** las etapas que todavía no existen se muestran en gris con «ETAPA n» (desde el 20/11/2026 están todas habilitadas). Desde el 21/11, «Creación» agrupa Carruseles y Promos.
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

- **Etapa 6 (pautas en Meta), hecha el 20/11/2026:**
  - **Qué se pauta:** solo posteos del **feed ya publicados** desde la plataforma (botón «Promocionar» en Publicaciones y en `/pautas`).
    El anuncio usa el mismo posteo de Instagram (`source_instagram_media_id`, se muestra también en Facebook) y suma sus me gusta;
    si salió solo en Facebook, se usa ese posteo y solo se puede «Alcance» (a un posteo de Facebook no se le suma botón).
  - **Objetivos:** Mensajes por WhatsApp (de entrada; `OUTCOME_ENGAGEMENT`, conversaciones, destino WhatsApp, botón «Enviar mensaje»),
    Tráfico a la tienda (`OUTCOME_TRAFFIC`, clics, botón «Comprar» con `utm_source=meta&utm_medium=pauta&utm_campaign=…`) y Alcance.
  - **Presupuesto siempre total con fecha de fin** (`lifetime_budget` en el conjunto, en centavos): Meta nunca gasta más de lo confirmado.
    Por día × días (de entrada $3.000 × 7), mínimo diario que informa la cuenta (`min_daily_budget`), hasta 90 días.
  - **Confirmación del monto:** cuadro «Vas a gastar como máximo $X» con el IVA aproximado aparte (21 %, configurable). Desde $50.000 hay que
    escribir el monto. El servidor recalcula el total y lo compara con el confirmado (si la pantalla quedó vieja, pide confirmar de nuevo).
    Cambiar el presupuesto también se confirma igual.
  - **Tope del mes** ($100.000 sin impuestos, corte automático configurable): las pautas que todavía pueden gastar cuentan por su total; las
    terminadas, rechazadas o fallidas, por lo gastado. Cada pauta se carga al mes de su inicio. Se recomienda el mismo límite en la cuenta de Meta.
  - **Lanzar:** campaña en pausa → conjunto → creativo → anuncio → recién al final se activa la campaña. Si algo falla en el medio, se borra
    la campaña (nunca queda una a medias gastando). Los errores de Meta vienen en español (`locale=es_LA` en todos los pedidos).
  - **Seguimiento:** estado del anuncio (en revisión, programada, activa, pausada, con problemas, rechazada con el motivo, terminada) y resultados
    (gastado, alcance, clics, conversaciones de WhatsApp, costo por resultado) desde los insights. Se piden a Meta al abrir `/pautas` si pasaron
    15 minutos, cada 2 minutos mientras haya pautas en revisión, cada 15 minutos desde el servidor, y con «Actualizar ahora». Lo gastado nunca baja.
    Pausar, reanudar, terminar (la campaña se archiva) y cambiar presupuesto. Inicio muestra el gasto del mes y los rechazos.
  - **Públicos guardados** en Configuración › Pautas: «Minorista Formosa» (Formosa Capital + 15 km, 18 a 65+, Advantage+, intereses de vida sana)
    y «Mayoristas provincia» (provincia de Formosa, 25 a 65+). Radio alrededor de un punto o provincia (se busca en Meta al lanzar), edades,
    géneros, intereses por nombre (se buscan en Meta) y Advantage+ (con él Meta exige edad máxima 65+ y mínima hasta 25). «Probar en Meta» los valida.
    Ubicaciones: Instagram y Facebook (feed, historias y reels), o solo una de las dos.
  - **Cuenta publicitaria** detectada sola con el mismo token (`me/adaccounts`, ajuste `meta_publicidad`): tiene que estar en pesos.
    El WhatsApp vinculado a la página se intenta leer; si no se puede, se avisa pero no frena.
  - **IA «¿Qué pauto?»:** mira los me gusta y comentarios de los posteos de Instagram, las pautas anteriores y lo que queda del tope, y propone
    posteo, objetivo y monto (se revisa y se ajusta al tope). Solo sugiere: lanzar sigue pidiendo confirmación. Cuesta unos centavos.
  - Tabla `pautas`; código en `src/lib/pautas/` (reglas puras con pruebas, motor e IA) y `src/lib/meta/anuncios.ts`.
  - **Pruebas sin gastar:** el servidor que imita a Meta suma la API de anuncios. Fuera de esta etapa: anuncios con texto o imagen nuevos,
    pruebas A/B, públicos de visitantes de la tienda (necesitan el píxel) y catálogo de productos en Meta.
  - **Conexión real hecha el 20/11/2026** (todo en verde en Probar conexión). Lo que hizo falta está en `docs/INSTALACION.md`, pasos 6 y 7:
    app propia «Plataforma marketing SyA» (tipo Negocio) en modo **Activo**, usuario del sistema **administrador** con la página, el Instagram,
    la cuenta publicitaria y la app asignados, y el token revisado en el depurador de Meta (una vez se cayó `pages_manage_posts`).

- **Creación (fase 1), hecha el 21/11/2026:**
  - **Menú «Creación»** (`/creacion`) en lugar de Carruseles y Promos (que siguen en sus páginas y se llegan desde ahí):
    «Nueva pieza» (asistente), «Mis piezas» (todo junto, con pestañas Todas / Carruseles / Historias / Reels / Promos, búsqueda y estado
    borrador / lista / programada / publicada), Carruseles y Promos. En el catálogo, la barra de elegidos suma «Seguir en Creación».
  - **Un contenido, varios formatos:** cada carrusel guarda `formatos` (carrusel, historia en imagen, reel, historia en video, video de feed)
    y cada promo suma reel, historia en video y video de feed a sus formatos. Los de entrada se eligen en Configuración › Creación.
  - **Asistente:** qué comunicás (NutriOfertas, Lanzamiento, Receta, Promo, Producto destacado = NutriOfertas con 1 producto, Fecha especial =
    Lanzamiento con la próxima fecha), dónde sale (formatos) y qué productos (la selección del catálogo o «Que la IA elija», con las sugerencias del asesor).
  - **Historias en imagen de los carruseles:** la placa en el medio de 1080×1920, con franja arriba (qué es) y abajo (WhatsApp y tienda)
    (`src/lib/carruseles/historia.ts`, `/render/carrusel/N?formato=historia`). Se exportan junto con las placas (`historia-N.jpg`).
  - **Videos con motion graphics** (`src/lib/video/`): las escenas salen del mismo contenido (portada → un producto por escena, o lista de
    ingredientes y pasos en Recetas, o una fila por escena en Promos → cierre con QR, tienda, WhatsApp e Instagram), con los 4 estilos
    (NutriOfertas, Recetas, Lanzamiento y la cinta verde de Promos). Animaciones CSS en pausa en una sola línea de tiempo: el motor las mueve
    cuadro por cuadro (30 por segundo) en Chromium y le pasa cada cuadro a **ffmpeg** (instalado en la imagen), que arma el MP4 H.264 + AAC
    (2 hilos, el servidor se comparte con el ERP). Reel e historia en video 1080×1920, video de feed 1080×1350. Un reel de ~12 s tarda ~50 s.
  - **Ajustes del video:** duración máxima 8/15/20/30 s (si no entra, las escenas del medio se acortan hasta un mínimo y después quedan afuera
    los últimos productos, con aviso; la historia en video dura hasta 8 s), ritmo suave o dinámico, variante automática o 1/2/3 (de qué lado
    va la foto y cómo entra la escena), música y segundo de la portada. Vista previa en vivo en el editor (`/render/video/...&vista=1`).
    «Armar videos» arma los que no están al día (huella del HTML + música + portada), con avance y descarga del MP4.
  - **Biblioteca de música** (tabla `musica`, Configuración › Creación): Lucas sube temas libres de derechos (MP3, M4A, AAC, WAV u OGG, hasta
    15 MB; se revisan con ffprobe). Va con fundido al empezar y al terminar. Ayuda en pantalla para bajar de la biblioteca de YouTube o Pixabay.
    Sin tema elegido, el video lleva una pista de audio en silencio.
  - **Publicar videos:** en «Publicar» se elige qué: «Carrusel e historias», «Reel», «Historia en video» o «Video de feed».
    Reel → reel de Instagram (con «también en el feed» y la portada) + reel de la página de Facebook (subida en 3 pasos con el token de la página);
    historia en video → historias de Instagram y Facebook; video de feed → reel en el feed de Instagram + video en la página. Si el video no
    está al día se arma solo antes de publicar. Los reels de Instagram se pueden promocionar en Pautas.
  - `/media` ahora sirve MP4 y audios, con pedidos por pedazos (Range, 206), como piden los reproductores del celular.
  - **Pruebas:** servidor que imita a Meta con reels, historias en video y la subida de Facebook; la prueba de punta a punta arma videos de
    verdad con ffmpeg (38 de 38). Fases que siguen: videos propios de Lucas con la marca encima (fase 2) y voz en off / extras de IA (fase 3).

- **Creación (fase 2: videos propios con la marca encima), hecha el 21/11/2026:**
  - **Mis videos** (`/creacion/videos`, tabla `videos`): Lucas sube MP4, MOV o WEBM desde la computadora o el celular (galería o cámara),
    hasta 300 MB y 3 minutos. Subida en pedazos de 8 MB (`POST /api/videos` → `PUT /api/videos/N?desde=…` → `POST /api/videos/N`); un pedazo
    fuera de orden se rechaza y dice desde dónde seguir. A medias queda en `MEDIA_DIR/tmp/subidas/*.part` (no se sirve). En la cola (la misma
    del render, de a uno) se revisa con ffprobe, se comprime a 1080p H.264 (lado largo hasta 1920, 30 cuadros, tono corregido si viene en HDR
    del iPhone con zscale) con miniatura, y se borra el original. Cada video: nombre, productos que aparecen (para buscar y para sugerir las
    franjas), «Conservar», en cuántas piezas está. Sin usar 90 días → se borra solo (limpieza cada hora; aviso desde 14 días antes). Un video
    que está en una pieza no se puede borrar.
  - **La pieza** (tabla `piezas_video`, editor en `/creacion/videos/N`, guardado automático): hasta 5 clips recortados (desde/hasta) unidos
    con un corte suave de 0,3 s; video con otra forma: fondo desenfocado (de entrada) o recortar al centro; sonido original, música o los dos
    (música al 25 %); estilo de la marca (NutriOfertas, Recetas, Lanzamiento o Promo); apertura animada de 2,4 s (título, «/» corta el renglón)
    y cierre con QR de 2,8 s (las mismas escenas de los reels de la fase 1); logo y tienda siempre visibles; hasta 3 franjas de producto
    (nombre, línea chica, precio de la lista menos el %, «antes» tachado, sello «-10 %» u «Oferta», granel por kilo o fraccionado) y hasta
    3 textos cortos, cada uno en los segundos que se elijan (cuentan desde el comienzo de los clips; «desde acá» toma el momento de la
    vista previa). Se revisa que no se pisen. Formatos: reel (hasta 90 s), historia en video (hasta 60 s) y video de feed 4:5 (hasta 90 s).
  - **Vista previa en vivo** (`ReproductorPropio`): los clips en un `<video>`, el fondo desenfocado en un canvas, y la apertura, el cierre y
    las capas en iframes (`/render/video/propio/N?formato=…&parte=apertura|cierre|capas[&vista=1]`) cuyas animaciones mueve la pantalla.
  - **Armado** (`src/lib/video/propios/armar.ts`): Chromium graba la apertura y el cierre, saca cada capa como PNG transparente en su lugar
    final, y **ffmpeg** une todo en un solo comando (`argumentosFfmpeg`, pura y probada): clips con xfade y acrossfade, capas animadas con
    expresiones (franjas desde la izquierda, textos desde arriba, sellos que aparecen), apertura y cierre con xfade, audio original corrido
    después de la apertura. El reel y la historia en video tienen la misma huella: si uno está armado, el otro se copia. Un video de 20 s con
    dos clips tarda ~75 s (el 4:5 aparte, ~40 s).
  - **Publicar y pautar:** `/publicaciones/nueva?video=N` (tipo `video` en `publicaciones`), igual que los reels de la fase 1; los reels de
    Instagram se pueden promocionar en Pautas. En Mis piezas, pestaña «Videos propios». La IA sugiere el título de la apertura y los textos.
  - **Pruebas:** 29 de reglas puras (tiempos, límites, revisión, limpieza y el comando de ffmpeg) y una de punta a punta (50 de 50): sube dos
    videos de más de 8 MB (uno 4K vertical), los etiqueta, arma la pieza con dos clips y música, arma reel, historia (copiada) y feed, y la
    publica contra el servidor que imita a Meta.

- **Lista de productos en Creación › Nueva pieza, hecha el 22/11/2026** (paso «¿Qué productos?», pedido de Lucas):
  - **Stock guardado:** la sincronización ahora guarda `productos.stock` (por sucursal) y `stock_total` (las 4 juntas). En granel suma el
    suyo y los fraccionados pasados a kilos (3 de 500 g = 1,5 kg). Va aparte de la huella: no cuenta como cambio del producto ni llena el
    historial. `VERSION_NORMALIZACION` 4 (así la primera sincronización después de publicar reprocesa todo y trae el stock).
  - **Lista** (`src/lib/catalogo/lista-piezas.ts`, reglas puras en `lista-piezas-reglas.ts`): solo los que sirven para piezas (con foto, activos,
    no excluidos), 20 por página con páginas numeradas, tarjetas con casilla, foto, marca, nombre, precio de la lista de Configuración (granel
    «el kg» o «x1 kg») y stock («48 u.», «6,75 kg», «sin stock» en rojo). Marcar usa la misma selección del catálogo (aparece arriba en «elegidos»).
  - **Filtros:** buscador (el del catálogo; buscando, primero los que tienen las palabras en el nombre), marca con búsqueda adentro, categoría,
    sucursal (las 4 o una), orden (mayor stock, nombre, precio, más nuevos), «Nuevos» (altas de los últimos 30 días sin la primera importación),
    «Bajaron de precio» (30 días, compara el Minorista), «Solo con stock», Todos / Envasados / A granel. Los sin stock siempre al final.
    Quedan en la dirección de la página (`/creacion?tipo=…&marca=…`): si salís y volvés, siguen. En el celular, botón «Filtros (n)».
  - **Según el tipo:** Lanzamiento y Fecha especial arrancan con «Nuevos» (si no hay, avisa y muestra los de mayor stock); Receta, a granel;
    el resto, mayor stock. Topes: NutriOfertas 6, Lanzamiento 6, Receta 5, Producto destacado 1, Promo sin tope (también en el servidor).
  - Abajo: «hay N sin foto que no se pueden usar» con enlace al catálogo. Arriba: «Stock al … (última sincronización)».
  - Pruebas: 15 de reglas y una de punta a punta (26 de 26) con el stock real del ERP.

- **Borrar piezas en Mis piezas, hecho el 24/11/2026** (pedido de Lucas):
  - Cada tarjeta tiene su botón de borrar y una casilla; con casillas elegidas aparece la barra de abajo («Elegir las N», «Ninguna»,
    «Borrar las N»). Antes de borrar, el cuadro de confirmación (aclara cuántas ya se publicaron: en Instagram y Facebook quedan).
  - Reglas (`src/lib/creacion/borrar-reglas.ts`, con pruebas): **no** se borra si tiene una publicación programada, publicando o
    reintentando (hay que cancelarla en Publicaciones), una pauta que todavía está en Meta (creando, en revisión, programada, activa,
    pausada o con problemas) o una exportación en curso. Lo frenado vuelve con el motivo y el enlace a dónde resolverlo.
  - Lo publicado sí se borra: el registro queda en Publicaciones como «Pieza borrada», sin enlace ni «Reintentar».
  - Se borran también sus exportaciones y los archivos (JPEG, MP4 y .zip) para liberar espacio. Los clips de «Mis videos» quedan.
  - Los botones de borrar de los editores (carrusel, promo y video propio) usan las mismas reglas (`borrarPieza` en `src/lib/creacion/borrar.ts`).

- **Rendimiento, paso 1 de la auditoría (24/11/2026)** (informe con los números en el artifact «¿Por qué tarda la plataforma de marketing?»):
  - **Pantallas de carga:** `loading.tsx` en `(panel)`, `catalogo`, `configuracion` y `creacion` con el componente `Esqueleto`. El menú precarga
    ese esqueleto: al tocar una sección la pantalla responde en ~60–130 ms (antes quedaba quieta 230–530 ms en el celular con 4G).
  - **Precarga:** solo el menú lateral (`Armazon`) y los submenús (`Submenu`) precargan; los demás `<Link>` llevan `prefetch={false}`
    (filas, tarjetas, pestañas y botones: antes cada pantalla disparaba 20–29 precargas). Al sumar enlaces nuevos, ponerles `prefetch={false}`.
  - **Acciones frecuentes sin `revalidatePath`:** en una acción, cualquier `revalidatePath` hace que todas las páginas visitadas se pidan de nuevo
    (y se vuelvan a precargar). Marcar y sacar productos en Nueva pieza devuelven los elegidos (`elegidosVista`) y la pantalla se actualiza
    con eso: 1 pedido y 5 consultas por casilla (antes 16 y 37). El catálogo revalida solo `/catalogo`. La lógica de marcar está en `lib/seleccion.ts`.
  - **Publicaciones** ya no recarga la página cada 5 s: mira una firma chica del estado (`firmaPublicaciones`) cada 30 s si algo sale en el día,
    cada 5 s si algo se publica o sale en menos de 10 min (`cadaCuantoMirar`), nunca con la pestaña oculta, y recarga solo si cambió.
  - **Caché del navegador:** `staleTimes.dynamic: 30` (volver a una sección vista hace menos de 30 s no la pide de nuevo). Las páginas cuyos
    datos cambian solos o desde otra pantalla llevan `export const unstable_dynamicStaleTime = 0` (Catálogo, Nueva pieza, Mis videos,
    Publicaciones, Pautas y los tres editores).
- **Rendimiento, paso 2: miniaturas (24/11/2026):**
  - `/media/mini/<ancho>/<ruta>`: la misma imagen de `/media` achicada (anchos 96, 160, 320 y 640; WebP calidad 80, girada según la foto,
    nunca agrandada). Se genera con sharp la primera vez que se pide (~20 ms una foto, ~140 ms una placa) y queda en `MEDIA_DIR/mini/`;
    después se sirve con caché permanente (los nombres llevan versión). Pedidos simultáneos generan una sola vez. SVG, anchos no permitidos
    y rutas fuera de la carpeta dan 404. La limpieza de cada hora borra las miniaturas cuya original ya no existe.
  - En pantalla: `imagenMini(url, píxeles que ocupa)` (`src/lib/miniaturas.ts`) da `src` y `srcSet` (1x y 2x para el celular). Lo usan las
    filas del catálogo, la lista de Nueva pieza, Mis piezas, Publicaciones, Pautas, los buscadores y chips de los editores. Las vistas grandes
    (la foto del producto, la vista previa de Publicar) siguen con la original. Al sumar imágenes chicas, usar `imagenMini`.
  - Medido: Catálogo 921 → 52 KB, Nueva pieza 807 → 81 KB, Mis piezas 6.131 → 483 KB, Publicaciones 1.053 → 9 KB.
- **Rendimiento, paso 3: ajustes finos (24/11/2026):**
  - **Prioridad baja para lo pesado** (`src/lib/render/prioridad.ts`): ffmpeg con `os.setPriority(pid, 10)` y Chromium lanzado por un guion
    con `nice -n 10` (en `os.tmpdir()`). En Docker corre como usuario `node`, que no puede subirse la prioridad: comprobado que los procesos
    de Chromium quedan en 10. Con el servidor saturado, las páginas mejoran 0–17 % (el resto es competencia por memoria).
  - **Ajustes leídos una vez por pedido** (`src/lib/ajustes.ts`): la tabla se lee entera con `cache()` de React (una consulta en lugar de hasta 6);
    guardar o borrar un ajuste cambia la versión y la lectura siguiente va a la base. Inicio pasó de 17 a 11 consultas y Pautas de 15 a 10.
  - **Caché de un día** para `/marca`, `/piezas`, `/fuentes` e `/interfaz` (`headers()` en `next.config.ts`).
  - **Catálogo:** la lista de precios por defecto es la de Configuración › Piezas (`leerFiltros(p, listaPorDefecto)`), ya no la Minorista fija.
  - **Fuente de íconos recortada** (aprobado por Lucas, con fontTools instalado solo en el entorno de trabajo, no en el servidor):
    `src/styles/fuentes/material-icons-sya.woff2` (~8 KB, unos 120 íconos; la completa pesaba 125 KB), cargada desde `src/styles/iconos.css`.
    La genera `scripts/iconos/recortar.py` (busca en el código los textos que son nombres de ícono). **Al usar un ícono nuevo** la prueba
    `src/lib/__tests__/iconos.test.ts` falla y dice cuál falta: correr `python3 -m pip install fonttools brotli` y `python3 scripts/iconos/recortar.py`.

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
- [x] Credenciales de Meta: token del usuario del sistema cargado en Configuración › Meta el 20/11/2026, con publicación y anuncios (guía en `docs/INSTALACION.md`, pasos 6 y 7)
