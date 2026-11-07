# Carril B — Grid de servicios (solo lectura)

## Integración propuesta (NO registrada; la hace otra persona)

- Ruta: `administration/services-grid`
- Pantalla diferida (en `ADMIN_SCREENS`): `() => import('./services-grid/services-grid').then((m) => m.ServicesGrid)`
- Entrada de menú (`navigation.map.ts`): `{ path: 'administration/services-grid', label: 'Servicios por tipo', group: 'Administración', icon: 'tag', roles: ['SECURITY_ADMIN', 'BILLING'], availability: 'disponible', module: 'M17 billing' }`
- Añadirla también a la lista de `navigation.management.ts` junto a `administration/services-catalog`.
- Los roles son una sugerencia: la autoridad es la API.

## Estados

| Qué | Estado | Evidencia |
|---|---|---|
| Cliente (3 GET, mapeo a filas) | TESTED | `test-unit.log` (7 pruebas) |
| Pestañas Médico, Laboratorio (403), Hospital, Farmacia (parcial) en simulador | VERIFIED_FUNCTIONAL_ONLY | `capturas/DESPUES-*.png` (simulador, ruta registrada solo localmente y revertida) |
| Estado vacío S3 | TESTED (prueba unitaria); no se vio en navegador: el simulador trae filas | `services-grid.spec.ts` |
| Contra la API real | no se ejecutó | — |
| Modo oscuro, 768 px | no se ejecutó (solo 1440 claro y 390 claro) | — |

ANTES: `capturas/ANTES-services-catalog.png` (tabla de UNA práctica). La ruta nueva no existía.
Para registrar la ruta y capturar se parchó `admin.screens.ts` y `navigation.map.ts` en local y se revirtió; no entra en el PR.

## Hallazgos

1. `GET /diagnostics/lab/services` está tras `LabStaffGuard` en la API: un admin responde 403 (se ve en `DESPUES-2-laboratorio.png`). Hace falta decidir si el admin necesita una lectura propia del catálogo del laboratorio.
2. «Médico» muestra todo `/admin/catalogs/services` sin filtrar por tipo (columna «Tipo de organización»); no se inventó qué tipos cuentan como «médico». Decisión de negocio pendiente.
3. La paginación no existe: con `nextCursor`/`truncated` se avisa «Lista parcial».

## Gate (`scripts/pre-push-gate.mjs`)

Resultado: **BLOQUEADO — no se ejecutó completo, no hay PR ni push.**
- `node scripts/pre-push-gate.mjs run --base dev` responde: «front code changed: pass --pw <spec>».
- El spec debe vivir en `playwright/*.spec.ts` (fuera de la lista de archivos del carril) y la pantalla no es alcanzable sin registrar la ruta (fuera del carril). Se detiene y se reporta (regla 2).
- Pasos del gate corridos a mano: typecheck 0 errores (`typecheck.log`), eslint limpio (`lint.log`), `yarn build` exit 0 (`build.log`). Playwright del gate: no se ejecutó.
- Capturas hechas con `capturas.mjs` (Playwright, un navegador, sin `networkidle`; usa pausas fijas, por lo que el gate lo rechazaría como spec).
