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
  nadie más pueda crear la contraseña antes que vos. Cualquier frase larga que no se adivine.
  Guardalo: también sirve para recuperar la contraseña.

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
2. Te pide el **código de instalación** y que crees tu **contraseña** (10 caracteres o más).
3. Andá a **Catálogo › Sincronizar ahora**. La primera vez tarda unos **6 minutos**, porque copia
   las más de 2.000 fotos del ERP de a poco para no sobrecargarlo. Podés seguir usando la plataforma mientras tanto.
4. En **Configuración** subí el logo.

## Si te olvidás la contraseña

1. En Dokploy › Environment agregá `REINICIAR_CLAVE=si` y apretá **Deploy**.
2. Entrá a la plataforma: te pide crear una contraseña nueva con el código de instalación.
3. **Sacá** `REINICIAR_CLAVE=si` de Environment y volvé a apretar **Deploy**.
   (Si queda puesta, cada publicación borra la contraseña.)

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
