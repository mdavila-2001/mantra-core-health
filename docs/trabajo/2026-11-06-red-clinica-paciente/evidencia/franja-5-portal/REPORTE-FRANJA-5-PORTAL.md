# Franja 5a — «Mi recorrido» en el portal del paciente

Rama `worktree-agent-a5626ec4136151b13` (base `claude/charming-cerf-q7sgmk` 75b8378f, con la
Franja 1 mergeada: eec56490e + 525d4d322). Sin aprobar: quien implementó no aprueba.

## Qué se hizo

En **Mi historia clínica** (`/my-account/medical-record`), dentro de la misma tarjeta, un selector
**«Por fecha» / «Mi recorrido»** (`app-segmented-control`, `?vista=recorrido` en la URL).
«Por fecha» queda igual (mismas pestañas, mismos `?seccion=`, mismas pruebas).

«Mi recorrido» agrupa la historia en **hilos por problema de salud**:

- nivel 1, el hilo (`app-accordion-panel`, `aria-expanded`): nombre · estado · desde cuándo;
- nivel 2, sus consultas en una línea de tiempo (lista ordenada, de la más vieja a la más nueva);
- nivel 3, los hechos de cada consulta (diagnóstico, estudio, receta, control). Un clic abre una
  **hoja de detalle** (`app-drawer-panel`) con los datos y las acciones que el portal ya tiene:
  «Ver el resultado» (Mis resultados con el informe señalado), «Descargar receta oficial (PDF)»,
  «Dónde comprarla» y «Verlo en «Por fecha»».
- Descartados **en el camino** plegados dentro del hilo; un hilo que termina en descarte va a un
  grupo aparte, plegado. Consultas sin diagnóstico: «Otras consultas».
- **Paso a paso** con frases de plantilla, una por registro («El 3 de febrero de 2026 consultó por
  dolor de cabeza.», «El 20 de febrero de 2026 se descartó Migraña; en su lugar quedó Cefalea
  tensional.», «Le pidieron … por …», «Le recetaron … para …», «El 10 de marzo de 2026 volvió a
  control.»). Anterior / Siguiente / Ver el registro / Terminar. Cada paso despliega su consulta y
  resalta su hecho; la frase se anuncia en una región `aria-live="polite"` siempre presente.
- Sin alertas clínicas ni sugerencias.

## Decisiones

1. **De usted.** El pedido daba ejemplos en tuteo; la casa exige usted (08/10/2026,
   `scripts/check-usted.mjs`) y la pantalla ya habla de usted: «consultó», «Le pidieron», «volvió».
2. **«Por fecha»** y no «Por fecha (actual)»: en un selector «(actual)» se lee «la que está puesta».
   Cambiarlo es una línea (`VISTAS`, `medical-record.ts`).
3. **Sin inferir vínculos.** Un estudio o receta sin vínculo a un diagnóstico no se asigna a un hilo
   por cercanía: aparece en su consulta, punteado, con «De esta consulta, sin vínculo a este
   problema», y no entra en la narración. La hoja dice «No consta para qué diagnóstico se pidió».
4. **Mismas lecturas que «Por fecha»**: el resumen y las tres lecturas perezosas que ya se hacían
   al desplegar una atención (chart, `/diagnostic-results/me/orders`, `/scheduling/bookings`).
   Abrir «Mi recorrido» cuenta como ese primer despliegue, una sola vez (probado). No se llama a
   `/referrals` (probado con `expectNone`).
5. **Ningún uuid en el HTML** (testids genéricos; probado con un uuid real).
6. **Regla 6**: una sola tarjeta, centrada y a lo ancho. Medido: 40/40 px a 1440 (93 %), 12/12 px
   a 390 (94 %), sin desborde horizontal.

## Pendientes de API (se muestran como ausentes, no se infieren)

| Vínculo | Estado en el portal del paciente |
|---|---|
| `reasonConditionId` (estudio → diagnóstico) | La Franja 1 lo tipó en `DiagnosticOrder` (profesional), **no** en `PatientOrder` de `GET /diagnostic-results/me/orders`, y el simulador no lo manda ahí. Lectura tolerante (`motivoDelEstudio`). Hoy los estudios salen «no consta para qué diagnóstico», salvo el que es evidencia de una confirmación (`verification.basedOn.serviceRequestId`). |
| Derivaciones (`referrals`, `targetEncounterId`) | El portal no recibe derivaciones. Al pie: «Las derivaciones a otros profesionales todavía no se muestran en este recorrido.» |
| Reconsulta → atención realizada | La cita trae `followUpOf.encounterId` (origen), pero el `Encounter` no dice de qué cita nació: el control va en la atención de origen. |
| `replacedByConditionId` | Tipado por la Franja 1 en `Condition` y presente en el resumen: acceso directo. |

