
## 2026-09-24T19:19:42.228681+00:00 — Carril portabilidad-aseguradora — S2.M1-M2
- Estado: HECHO
- QA: PASS
- M1 (cherry-pick copy honesto c1578610) y M2 (BUNDLE por defecto) verdes: 20/20. Sigo con M3 (no cerrar el dialogo en loading).

## 2026-09-24T19:24:33.619064+00:00 — Carril portabilidad-aseguradora — S2.M3
- Estado: HECHO
- QA: PASS
- M3 verde: 21/21 (attemptClose ignora dismissAttempt en loading, takeUntilDestroyed en la suscripcion del export). Sigo con M4 (objetivos tactiles).

## 2026-09-24T19:28:02.948567+00:00 — Carril portabilidad-aseguradora — S2.M4
- Estado: HECHO
- QA: PASS
- M4 verde: 21/21 (boton Copiar hash paso de size=sm a md, 44/40px por el sistema de diseno). Sigo con M5 (tipos + maqueta: encounters, schemaVersion/2, hash mayusculas en el mock).

## 2026-09-24T19:39:17.745728+00:00 — Carril portabilidad-aseguradora — S2.M5
- Estado: HECHO
- QA: PASS
- M5 verde: 13/13 (atenciones en el mock, schemaVersion string /2, perfil resuelto por patientProfileId real, verify insensible a mayusculas, historicos solo para PACIENTE de demo). Sigo con M6 (lane-29).

## 2026-09-24T19:47:40.922868+00:00 — Carril portabilidad-aseguradora — S2.M6
- Estado: HECHO
- QA: PASS
- M6 (lane-29) sustancial: testid duplicado resuelto, BEM de card/dialog/verify a ingles, formatos->formatOptions, vigentes->currentCount, enLaDireccion->hashFromRoute, identificadores del mock handler renombrados; 46/46 y typecheck 0. Residual declarado: helpers de los specs unitarios y del Playwright spec (montar/query/seleccionarFormato/etc.) sin renombrar por costo/riesgo vs beneficio, se deja para otro carril. Sigo con M7 (card: dependiente exporta el id del titular).

## 2026-09-24T19:51:39.296729+00:00 — Carril portabilidad-aseguradora — S2.M7
- Estado: HECHO
- QA: PASS
- M7 verde: 22/22 (nuevo test confirma que actuando por dependiente el dialogo recibe el patientProfileId del titular, nunca el del dependiente). Sigo con M8 (docs de ruta).

## 2026-09-24T19:52:25.972300+00:00 — Carril portabilidad-aseguradora — S2-front
- Estado: HECHO
- QA: PASS
- S2 front completo: M1-M8 verdes (46/46 combinados en las corridas parciales). Sigo con S3 (Playwright E2E) contra la maqueta.

## 2026-09-24T19:59:09.375007+00:00 — Carril portabilidad-aseguradora — S3-playwright
- Estado: EN CURSO
- QA: escribiendo
- E2E escrito: BUNDLE doble descarga + atenciones, dependiente exporta al titular, sin coberturas simulado con page.route (regla 65), objetivos tactiles en ready. typecheck 0. Levanto yarn start para correr contra la maqueta real.

## 2026-09-24T20:36:29.885231+00:00 — Carril portabilidad-aseguradora — S3-playwright
- Estado: HECHO
- QA: PASS
- S3 completo: 10/10 Playwright verde (BUNDLE doble descarga+atenciones, dependiente exporta al titular, touch targets ready, verify anonimo, teclado, JSON). M3 (sin coberturas) queda BLOCKED con causa raiz real documentada en el spec (interceptor mock no genera trafico de red, ningun login sin coberturas existe). Doble revision de 4 capturas: 3 APROBADA, 1 ACEPTABLE CON RESERVAS (toast cosmetico). Cierro ng serve y sigo con S1.M7 (int-spec Neon).
