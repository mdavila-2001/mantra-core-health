# Runbook 6 · CORS bloqueando peticiones

**Síntoma.** El panel muestra **S8 (sin conexión)** y la consola dice
`blocked by CORS policy`. Con la API respondiendo bien a `curl`.

**Impacto.** Alto: nada que necesite datos funciona.
**Severidad.** S1.

---

## Por qué se ve como «sin conexión»

El navegador bloquea la respuesta **antes** de que llegue al código. Para
`HttpClient` es indistinguible de una petición que no llegó:

```ts
if (error.status === 0) {
  return offline();   // S8
}
```

> *«Estado 0 es "la petición no llegó": sin conexión, DNS caído **o CORS**.»*

**La consola del navegador es la única fuente que lo distingue.** Desde el código
es imposible.

## Cuándo puede pasar, y cuándo no

| Entorno | ¿Puede haber CORS? |
|---|---|
| `yarn start` (host) | **No.** El proxy hace que el navegador vea un solo origen |
| `docker compose up` | **No.** Ídem, con `proxy.generated.json` |
| Producción, mismo dominio | **No** |
| Producción, API en otro dominio | Sí |

**Con `PUBLIC_API_BASE_URL` vacío no hay CORS posible**: las peticiones salen
relativas.

> **Y ésa es la configuración decidida.** La API va detrás del mismo dominio,
> con [`deploy/nginx.conf`](../../../deploy/nginx.conf) enrutando los seis
> prefijos. En esa topología **este runbook no debería dispararse nunca**.
>
> Si se dispara, la primera hipótesis no es CORS: es que alguien construyó la
> imagen con `PUBLIC_API_BASE_URL` definida. Ver
> [runbook 8](variables-incorrectas.md).

## Diagnóstico

### 1 · Confirmar que es CORS

```text
F12 → Consola
```

```text
Access to fetch at 'https://api.ejemplo.com/iam/auth/login' from origin
'https://app.ejemplo.com' has been blocked by CORS policy: ...
```

El mensaje dice **cuál** de las comprobaciones falló:

| Mensaje | Falta |
|---|---|
| `No 'Access-Control-Allow-Origin' header` | La cabecera, o el origen no está permitido |
| `not allowed by Access-Control-Allow-Headers` | **`Authorization` o `X-Tenant-Id`** en la lista |
| `Method ... not allowed` | El método en `Access-Control-Allow-Methods` |
| `Response to preflight request doesn't pass` | El `OPTIONS` falla |

**La segunda fila es la más probable en este proyecto**: el interceptor manda dos
cabeceras propias.

```ts
setHeaders: {
  Authorization: `Bearer ${accessToken}`,
  ...(tenantId === null ? {} : { 'X-Tenant-Id': tenantId }),
}
```

Un `X-Tenant-Id` no permitido rompe **solo las peticiones con organización
activa**, así que el login funciona y el panel no. Es un síntoma muy
característico.

### 2 · Comprobar el preflight

```bash
curl -i -X OPTIONS https://<api>/iam/auth/login \
  -H "Origin: https://<frontend>" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: authorization,x-tenant-id,content-type"
```

Debe devolver `204` o `200` con:

```http
Access-Control-Allow-Origin: https://<frontend>
Access-Control-Allow-Headers: authorization, x-tenant-id, content-type
Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
```

### 3 · Verificar qué origen se está enviando

```bash
yarn env:generate && cat src/environments/env.generated.ts
```

Con `apiBaseUrl` vacío no debería haber CORS. Si lo hay, **la variable quedó
compilada con un valor**, y eso es del build → [runbook 8](variables-incorrectas.md).

## Evidencia

- [ ] Mensaje completo de la consola
- [ ] Origen del frontend y URL de la API
- [ ] Salida del `curl -X OPTIONS`
- [ ] Valor de `PUBLIC_API_BASE_URL` con el que se compiló
- [ ] ¿El login funciona y el panel no? → apunta a `X-Tenant-Id`

## Mitigación

| Opción | Nota |
|---|---|
| **Configurar CORS en la API** | Debe permitir el origen, `Authorization` y `X-Tenant-Id` |
| **Servir la API tras el mismo dominio** | Elimina el problema. **La recomendada** |
| Reconstruir con `PUBLIC_API_BASE_URL` vacío | Solo si el mismo dominio es viable |

**Nunca:** `Access-Control-Allow-Origin: *` con credenciales. El navegador lo
rechaza, y aunque no lo hiciera, sería abrir la API a cualquier origen.

## Escalamiento

**Equipo de la API.** La configuración de CORS es suya; el frontend no puede
hacer nada.

## Prevención

1. **Decidir el dominio de la API** — la decisión pendiente número uno.
2. Si va en otro dominio, **probar el preflight en staging** — que tampoco
   existe.
3. Que la lista de cabeceras permitidas incluya `X-Tenant-Id` **desde el
   principio**: es la que más se olvida porque es propia del proyecto.
