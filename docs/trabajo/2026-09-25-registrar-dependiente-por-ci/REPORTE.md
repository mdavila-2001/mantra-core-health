# Reporte — Registrar dependiente por CI, con aceptación de la relación

> **AVANCE: 8 / 8 — 100 %.** (contra el simulador de `mockup`; la API real no tiene el endpoint)

- Fecha: 2026-09-25 · Plan: [PLAN.md](./PLAN.md) · Rama: `claude/dependiente-relacion-existente`
- Peldaño de evidencia: `VERIFIED` contra el simulador (unitarios + Playwright en el navegador).

## Qué cambió

- **Modal «Registrar dependiente»**: pide **sólo el CI**. Se quitaron nombre, apellidos, fecha de
  nacimiento, parentesco y departamento.
- **CI con cuenta** → se crea una solicitud y a esa cuenta le llega la notificación «Te quieren
  registrar como dependiente» (abre `Mi cuenta → Dependientes`).
- **CI sin cuenta** → junto al campo: «No hay ninguna cuenta registrada con ese CI.»
- Otros casos junto al campo: el propio CI (422), una solicitud ya pendiente (409), alguien que ya es
  dependiente (409).
- **Dependientes** muestra arriba «Te quieren registrar como dependiente» con **Aceptar / Rechazar**.
  Al aceptar, el titular pasa a tener a esa persona en su lista y recibe un aviso; al rechazar
  recibe el aviso y no se crea el vínculo.
- Simulador: endpoints `POST /profiles/patients/me/dependent-requests`,
  `GET …/dependent-requests/incoming`, `POST …/:id/accept`, `POST …/:id/reject`. Los pacientes del
  padrón con correo pueden entrar con su CI (cualquier clave) para poder aceptar.

## Completado

| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.M1–M5 | Contrato, simulador, modal sólo CI, bandeja | `yarn ng test --include …` (7 archivos) | 83 passed |
| H1.M6–M8 | Login del padrón, persistencia, E2E | `yarn playwright test playwright/b1-dependientes.spec.ts` | 4 passed |
| — | Tipos | `yarn typecheck` | exit 0 |
| — | Lint de lo tocado | `yarn eslint <archivos>` | exit 0 |

## A medias

ninguna

## Pendiente

| ID | Estado | Qué lo destraba |
|---|---|---|
| Backend real | TODO | La API no publica `dependent-requests`; fuera de `mockup` el modal respondería 404 («no hay cuenta»). Hay que implementarlo en la API con el mismo contrato. |

## Evidencia

```text
yarn ng test --watch=false --include <7 specs>
 Test Files  7 passed (7)
      Tests  83 passed (83)

E2E_BASE_URL=http://localhost:4391 yarn playwright test playwright/b1-dependientes.spec.ts --workers=1
  ✓ pedir por CI, aceptar desde la otra cuenta y verla en la lista
  ✓ el modal entra en telefono / tableta / escritorio
  4 passed

playwright/carril-insurance-portability.spec.ts (1440): 5 passed, incluido «actuando por un dependiente»
playwright/carril-insurance-portability.spec.ts (390): falla `screenshotWithoutOverflow` (ver Riesgos)
```

## No cubierto

- Tema oscuro y revisión visual doble de las capturas: no se hizo.
- La bandeja no se refresca sola si llega una solicitud con la pantalla abierta (se ve al entrar).

## Desvíos del plan

- H1.M6–M8 agregadas: sin login para otra cuenta de paciente el lado que acepta no se podía mostrar,
  y sin persistir los apoderamientos el vínculo se perdía al cambiar de cuenta.

## Riesgos residuales

- **Desborde de 13 px en teléfono, previo a este cambio**: el botón de cuenta de la cabecera
  (`app-header__account`) se sale del ancho en **todas** las pantallas (medido también en
  `/my-account/appointments`). Por eso fallan en 390 px los tests de portabilidad que miden el
  documento entero. No se tocó (fuera de alcance).
- El comentario de `carril-insurance-portability.spec.ts` que dice que `p-mamani` no tiene credencial
  quedó desactualizado: ahora puede entrar con su CI.

## Decisiones y ambigüedades (confirmar con quien pidió el cambio)

1. **CI sin cuenta**: se tomó «lo demás quitar del formulario» al pie de la letra; ya no se puede
   registrar desde acá a alguien sin cuenta (p. ej. un recién nacido).
2. **Parentesco**: al quitarse del formulario, el vínculo nace como «Otro/a».
3. **Privacidad**: la respuesta al pedir no revela el nombre del dueño del CI.
