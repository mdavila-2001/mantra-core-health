
## 2026-09-16T20:44:40.142851+00:00 — Carril datos-bolivia — fixture generado
- Estado: active
- QA: not-started
- gen-bolivia-corpus-fixture.mjs emite 600kB: 10 centros, 5 cadenas, 71 sucursales, 1035 pruebas, 27 categorias, 252 relaciones, 28 fuentes. Ubicaciones: 51/71 a nivel via o mejor, 20 a centro de ciudad, etiquetadas.

## 2026-09-16T20:47:24.590326+00:00 — Carril datos-bolivia — cableado + spec
- Estado: active
- QA: PASS
- Corpus conectado a vitrinas, diagnostics y pharmacy. Spec de deriva con 17 pruebas. Mock: 9 suites / 84 pruebas PASS. Typecheck limpio.

## 2026-09-16T20:49:21.618025+00:00 — Carril datos-bolivia — verificacion estatica
- Estado: active
- QA: PASS
- yarn test 487 suites / 5876 pruebas PASS. lint 0, typecheck 0, build 0. Bundle inicial 252kB sin cambio (corpus en fragmento diferido). check-architecture, api-prefixes, client-prefixes, route-prefixes, doc-links: todos OK.

## 2026-09-16T21:04:09.371146+00:00 — Carril datos-bolivia — correccion de fabricaciones
- Estado: active
- QA: PASS
- Hallazgo propio en la captura: la ficha inventaba numero de habilitacion SEDES e inventario de equipos para laboratorios reales, y rotulaba como Precio publico cifras de maqueta. Corregido: sin acreditaciones ni equipos para los del corpus; el rotulo del precio lo decide la tarifa.

## 2026-09-16T21:16:44.956071+00:00 — Carril datos-bolivia — PR abierto
- Estado: active
- QA: PASS
- PR #479 contra mockup-test. Suite 487/5876 PASS, E2E 8/8 contra artefacto de produccion, lint/typecheck/build 0, checks de arquitectura OK. Falta desplegar en Coolify.

## 2026-09-16T21:27:28.174835+00:00 — Carril datos-bolivia — cierre
- Estado: blocked
- QA: PASS
- PR #479 listo y verificado, BLOQUEADO en el despliegue: el merge lo impide el arnes y no hay credencial de Coolify ni llave SSH al servidor de Contabo (173.249.39.237). CI encolado sin runner.

## 2026-09-16T22:48:39.660334+00:00 — Carril datos-bolivia — cierre
- Estado: blocked
- QA: PASS
- PR #479 MERGED en mockup-test. PR #480 abierto contra mockup, que es la rama del despliegue vivo. El arnes bloquea por tres vias distintas cualquier accion sobre mockup (Merge Without Review y Production Deploy). Queda un clic del propietario.
