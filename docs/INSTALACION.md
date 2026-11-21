# Instalación en Dokploy

Guía paso a paso para dejar la plataforma andando en `https://marketing.saboryaroma.com`.
Se hace **una sola vez**. Después, cada cambio aprobado en `main` se publica solo.

> Los nombres de algunos botones de Dokploy pueden cambiar un poco según la versión.
> Si algo no coincide, buscá la opción equivalente o pedí ayuda.

## Qué se instala

Un solo «Docker Compose» con tres partes:

| Parte | Qué hace | Memoria máxima |
| --- | --- | --- |
| `app` | La plataforma | 1 GB |
| `db` | Su propia base de datos PostgreSQL, separada de la del ERP | 512 MB |
| `respaldo` | Copia diaria de la base a las 4 de la mañana; guarda 14 días | 128 MB |

Las fotos y las copias quedan en volúmenes del servidor: no se pierden al reiniciar ni al publicar una versión nueva.

## 1. Apuntar el dominio al servidor

Hace falta un registro **A** con nombre `marketing` que apunte a la IP del VPS.
La IP la ves en el panel de Hostinger, en el VPS.

- **Si el DNS está en Hostinger:** hPanel › Dominios › `saboryaroma.com` › DNS › Agregar registro.
  Tipo `A`, nombre `marketing`, apunta a la IP del VPS, TTL `3600`.
- **Si está en Cloudflare:** DNS › Add record. Tipo `A`, nombre `marketing`, la IP del VPS,
  y la nube en **gris** («DNS only»), así Dokploy puede sacar el certificado HTTPS.

Puede tardar de unos minutos a un par de horas en propagarse.

## 2. Inventar dos claves

Anotalas en un lugar seguro (por ejemplo, tu gestor de contraseñas). **No las mandes por chat.**

- **`DB_CLAVE`**: contraseña de la base. **Solo letras y números**, 32 caracteres.
  Un generador de contraseñas con los símbolos desactivados sirve.
- **`CODIGO_INSTALACION`**: un código que te va a pedir la plataforma la primera vez, para que
  nadie más pueda crear el PIN antes que vos. Cualquier frase larga que no se adivine.
  Guardalo: también sirve para recuperar el PIN.

## 3. Crear el servicio en Dokploy

1. **Projects › Create Project**. Nombre: `Marketing`.
2. Dentro del proyecto: **Create Service › Compose**. Nombre: `plataforma`.
3. En **General › Provider**: elegí **GitHub**, el repositorio `saboryaromacrm-lab/marketingsya`,
   la rama **`main`** y en **Compose Path** `./docker-compose.yml`. Guardá.
   (Si GitHub no aparece, primero conectalo en Settings › Git.)
4. En **Environment** pegá, con tus valores:

   ```
   DB_CLAVE=la-clave-de-la-base
   CODIGO_INSTALACION=tu-codigo-de-instalacion
   ```

   Guardá.
5. En **Domains › Add Domain**:
   - Host: `marketing.saboryaroma.com`
   - Path: `/`
   - Service: `app`
   - Container Port: `3000`
   - HTTPS: activado, certificado **Let's Encrypt**

   Guardá.
6. Volvé a **General** y apretá **Deploy**. La primera vez tarda unos minutos (compila la imagen).
   En **Logs** tiene que aparecer `[arranque] base de datos al día`.
7. Revisá que **Autodeploy** esté activado: así cada cambio aprobado en `main` se publica solo.

## 4. Primera entrada

1. Abrí `https://marketing.saboryaroma.com`.
2. Te pide el **código de instalación** y que crees tu **PIN** (de 4 a 8 números).
3. Andá a **Catálogo › Sincronizar ahora**. La primera vez tarda unos **6 minutos**, porque copia
   las más de 2.000 fotos del ERP de a poco para no sobrecargarlo. Podés seguir usando la plataforma mientras tanto.
4. En **Configuración** subí el logo.

## 5. Conectar el asesor con IA (una vez)

