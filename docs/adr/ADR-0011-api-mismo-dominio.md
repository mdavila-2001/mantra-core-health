# ADR-0011: La API va detrás del mismo dominio que el frontend

## Estado

**Aceptado** — 2026-08-01. Decisión explícita del equipo, no reconstruida.

## Contexto

El navegador tiene que llegar a la API. `PUBLIC_API_BASE_URL` admite dos
formas, y hasta ahora ninguna estaba elegida:

| Valor | Significa |
|---|---|
| Vacía | Rutas relativas: la aplicación pide a `/iam/auth/login` sobre su propio origen |
| `https://api.ejemplo.com` | URL absoluta a otro origen |

En desarrollo la pregunta no se notaba: el proxy del servidor de Angular
(`proxy.conf.json`) resuelve los seis prefijos y el navegador ve un solo origen.
**En producción no hay proxy de Angular**, así que había que decidir.

Era el bloqueante `B-02`: sin él no se podía construir la imagen, escribir la
CSP ni saber si hacía falta CORS.

## Fuerzas y restricciones

- **`PUBLIC_API_BASE_URL` es de _build_, no de ejecución.** Se compila dentro
  del paquete, así que un valor por entorno significa **una imagen por
  entorno**.
- La CSP declara `connect-src`. Un dominio distinto hay que abrirlo, y eso ata
  la política de seguridad a la topología de despliegue.
- El interceptor manda dos cabeceras propias: `Authorization` y
  **`X-Tenant-Id`**. La segunda es la que más se olvida al configurar CORS,
  porque no es estándar — y su ausencia rompe **solo** las peticiones con
  organización activa, así que el login funciona y el panel no.
- Es un sistema de salud: cuantas menos piezas negocien la política de origen,
  menos superficie hay que auditar.

## Opciones consideradas

| Opción | Descartada porque |
|---|---|
| **API en otro dominio** | Exige CORS, abre `connect-src`, y obliga a una imagen por entorno |
| Proxy dentro del servidor SSR | Funcionaría, pero **haría pasar todo el tráfico clínico por el proceso de renderizado**: acopla dos cosas que fallan distinto y escalan distinto |

## Decisión

**La API va detrás del mismo dominio.** `PUBLIC_API_BASE_URL` queda **vacía en
todos los entornos**, y un reverse proxy delante enruta:

```text
/iam  /public  /terminology  /profiles  /identity  /common   →  API
todo lo demás                                                →  servidor SSR
```

Referencia funcional en [`deploy/nginx.conf`](../../deploy/nginx.conf), con un
despliegue completo en
[`deploy/docker-compose.prod.yml`](../../deploy/docker-compose.prod.yml).

**Los estáticos también van al servidor SSR**, no al proxy: `src/server.ts` los
sirve con `maxAge: '1y'` **y emite las cabeceras de seguridad**. Servirlos desde
nginx las perdería, salvo repitiéndolas — y dos fuentes para la misma política
es exactamente cómo se separan.

## Consecuencias positivas

| | |
|---|---|
| **Sin CORS** | El navegador ve un solo origen. Nada que configurar, nada que se olvide |
| **CSP estable** | `connect-src 'self'`, y no cambia entre entornos |
| **Una sola imagen** | La misma sirve para staging y producción |
| Sin preflight | Una petición menos por operación no simple |
| Cookies futuras | Si la API pasara a `HttpOnly`, el mismo origen lo hace trivial |

## Consecuencias negativas

- **Hace falta un reverse proxy.** Es una pieza más de infraestructura, aunque
  cualquier despliegue serio ya la tiene (ingress, ALB, nginx).
- **Los prefijos se declaran en tres lugares** —desarrollo, contenedor y
  producción— y pueden separarse.
- El frontend y la API comparten dominio, así que un cambio de dominio los toca
  a los dos.

## Riesgos

| Riesgo | Mitigación |
|---|---|
| Los tres proxys se separan | **`scripts/check-api-prefixes.mjs`**, en CI. Es el modo de fallo peor: un módulo agregado en desarrollo y olvidado en producción funciona en la máquina de quien lo escribió |
| Alguien construye la imagen con la variable definida | El `ARG` por defecto es vacío, y `deploy/docker-compose.prod.yml` lo declara explícito con el motivo al lado |
| El proxy no reenvía `X-Tenant-Id` | No aplica: nginx reenvía las cabeceras de la petición salvo que se las quite |

## Evidencia

- `deploy/nginx.conf`, `deploy/api-proxy.conf`, `deploy/docker-compose.prod.yml`
- `Dockerfile`, con `ARG PUBLIC_API_BASE_URL=""`
- `src/server/security-headers.ts`: `connect-src` sigue a la variable, con
  prueba de los dos casos
- `scripts/check-api-prefixes.mjs`: 6 prefijos, iguales en las 3 fuentes

## Plan de revisión

Revisar si aparece una razón concreta para separar los dominios —un CDN propio
para la API, o un equipo que la despliegue por su cuenta con otro ciclo—. **El
mecanismo para la otra opción sigue existiendo y probado**: es cambiar una
variable y abrir `connect-src`.

Y revisar si la API pasa a entregar el refresh token como cookie `HttpOnly`:
esta decisión lo haría mucho más simple, y cambiaría además
[ADR-0006](ADR-0006-sesion-en-memoria.md).
