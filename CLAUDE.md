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

## Git

El merge a `dev` exige revisión humana: `gh pr merge` y el auto-merge están
bloqueados. El flujo termina en **abrir el PR**. El CI propio está caído; los
`check-*.mjs` se corren a mano.
