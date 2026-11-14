# Sistema de diseño · Plataforma de marketing

La plataforma tiene que verse como una parte más del ERP Sabor y Aroma, no como otra aplicación.
Los valores de abajo están medidos pixel por pixel sobre una captura del módulo Compras del ERP.

## Dos paletas, no una

Esto es importante y conviene no mezclarlo:

- **La interfaz** de la plataforma usa la paleta del ERP que está más abajo. Es la que ve Lucas
  cuando trabaja: menús, botones, tablas, formularios.
- **Las piezas que se generan** (carruseles, promos, placas para Instagram) usan la paleta de
  marca del manual de identidad. Es la que ve el cliente final.

Son dos sistemas distintos que conviven. Nunca pintar un carrusel con los colores del ERP,
ni la interfaz con los del manual.

## Colores de la interfaz

| Token | Valor | Dónde se usa |
| --- | --- | --- |
| `sidebar` | `#0c3b22` | Fondo de la barra lateral |
| `sidebar-activo` | `#155232` | Ítem seleccionado en la barra lateral |
| `sidebar-texto` | `#a9c6b3` | Texto de ítems no seleccionados |
| `sidebar-rotulo` | `#287873` | Rótulos de sección («GENERAL», «MÓDULO») |
| `verde` | `#166534` | Botones primarios, texto de pestaña activa, números destacados |
| `teal` | `#0f766e` | Enlaces e íconos dentro de las tarjetas de aviso |
| `naranja` | `#ea580c` | Subrayado de la pestaña activa |
| `ambar` | `#b45309` | Texto y fondo del toast de notificación |
| `rojo` | `#b91c1c` | Texto de alertas |
| `rojo-badge` | `#dc2626` | Contador circular en la barra lateral |
| `fondo` | `#f3f6f3` | Fondo de la página |
| `superficie` | `#ffffff` | Tarjetas, filas de tabla, inputs |
| `superficie-sutil` | `#f7faf7` | Encabezado de tabla |
| `borde` | `#dde6de` | Todos los bordes y separadores |
| `texto` | `#16211a` | Texto principal |
| `texto-suave` | `#56655c` | Subtítulos, rótulos de columna, texto secundario |
| `aviso-verde` | `#d7e6e2` | Fondo de tarjeta de aviso informativa |
| `aviso-ambar` | `#ebe2d6` | Fondo de tarjeta de aviso que pide una acción |
| `aviso-rojo` | `#fef2f2` | Fondo de la franja de alerta |
| `aviso-neutro` | `#e7f1f0` | Fondo de la franja informativa |
| `chip` | `#d8e9e8` | Fondo de las etiquetas dentro de la tabla |

## Tipografía

Una sola familia sans serif para toda la interfaz, sin tipografías de marca.
Pesos: 400 para texto, 500 para rótulos, 600 para títulos y nombres.

| Elemento | Tamaño |
| --- | --- |
| Título de página | 30 px / 600 |
| Título de sección | 20 px / 600 |
| Texto base | 14 px / 400 |
| Subtítulo y texto secundario | 14 px / 400, color `texto-suave` |
| Rótulo de columna | 11 px / 500, mayúsculas, letter-spacing 0.05em |
| Rótulo de sidebar | 11 px / 500, mayúsculas, letter-spacing 0.08em |
| Texto de chip y contador | 12 px / 500 |

## Estructura

- **Barra lateral fija** de 245 px, fondo `sidebar`, con borde derecho de 1 px.
  Arriba el logo circular y «Plataforma de marketing» en blanco 600.
  Después los rótulos de sección y los ítems: ícono de 18 px, 12 px de separación, texto 14 px.
  El ítem activo lleva fondo `sidebar-activo` y esquinas de 8 px.
  Los contadores van a la derecha del ítem, en un círculo `rojo-badge` con número blanco.
- **Barra superior** blanca: ícono para plegar la barra lateral, después un buscador global
  redondeado de 8 px con borde `borde`, ícono de lupa a la izquierda y placeholder «Buscar...».
- **Franjas de aviso** debajo de la barra superior, a todo el ancho, apiladas y sin margen entre sí.
  Alertas sobre `aviso-rojo` con texto `rojo`; informativas sobre `aviso-neutro` con texto `texto`.
  Siempre arrancan con un emoji o ícono, después el dato en 600 y el detalle en 400.
- **Área de contenido** sobre `fondo`, con 32 px de respiro.
  Primero la miga de pan «Inicio › Sección» en `texto-suave`, después el título, el subtítulo,
  y los botones de acción alineados a la derecha del título.

## Dos columnas

La sección se divide en un submenú a la izquierda y el contenido a la derecha.

- **Tarjeta de submenú:** fondo blanco, borde `borde`, esquinas de 12 px, ancho ~215 px.
  Cada ítem lleva ícono y texto. El activo tiene fondo `verde`, texto blanco y esquinas de 8 px.
- **Pestañas:** fila horizontal con borde inferior `borde` de 1 px a todo el ancho.
  La activa lleva texto `verde` 600 y un subrayado `naranja` de 2 px. Las demás, `texto-suave`.

## Componentes

**Botones.** Alto 40 px, esquinas de 8 px, texto 14 px / 500.
El primario va con fondo `verde` y texto blanco. El secundario, fondo blanco, borde `borde`
y texto `texto`. Los de fila de tabla son más chicos: alto 30 px, texto 13 px.

**Tarjetas de aviso.** Dentro del contenido, antes de los filtros. Esquinas de 12 px,
16 px de padding, borde del mismo tono que el fondo pero más saturado.
El dato importante va en 600 y el resto en 400; el botón de acción se alinea a la derecha.
Verde para informar, ámbar cuando hay algo pendiente de resolver.

**Filtros.** Una grilla que se acomoda sola. El buscador ocupa el doble que un select.
Inputs y selects: alto 40 px, fondo blanco, borde `borde`, esquinas de 8 px, texto 14 px.
Los selects muestran siempre la opción que incluye todo («Todas las categorías»), nunca vacío.

**Tabla.** Encabezado con fondo `superficie-sutil` y rótulos en mayúsculas `texto-suave`.
Filas blancas de 89 px separadas por un borde de 1 px. Padding horizontal de 16 px.
La fila entera es clicleable y se aclara al pasar el mouse.
Primera columna de selección múltiple. Las miniaturas van en 40 × 40 px con borde y
esquinas de 6 px. Los números se alinean a la derecha, con la aclaración debajo en 12 px
`texto-suave`. La última columna apila los botones de acción, uno por línea.

**Chips.** Fondo `chip`, texto `texto` de 12 px / 500, esquinas de 6 px,
padding de 2 px por 8 px. Para estados y tipos dentro de la tabla.

**Toast.** Arriba a la derecha, sobre la barra superior. Fondo `ambar`, texto blanco,
esquinas de 8 px. Lleva un ícono, el mensaje y una acción en 600 a la derecha.

## Reglas

- Nada de sombras marcadas ni degradados: todo se separa con bordes de 1 px.
- Los avisos dicen el número y después qué hacer, nunca al revés.
- Si un aviso propone una acción, el botón va en la misma tarjeta.
- El verde es para confirmar y avanzar, el ámbar para lo pendiente, el rojo solo para lo vencido.
- Las pantallas arrancan mostrando todo y se filtra desde ahí, nunca al revés.
