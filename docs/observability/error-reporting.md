# Reporte de errores

Los fallos de render ya **dejan rastro y son reportables**. Lo que falta es el
destino remoto: que el equipo se entere sin que nadie lo cuente.

---

## Estado

| Mecanismo | Estado |
|---|---|
| `ErrorHandler` propio | ✅ `core/errors/app-error-handler.ts` |
| Registro con contexto (versión, commit, ruta) | ✅ `ErrorReporter` |
| Código de soporte para el usuario | ✅ `E-<commit>-<n>`, copiable |
| Pantalla de recuperación | ✅ `/error` |
| Manejo del fragmento diferido fallido | ✅ `catch` en `loadComponent` |
| Página 404 que no filtra existencia | ✅ |
| **Destino remoto** | ❌ **Sigue faltando** |

### Lo que hace el manejador

```ts
handleError(error: unknown): void {
  const id = this.reporter.report(error, {
    version: this.build.version,
    commit: this.build.commit,
    route: typeof location === 'undefined' ? '(servidor)' : location.pathname,
  });
  …
}
```

Y lo que **no** registra, con prueba que lo fija:

| No viaja | Por qué |
|---|---|
| La traza (`stack`) | Puede arrastrar valores interpolados en plantillas |
| El usuario, el tenant | Datos personales |
| Contenido de formularios | Ídem |

**La regla está fijada antes de que exista el destino**, que es cuando es
barata: el día que se elija un servicio, la política ya está escrita y probada.

## Qué pasa hoy con cada tipo de fallo

| Fallo | Qué ve la persona | Qué sabe el equipo |
|---|---|---|
| Error de la API (4xx/5xx) | El estado del M34 correspondiente, **con código de soporte** | Nada, salvo que lo reporte |
| Sin conexión | S8, con botón de reintentar | Nada |
| Excepción en el constructor de un componente | **Pantalla en blanco** | Nada |
| Excepción en un `computed` de plantilla | **Pantalla en blanco** | Nada |
| Fragmento diferido que no baja (chunk 404) | **La navegación no completa, sin aviso** | Nada |
| Error de hidratación | Repintado, o peor | Nada |

**La columna de la derecha es siempre la misma.**

## Lo que sí funciona: los errores de la API

Todo fallo HTTP entra por `errorToViewState` y sale como uno de los nueve
estados. La pantalla lo pinta con `ViewStateHost` y **no escribe una línea sobre
errores**.

Y S9 muestra el identificador de soporte, visible y copiable:

```html
Código de soporte: <code class="tabular-nums">{{ fallo.requestId }}</code>
```

**Eso es reporte manual bien resuelto.** Lo que falta es el automático.

## Los fallos de render, y el código que los identifica

Ver [error boundaries](../architecture/error-boundaries.md#nivel-3--lo-que-se-rompe-fuera-de-una-petición).

Un fallo de render no tiene identificador de correlación, porque nunca hubo una
petición. Por eso `ErrorReporter` fabrica el suyo —`E-<commit>-<n>`— y
`features/error-recovery` lo muestra en pantalla.

Lo que sigue faltando no es el identificador sino **el destino**: el código está
listo para enviarse y no hay a dónde. Elegirlo es una decisión de operación con
implicaciones de privacidad.

### El caso más probable en producción

**Un fragmento diferido que no baja.** Ocurre cuando:

1. Se despliega una versión nueva.
2. Alguien tiene la anterior abierta en una pestaña.
3. Navega a `/design-system`.
4. El navegador pide un chunk cuyo nombre ya no existe → 404.
5. **La navegación no completa. Sin aviso.**

`outputHashing: "all"` garantiza que los nombres cambian en cada despliegue, así
que este caso es **seguro**, no hipotético. Ver el runbook
[chunks desactualizados](../operations/runbooks/chunks-desactualizados.md).

## Propuesta, en orden de valor

### 1 · `ErrorHandler` propio

```ts
// PROPUESTA, no implementada
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    // 1 · consola, como hoy
    // 2 · contexto: versión, ruta, sub del usuario (NO su nombre ni su documento)
    // 3 · destino remoto, cuando exista
  }
}
```

Sin destino remoto no aporta mucho, pero es el punto único por el que todo pasa.

### 2 · Componente frontera

Un componente alrededor del `router-outlet` que capture el fallo de la ruta hija
y muestre una pantalla de recuperación con opción de recargar, en vez del blanco.

### 3 · Manejo del fragmento fallido

Es el caso más probable y el que mejor se resuelve: detectar el fallo de
`loadComponent` y ofrecer recargar la página, que baja los chunks nuevos.

### 4 · Captura remota

**La que de verdad cambia las cosas**, y la que exige más decisiones:

| Decisión | |
|---|---|
| Autoalojado o de terceros | Un tercero rompe la propiedad de «cero terceros» del proyecto |
| Qué se envía | **Nada de PHI, nada de tokens, nada de contenido de formularios** |
| Consentimiento | ¿Un error es telemetría de comportamiento? |
| Retención | Cuánto tiempo |
| Mapas de fuente | Sin ellos las trazas son ilegibles. Subirlos al servicio de errores **no es lo mismo** que desplegarlos |

Ver [privacidad](../security/privacy.md) y
[analítica](../integrations/analytics.md).

## Los tres primeros no añaden dependencias

Es lo que hace que valga la pena hacerlos aunque la decisión sobre el punto 4
tarde: **mejoran lo que la persona ve** (una pantalla de recuperación en vez del
blanco), aunque no mejoren lo que el equipo sabe.

## Por qué esto es prioritario

Sin captura remota:

- Nadie sabe cuántas pantallas en blanco hay.
- Nadie detecta que la API está caída **hasta que alguien lo reporta**.
- Un despliegue que rompe algo pasa inadvertido si nadie usa esa pantalla.
- El post mortem de cualquier incidente empieza sin datos.

En [respuesta a incidentes](../security/incident-response.md), la pregunta *«¿qué
lo detectaría antes la próxima vez?»* hoy tiene siempre la misma respuesta:
**nada**.

## Estado

`CRITICAL` en [el análisis de brechas](../reports/documentation-gap-analysis.md).

**No se implementa acá**: es un cambio de producto. Los tres primeros puntos son
propuestas concretas y sin dependencias; el cuarto exige decisiones de privacidad
previas.
