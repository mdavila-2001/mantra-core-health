# Red clínica del paciente — integración, tanda 2

06/11/2026 · rama `claude/charming-cerf-q7sgmk` · commits `d88d9a3c7` (integración), `ebc2a3eb5` (profesionales de la demo) y el de
este reporte (retoques de panel y paso a paso + evidencia). Capturas tomadas después del último cambio de código. Lo reporta quien implementó; **no es una aprobación** (`NO_SELF_APPROVAL`).

## Qué se hizo

1. **Recorrido paso a paso en la red** (`patient-chart/red-clinica/superficie/`, nuevo):
   - `app-red-clinica-superficie` reúne filtros, alertas, «Recorrido paso a paso» y la red; el expediente sólo le pasa
     sus señales (el `.html` del expediente bajó de 842 a 826 líneas).
   - `guia-de-la-red.ts` (puro, con spec): `guiaDelExpediente` arma la entrada de `armarRecorridoGuiado` con las
     lecturas ya en pantalla (resumen, citas, derivaciones, estudios). `profesional` nombra sólo a quien mira (su
     perfil propio; ninguna lectura trae otros nombres). `servicioDeAtencion` **no** se pasa: la atención no trae
     servicio y deducirlo de la cita del día sería afirmar algo inferido. `visiblesDelPaso` = revelado ∩ filtros, nunca
     `[]` (para la red `[]` es «todos»: se usa un id centinela y se avisa «Lo que cuenta este paso no queda a la
     vista…»). `episodioPropuesto`: el del nodo abierto o, si no hay, el del filtro de hilo.
   - En cada paso la red recibe lo revelado, resalta `enfocar` y llama a `irANodo` (el principal queda último, a la
     vista). `pointerdown`/teclas (salvo Tab) sobre la red o un clic en una alerta → `interaccionEnLaRed` (pausa).
   - «Qué recorrer» (app-select) elige el episodio; al abrir viene propuesto. Salir restaura la red:
     `RecorridoClinico.plegado()` / `restaurarPlegado()` (desplegados, abiertos, desplazamiento del lienzo).
     `recorrido-clinico.ts` sigue en 600 líneas (se condensaron cuatro funciones para hacer lugar).
   - Banco de componentes: se retiró la variante «simulador» (redundante: el expediente lee lo mismo con los clientes
     reales). Quedan «historia», «episodio» y «vacío» como documentación del control aislado.
2. **Regla 6**: una `app-card` con franjas separadas por filete. Barra de filtros (`integrada`) y alertas
   (`compacta`) sin recuadro propio. Las alertas arrancan plegadas en un botón de divulgación dentro del `h2`
   («Para revisar · 5 alertas · 2 de prioridad alta», `aria-expanded`/`aria-controls`): ocupan 23 px (42 px a 390) en
   lugar de ~450. Profesional y especialidad se ocultan si sólo ofrecerían «Todos» (si hay un valor puesto, quedan
   para poder quitarlo); fechas se reparten el ancho sin columnas vacías. `app-recorrido-guiado` ganó `integrada`.
3. **Tipos y portal**: `MedicationRequest.replacedByRequestId?` (el resumen no publica el inverso: el recorrido lo
   deduce; se quitó la lectura tolerante de `replacesRequestId` y su prueba se reemplazó por la del caso que sí llega
   — receta nueva antes que la vieja en la lista). `PatientOrder.reasonConditionId?`; el simulador de
   `/diagnostic-results/me/orders` lo manda (sólo si existe). «Mi recorrido» lo lee directo. Los otros dos
   `INTEGRACION-FRANJA-2` se cierran con nota: **no** se delega en `agruparEnEpisodios` porque ese modelo infiere
   vínculos (`inferido-*`), une por concepto y reparte atenciones, y el portal, a propósito, sólo agrupa por vínculo
   declarado (decisión 3 de la Franja 5).
