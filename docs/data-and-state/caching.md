# Caché

**No hay caché de datos en el frontend.** Esta página documenta esa ausencia con
precisión, porque «no hay caché» suele ser falso a medias.

---

## Lo que de verdad no hay

| Mecanismo | Estado |
|---|---|
| Caché de respuestas HTTP en memoria | No existe |
| Biblioteca de estado remoto (TanStack Query, Apollo, …) | No existe |
| Deduplicación de peticiones idénticas en vuelo | **Solo para el refresco de token** |
| Almacenamiento persistente de datos (IndexedDB, `localStorage`) | No existe |
| Service worker | No existe |
| Transferencia de estado servidor → cliente | No aplica: el servidor no pide datos |
| Cabeceras de caché en las peticiones a la API | No se fijan. Se usan las que devuelva el servidor |

Cada pantalla que necesita datos los pide. Volver a la pantalla los vuelve a
pedir.

## Lo único que sí deduplica

`TokenRefreshService`, y **solo** para el refresco:

```ts
refresh(): Observable<Session> {
  const current = this.inFlight;
  if (current !== null) return current;      // el mismo Observable, no uno nuevo
  …
  const request = this.iam.refresh(refreshToken).pipe(
    tap((session) => this.session.renew(session)),
    finalize(() => { this.inFlight = null; }),
    shareReplay({ bufferSize: 1, refCount: false }),
  );
  this.inFlight = request;
  return request;
}
```

Existe porque su ausencia rompía algo concreto:

> *«Si tres llamadas fallan con 401 a la vez —lo normal al volver de una pestaña
> en segundo plano— y cada una pidiera su propio refresco, se gastarían tres de
> los 20 intentos por minuto que admite la API y las tres rotarían el token unas
> sobre otras: la última ganaría y las otras dos dejarían tokens muertos.»*

### Dos detalles del patrón que no son opcionales

**`finalize` libera el hueco pase lo que pase.**

> *«Si quedara ocupado tras un fallo, ningún intento posterior podría volver a
> refrescar en toda la sesión.»*

**`shareReplay({ refCount: false })`**, no `refCount: true`. Con `refCount: true`,
si todos los suscriptores se dieran de baja antes de que llegara la respuesta, la
petición se cancelaría — y volvería a empezar en el siguiente intento.

## Caché que sí existe, fuera de los datos

| Qué | Dónde | Duración |
|---|---|---|
| Estáticos del build | `src/server.ts` → `express.static(…, { maxAge: '1y' })` | 1 año |
| Compilación de Angular | `.angular/cache` (y un volumen Docker) | Local |
| Instalación de Yarn | `.yarn/cache`, `.yarn/unplugged` | Local |

Un año en los estáticos es correcto **porque `angular.json` usa
`outputHashing: "all"`** en producción: cada archivo lleva su hash en el nombre,
así que un despliegue nuevo produce nombres nuevos y no hay nada que invalidar.

Ver [caché y CDN](../operations/cache-and-cdn.md).

## Qué se pierde hoy, y cuánto

Con **una sola pantalla que pide datos**, el costo real es cero:

| Consecuencia | Impacto hoy |
|---|---|
| Volver al panel lo recarga entero | Una petición a una ruta pública. Nulo |
| Dos pantallas que pidan lo mismo lo piden dos veces | No existen dos pantallas que pidan lo mismo |
| No hay datos disponibles sin conexión | El estado S8 lo dice claramente |
| No hay actualización en segundo plano | La recarga es manual y explícita |

**Y qué va a costar cuando haya listados:** una lista de pacientes, su detalle y
la vuelta a la lista serían tres peticiones donde deberían ser una y media.

## Lo que hay que resolver antes de agregar caché

No es «elegir una biblioteca». Es contestar cuatro preguntas que hoy no tienen
respuesta:

1. **¿Qué se puede cachear en una aplicación de salud?** Los datos clínicos son
   PHI. Una caché en memoria se pierde al recargar, pero una en `IndexedDB`
   sobrevive al cierre de sesión si nadie la limpia.
2. **¿Qué pasa al cambiar de organización?** `X-Tenant-Id` cambia el contexto
   entero. Una caché que no distinga por tenant mostraría datos de la
   organización anterior — que es exactamente lo que `ShellLayout` evita hoy
   volviendo al panel.
3. **¿Qué pasa al cerrar sesión?** Toda caché debe vaciarse. Hoy `clearLocal()`
   limpia el store y el almacenamiento; tendría que limpiar también la caché.
4. **¿Qué es «atrasado» aquí?** El proyecto ya tiene el estado S7 y 14
   proyecciones materializadas del lado del servidor. Una caché de cliente
   agregaría una **segunda** fuente de antigüedad, y habría que decidir cuál
   manda en `asOf`.

La cuarta es la más interesante: este proyecto ya modela la obsolescencia de
datos. Una caché mal integrada mentiría sobre ella.

## Recomendación

**No agregar caché todavía.** Agregarla cuando exista el primer caso concreto —
una lista con detalle, o dos pantallas que compartan un recurso—, y resolver
entonces las cuatro preguntas con ese caso a la vista.

Registrado como propuesta, no como brecha bloqueante, en
[el análisis de brechas](../reports/documentation-gap-analysis.md).
