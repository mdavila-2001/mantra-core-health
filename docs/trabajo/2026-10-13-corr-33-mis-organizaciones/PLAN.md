# Plan — CORR-03: integrar «Mis organizaciones» en «Organización médica»

- Fecha: 2026-10-13 · Repos afectados: `mantra-core-health` · Predecesor: CORR-01 en curso
- Rama: `justin/mockup-corr-33-mis-organizaciones` sobre `origin/mockup`
- Resultado observable: el médico gestiona sus vinculaciones en la pestaña «Mis vinculaciones» del panel «Organización médica», con tabla, estados, vacío y formulario dentro del panel.
- Kill-test: la ruta redirige al panel pero este no carga las vinculaciones del médico ni permite pedir una.

## Alcance

- IN: inventariar el panel y el flujo actual; extraer la pestaña de vinculaciones; conectarla por `?tab=memberships`; redirigir la ruta anterior; retirar navegación/componente antiguos; ajustar el perfil; mantener contratos y permisos actuales.
- OUT: API, modelo, seeds; rediseño de otras pestañas; navegación de administrador ajena al flujo del médico.
- Decisión de entrada: el panel sigue fuera del menú del médico. El perfil de profesional ya retiró los enlaces sueltos por la directiva posterior C-01/C-02 (2026-09-20); queda disponible en «Tus accesos» conforme al árbol de acceso. No se reponen enlaces retirados después de esta ficha.
- Ambigüedades bloqueantes: ninguna indicada por TAREA-33 §3.

## H1 — Vinculaciones dentro de Organización médica

**CA:** Dado un médico con vinculaciones, cuando abre «Organización médica → Mis vinculaciones», entonces ve una tabla completa y puede iniciar una nueva vinculación; sin registros, ve el vacío con acción.
**DoD:** línea base y final fotográficas con `scripts/corr-evidencia.sh 33`; por microtarea, typecheck, lint dirigido y specs; regresiones, revisión visual, reporte y `fable-proof-check.py --lane 33`.
**Estado:** EN CURSO

### H1.S1 — Inventariar y construir la pestaña

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S1.M1 | Inventariar estado, tabs, cliente y permisos del panel destino | Índice de pestaña elegido y dependencias anotadas | `INVENTARIO.md` registra árbol actual, cliente, estados y decisión | HECHO |
| H1.S1.M2 | Extraer el flujo a `memberships-tab` con tabla, badge, vacío y acción | Lista, vacío, error, solicitud, código de soporte y cero `any` | Spec trasladado; typecheck y lint dirigidos | HECHO |
| H1.S1.M3 | Conectar la pestaña, retirar pantalla y redirigir la ruta vieja | `/my-organizations` redirige; referencias quedan sólo en la redirección | Specs dirigidos, `stock:generate`, typecheck y build | HECHO |
| H1.S1.M4 | Simplificar enlaces del perfil | Perfil sin enlaces sueltos según directiva posterior C-01/C-02 | Spec de perfil dirigido | VERIFICADO: 46 pruebas pasan |

### H1.S2 — Verificar el flujo

| ID | Microtarea | CA | DoD | Estado |
|---|---|---|---|---|
| H1.S2.M1 | Capturar y revisar estados con datos y vacío | Tabla y vacío legibles en tamaños acordados | Playwright del carril 33, fotos revisadas y `REPORT.md` | PARCIAL: 9 vistas claras PASS; 3 oscuras fallan por CORR-34 |
| H1.S2.M2 | Regresión y guard de evidencia | Sin rojos nuevos; todo lo pedido tiene evidencia | Suite, ruta de salud, matriz de roles y `fable-proof-check.py --lane 33` | PENDIENTE: suite global con 71 fallos; API apagada para route-health; guard ausente en el worktree |

## Riesgos y bloqueos previstos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El panel requiere roles administrativos | Expondría datos incorrectos o bloquearía al médico | La pestaña usará el cliente propio de vinculaciones; no el cliente de administración de tenants. |
| Consulta de vinculaciones vacías no existe en las fixtures | Captura inválida | Usar el modo `empty=1` definido por el carril sólo si su fixture ya está soportado; si no, añadir un fixture visual acotado con spec. |
