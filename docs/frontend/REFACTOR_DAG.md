# DAG de refactor

Orden de dependencias. Una tarea **no empieza** hasta que su dependencia esté
`REGRESSION_VERIFIED`.

```text
TOKENS -> PRIMITIVAS -> COMPARTIDOS -> LAYOUTS -> FEATURE -> PAGINAS
```

Nunca al revés, y nunca todo a la vez.

## Estado

Vacío a propósito. Se completa en la Wave 0 (baseline), no antes: el DAG se
deriva de defectos observados en el navegador, no de intuiciones.

## Waves

| Wave | Alcance | Estado |
|---|---|---|
| 0 | Infraestructura, baseline, inventario | **en curso** |
| 1 | Fundación de diseño (tokens, tipografía, espaciado, iconos) | pendiente |
| 2 | Primitivas (átomos y moléculas de `shared/`) | pendiente |
| 3 | Layouts y shells | pendiente |
| 4 | Flujos críticos | pendiente |
| 5 | Flujos secundarios | pendiente |
| 6 | Cola larga | pendiente |
| 7 | Regresión global | pendiente |

## Plantilla de microtarea

Cada microtarea declara, antes de tocar código:

- **Outcome** — resultado observable, no archivo tocado.
- **IN** — archivos permitidos, rutas, componente, dependencias.
- **OUT** — fuera de alcance: auth, backend no relacionado, rutas ajenas.
- **Preserve** — contrato de API, navegación, permisos, persistencia, validación.
- **Acceptance criteria** — lista numerada, verificable.
- **Browser scenarios** — ruta, rol, viewport, interacción, assertion.
- **Required evidence** — capturas, assertions, consola, red, persistencia si
  hay mutación.

## Registro

| ID | Superficie | Depende de | Estado | Evidencia |
|---|---|---|---|---|
| - | - | - | - | - |
