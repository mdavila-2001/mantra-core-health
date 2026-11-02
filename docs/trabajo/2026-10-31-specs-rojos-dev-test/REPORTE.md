# Reporte — Dos specs rojos en la suite de `dev` y `test`

> **AVANCE: 2 / 2 — 100 %.**

- Fecha: 2026-10-31 · Rama: `claude/lucid-volta-46naf7` (desde `dev` en `7159f4dd4`)
- Peldaño de evidencia: `TESTED` (cambio sólo de pruebas; no hay superficie de UI).

Suite completa por tandas sobre `dev` (`7159f4dd4`) y `test` (`c1785401c`):

| Falla | `dev` | `test` | Causa |
|---|---|---|---|
| `practitioner-profile.spec.ts`: 8 errores no capturados | sí | sí | dobles de `AuthService` sin `roles` |
| `attachment-dialog.spec.ts` «descartar sin nada pendiente sí anima» | sí | no | `motion.spec.ts` deja `matchMedia` en «reducir movimiento» |
| `standard-sheets.spec.ts` (375 ≠ 374) | sí | sí | entorno: el clon local de la API no tiene `transversal/cita-medica.json` (el `dev` de la API sí) — no se toca |

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Los tres dobles de `AuthService` del spec de `PractitionerProfile` traen `roles`, que el componente lee para «Mis verificaciones» | `ng test --include …/practitioner-profile` | antes: 7 archivos en verde pero **8 errors** (exit 1); ahora: 7 archivos, 224 pruebas, sin errores (exit 0) |
| H1.S1.M2 | `motion.spec.ts` restaura `window.matchMedia` y `Element.prototype.animate` por descriptor; `attachment-dialog.spec.ts` usa `reemplazarAnimate` | un solo hilo: `motion` + `attachment-dialog`; los siete juntos; tanda 5 de `dev` con 4 hilos | antes: `motion` + `attachment` → 1 fallido; ahora: 2/2, 7/7 (166 pruebas) y la tanda 185/185 (2741 pruebas) |

## A medias

Ninguna.

## Pendiente

Ninguna.

## Evidencia

```text
# practitioner-profile, spec viejo (HEAD~1) vs arreglado
spec viejo:   Test Files  7 passed (7) · Errors  8 errors   → exit 1
arreglado:    Test Files  7 passed (7) · Tests 224 passed    → exit 0

# attachment-dialog, un solo hilo (runnerConfig temporal maxWorkers: 1, sin commit)
antes:  attachment solo → 1 passed · motion.spec + attachment → 1 failed | 1 passed
        panel-motion / pointer-scene / route-transition + attachment → 2 passed
después: motion.spec + attachment → 2 passed (14 pruebas)
         motion + attachment + select/dialog/content-dialog/date-picker/tree-select → 7 passed (166 pruebas)

# la tanda 5 de dev que había fallado, con la configuración normal
Test Files  185 passed (185) · Tests  2741 passed (2741) → exit 0

eslint motion.spec.ts attachment-dialog.spec.ts → 0 · yarn typecheck → 0
```

## No cubierto

- La suite completa no se corrió de una vez: en este contenedor `ng test` se queda sin memoria.
- `standard-sheets.spec.ts` sigue rojo en este contenedor por el clon local de la API; con la API al día cuadra (375 = 375).

## Desvíos del plan

Ninguno.

## Riesgos residuales

- Otros specs redefinen `matchMedia` sin restaurarlo (`panel-motion`, `pointer-scene`, `route-transition`, `breakpoints`, `answer-faltantes`). Hoy no rompen a nadie; pueden hacerlo con otro reparto de hilos.

## Decisiones y ambigüedades

- `roles: []` en los dobles: con roles vacíos no se muestra «Mis verificaciones», que es lo que estas pruebas veían cuando el `computed` fallaba. Ninguna de ellas mide ese enlace.
