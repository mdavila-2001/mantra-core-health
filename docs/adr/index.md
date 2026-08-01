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