1. Entrá a **console.anthropic.com** y creá una cuenta (podés entrar con Google).
2. En **Billing**, cargá saldo (con 10 o 20 USD alcanza para varios meses de uso normal).
3. En **Settings › Limits**, poné un tope mensual igual al de la plataforma (por ejemplo 20 USD), como doble seguro.
4. En **Settings › API Keys › Create Key**, creá una clave (nombre: `marketing`). Copiala: empieza con `sk-ant-`.
   **No la mandes por chat.**
5. En la plataforma: **Configuración › Asesor IA › Conexión con Claude**, pegala y apretá **Probar y guardar**.
   Tiene que decir «Conectada». Queda guardada cifrada y no se vuelve a mostrar.

El gasto del mes se ve en Inicio, en el Asesor y en Configuración. Al llegar al tope, la IA se apaga sola hasta el día 1.

## 6. Conectar Instagram y Facebook (una vez)

Hace falta: el Instagram como cuenta de **empresa** (no de creador), vinculado a la página de Facebook,
y las dos dentro del portafolio comercial de Sabor y Aroma (business.facebook.com).
Así se hizo el 20/11/2026 (Meta cambia seguido los nombres de los menús).

**A. La app (developers.facebook.com)**
1. **Mis apps › Crear app** › nombre `Plataforma marketing SyA` › caso de uso **Otro** › tipo **Negocio** ›
   portafolio **SABOR Y AROMA**. No uses otras apps que aparezcan (por ejemplo «mi feed»): pueden ser de otro servicio.
2. Agregá el producto **Instagram**. No hace falta tocar «Crear nueva configuración» ni la «URL de redireccionamiento».
   Los permisos de anuncios (`ads_management`, `ads_read`) ya vienen: no hace falta agregar la API de marketing aparte.
3. **Configuración de la app › Básica:** política de privacidad e instrucciones para borrar datos
   `https://marketing.saboryaroma.com/privacidad`, categoría Negocios. Guardar.
4. Pasá **App Mode** de «Development» a **Activo** (el interruptor de arriba). **Sin esto, al generar el token
   dice «No hay permisos disponibles».**
5. En **Revisión de la app › Permisos y funciones** alcanza con el **acceso estándar** (publicamos en cuentas propias).
   No pidas acceso avanzado ni la revisión del «Marketing API Access Tier»: «Limited access» alcanza.

**B. El usuario del sistema (business.facebook.com › Configuración)**
1. **Usuarios del sistema › Agregar** › nombre `plataforma-marketing` › rol **Administrador**.
   Con rol «Employee» Meta no deja elegir permisos, y el rol no se puede cambiar después.
2. Elegilo › **···** › **Asignar activos**, con **control total**: la **página**, la **cuenta de Instagram**,
   la **cuenta publicitaria** y la **app**. Si el Instagram no deja marcarse y pide «iniciar sesión», andá a
   **Cuentas › Cuentas de Instagram › saboryaroma__**, iniciá sesión desde ahí (tener Instagram abierto en otra pestaña no alcanza) y volvé.
3. **Generar token** › la app › caducidad **Nunca** › marcá estos 8 (con el buscador, ninguno más):
   `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`,
   `business_management`, `ads_management`, `ads_read`. Copialo en el momento: Meta lo muestra una sola vez.
4. Revisalo en **developers.facebook.com/tools/debug/accesstoken**: en «Ámbitos» tienen que estar los 8.
   A veces Meta saca uno sin avisar (nos pasó con `pages_manage_posts`): si falta, generalo de nuevo.
5. En la plataforma: **Configuración › Meta**, pegalo y **Probar y guardar**; después **Probar conexión**: todo en verde.
   **No lo mandes por chat ni por mail**, y borralo del bloc de notas donde lo hayas pegado.
6. Cambiá el PIN por uno de 6 a 8 dígitos en **Configuración › Seguridad**.

