# Decisiones de arquitectura (ADR)

Registro de las decisiones que gobiernan el frontend.

> **Advertencia sobre el origen de estos ADR.** El proyecto no llevaba registro de
> decisiones. Estos documentos se escribieron **a partir del código y de sus
> comentarios**, que en este repositorio son inusualmente explícitos sobre el
> porqué de cada elección.
>
> El plan maestro lo exige así: *«No crear ADR retroactivos con razonamientos
> inventados. Si no existe evidencia histórica, indicar que documenta el estado
> observado.»*
>
> **Cada ADR cita la evidencia de la que sale.** Donde el motivo no se pudo
> recuperar, se dice — y ése es el caso de [ADR-0010](ADR-0010-css-critico-en-linea.md).

---

## Índice

| # | Decisión | Estado | Evidencia |
|---|---|---|---|
| [0001](ADR-0001-angular-standalone-signals.md) | Angular 21 standalone con señales, sin NgModule | Aceptado | Código |
| [0002](ADR-0002-ssr-prerenderizado-selectivo.md) | SSR con prerenderizado selectivo por sesión | Aceptado | `app.routes.server.ts`, comentado |
| [0003](ADR-0003-sin-store-global.md) | Sin store global ni caché de estado remoto | Aceptado | Código |
| [0004](ADR-0004-sistema-de-diseno-propio.md) | Sistema de diseño propio, sin biblioteca de terceros | Aceptado | `package.json`, `styles.css` |
| [0005](ADR-0005-view-state-m34.md) | `ViewState<T>` como contrato de los 9 estados del M34 | Aceptado | `view-state.types.ts`, comentado |
| [0006](ADR-0006-sesion-en-memoria.md) | Access token en memoria, refresh token en `localStorage` | Aceptado | `session.store.ts`, comentado |
| [0007](ADR-0007-fronteras-por-alias.md) | Fronteras de capa declaradas como alias de `tsconfig` | Aceptado | `tsconfig.json`, comentado |
| [0008](ADR-0008-contrato-de-formularios.md) | Contrato de accesibilidad campo ↔ control por inyección | Aceptado | `form-control.context.ts`, comentado |
| [0009](ADR-0009-vitrina-en-vez-de-storybook.md) | Vitrina interna en vez de Storybook | Aceptado | `/design-system` |
| [0010](ADR-0010-css-critico-en-linea.md) | CSS crítico en línea desactivado | **Observado, sin motivo recuperable** | `angular.json` |
| [0011](ADR-0011-api-mismo-dominio.md) | **La API va detrás del mismo dominio** | Aceptado | Decisión del equipo, 2026-08-01 |
| [0012](ADR-0012-botones-con-texto-y-acciones-de-fila.md) | **Todo botón lleva icono y texto; las acciones de fila van en un desplegable** | Aceptado — reemplaza la decisión del 2026-09-13 | Corrección C-06, 2026-09-20 |
| [0013](ADR-0013-opciones-en-select.md) | **Elegir un valor de una lista se hace con un `select`**; alternar dos estados, con un toggle | Aceptado — con una lectura por confirmar | Correcciones C-21 y C-10, 2026-09-20 |
| [0014](ADR-0014-pantallas-portadas-que-se-graduan.md) | **Las pantallas portadas de `features/alovida/**` NO se migran**: son referencia de diseño declarada y la fuente de rehidratación de las vistas reales. La adopción se mide sobre las pantallas reales, que ya montan `DataTable`. Se deja escrito el mecanismo de graduación por si alguna vez hace falta | Aceptado | `alovida-design-notice.ts:12-60`, `port-vistas-alovida.mjs:275-284`, `app.routes.ts:1232-1240`, 2026-09-21 |
| [0015](ADR-0015-tabla-con-acciones.md) | **Toda tabla con acciones de edición sigue la misma disciplina**: modal (nunca formulario en línea), guardar habilitado por cambios, confirmación al guardar y al eliminar, barra con buscador multicampo y filtros arriba, sin scroll lateral, paginación local con `app-pagination` o por cursor con `data-table` según el caso | Aceptado — extiende ADR-0012 y ADR-0013 | D-04/D-05/D-06/D-08/D-09, 2026-09-22 |
| [0016](ADR-0016-encuentro-eje-clinico.md) | Encuentro como eje del contrato clínico: notas, órdenes, verificación y reconsulta; compatibilidad C6 y límites del simulador | Aceptado | C0, 2026-09-25 |
| [0017](ADR-0017-mi-equipo-y-personal-de-apoyo.md) | **«Mi equipo» es el duodécimo renglón del doctor** (once → doce, a confirmar por el propietario), y **el personal de apoyo se distingue por clase de cuenta y vínculo, no por un rol global**: `accountKind` + `SECURITY_ADMIN` para la organización, el vínculo y sus permisos para la persona | Aceptado — a confirmar por el propietario | `navigation.support.ts`, `navigation.service.spec.ts`, 2026-10-30 |
| [0018](ADR-0018-segundo-paso-lo-hace-cumplir-el-cliente.md) | **Quien entra sin el segundo paso que su organización exige entra con un token de alcance limitado** (`mfaEnrollment`): **la API lo impone** (403 `MFA_ENROLLMENT_REQUIRED` fuera del alta) y el cliente lo refleja con su guarda; el refresco reemite el token completo al confirmar el factor | Aceptado (revisado: la API ya lo impone) | `mfa-enrollment.guard.ts`, `session.store.ts`, `mfa-enrollment/`, 2026-10-30 |

## Plantilla

```markdown
# ADR-XXXX: Título

## Estado
Propuesto | Aceptado | Reemplazado | Rechazado | Obsoleto

## Contexto
## Fuerzas y restricciones
## Opciones consideradas
## Decisión
## Consecuencias positivas
## Consecuencias negativas
## Riesgos
## Evidencia
## Plan de revisión
```

## Cuándo escribir uno

| Situación | ¿ADR? |
|---|---|
| Elegir o cambiar de framework | **Sí** |
| Añadir una dependencia en ejecución | **Sí** — hay diez, y son diez decisiones |
| Cambiar la estrategia de renderizado | **Sí** |
| Introducir un store o una caché | **Sí** |
| Cambiar el mecanismo de sesión | **Sí** |
| Añadir telemetría | **Sí** |
| Desactivar una optimización del build | **Sí** — ver ADR-0010 |
| Añadir un componente | No |
| Corregir un defecto | No |
| Refactorizar sin cambiar contratos | No |

## La regla que ADR-0010 enseña

`inlineCritical: false` está en `angular.json`, alguien lo escribió, **y el
motivo no está en ninguna parte**.

Es exactamente el tipo de decisión que un ADR conserva: quien la lea hoy no sabe
si puede revertirla o si rompería algo. Ver
[ADR-0010](ADR-0010-css-critico-en-linea.md).
