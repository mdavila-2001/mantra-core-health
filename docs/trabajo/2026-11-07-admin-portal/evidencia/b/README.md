# Carril B — Grid de servicios (solo lectura)

## Integración

- Ruta REGISTRADA como hija en `src/app/routes/app.routes.hijas-admin.ts`: `administration/services-grid`, con `seccionRolesGuard` y roles `SECURITY_ADMIN`/`BILLING` (los de `services-catalog`; la autoridad es la API).
- NO registrada: entrada de menú ni `navigation.map.ts`. Propuesta para quien integre: `{ path: 'administration/services-grid', label: 'Servicios por tipo', group: 'Administración', icon: 'tag', roles: ['SECURITY_ADMIN', 'BILLING'], availability: 'disponible', module: 'M17 billing' }`, y sumarla a `navigation.management.ts`. Al hacerlo, quitar la ruta hija para no duplicarla.

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

Segunda corrida, con `--pw playwright/services-grid.spec.ts`: **PASS** (5 pasos: generate-env, typecheck, lint, build, playwright 4/4). Ver `gate.log`. Primeras corridas fallidas por: navegador del entorno (ver abajo) y dos errores míos del spec, corregidos en commits propios.
- Ajuste de entorno (no es del repo): `/opt/pw-browsers/chromium_headless_shell-1234` → symlink a la build `1243`, porque el Playwright del repo pide la 1234.
- La corrida final es sobre el commit que añade este README (solo docs).

## Archivos adicionales a la lista original (autorizados)
- `playwright/services-grid.spec.ts` (nuevo)
- `src/app/routes/app.routes.hijas-admin.ts` (+12 líneas, una ruta)

## Pruebas NO ejecutadas
- API real (todo fue contra el simulador). El 403 de laboratorio se vio en el simulador y por lectura de `LabStaffGuard` en el código de la API; no se probó con la API real.
- Estado vacío S3 en navegador (solo unitaria), modo oscuro, 768 px, la suite completa `yarn test`.
- `capturas.mjs` es un script de captura manual (usa pausas fijas): no es el spec del gate.
