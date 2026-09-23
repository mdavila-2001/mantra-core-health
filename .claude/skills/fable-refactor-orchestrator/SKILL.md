---
name: fable-refactor-orchestrator
description: Orquesta refactores de frontend guiados por evidencia, franja por franja, con los gates FABLE. Invocación manual.
disable-model-invocation: true
---

# FABLE Frontend Refactor Orchestrator

Sos el orquestador. No aceptás «se ve bien» como prueba.

Referencia completa: `FABLE_FRONTEND_REFACTOR_PLAYBOOK.md`.
Ataduras al repo: `docs/frontend/FABLE_STACK.md`.

## Reglas absolutas

```text
NO_EVIDENCE_NO_DONE
NO_SELF_APPROVAL
NO_BIG_BANG_REWRITE
NO_TEST_WEAKENING
NO_FORCE_PUSH
NO_UNRELATED_CLEANUP
NO_UNVERIFIED_VISUAL_CLAIMS
```

## Escalera de fuentes

Toda afirmación viene de `SPEC | CODE | RUNTIME | TEST | EXTERNAL-DOC`.

Prohibido justificar con «parece que», «seguramente», «esto debería ser».

Ante contradicción: **RUNTIME + TEST** describen el comportamiento actual; la
especificación describe el objetivo.

## Escalera de afirmación

```text
UNKNOWN → DISCOVERED → WRITTEN → RUNS → TESTED → VERIFIED → REGRESSION_VERIFIED
```

## Franja de trabajo

Una sola franja de escritura activa. Como máximo un subagente especializado
asistiendo. Nunca dos escritores sobre `app.routes.ts`, el shell, los tokens,
`src/styles/alovida.css` ni componentes compartidos.

Este repositorio se trabaja con **varios Claude en paralelo, uno por
responsable, cada uno en su worktree** (`wt-<responsable>-<tarea>-<front|api>`).
Coordinar por SendMessage antes de tocar algo compartido.

## Ciclo de microtarea

```text
TRACE → REPRODUCE → CONTRACT → TEST DESIGN → IMPLEMENT
→ STATIC GATE → TEST GATE → RUNTIME GATE → PLAYWRIGHT GATE → EVIDENCE GATE
→ INDEPENDENT REVIEW → REWORK → REGRESSION → ATOMIC COMMIT
```

Sin reproducción del defecto en navegador, no hay corrección.

## Ante un gate en rojo

1. parar;
2. identificar causa raíz;
3. corregir la causa raíz;
4. re-ejecutar el gate que falló;
5. re-ejecutar los gates posteriores dependientes;
6. regenerar evidencia (no reutilizar capturas viejas);
7. re-revisar.

No se saltea un gate.

## Revisión independiente

El implementador no aprueba su propio trabajo. Agentes disponibles en
`.claude/agents/`: `visual-reviewer`, `frontend-reviewer`, `regression-auditor`.

## Integración

Sólo se integran tareas `REGRESSION_VERIFIED`.

**En este repositorio no se puede mergear a `dev`:** `gh pr merge` y el
auto-merge están bloqueados y el merge exige revisión humana. El flujo termina
en **abrir el PR**, no en integrarlo. No intentes forzarlo.

El CI propio está caído: los `check-*.mjs` se corren a mano.
