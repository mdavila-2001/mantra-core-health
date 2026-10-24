# Carril 16 · P0 · evidencia de la suite de cobro con seguro (frontend)

- Fecha: 2026-10-24 · Rama: `marcelo/lane16-insurance-ui` (base `origin/mockup` = `3cda242fd`)
- Plan y reporte: [REPORTE del carril](../../../../trabajo/2026-10-24-marcelo-lane16-front/REPORTE.md)
- Doble revisión de las capturas: [doble-revision.md](../../../../trabajo/2026-10-24-marcelo-lane16-front/evidencia/doble-revision.md)

## Qué prueba cada grupo

| Grupo | Archivo | Resultado |
|---|---|---|
| Médica cotiza el cobro, claro y oscuro (7 pruebas por tema) | `playwright/carril-16-cobro-con-seguro.spec.ts` | 14 en verde |
| Paciente ve el desglose y objeta, claro y oscuro (5 pruebas por tema) | idem | 10 en verde |
| Nombres de las capturas sin datos de la persona | idem | 1 en verde |
| Suite real de la operadora (AC-16-1 a 18, 375/768/1280 × claro/oscuro) | `playwright/carril-16-solicitudes-de-seguro.spec.ts` | **BLOQUEADO**: ver abajo |

## Comandos y salida

```text
$ E2E_BASE_URL=http://localhost:4200 corepack yarn playwright test playwright/carril-16-cobro-con-seguro.spec.ts --project=chromium --workers=1 --max-failures=1 --reporter=list
  25 passed (32.1s)
```

## Por qué la suite real está BLOQUEADA

La API local arrancó (puerto 3000, base PostgreSQL, MongoDB y Redis en contenedores). La semilla
`tools/alovida/seed-solicitudes-seguro.mjs` no puede sembrar: el login del administrador de arranque
responde 500 (`INTERNAL`). El log de la API no muestra la causa. Salida literal:

```text
✗ login del administrador → 500 {"code":"INTERNAL","message":"Error interno del servidor", ...,"path":"/iam/auth/login"}
✗ No se pudo entrar como admin@alovida.com.
```

La suite real quedó escrita y tipada (`corepack yarn typecheck` en verde), pero **no se ejecutó**. Su
resultado es desconocido, y no se afirma que pase.

## Capturas

Carpeta: esta misma. 26 PNG: `cotizacion-medico-cifras-*`, `cotizacion-medico-envio-*`,
`objecion-modal-1280-*`, `desglose-paciente-*`, `objecion-paciente-*`. Nombres sin datos de la persona.
