> **AVANCE (front): 12 / 13 microtareas — 92 %.** 1 en este cierre (PR). La revisión visual queda con reservas abiertas y sin una tercera pasada independiente.

# Reporte — Tarea 4 · campañas preventivas de la aseguradora (front)

- **Rama:** `marcelo/feat-insurance-preventive-campaigns` sobre `origin/dev` @ `9870b83a`.
- **Depende de:** el PR del modelo (`mantra-core-health-model` #31) y el de la API (`mantra-core-health-api` #469). En `dev` este front corre con `mockBackend: true`, así que funciona sin ellos y se comporta igual contra el simulador y contra la API real.
- **Contrato:** `mantra-core-health-api/docs/contracts/insurer-preventive-campaigns.md`.
- **Plan:** [`PLAN.md`](PLAN.md).

## Completado

| Hito | Qué quedó |
|---|---|
| H3 · cliente y navegación | Cuatro métodos en `InsuranceClient`, tipos, prefijo `/insurance-campaigns` en los tres archivos de proxy y despliegue, y la sección «Campañas preventivas» en el menú de la aseguradora |
| H3 · consola | Listado con filtros por tipo y estado en la URL, cursor, alta inline con validación en tiempo real, aliados repetibles y cambio de estado. «Finalizar» pide confirmación porque no se reabre |
| H4 · widget | Tarjetas con el sello «100% Cubierto por tu Seguro», aliados, vigencia y botón de acción, en el panel del paciente y en la pestaña de seguros de «Mi cuenta» |
| H4 · botón | Laboratorio, estudio y vacunación abren «Agendar una cita»; farmacia abre el directorio. La pantalla de turnos avisa por qué se agenda, con el título de la campaña |
| H4 · simulador | Handlers con cinco campañas: activa, borrador, pausada, vencida y de otra aseguradora |
| H5 · E2E | 21 escenarios en tres anchos, con objetivo táctil y sin desborde horizontal |

## A medias

- **Revisión visual con reservas.** Ver `evidencia/doble-revision.md`. Hubo dos pasadas independientes y correcciones tras cada una, pero la última recaptura la verificó quien implementó. Queda pendiente una tercera pasada independiente.

## Pendiente

- Nada del alcance. Revisión humana de los tres PR y merge en orden: modelo, API, front.

## Evidencia

En la carpeta `evidencia/`:

- `playwright-campaigns.txt` y 21 capturas `campanas-*.png`: 21 de 21 en 1440, 768 y 390 px.
- `doble-revision.md`: las dos pasadas de la Regla 35.
- `typecheck.txt`, `lint.txt`: 0 errores de TypeScript y 0 errores de lint en los archivos tocados.
- `unit-tests.txt`: suite unitaria completa, 586 archivos y 7603 pruebas.
- `prefixes.txt`: ambos verificadores de prefijos en verde.
- `pr/`: estado de los PR según GitHub.

Además, `ng build --configuration development` compila con el compilador estricto de plantillas, sin avisos en los componentes tocados.

## No cubierto

- **Contra la API real.** El front corre con simulador. No se ejerció contra el backend real: la API y el modelo están en sus propios PR sin integrar.
- **Tema oscuro y estado vacío del filtro** sin capturar.
- **Canje en farmacia.** No existe ruta de canje; el botón de una campaña de farmacia lleva al directorio de farmacias con la campaña como contexto.
- **Contraste medido con herramienta.** Se subió el token de las etiquetas del widget; no se midió.

## Desvíos respecto del plan

1. **Aviso de turnos con título y arriba de la pantalla.** El plan decía un aviso con el código; la revisión visual mostró que el código no le dice nada a quien agenda y que al fondo nadie lo veía. Se añadió el parámetro `campaignTitle`.
2. **El estado va en la celda del título, sin columna propia.** La columna robaba ancho en móvil.
3. **`data-testid` del envío.** `FormActions` no admite uno en su botón: el E2E lo localiza dentro de `campaign-form-actions`.
4. **Pruebas de listas cerradas de la aseguradora actualizadas** (`navigation.service`, `shell-layout`, y dos de `access-tree`): ahora incluyen la nueva sección.
5. **Sin PR contra `mockup`.** Solo `dev`, como pedía el encargo.

## Fallos que venían de `origin/dev`, corregidos en este PR

Medidos primero sobre un worktree limpio de `origin/dev`. Por pedido explícito se arreglan acá también:

| Fallo | Causa | Corrección |
|---|---|---|
| 2 pruebas de `shell-layout.spec` | «Cotizaciones» (b3af9887) se agregó al bloque clínico «Mi salud» y a las listas cerradas del menú no se les sumó | Pasa al bloque «Mis gestiones» (comparar precios es una gestión) y detrás de «Promociones» en el registro; listas actualizadas |
| `insurance-portability.handlers.spec`: 15 reclamos en vez de 14 | La Tarea 3 (36b5efb9) asignó `CLM-2026-0183` a la titular de demostración, y su certificado suma exactamente 3 reclamos reales | `CLM-2026-0183` pasa a otro afiliado de Seguros Andina; la prueba que lo usa solo lo consulta por identificador |
| `insurance-analytics.spec`: accesibilidad por tiempo | axe sobre el tablero tarda ~2,2 s sola y pasaba los 5 s por defecto con la suite completa en paralelo | Margen de 30 s con la causa escrita, la misma convención de `shared/components/a11y.spec.ts` |
| `check-api-prefixes` y `check-client-prefixes` | `/loyalty` faltaba en dos de las tres declaraciones y `POST /patients/me/reviews` no estaba ruteado | `/loyalty` y `/patients/me` en las tres; ninguna ruta del router empieza así |
| Lint `prefer-on-push` en `navigation.service.spec.ts` | Componente vacío de prueba sin estrategia | `OnPush` |

Resultado: la suite unitaria completa pasa (586 archivos, 7603 pruebas).

## Riesgos

| Riesgo | Estado |
|---|---|
| El contrato real difiere del simulador en algún detalle | El simulador reproduce 403, 409 y 422 y el aislamiento por titular y por aseguradora; falta ejercitarlo contra la API integrada |
| El widget vive en el bundle inicial del panel del paciente | Va en `@defer (on immediate)`; el build no reporta excedentes nuevos |
| El menú de la aseguradora gana una entrada | Coherente con el módulo de promociones del registro de procesos; listas cerradas actualizadas |

## Decisiones

- **D4.** La campaña se anuncia a todos los afiliados con cobertura vigente; la patología la describe y nunca filtra por historia clínica.
- **Widget con dos anfitriones.** Sin campañas, el panel principal no dibuja nada; la pestaña de seguros lo dice y ofrece reintentar.
- **PR a nombre de la cuenta de la máquina**, que es `PabloArauzCaballero`; por eso el revisor pedido es `jsaldias39`.
