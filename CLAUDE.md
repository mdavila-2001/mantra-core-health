# Mantra Core Health — frontend

Angular 21.2 standalone con señales, SSR, sistema de diseño propio (188 tokens),
Vitest 4, Yarn 4.18 PnP. Panorama completo: `docs/index.md`.

## Comandos

```bash
yarn lint          # eslint .
yarn typecheck     # tsc app + cypress + playwright, --noEmit
yarn build         # ng build
yarn test          # ng test (Vitest, 4985 pruebas, ~140 s)
yarn pw            # Playwright (18 specs en playwright/)
```

**Yarn 4 PnP.** No usar npm, no generar `package-lock.json`.

## Protocolo de calidad del frontend

Todo cambio de frontend sigue `FABLE_FRONTEND_REFACTOR_PLAYBOOK.md`, con las
ataduras a este repo en `docs/frontend/FABLE_STACK.md` (**esas mandan** cuando
discrepan del playbook).

Reglas absolutas:

- `NO_EVIDENCE_NO_DONE` — una afirmación visual necesita prueba de navegador.
- `NO_SELF_APPROVAL` — quien implementa no aprueba.
- `NO_BIG_BANG_REWRITE` — franja por franja, en orden de dependencias.
- `NO_TEST_WEAKENING`.
- Un refactor visual preserva comportamiento: autorización, navegación,
  contratos de API, persistencia, validación.
- Usar las primitivas existentes antes de crear una nueva.
- Las mutaciones se demuestran `UI → request → response → persistencia →
  recarga → UI`. Un toast no prueba nada.
- `LEAN_CODE_MAX_300` — escribir **única y exclusivamente las líneas de código necesarias**
  (cero sobre-ingeniería o boilerplate). Ningún archivo nuevo puede superar **300 líneas**.
  Archivos existentes > 300 líneas están congelados en `scripts/baselines/max-lines.json`
  y tienen prohibido crecer. Al tocarlos se descomponen en:
  - Subcomponentes subatómicos (Container Smart ≤ 150 lín., subcomponentes Dumb ≤ 120 lín.).
  - Plantilla `.html` y estilos `.css` separados.
  - Rutas y menús modularizados por dominio (lazy loading por módulo).
  - Orquestación en paralelo mediante la herramienta y skill `kman`.
- `PR_MANDATORY_ON_FINISH` — **Orden de Pablo (02/11/2026): Toda sesión que termine su tarea y valide sus gates debe empujar a remoto y ABRIR PULL REQUEST a `dev`. Prohibido dejar cambios pendientes en local o ramas sin PR.**



Skills locales que cargan estas reglas: `project-design-system`,
`visual-quality-gate`, `frontend-production-gate`,
`fable-refactor-orchestrator`.

Revisores en `.claude/agents/`: `visual-reviewer`, `frontend-reviewer`,
`regression-auditor`.

## Lo que hay que saber antes de tocar nada

1. **Los nueve estados M34 son contrato**, codificados en `ViewState<T>`
   (`docs/adr/ADR-0005-view-state-m34.md`). S1≠S2, S5≠S6, S3 exige próxima
   acción, S7 la antigüedad del dato, S9 el ID de petición.
2. **La autoridad es la API.** El frontend no autoriza. Ocultar un control no es
   seguridad.
3. **`tsc` no revisa las plantillas.** Una plantilla rota compila limpio y
   aparece como un 404 de ruta en ejecución.
4. **Sin Tailwind.** CSS plano con 188 custom properties
   (`docs/design-system/tokens.md`).
5. **Playwright contra `ng serve`:** nunca esperar `networkidle` — con HMR no
   llega y da verdes falsos. `testId` y `data-testid` caen en elementos
   distintos.

6. **Fichas y formularios: centrados, a lo ancho y en UNA tarjeta con
   pestañas.** Regla del cliente (09/09/2026). Nunca un bloque pegado a la
   izquierda con una columna vacía al lado, nunca un formulario acotado a una
   «medida de formulario», nunca tarjetas apiladas donde cabe una con
   pestañas. `docs/components/composition-rules.md` §5 tiene la receta y la
   forma de medirlo.

## Refactorización profesional UX/UI

Kit y trabajo en `docs/refactor-profesional/` (alcance y criterios en
`ESPECIFICACION_OBJETIVO.md`). Antes de continuar, leé `trabajo/ESTADO.md` y la
fase vigente. Cada afirmación de validación enlaza evidencia real o dice que no
se ejecutó. El kit se aplica **sobre** el protocolo de esta página, no en su
lugar (`trabajo/DECISIONES.md` D-01).

## Git

El merge a `dev` exige revisión humana: `gh pr merge` y el auto-merge están
bloqueados. El flujo termina en **abrir el PR**. El CI propio está caído; los
`check-*.mjs` se corren a mano.

**Un PR por cambio terminado, hacia `dev`.** La rama `test` está dada de baja
desde el 30/10/2026: no despliega nada y `test.alovidasalud.com` redirige a
`dev`, así que no se le abren PR. Si el cambio también va a `mockup`, lleva su
propio PR desde una rama creada sobre `mockup`, con solo los commits del cambio
(cherry-pick).

## Trabajo en paralelo (autorización explícita)

Por pedido del usuario (30/10/2026) para el portal de reportería
(`docs/trabajo/2026-10-30-reporteria-comercial-alovida/`), la regla 70 de la casa
(1 subagente, sin background) se relaja **sólo para esa tarea**: varios agentes en
paralelo, cada uno dueño de archivos **disjuntos** (una pestaña por agente). Se
mantiene: **un solo navegador de pruebas a la vez** y capturas en serie, y quien
implementa no aprueba su propio trabajo.

También por pedido del usuario (30/10/2026) para **AloVida Insights** como portal propio
(`docs/trabajo/2026-10-30-alovida-insights-portal/`): la misma relajación, en archivos disjuntos
entre el front, el API y el modelo. Mismas reservas: un solo navegador de pruebas y quien implementa
no aprueba su propio trabajo.
