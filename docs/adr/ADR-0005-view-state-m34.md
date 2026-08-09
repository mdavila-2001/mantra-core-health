# ADR-0005: `ViewState<T>` como contrato de los nueve estados del M34

## Estado

**Aceptado** — con evidencia normativa externa (el modelo del proyecto).

## Contexto

El modelo canónico (`SALUD/Arquitectura/angular-architecture-map.md` §3.18)
declara **nueve estados de interfaz obligatorios** para las 81 secciones:

```text
S1  Autorización de ruta pendiente    S6  No encontrado sin filtrar existencia
S2  Cargando / esqueleto              S7  Datos atrasados / refrescar
S3  Vacío con próxima acción          S8  Sin conexión / reintentar
S4  Validación o conflicto            S9  Error inesperado + ID de petición
S5  Prohibido / propósito denegado
```

**Son contrato, no una sugerencia visual.**

## Fuerzas y restricciones

Tres distinciones del modelo que no son cosméticas:

- **S1 ≠ S2** — autorizar ocurre **antes** de pedir datos sensibles.
- **S5 ≠ S6** — un «no tenés permiso» sobre un identificador **confirma que ese
  identificador existe**.
- **S7 exige exponer la antigüedad**, porque hay 14 proyecciones materializadas.

## Opciones consideradas

| Opción | Descartada porque |
|---|---|
| Banderas sueltas (`loading`, `error`, `data`) | Permite combinaciones imposibles: cargando **y** con error |
| Enum sin datos asociados | No transporta `asOf` ni `requestId` |
| Una clase por estado | Más ceremonia sin ganar estrechamiento en la plantilla |

## Decisión

**Una unión discriminada por `status`, con campos obligatorios que hacen cumplir
las reglas del modelo.**

```ts
export type ViewState<T> =
  | RouteAuthPendingViewState | LoadingViewState | EmptyViewState
  | ReadyViewState<T> | ValidationViewState | ForbiddenViewState
  | NotFoundViewState | StaleViewState<T> | OfflineViewState
  | UnexpectedErrorViewState;
```

Con **tres obligatoriedades que no son adorno**:

| Estado | Campo obligatorio | Por qué |
|---|---|---|
| S3 `empty` | `nextAction` | El modelo lo llama «Empty **with next action**»: un vacío sin salida es un callejón |
| S7 `stale` | `asOf` | El contrato exige exponer la antigüedad. Un tipo que la permita omitir deja pasar el olvido |
| S9 `error` | `requestId` | Sin él, quien reporta y quien busca en los registros no tienen cómo encontrarse |

Y **S6 no transporta ningún dato del recurso**: no se puede construir uno que
filtre existencia.

Más tres piezas de apoyo:

- `errorToViewState`, que traduce todo fallo de la API ramificando **por `code`,
  nunca por `message`**.
- `ViewStateHost`, que pinta los nueve estados una sola vez para el proyecto.
- `M34_CODE_BY_STATUS`, con prueba contra los nueve códigos literales.

## Consecuencias positivas

- **Las reglas del modelo no se pueden incumplir por olvido**: no compilan.
- `@switch (state().status)` estrecha el tipo sin conversiones.
- **Ninguna pantalla escribe una línea sobre manejo de errores HTTP.**
- 81 secciones que pintan sus estados igual, con una sola implementación.
- Trazabilidad ejecutable al modelo.

## Consecuencias negativas

- Hay que aprender el vocabulario antes de escribir una pantalla.
- `mapData` existe porque transformar datos conservando el estado no es trivial.
- La restricción de la ranura por defecto obliga a que `ready` y `stale`
  compartan rama en `ViewStateHost`.

## Riesgos

| Riesgo | Estado |
|---|---|
| Que una pantalla no lo use | **Materializado**: las seis de `auth/` usan `app-alert` propio, y por eso no heredan la región viva ni el foco en S4 |
| Que un código de error nuevo de la API caiga en S9 genérico | **Sin mitigar**: `readApiError` devuelve `null` y se degrada |
| Que `nextAction.route` apunte a una ruta inexistente | **Materializado**: `IDENTITY_VERIFICATION_ROUTE` vale `/identity/me`, que es de la API |

Los tres están registrados en
[el análisis de brechas](../reports/documentation-gap-analysis.md).

## Evidencia

- `view-state.types.ts`: 226 líneas, con las tres distinciones explicadas.
- `ViewStateHost`: *«Reglas duras que este componente encarna (no las repitas
  afuera)»*.
- `error-to-view-state.ts`: el mapeo completo, con el motivo de cada rama.
- `M34_CODE_BY_STATUS` + su prueba.

## Plan de revisión

Revisar si el modelo cambia los nueve estados, o si aparece un caso que ninguno
cubra. **Ampliar la unión es barato; cambiar el significado de uno existente
no.**
