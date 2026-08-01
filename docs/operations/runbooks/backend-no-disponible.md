# Runbook 4 · Backend no disponible

**Síntoma.** La aplicación carga, pero no se puede iniciar sesión y el panel
muestra **S8 (sin conexión)** o **S9 (error inesperado)** en la tarjeta del
directorio.

**Impacto.** Alto. Todo lo que necesita datos deja de funcionar; lo público sigue
viéndose.
**Severidad.** S1.

---

## El frontend está diciendo la verdad

**Esto no es un fallo de la aplicación: es su comportamiento correcto.**

```ts
// error-to-view-state.ts
if (error.status === 0) {
  return offline();      // S8: la petición NO llegó
}
```

> *«Estado 0 es "la petición no llegó": sin conexión, DNS caído o CORS. Nunca trae
> cuerpo de la API, así que se resuelve antes de intentar leerlo.»*

El panel fue construido para ser este termómetro:

> *«**S8/S9** cuando la API no está levantada, que es exactamente lo que hay que
> ver si alguien abre el frontend sin el backend.»*

## Diagnóstico

### 1 · S8 o S9 — la distinción decide todo

| Estado | Significa | Dónde mirar |
|---|---|---|
| **S8 · Sin conexión** | La petición **no llegó**: red, DNS, proxy o CORS | Infraestructura |
| **S9 · Error inesperado** | La API **respondió mal**: 500, o un cuerpo sin la forma del contrato | La API |

Si hay S9, **hay código de soporte**. Pedirlo: es lo que permite buscar en los
registros de la API.

### 2 · ¿Responde la API?

```bash
curl -i https://<api>/public/directory
```

`/public/directory` es la única ruta legible **sin sesión**, así que sirve para
comprobar sin credenciales.

| Resultado | Causa |
|---|---|
| `200` | La API está bien: el problema es de red o de configuración → paso 3 |
| `5xx` | La API está mal → escalar |
| Sin conexión | La API caída o inalcanzable → escalar |
| HTML en vez de JSON | Un proxy o balanceador está respondiendo por ella |

**El último caso está contemplado en el código:**

```ts
const body = readApiError(error);
if (body === null) {
  // Respuesta sin la forma del contrato: un proxy, un balanceador, un 502.
  return unexpectedError(correlationOf(error, null), 'No pudimos completar la operación.');
}
```

### 3 · ¿Llega el frontend a la API?

Depende del entorno:

| Entorno | Ruta | Qué comprobar |
|---|---|---|
| Host | `proxy.conf.json` → `localhost:3000` | Que la API escuche ahí |
| Docker | `BACKEND_ORIGIN` | **`localhost` dentro del contenedor es el contenedor.** Usar `host.docker.internal` |
| Producción | `PUBLIC_API_BASE_URL` o mismo origen | [Runbook 8](variables-incorrectas.md) |

### 4 · ¿Es CORS?

CORS produce **estado 0**, indistinguible de «sin conexión» desde el código. La
consola del navegador sí lo dice. → [Runbook 6](cors-bloqueando.md).

### 5 · ¿Falta una ruta en el proxy?

```text
/iam  /public  /terminology  /profiles  /identity  /common
```

Un módulo nuevo de la API que no esté en esa lista **se va al servidor de
desarrollo** y devuelve el `index.html` de Angular — que no es JSON, así que
`readApiError` devuelve `null` y sale S9.

## Evidencia

- [ ] ¿S8 o S9?
- [ ] Código de soporte, si hay S9
- [ ] `curl -i` a `/public/directory` desde el servidor del frontend
- [ ] Consola del navegador (revela CORS)
- [ ] Pestaña de red: URL exacta y estado
- [ ] ¿Otras aplicaciones que usan la API también fallan?

## Mitigación

**Ninguna del lado del frontend.** El frontend ya hace lo correcto: dice que no
hay API y ofrece reintentar.

| Causa | Quién |
|---|---|
| API caída | **Equipo de la API** |
| API con 5xx | **Equipo de la API** |
| Red / DNS / proxy | Infraestructura |
| CORS | Equipo de la API |
| Ruta faltante en el proxy | Frontend |
| `PUBLIC_API_BASE_URL` mal | Frontend — requiere **recompilar** |

**No revertir el frontend.** Salvo la última fila, revertirlo no arregla nada.

## Escalamiento

Equipo de la API, con:

- El código de soporte (`requestId`).
- La URL exacta y el estado.
- La hora.
- Si `/public/directory` responde por `curl`.

## Prevención

- **Alerta sobre picos de S8** — es la alerta más valiosa del proyecto y hoy no
  existe. Ver [paneles y alertas](../../observability/dashboards-and-alerts.md).
- Monitoreo de disponibilidad de la API.
- Smoke tras cada despliegue: el paso «el panel no muestra S8» detecta esto.