4. **Demo**: conceptos `MED-LEVOTIROXINA-25` y `-75` (`MEDICAMENTO_POR_CONCENTRACION`, aparte de `MEDICAMENTO` porque
   la vitrina pública exige ATC del catálogo); las farmacias simuladas también los venden (al final de la lista: los
   productos de siempre conservan precio y stock). Además: `bySlug` de `patient-network.data.ts` nunca encontraba a
   nadie (el slug sale del nombre) y la endocrinóloga, la neuróloga y la médica de guardia eran la médica de la
   sesión — la narración decía «Se derivó a Valeria Rojas Mendoza». Ahora se busca por clave (`hpid-<clave>`):
   «Se derivó a Ana Belén Terrazas Moreno…», «Se derivó a Carla Montero Ribera…».
5. **ADR**: fila de ADR-0022 en `docs/adr/index.md`; ADR-0022 actualizado sobre `replacedByRequestId`.
6. **Informe liberado para el profesional** (pedido del coordinador, API 8271ebc0):
   - `DiagnosticsClient.getPractitionerResult` (`releasedAt`/`issuedAt` → `Date`) y
     `downloadPractitionerResultFile` (nombre desde `Content-Disposition`); tipos `PractitionerDiagnosticResult`.
   - Simulador: las dos rutas, con `puedeLeer` (403) y un único 404 `DIAGNOSTICS_RESOURCE_NOT_AVAILABLE`
     (inexistente, otro paciente, sin liberar, archivo ajeno). Valores coherentes con cada conclusión de pid-paciente:
     TSH 8,9 (H «Alto») y T4L 0,68 (L «Bajo»), TSH 5,6 alta, TSH 0,09 baja con T4L 1,9 alta, hemograma normal,
     urocultivo anormal (texto); la ecografía sin valores.
   - Panel: con `pacienteId` y el `informeId` que ahora trae el detalle del estudio, lee el informe **al abrirlo**
     (una lectura por nodo, nunca por adelantado), con S1 «Leyendo los valores…», 403, 404 (S6), sin conexión y error
     con id de petición + «Reintentar» (S9); mientras tanto sigue diciendo «Resultado liberado». Muestra el rótulo de
     interpretación tal cual (sin mapear H/L); «fuera de rango» lo decide el número contra el rango impreso y se dice
     en texto (símbolo ↑/↓ y «fuera de rango» para lectores). `patientVisible: false` → «Liberado sin publicar al
     paciente.». El PDF baja por la ruta nueva (adiós `FilesClient.contentDataUrl` en el panel); sin paciente (banco)
     no se ofrece la descarga. `informeLeido` alimenta las alertas «fuera de rango» con lo ya leído.
   - Correcciones de diseño vistas en el navegador: el cuerpo y las secciones del panel eran rejillas de columna
     implícita y la tabla las ensanchaba (se recortaba la derecha en 1440); el botón de descarga con nombre largo se
     salía. En el recorrido guiado a 390 px, 34 segmentos de progreso desbordaban la página (454/390): en angosto se
     encogen sin mínimo.

## Comandos

