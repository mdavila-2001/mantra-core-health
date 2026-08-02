# Variables de entorno

Cuatro variables, tres consumidores distintos, y **una sola de ellas llega al
navegador**. Esa distinción es lo importante de esta página.

## El catálogo completo

| Variable | Quién la lee | Por defecto | Llega al navegador |
|---|---|---|---|
| `PUBLIC_API_BASE_URL` | `scripts/generate-env.mjs` → el paquete | `''` (rutas relativas) | **Sí** |
| `PORT` | `src/server.ts` (SSR en producción) | `4000` | No |
| `SSR_ALLOWED_HOSTS` | `src/server.ts` (**decide si hay SSR**) | vacío | No |
| `FRONTEND_PORT` | `docker-compose.yml` | `4200` | No |
| `BACKEND_ORIGIN` | `docker-compose.yml` y `Dockerfile.dev` | `http://host.docker.internal:3000` | No |

`.env.example` es la plantilla oficial y explica cada una. `.env` está ignorado
por Git.

De todas, la que más caro sale olvidar es **`SSR_ALLOWED_HOSTS`**: sin el
dominio público declarado, el servidor no falla —responde 200— pero degrada a
renderizado de cliente, así que se pierde el prerenderizado **en silencio**. El
detalle está en [configuración](../operations/configuration.md).

```bash
cp .env.example .env
```

**Sin `.env` el proyecto levanta igual**: las cuatro tienen valor por defecto.

## Angular no lee `.env`, y por eso existe el generador

Un `.env` es un archivo del sistema operativo; lo que el navegador ejecuta es
JavaScript compilado. No hay forma de que uno lea el otro en tiempo de
ejecución. El puente es explícito y angosto:

```text
.env  ·  entorno del proceso
      ↓
scripts/generate-env.mjs         ← manifiesto de UNA sola clave
      ↓
src/environments/env.generated.ts    (generado, ignorado por Git)
      ↓
environment.ts / environment.development.ts   ← ponen el valor por defecto
      ↓
API_BASE_URL (InjectionToken)  →  los seis clientes de data-access
```

Se ejecuta encadenado antes de `start`, `build`, `watch` y `test`
(`package.json`), y en el arranque del contenedor (`Dockerfile.dev`). No hay que
llamarlo a mano; `yarn env:generate` existe para inspeccionar la salida.

### El manifiesto es la lista blanca

`generate-env.mjs` **no lee el resto del `.env`**. Solo mira las claves de su
`MANIFEST`, que hoy tiene una entrada:

```js
const MANIFEST = [
  { key: 'PUBLIC_API_BASE_URL', field: 'apiBaseUrl', validate: validateApiBaseUrl },
];
```

Eso significa que podés tener todos los secretos que quieras en tu `.env` sin
riesgo de que se cuelen al paquete: no se leen. Lo que hay que impedir es que
alguien **agregue un secreto al manifiesto**, y para eso el script tiene tres
defensas que abortan la generación:

| Defensa | Qué rechaza |
|---|---|
| `assertPublicName` | Claves cuyo nombre promete un secreto: `SECRET`, `PASSWORD`, `PRIVATE`, `CREDENTIAL`, `TOKEN`, `APIKEY`, `API_KEY`, `*_KEY`, `SIGNATURE`, `SALT`, `SESSION`, `COOKIE` |
| `assertPublicValue` | Valores con forma de JWT (`eyJ….….`) o de clave PEM (`-----BEGIN`) |
| `validateApiBaseUrl` | URLs relativas, con query, con fragmento o con `usuario:contraseña@` embebidos |

El fallo es **al compilar**, no en producción. Es la diferencia entre un error y
una filtración.

## `PUBLIC_API_BASE_URL` en detalle

```bash
PUBLIC_API_BASE_URL=            # vacío — el valor recomendado
```

Vacío significa **rutas relativas**: la aplicación pide a `/iam/auth/login` sobre
su propio origen. Quién resuelve ese destino depende del entorno:

| Entorno | Quién resuelve |
|---|---|
| `yarn start` en el host | El proxy de Angular (`proxy.conf.json` → `localhost:3000`) |
| `docker compose up` | El proxy generado (`proxy.generated.json` → `BACKEND_ORIGIN`) |
| Despliegue de mismo origen | El servidor web que sirve el frontend |
| Despliegue con la API en otro dominio | **Nadie.** Hay que definir la variable |

Solo en ese último caso se define, y entonces va absoluta y limpia:

```bash
PUBLIC_API_BASE_URL=https://api.ejemplo.com
```

Sin barra final, sin query, sin fragmento, sin credenciales. El generador aborta
si las lleva.

> **Decisión tomada: la API va detrás del mismo dominio.** Así que en producción
> esta variable también queda **vacía**, y quien enruta los seis prefijos es el
> reverse proxy ([`deploy/nginx.conf`](../../deploy/nginx.conf)).
>
> El mecanismo para la otra opción sigue existiendo y probado; simplemente no se
> usa. Ver [configuración](../operations/configuration.md).

## Nada de lo público es secreto

Todo lo que sale de `environment` termina literal en el JavaScript que descarga
el navegador. Se lee abriendo las herramientas de desarrollo. No es una
filtración potencial: es publicarlo.

Ofuscar no cambia nada — el paquete se ejecuta en la máquina de quien lo
descarga, así que cualquier valor que necesite para funcionar está a su alcance.
Lo que necesite ser secreto vive del lado de la API, que es donde hay dónde
guardarlo.

Ver [seguridad frontend](../security/frontend-security.md#variables-públicas-y-privadas).

## Los dos proxys

| Archivo | Lo usa | Destino |
|---|---|---|
| `proxy.conf.json` | `yarn start` en el host | `http://localhost:3000`, fijo |
| `proxy.conf.docker.json` | Plantilla del contenedor | `__BACKEND_ORIGIN__`, sustituido al arrancar |
| `proxy.generated.json` | El contenedor, en ejecución | Generado; ignorado por Git |

Los dos reenvían los mismos seis prefijos:

```text
/iam  /public  /terminology  /profiles  /identity  /common
```

Esa lista es **la superficie de red completa de la aplicación**. Si alguien
agrega un módulo nuevo de la API, hay que agregarlo a los dos archivos o las
peticiones se irán al servidor de desarrollo en vez de a la API.

## Qué NO se configura por entorno

| Cosa | Dónde vive |
|---|---|
| Puerto del servidor de desarrollo | `angular.json` (4200) |
| Lista de rutas del proxy | `proxy.conf*.json` |
| Presupuestos de bundle | `angular.json` → `budgets` |
| Umbrales de cobertura | `vitest.config.ts` |
| Tema por defecto | Preferencia del sistema; el usuario la sobreescribe y va a `localStorage` |
| Credenciales de la cuenta de demostración | El `.env` de la API, no de este repositorio |
| Banderas de funcionalidad | **No existen.** Ver [feature flags](../operations/feature-flags.md) |
