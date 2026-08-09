# Runbook 5 · Autenticación en bucle

**Síntoma.** El login funciona y a la siguiente petición vuelve a `/auth`. O al
recargar, la sesión se pierde siempre.

**Impacto.** Alto: nadie puede usar la superficie autenticada.
**Severidad.** S1.

---

## El comportamiento es deliberado

```ts
function endSession(session: SessionStore, router: Router, error: unknown) {
  session.clear();
  void router.navigateByUrl(LOGIN_ROUTE);
  return throwError(() => error);
}
```

Se dispara en **dos** casos:

1. 401 y `session.refreshToken() === null` — no hay nada que renovar.
2. El refresco falla.

Y **el reintento no recursa**:

> *«si la petición reintentada vuelve a dar 401, el error sube. Un interceptor que
> reintenta en bucle agota el límite de peticiones y deja la interfaz colgada sin
> decir nada.»*

**Es decir: no hay bucle infinito posible.** Lo que se percibe como «bucle» es
una expulsión repetida.

## Diagnóstico

### 1 · ¿Es una expulsión, o una selección de organización?

**El caso más confundido.** Si el token trae **más de una** organización, el
guard manda a `/auth/organizacion`, no a `/auth`:

```ts
if (session.needsTenantSelection()) {
  return router.createUrlTree([TENANT_SELECTION_ROUTE]);
}
```

Y como la elección **no se persiste**, esto pasa **en cada recarga**. Es
fricción conocida, no un fallo. Ver
[persistencia](../../data-and-state/persistence.md#la-organización-elegida-sí-molesta).

| A dónde va | Qué es |
|---|---|
| `/auth` | Expulsión real → seguir |
| `/auth/organizacion` | Falta elegir organización → **no es este runbook** |

### 2 · ¿Se guardó el refresh token?

```text
F12 → Application → Local Storage → clave `mantra.refresh-token`
```

| Resultado | Causa |
|---|---|
| Está | El canje falla → paso 3 |
| **No está** | El almacenamiento está bloqueado → paso 4 |

### 3 · ¿Qué responde el canje?

```text
F12 → Red → POST /iam/auth/token/refresh
```

| Estado | Causa |
|---|---|
| `401` | El refresh token venció o fue revocado. **Volver a iniciar sesión es la respuesta correcta** |
| `429` | Límite de peticiones — 20 por minuto |
| `0` | No llega → [runbook 4](backend-no-disponible.md) |
| `200` y aun así expulsa | La petición reintentada volvió a dar 401 → contrato o permisos |

### 4 · ¿El navegador bloquea el almacenamiento?

Safari en modo privado, o cookies de terceros deshabilitadas.

```js
// consola
try { localStorage.setItem('x','1'); localStorage.removeItem('x'); console.log('OK'); }
catch (e) { console.log('BLOQUEADO', e); }
```

**Con el almacenamiento bloqueado, la sesión funciona durante la pestaña y se
pierde al recargar.** Es degradación deliberada:

> *«Peor es romper.»*

### 5 · ¿El reloj está bien?

`isAccessTokenExpired` compara contra `exp` con 10 segundos de margen. Un reloj
muy desfasado produce tokens «vencidos» al nacer.

*(Nota: esa función existe y hoy **nadie la llama** — el refresco es reactivo.
Aun así, la API sí valida `exp`.)*

### 6 · ¿El token es legible?

```ts
export function decodeAccessToken(token: string): AccessTokenClaims | null
```

Devuelve `null` ante cualquier anomalía, y entonces `isAuthenticated()` es
`false` y el guard expulsa. **Solo `sub` es obligatorio**, así que un token sin
`sid` o sin `tenants` **no** se descarta:

> *«exigirlos acá sería ser más estricto que el contrato.»*

Un token sin `sub` sí. Eso apunta al backend.

## Evidencia

- [ ] ¿A `/auth` o a `/auth/organizacion`?
- [ ] ¿Existe `mantra.refresh-token`?
- [ ] Respuesta del `POST /iam/auth/token/refresh`
- [ ] Navegador y modo (privado o no)
- [ ] ¿Le pasa a todo el mundo o a algunos?
- [ ] ¿Coincide con un cambio en la API?

## Mitigación

| Causa | Acción |
|---|---|
| Token revocado o vencido | Volver a iniciar sesión — comportamiento correcto |
| Almacenamiento bloqueado | Salir del modo privado. **No hay arreglo del lado del frontend** |
| API rechazando tokens válidos | **Escalar** |
| `429` | Esperar. El límite es de la API |
| Varias organizaciones | Elegir una — no es un fallo |

## Escalamiento

Equipo de la API si el canje devuelve 401 con un token que debería servir, o si
el token no trae `sub`.

## Prevención

- **Cierre de sesión entre pestañas** con un oyente de `storage` (`MEDIUM`).
- **Refresco proactivo** usando `isAccessTokenExpired`, que ya existe y nadie
  llama (`MEDIUM`).
- **Persistir la organización elegida** para no pasar por el selector en cada
  recarga (`MEDIUM`).
- **Telemetría de `sesion_cerrada` con `motivo`**, que distinguiría una expulsión
  masiva de un caso aislado.