**Si algo falla**
- «No hay permisos disponibles» al generar el token: la app está en Development, o el usuario del sistema es «Employee».
- «Faltan permisos» en Probar conexión: generá otro token revisando la lista (el viejo no hace falta revocarlo).
- **No toques «Revocar tokens»**: borra todos los tokens de ese usuario, también el que está andando.

## 7. Pautas en Meta (una vez)

1. En **business.facebook.com › Configuración › Cuentas publicitarias**, la cuenta tiene que estar en **pesos argentinos**,
   con hora de Argentina y con la tarjeta cargada (la moneda y la zona no se cambian después de creada).
2. Poné un **límite de gasto** de la cuenta igual al tope de la plataforma (por ejemplo $100.000), como doble seguro.
3. La cuenta publicitaria tiene que estar asignada al usuario del sistema (paso 6.B.2) y el token tiene que tener
   `ads_management` y `ads_read` (paso 6.B.3). Si ya lo hiciste así, no hay que generar otro.
4. Para los anuncios de mensajes, el **WhatsApp Business** tiene que estar vinculado a la página de Facebook
   (Meta Business Suite › Configuración › WhatsApp).
5. En la plataforma: **Configuración › Pautas** detecta la cuenta sola. Ahí ajustás el tope del mes, los valores de entrada y los públicos.

## 8. Videos y música

- La imagen ya trae **ffmpeg** (arma los reels y las historias animadas): no hay que instalar nada. En **Configuración › Creación**
  tiene que decir «Listo: ffmpeg version…».
- Los videos se arman de a uno y usan 2 núcleos del servidor; un reel de 15 segundos tarda alrededor de 1 minuto.
- La música se sube en **Configuración › Creación › Biblioteca de música**. Usá solo temas libres de derechos (biblioteca de audio de YouTube
  con «No se requiere atribución», o Pixabay Music): Instagram silencia o bloquea los videos con música con derechos.
- **Tus videos (Creación › Mis videos):** se suben desde la computadora o el celular, en pedazos de 8 MB (si se corta la conexión,
  sigue desde donde quedó). Hasta 300 MB y 3 minutos. El servidor guarda una copia en 1080p (un video de 25 MB queda en 2 o 3 MB)
  y borra el original. Los videos sin usar se borran solos a los 90 días (se avisa 14 días antes; «Conservar» lo evita).
  Todo queda en el volumen de Dokploy (`/data/media/videos`): no hace falta configurar nada.
- Un video propio de 20 segundos con apertura, franjas y cierre tarda alrededor de 1 minuto en armarse.

## Si te olvidás el PIN

1. En Dokploy › Environment agregá `REINICIAR_CLAVE=si` y apretá **Deploy**.
2. Entrá a la plataforma: te pide crear un PIN nuevo con el código de instalación.
3. **Sacá** `REINICIAR_CLAVE=si` de Environment y volvé a apretar **Deploy**.
   (Si queda puesta, cada publicación borra el PIN.)

## Copias de seguridad

- La copia de la base se hace sola todos los días a las 4 de la mañana y se guardan los últimos 14 días,
  en el volumen `respaldos` del servidor. En **Logs** del servicio `respaldo` ves cada copia.
- Las fotos están en el volumen `media`. Las dos entran en la copia semanal del VPS de Hostinger.
- Para tener una copia **fuera** del servidor (Google Drive u otro) falta decidir el servicio.
- Restaurar una copia se hace desde la terminal del servidor. Si alguna vez hace falta, pedilo y te guío.

## Cosas que conviene saber

- **Memoria:** con el catálogo cargado la plataforma usa unos 110 MB y la base unos 55 MB.
  En la etapa 2 (carruseles) se sube el tope de `app`, porque el navegador que arma las piezas necesita más.
- **Publicar una versión nueva:** se aprueba el cambio en GitHub (pull request a `main`) y Dokploy lo publica solo.
  Las tablas nuevas se crean solas al arrancar.
- **Salud:** `https://marketing.saboryaroma.com/api/salud` responde `{"ok":true}` si la plataforma y la base andan.
