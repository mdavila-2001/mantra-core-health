# Evidencia visual · Topología de la red de salud ALÓVIDA

## Resultado

**PASS para el cambio de topología en los dos tamaños registrados.** La ruta `/inicio` muestra ALÓVIDA al centro y seis actores. En 1440 px aparecen las seis conexiones; en 390 px las tarjetas se apilan, las líneas se ocultan y no hay desborde horizontal. La captura móvil conserva el encabezado y todo el diagrama en un recorte legible.

## Capturas revisadas

| Vista | Ancho | Resultado | Evidencia |
|---|---:|---|---|
| Escritorio, claro | 1440 px | 6 actores, centro y conexiones visibles | [red-salud-1440.png](fotos/red-salud-1440.png) |
| Móvil, claro | 390 px | 6 actores apilados, centro visible, sin scroll horizontal ni solapamiento del encabezado | [red-salud-390.png](fotos/red-salud-390.png) |

La captura de escritorio muestra el diagrama completo. La captura móvil incluye el encabezado y un recorte de 390 × 1450 px situado sobre la sección; el test comprueba que el diagrama entra en ese recorte antes de guardarlo.

## Verificaciones ejecutadas

- `corepack yarn typecheck` — PASS.
- `corepack yarn eslint playwright/alovida-health-network-topology.spec.ts` — PASS.
- `E2E_BASE_URL=http://127.0.0.1:4200 corepack yarn pw playwright/alovida-health-network-topology.spec.ts --workers=1 --reporter=list` — PASS, 1 prueba / 1 worker. Verifica los seis actores, el centro, conexiones de escritorio, conexiones ocultas en móvil y `scrollWidth` igual al viewport.
- `git diff --check` — PASS.
- El servidor local compiló con `ng serve`; mostró advertencias Angular existentes en componentes ajenos a este cambio. Se detuvo después de la prueba.

No se ejecutaron suites globales ni una instalación de dependencias: el disco continúa con 3,0 GB libres (99 % ocupado), y los resultados globales ya constan en los reportes de los carriles. Se compartió el `node_modules` existente porque los `yarn.lock` coinciden. `env:generate` informó que no había variables definidas; no se editó `.env`.

## Autorrevisión del diff

Checklist `.claude/agents/corr-revisor-codigo.md`, aplicado al diff suplementario:

| Ítem | Resultado | Observación |
|---|---|---|
| Alcance y sólo visual | PASS | Sólo spec y artefactos de evidencia; sin cambios de API, modelo, `.env` ni proxy. |
| Criterio comprobado | PASS | La prueba comprueba número de nodos, centro, líneas y ancho de documento. |
| Organismos y §6 | N/A | No se modificó una vista o composición de producto. |
| Tokens y modo oscuro | N/A | Sin CSS ni tokens nuevos. |
| Tests | PASS | No hay `skip`, aserciones retiradas ni tolerancias ampliadas; se agregaron aserciones de comportamiento. |
| Inglés y accesibilidad | PASS | Archivo, identificadores y variables en inglés; la prueba usa los grupos accesibles ya existentes. |
| Rutas | N/A | No se añadió ninguna ruta. |
| Comandos | PASS | Typecheck, ESLint focalizado y Playwright dirigido pasaron. |

**Veredicto del diff suplementario: APROBADO.** Esta evidencia cubre la sección de topología de este PR; no reemplaza la verificación de regresión global.