| Comando | Resultado |
|---|---|
| `corepack yarn test` completo, de una vez | **No terminó**: el cgroup lo mata por memoria (~10 GB, `dmesg`: «Memory cgroup out of memory: Killed process (ng test)») con `--max-old-space-size=8192` y también con 6144. |
| Mismo `ng test`, todas las specs en 4 tandas (core+server+raíz · shared+account+clinical-record · admin+auth+support-access+access-governance+agenda · resto de features) | **18 893 pruebas, 1 331 archivos, 0 fallas** tras el último cambio de datos (5 538 · 5 487 · 1 948+1 777 · 4 143). |
| — en la primera pasada | 1 falla en `diagnostic-coverage.handlers.spec.ts` (cuenta órdenes de imagen pendientes de la paciente): **pasa sola** y pasó en la segunda pasada de la tanda; depende del orden (estado compartido del simulador entre archivos). |
| — tanda 2 | 8 «unhandled errors» `this.auth.roles is not a function` de `practitioner-profile.spec.ts`: **preexistentes**, se reproducen igual con el árbol limpio (`git stash`). |
| `corepack yarn lint` | 0 |
| `corepack yarn typecheck` | 0 |
| `corepack yarn build` | 0; avisos de presupuesto ya existentes (`patient-chart.css` 4,31 kB, `recorrido-clinico.css`, `red-clinica-panel.css` 6,6 kB) |
| `check-api-contract-drift` | las dos rutas nuevas documentadas en `backend-api.md` (el script sigue rojo por 59 rutas ajenas) |
| `check-max-lines` | `recorrido-clinico.ts` 600 (techo). `patient-chart.ts` 3 064 → 3 085 (+21: `guiaDeLaRed` e `informesLeidos`; ya estaba sobre su techo); `diagnostics.handlers.ts`, `diagnostics.client.ts`, `concepts.ts`, `pharmacy.handlers.ts` crecieron y ya estaban sobre techo |
| `check-css-tokens`, `check-colores-sueltos` | sin hallazgos en archivos tocados |

## Navegador

`ng serve --configuration development,demo --port 4300`, Playwright (`captura-tanda-2.cjs`), `deviceScaleFactor: 2`,
1440/768/390, claro y oscuro, sin `networkidle`. **121 aserciones ok, 0 fallas** (`aserciones-todo.txt`), consola
sin errores en las 12 sesiones.

- Composición: 0 tarjetas anidadas, borde 0 px en filtros y alertas, alertas plegadas (23 px), sin desplegables vacíos
  de profesional/especialidad, sin desborde horizontal (`*-01-superficie`, `*-02-alertas-desplegadas`).
- Paso a paso: el paso 1 deja 1 de 7 episodios y 7 nodos; paso 2 → 9, paso 4 → 12, paso 5 → 13; lo enfocado
  resaltado; salir devuelve los 7 episodios (`*-03-guiado-paso1..5`).
- Siguiendo Hipotiroidismo (desde el nodo abierto a ≥ 780 px; desde «Qué recorrer» bajo 780, donde el panel es hoja
  modal): «Paso 1 de 9», narración completa en `aserciones-todo.txt`; la receta de 25 mcg dice «Levotiroxina 25 mcg
  comprimidos» y cada reemplazo nombra la concentración correcta (`*-04-episodio-hipotiroidismo*`).
- Panel: TSH del 15 may 2025 → «Liberado el 17 de mayo de 2025 · 2 valores fuera de rango», TSH 8,9 ↑ Alto y
  T4 libre 0,68 ↓ Bajo con rango; nada recortado; descarga «Informe de TSH por quimioluminiscencia.pdf» (`*-05-*`).
- Paciente («Mi historia clínica» → «Mi recorrido», hilo Hipotiroidismo): 0 estudios «sin vínculo a este problema»;
  «Le pidieron TSH por quimioluminiscencia por Hipotiroidismo.», «Le pidieron Hemograma completo por Anemia
  ferropénica.»; el descarte ya no se narra como «resuelto» (frase de la Franja 5 recapturada); «Le recetaron
  Levotiroxina 25/50/75 mcg comprimidos para Hipotiroidismo.» (`paciente-*`).

## Pendientes

- **Suite completa en una sola corrida**: no cabe en la memoria del entorno; se corrió entera en tandas.
- Lo fuera de rango sólo se marca cuando el valor es numérico; un texto con interpretación del laboratorio
  («Urocultivo … Anormal») muestra el rótulo pero no cuenta como «fuera de rango» (no se mapean códigos).
- `servicioDeAtencion` sigue sin dato: las atenciones se narran «Tuvo una atención (ambulatorio)».
- La médica de la sesión se nombra a sí misma («con Valeria Rojas Mendoza»); los demás profesionales, sólo donde el
  contrato trae el nombre (destino de la derivación).
- No ejecutado: `yarn pw`, axe, lector de pantalla real, revisión independiente.
