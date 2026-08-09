# Invalidación

Sin caché no hay invalidación de datos. Lo que **sí** hay son cuatro momentos en
los que un estado deja de ser válido, y cada uno se resuelve de una forma
distinta.

---

## 1 · Invalidación de datos: recargar

La única forma de refrescar es volver a llamar:

```html
<app-view-state-host [state]="directory()" (retry)="loadDirectory()" (refresh)="loadDirectory()">
```

`retry` (S8/S9) y `refresh` (S7) apuntan a **la misma función**, y está bien:
reintentar tras un fallo y refrescar un dato viejo son la misma operación.

El organismo **no lo hace solo**: emite el evento y el dueño de los datos decide.

## 2 · Invalidación de sesión: el interceptor

```ts
function endSession(session: SessionStore, router: Router, error: unknown) {
  session.clear();
  void router.navigateByUrl(LOGIN_ROUTE);
  return throwError(() => error);
}
```

Se dispara en dos casos:

| Caso | Qué pasó |
|---|---|
| 401 y `session.refreshToken() === null` | No hay nada que renovar. Se corta antes de gastar una petición que ya se sabe que va a fallar |
| El refresco falla | Ya se intentó una vez y no alcanzó |

**El reintento no recursa a propósito.** Si la petición reintentada vuelve a dar
401, el error sube:

> *«Un interceptor que reintenta en bucle agota el límite de peticiones y deja la
> interfaz colgada sin decir nada.»*

`session.clear()` vacía tokens **y** organización elegida. `AuthService.clearLocal()`
además limpia `localStorage`.

## 3 · Invalidación de credencial: el refresco

`renew()` reemplaza los tokens **sin tocar la organización elegida**:

```ts
renew(tokens: SessionTokens): void {
  this.tokens.set(tokens);      // selectedTenantId intacto
}
```

> *«la rotación es transparente para la persona y perder su elección la sacaría
> de la organización en la que estaba trabajando.»*

Es la diferencia con `start()`, que sí la descarta: una sesión nueva es un
contexto nuevo.

## 4 · Invalidación de contexto: cambiar de organización

```ts
protected changeTenant(tenantId: string): void {
  this.auth.selectTenant(tenantId);
  void this.router.navigateByUrl('/panel');
}
```

**Es el caso más interesante**, y el que más se parece a una invalidación de
caché de verdad:

> *«Cambiar de organización es un **cambio de contexto de datos**: lo que hubiera
> en pantalla corresponde a la anterior. Se vuelve al panel en vez de recargar la
> vista actual, que podría ser el detalle de un recurso que en esta organización
> no existe.»*

Navegar al panel **descarta todo el estado de pantalla** por el mecanismo más
simple que hay: destruir el componente. Sin caché, eso basta.

**Cuando haya caché, no bastará.** Una caché que no distinga por tenant
serviría datos de la organización anterior, y esta navegación dejaría de ser
suficiente. Es la segunda de las cuatro preguntas que
[caché](caching.md#lo-que-hay-que-resolver-antes-de-agregar-caché) deja
planteadas.

## 5 · La antigüedad declarada: S7

No es invalidación, pero es la respuesta del proyecto al mismo problema. El dato
**puede estar atrasado y se dice**:

```ts
return projection.refreshedAt === null
  ? ready(projection)
  : stale(projection, projection.refreshedAt);
```

`StaleViewState` exige `asOf`, y `ViewStateHost` lo pinta siempre visible:

```html
Información al {{ viejo.asOf | date: 'dd/MM/yyyy HH:mm' }}.
<button app-button size="sm" variant="secondary" (clicked)="requestRefresh()">Actualizar</button>
```

> *«la antigüedad va SIEMPRE visible, nunca solo en un tooltip.»*

Hay 14 proyecciones materializadas en el modelo del proyecto. **Exponer la
antigüedad en vez de esconderla es la política, y está codificada en el tipo.**

## Qué NO se invalida hoy, y a nadie le duele

| Estado | Qué pasa |
|---|---|
| El estado local de una pantalla | Se destruye al cambiar de ruta |
| El tema | Persiste a propósito |
| La sesión de otra pestaña | **No se invalida.** Ver abajo |
| Cualquier caché | No hay |

### La sesión de otra pestaña

Cerrar sesión en una pestaña **no cierra la otra**. Cada una tiene su
`SessionStore` en memoria, y la que sigue abierta funciona hasta que su access
token expire y el refresco falle (porque el refresh token ya fue revocado del
lado del servidor).

Se resolvería con un oyente de `storage` sobre `mantra.refresh-token`, que
dispara en las **otras** pestañas del mismo origen. Es un cambio de producto de
unas pocas líneas, registrado como brecha `MEDIUM` en
[seguridad de sesión](../security/session-and-tokens.md).

## Cuando haya caché

Las reglas mínimas que habrá que fijar, en orden de gravedad:

1. **Vaciar todo al cerrar sesión.** Sin excepción.
2. **Segmentar por tenant.** La clave de caché debe incluir `X-Tenant-Id`, o
   cambiar de organización servirá datos ajenos.
3. **Nada de PHI fuera de memoria.** Una caché en `IndexedDB` sobrevive al cierre
   de sesión si nadie la limpia.
4. **Invalidar la lista tras una mutación de sus elementos**, que es el caso que
   hoy no existe porque no hay listas.
5. **Decidir quién manda en `asOf`**: la antigüedad de la proyección del servidor
   o la de la caché del cliente. Hoy solo hay una fuente; con caché habría dos.
