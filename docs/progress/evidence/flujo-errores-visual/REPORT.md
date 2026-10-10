# Prueba visual — errores visibles W1–W3 (#1026)

**Fecha:** 2026-10-09 · **Rama:** `mockup` (`origin/mockup`), maqueta en memoria, sin backend.
**Cómo se forzaron los fallos:** `sessionStorage['mock:fallos']` (`core/mock/fallos-simulados.ts`), que hace fallar en el interceptor de la maqueta las rutas que casan por subcadena.
**Navegador:** panel de navegador de Claude Desktop, uno solo. Viewports 1280×800 y 375×812; tema oscuro y claro en el tablero.

> Evidencia: texto literal leído del árbol de accesibilidad y capturas observadas en el panel, que **no quedaron guardadas como archivo**. Nivel: VERIFIED_FUNCTIONAL_ONLY para las pantallas marcadas PASS. No es una verificación visual completa en todos los viewports.

## Resultado por pantalla

| # | Pantalla | Fallo forzado | Resultado | Evidencia |
|---|---|---|---|---|
| 1 | Mi agenda (médica, `/schedule`) | `GET /scheduling/bookings` → error | **PASS** | Aviso «Parte de su agenda no se pudo cargar» con dos ítems: «No se pudieron cargar las citas del mes. (Código de soporte: mock-fallo)» y «…del día…», más el botón «Volver a cargar». |
| 2 | Mi agenda: reintento | Se quita el fallo y se pulsa «Volver a cargar» | **PASS** | El aviso desaparece y vuelven «8 de 8 horarios reservados» con las citas del día. |
| 3 | Panel de la médica (`/dashboard`), 1280 | `GET /scheduling/bookings` → error | **PASS** | «Algo salió mal · Simulado: fallo del servidor · Código de soporte: mock-fallo», con «Copiar código» y «Reintentar». No se pinta un día vacío. |
| 4 | Panel de la médica, 375 px, oscuro y claro | ídem | **PASS** | `scrollWidth − innerWidth = 0`. En claro, el aviso, el código y los botones se leen. |
| 5 | Mis vinculaciones (`/administration/medical-organization`, pestaña) | `GET` de `role-assignments`/`memberships` → error | **PASS** | Bajo «Mis vinculaciones» aparece «Algo salió mal» con el código de soporte. Ya **no** dice «Todavía no tiene vinculaciones». |
| 6 | Mi salud (paciente, `/dashboard`) | `GET /scheduling/bookings` → error | **PASS** | `role=alert`: «No pudimos traer su próxima cita. (Código de soporte: mock-fallo) Puede verla igual en Mis citas.». No dice «No tiene citas». |
| 7 | Mi salud: «Su última receta» | `GET /clinical/medication-requests` → error | **NO CONCLUYENTE** | La tarjeta siguió mostrando «19 de septiembre, 2026». Lee de otra ruta y no se identificó cuál. |

## Defectos encontrados (no corregidos acá)

1. **«No atiende este día» con la lectura caída** (criterio 12 y 14 de `55-criterio-humano.md`).
   - Si falla `GET /scheduling/bookings`, la tarjeta del día de *Mi agenda* dice «No atiende este día.» y pinta las franjas como «No disponible · Sin lugar», aunque la médica atiende de 08:00 a 12:00.
   - Origen: `src/app/features/agenda/my-agenda/day-view/day-view.ts:824`. El resumen se calcula solo con los cupos, que quedan vacíos cuando la lectura falla.
   - Lo atenúa el aviso de arriba («un día sin citas aquí no significa que esté libre»), pero el texto de la tarjeta afirma algo falso.
   - Arreglo sugerido: que `DayView` reciba si la carga quedó incompleta y, en ese caso, diga «No se pudieron cargar las citas de este día».
2. **Accesibilidad — pestañas sin nombre.**
   - En `/schedule`, las tres pestañas principales («Consultas», «Mis horarios», «Horarios de otros servicios») aparecen como `tab` **sin nombre accesible**.
   - En `/administration/medical-organization`, «Mis vinculaciones» aparece como `generic` y no como `tab`.
3. **Accesibilidad — enlaces sin nombre en `/auth`.** Los dos enlaces de registro (`/auth/register` y `/auth/register/organization-type`) no tienen nombre accesible.

## No verificado

- **Tablero contable C9–C11:** **no está en `mockup`**. Se mergeó en `dev` (#1038) y `test` (#1039), y en `mockup` no hay selector de cuenta de banco (`resumen.html`: 0 coincidencias). Verificarlo exige servir `dev` con la maqueta, o portar C9–C11 a `mockup`.
- **Receta (interacciones), anclaje de errores 422 a campos en el editor del médico y pantallas de dinero o social de W3:** no se recorrieron. El anclaje a campos necesita un 422 con `fieldErrors`, y el interruptor de fallos de la maqueta no lo genera.
- 768 px, y tema claro fuera del tablero.
