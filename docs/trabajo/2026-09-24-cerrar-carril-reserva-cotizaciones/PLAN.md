# Plan — cerrar el carril «reserva y Cotizaciones» (2026-09-24)

- Carril: `Noche-ReservaYCotizaciones.DirectorioYPrecios` (51 microtareas), reparto del 2026-09-22.
- Forma de trabajo: `CERRAR-EL-CARRIL-SIN-FRENOS.md` (Pablo, 2026-09-24) — código primero, un PR por
  hito a `mockup` y a `dev`, evidencia exhaustiva una sola vez al final.
- Corte: `origin/mockup` @ `4daf00aa3482f53476db29787775aad5b43a7e28` (2026-09-24 13:16 -04).
- Rama de trabajo: `justin/cerrar-carril-reserva-cotizaciones-2026-09-24`.
- **Rebase antes de los PRs** sobre `origin/mockup` @ `95472903` (entró el módulo médico, #621 y
  #623; ninguno toca archivos de este carril). Re-corrido tras el rebase: typecheck exit 0; specs
  focales 7 archivos / 131 tests; Playwright 4/4 (Cotizaciones, recorrido, estados, teclado). La
  medición, las capturas y la suite completa son del corte `4daf00aa` + este diff.
- Regla 7 (una máquina a la vez): `git ls-remote --heads origin 'justin/*'` a las 18:43 UTC — la
  última actividad ajena en ramas `justin/*` era de 15:37 UTC (módulo médico, Mac mini), fuera de
  este carril y a más de dos horas. Se arrancó.

## Punto de partida

29 / 51 HECHO (20 legados + 9 de #583) · 6 DESCARTADO (H4.S1.M1–M6) → **16 pendientes**.

Los 20 legados no tienen fila por ID (la adjudicación de #583 lo dice). La lista de 16 sale de la
tabla «Lo que falta» de la guía, que nombra 12 IDs (H2.S2.M1–M4, H3.S2.M2–M4, H5.S1.M1–M2,
H6.S1.M3–M5) más «H1.S2 y H2.S2: medición antes/después hasta cupos». Esos cuatro de medición son
**H1.S2.M1, H1.S2.M2, H2.S2.M5 y H2.S2.M6**: los únicos de H1.S2/H2.S2 cuyo DoD es una medición y que
ni el legado ni #583 cerraron. Supuesto declarado.

## Las 16 microtareas

| ID | Qué | Estado | Evidencia |
|---|---|---|---|
| H1.S2.M1 | Tabla del recorrido Directorio → ficha con cupos, peticiones y total | HECHO | #610 (2 escenarios × 10 muestras × 2 cortes) + `evidencia/medicion/resumen.json` (10 muestras sobre el corte final). Peticiones de negocio observables en la Red: 0 (el simulador es un interceptor en memoria) |
| H1.S2.M2 | Médico con semana vacía: cuántas lecturas dispara el «próximo hueco» | HECHO | `evidencia/medicion/lecturas-por-sede.md` |
| H2.S2.M1 | ¿`GET /scheduling/slots` admite filtro por profesional? (Q-J3) | HECHO | No: la API (`ListSlotsQueryDto`) y el doble aceptan un solo `resourceId`, ventana ≤ 92 días, `limit` ≤ 500, orden por inicio. Escrito en el JSDoc del componente |
| H2.S2.M2 | Lecturas por sede en paralelo, contadas | HECHO | spec «pide los cupos de todas las sedes en paralelo, una lectura por sede» (`HttpTestingController`) |
| H2.S2.M3 | «Próximo hueco» sin una segunda espera en serie | HECHO | spec «la única lectura cubre la semana visible y el horizonte» + «con la semana vacía ofrece el próximo hueco de la misma lectura» |
| H2.S2.M4 | Carga por sede (`role="status"`) y error por sede | A MEDIAS | spec «cada sede muestra su propia carga…» y «si una sede falla…»; la captura del estado transitorio no se obtuvo (ver REPORTE) |
| H2.S2.M5 | Medición después ≤ 50 % de antes | A MEDIAS | mediana 1428 → 992 ms (−31 %), no llega a −50 % |
| H2.S2.M6 | Repetir con la latencia nueva de Ender (Q-10: < 1 s) | HECHO | mediana 992 ms, 10 muestras |
| H3.S2.M2 | Origen para la distancia; cambiarlo recalcula | HECHO | spec «elegir un origen vuelve a consultar con ese punto» + capturas con «Tu casa» y km |
| H3.S2.M3 | Tabla con scroll vertical, paginación en cliente, columnas y acción ícono + texto | HECHO | `app-data-table` `maxHeight` + `app-pagination`; capturas 390/768/1440 × claro/oscuro; spec de la acción |
| H3.S2.M4 | Cuatro estados + «sin ubicación» + «precio no publicado» | A MEDIAS | los seis en spec; en captura, 4 de 6 (con datos, vacío, cargando, no publicado) |
| H5.S1.M1 | Lint y typecheck sin rojos nuevos | HECHO | `evidencia/gates.md`: lint 249 = 249, diff 0; typecheck exit 0 en los dos cortes |
| H5.S1.M2 | Test completo sin rojos nuevos | HECHO | `evidencia/gates.md`: final 1 rojo, previo |
| H6.S1.M3 | Brechas declaradas | HECHO | REPORTE §Brechas |
| H6.S1.M4 | Peldaño por área | HECHO | REPORTE §Peldaño |
| H6.S1.M5 | REPORTE con el avance primero y procesos | HECHO | `head -3 REPORTE.md` |

## Decisiones

- **Una lectura por sede que cubre semana + horizonte** en vez de dos lecturas (semana y, si vacía,
  próximo hueco). El DoD de H2.S2.M3 pedía el próximo hueco «en paralelo con la semana visible, no
  después», pero también «sólo cuando la semana está vacía»; con dos lecturas las dos cosas no se
  pueden a la vez. Con una sola, no hay segunda lectura nunca. Costo: la respuesta trae hasta 67
  días de cupos (tope 500); como la API ordena por inicio, el tope sólo puede recortar el horizonte.
- **Cotizaciones compone fuentes existentes** (alternativa «a» de H3.S1.M2): no hay un endpoint de
  «cuatro verticales por precio» y el carril prohíbe uno nuevo en la API.
- **El doble de farmacia leía `productIds`** y el contrato (y `PharmacyClient`) usa `products`: se
  corrigió en el doble —archivo reservado del carril—, no en el cliente.

## Fuera de alcance (anotado, no tocado)

- `app-link` en el tema oscuro de AloVida mide ≈ 3,4:1 (`rgb(18,113,159)` sobre `rgb(8,22,28)`):
  afecta a **todos** los enlaces, átomo compartido.
- El vacío de `app-view-state-host` titula «Todavía no hay nada acá» para todo: la descripción
  propia de cada pantalla es la que dice qué pasó.
- `mock-backend-latencia.spec.ts` rojo en la base.
