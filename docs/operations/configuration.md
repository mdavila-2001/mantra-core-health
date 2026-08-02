# Configuración

Cuatro variables, y **una decisión sin tomar** que bloquea el despliegue.

Para el detalle de cada variable, ver
[variables de entorno](../getting-started/environment-variables.md).

---

## Las cuatro variables

| Variable | Momento | Consumidor | Llega al navegador |
|---|---|---|---|
| `PUBLIC_API_BASE_URL` | **Build** | El paquete, vía `generate-env.mjs` | **Sí** |
| `PORT` | Ejecución | `src/server.ts` | No |
| `FRONTEND_PORT` | Ejecución | `docker-compose.yml` | No |
| `BACKEND_ORIGIN` | Ejecución | `docker-compose.yml` y `Dockerfile.dev` | No |

## La distinción que más cuesta en producción

**`PUBLIC_API_BASE_URL` es de _build_, no de ejecución.**

```text
.env  →  scripts/generate-env.mjs  →  env.generated.ts  →  compilado en el paquete
```

Cambiarla exige **recompilar**. No se puede inyectar en el contenedor al
arrancar.

Consecuencias operativas:

| Estrategia | Implicación |
|---|---|
| Una imagen por entorno | Cada entorno se construye con su valor |
| Una sola imagen para todos | **`PUBLIC_API_BASE_URL` debe ir vacía** y la API detrás del mismo dominio |

**La segunda es más simple y probablemente la correcta**, pero exige que la
decisión se tome.

## La decisión, tomada

> ## ✅ Decisión tomada: **la API va detrás del mismo dominio**
>
> `PUBLIC_API_BASE_URL` queda **vacía** en todos los entornos. Consecuencias, y
> las tres son simplificaciones:
>
> | | |
> |---|---|
> | Peticiones | Relativas (`/iam/auth/login`) |
> | CORS | **No hace falta**: el navegador ve un solo origen |
> | CSP | `connect-src 'self'`, y no cambia nunca |
> | Imágenes | **Una sola**, igual para todos los entornos |
>
> Lo que enruta los seis prefijos a la API es el reverse proxy:
> [`deploy/nginx.conf`](../../deploy/nginx.conf), con un despliegue de
> referencia en [`deploy/docker-compose.prod.yml`](../../deploy/docker-compose.prod.yml).
>
> El mecanismo para la otra opción sigue existiendo y probado — pero no se usa.

## El generador de entorno

El único puente entre el entorno y el navegador, deliberadamente angosto:

| Defensa | Qué impide |
|---|---|
| Lista blanca (`MANIFEST`) | El resto del `.env` **no se lee** |
| `assertPublicName` | Claves con nombre de secreto |
| `assertPublicValue` | Valores con forma de JWT o clave PEM |
| `validateApiBaseUrl` | URLs con credenciales, query o fragmento |

El fallo es **al compilar**. Ver
[seguridad frontend](../security/frontend-security.md#variables-públicas-y-privadas).

## Configuración que NO es por entorno

| Cosa | Dónde |
|---|---|
| Puerto del dev-server | `angular.json` (4200) |
| Rutas del proxy | `proxy.conf.json` y `proxy.conf.docker.json` |
| Presupuestos | `angular.json` |
| Umbrales de cobertura | `vitest.config.ts` |
| Modo de render por ruta | `app.routes.server.ts` |
| Tema por defecto | Preferencia del sistema |
| Alias de rutas | `tsconfig.json` |
| Banderas de funcionalidad | **No existen** |

### Las rutas del proxy son la superficie de red

```text
/iam  /public  /terminology  /profiles  /identity  /common
```

**Están en dos archivos** (`proxy.conf.json` y `proxy.conf.docker.json`) y hay que
mantenerlos a la par. Un módulo nuevo de la API que no se agregue a los dos se va
al servidor de desarrollo en vez de a la API.

Es una duplicación **sin prueba que la vigile**, a diferencia de las tres del
sistema de diseño. Brecha `LOW` con solución fácil: una comprobación que compare
las dos listas.

## Cómo se genera el proxy del contenedor

```sh
sed "s|__BACKEND_ORIGIN__|$BACKEND_ORIGIN|" proxy.conf.docker.json > proxy.generated.json
```

> *«El proxy de Angular es un JSON estático y no interpola variables… Se genera en
> un archivo aparte para no chocar con el `proxy.conf.json` del repo, que es el
> del host y no debe cambiar.»*

`proxy.generated.json` está en `.gitignore`.

## Verificar la configuración efectiva

```bash
yarn env:generate && cat src/environments/env.generated.ts
```

Si `envFromProcess` sale `{}`, ninguna variable del manifiesto estaba definida y
mandan los valores por defecto de `environment*.ts` — que hoy son ambos `''`.

En el navegador:

```js
// consola, en la aplicación construida
performance.getEntriesByType('resource').filter(r => r.name.includes('/iam'))
// muestra contra qué origen salen las peticiones
```

## Configuración que sí hay que tocar antes de desplegar

Es la lista completa, y son **dos archivos**:

| Dónde | Qué | Por qué no puede tener un valor por defecto |
|---|---|---|
| `deploy/nginx.conf` → `server_name` | El dominio real | Mientras diga `localhost`, solo responde en local |
| Variables del entorno productivo | Credenciales y orígenes | No van en el repositorio |

`PUBLIC_API_BASE_URL` **se deja vacía**: con la API detrás del mismo dominio las
peticiones salen relativas, no hace falta CORS y la CSP se queda en
`connect-src 'self'` para siempre.

> ⚠️ `PUBLIC_API_BASE_URL` es de **build**, no de ejecución: queda compilada
> dentro del paquete. Definirla obligaría a una imagen por entorno, que es
> exactamente lo que la decisión de poner la API detrás evita.

### El `Host` ya no se configura en el build

`angular.json` tenía `build.options.security.allowedHosts`, que se hornea en el
artefacto y hacía que el servidor devolviera **400 ante cualquier dominio real**.
Se quitó, y la validación vive en nginx, donde es configuración en caliente. Ver
[despliegue](deployment.md#validación-del-host).

## Lo que falta

| # | Qué | Severidad |
|---|---|---|
| 1 | Variables del entorno productivo | BLOCKER |
| 2 | Banderas de funcionalidad | Ver [feature flags](feature-flags.md) |

Cerradas: el dominio de la API (va detrás, `deploy/nginx.conf`), el identificador
de build en el artefacto (`buildInfo`), y la comprobación de que los proxys
coinciden (`scripts/check-api-prefixes.mjs`, que compara los seis prefijos entre
`proxy.conf.json`, `proxy.conf.docker.json` y `deploy/nginx.conf`, y corre en CI).

Registradas en [el análisis de brechas](../reports/documentation-gap-analysis.md).