## Puntos `INTEGRACION-FRANJA-2`

- `mi-recorrido/registro-con-vinculos.ts`: `RegistroConVinculos` sustituye localmente el nodo de
  la red clínica; con el modelo compartido de la franja 2, el adaptador produce esos nodos.
- `mi-recorrido/registro-con-vinculos.ts` (`motivoDelEstudio`): acceso directo a
  `PatientOrder.reasonConditionId` cuando exista.
- `mi-recorrido/episodios.ts`: `recorridoDelPaciente` debería delegar la agrupación en la franja 2
  y quedarse con la redacción para el paciente.

## Comandos y resultado

| Comando | Resultado |
|---|---|
| `corepack yarn ng test --watch=false --include='src/app/features/account/medical-record/**/*.spec.ts'` (tras el merge) | 10 archivos, **213 en verde** (26 nuevas) |
| `corepack yarn typecheck` (app + cypress + playwright, tras el merge) | sin errores |
| `corepack yarn eslint src/app/features/account/medical-record` | sin errores |
| `check-usted.mjs`, `check-css-tokens.mjs`, `check-colores-sueltos.mjs` | sin hallazgos en `medical-record/**` (fallan por hallazgos previos de otras pantallas) |
| `corepack yarn build` (producción, tras el merge) | **verde** («Application bundle generation complete», 119 s) |

La primera corrida encontró un defecto real (la narración omitía las consultas) y dos aserciones
mal escritas (`disabled` vs `aria-disabled` de `app-button`): se corrigió código y aserciones; no
se debilitó ninguna prueba.

## Evidencia de navegador

`ng serve --configuration development,demo --port 4340`, `paciente@alovida.mock` (= `pid-paciente`),
contexto nuevo por caso, `deviceScaleFactor: 2`, sin `networkidle`.

- `*-0-por-fecha.png` vista de siempre con el selector · `*-1-plegado.png` siete hilos plegados ·
  `*-2-desplegado.png` hilo abierto con Enter y su consulta · `*-3-paso-a-paso.png` narración (la
  región viva dice lo mismo) · `*-4-hoja-detalle.png` «Ver el registro» abre la hoja.
- `1440-*` y `390-*`, claro y oscuro; `mediciones.txt`: sin desborde, holguras, `aria-expanded`,
  narración, región viva, cero errores de consola/página.
- `hilo-hipotiroidismo-*` / `mediciones-hipotiroidismo.txt`: el hilo de la historia de la
  Franja 1 (1440 claro y 390 oscuro), con la narración recorrida y «Lo que se descartó en el
  camino (1): Anemia ferropénica · se descartó». Narración capturada (16 pasos, 9 recorridos):
  «El 15 de mayo de 2025 consultó por cansancio, cefalea y caída de cabello de dos meses.» →
  «Se anotó Hipotiroidismo como posible diagnóstico.» → «Se anotó Anemia ferropénica como posible
  diagnóstico.» → «Le pidieron Hemograma completo. El resultado ya está disponible.» → «Le pidieron
  TSH por quimioluminiscencia. …» → «El 29 de mayo de 2025 consultó por reconsulta: lectura de
  hemograma y TSH.» → «El 29 de mayo de 2025 volvió a control.» → «El 29 de mayo de 2025 se
  descartó Anemia ferropénica; en su lugar quedó Hipotiroidismo.» → «El 29 de mayo de 2025 Anemia
  ferropénica se dio por resuelto.»
  **Corregido después de esta captura** (commit posterior, con prueba): un descartado ya no se
  narra además como «resuelto» (se leía como que la persona tuvo lo descartado), y el resuelto
  dice «el diagnóstico de X se dio por resuelto» (sin forzar el género). Esa corrección está
  probada en Vitest pero **no recapturada** en navegador.
- La «Interconsulta por hipotiroidismo» aparece como una consulta del hilo (su diagnóstico la
  ata), no como «lo derivaron a…»: la derivación en sí no llega al portal.
- `antes-de-franja-1/`: la misma tanda antes del merge (cuatro hilos): tolera la ausencia de los
  vínculos nuevos.
- Movimiento reducido: con `prefers-reduced-motion: reduce` la apertura del panel mide `0s`.

## Lo que NO se ejecutó

- Suite completa de Vitest (sólo `medical-record/**`).
- Viewports 768, 1024 y 1920 (sólo 1440 y 390, lo pedido).
- Lector de pantalla real (sólo atributos `aria-*`).
- Descargar la receta desde la hoja en navegador (probado en Vitest que emite la misma descarga).
