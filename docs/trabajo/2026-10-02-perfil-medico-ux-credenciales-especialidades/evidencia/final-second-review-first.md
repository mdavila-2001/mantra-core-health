# Segunda revisión independiente — primera matriz final

- Revisor: `/root/review_profile_ux`, independiente del implementador.
- Registro: 2026-10-03; revisión de la primera matriz final encargada después del cierre de P1 en [doble-revision.md](./doble-revision.md).
- Método: apertura individual mediante `view_image` de las 32 imágenes de `capturas/` y los dos diagnósticos adicionales. No se ejecutaron navegadores, pruebas ni compilaciones; no se modificó producto.
- Resultado de esta matriz: **10 APROBADA, 20 ACEPTABLE CON RESERVAS, 2 RECHAZADA**. Las dos rechazadas requieren corrección, recaptura y ambas pasadas; este documento conserva el resultado anterior a la corrección.
- Origen comunicado por el agente principal: build de producción, `e2e-isolated-final.txt` y `e2e-public-captures.txt`. Cuatro GET auxiliares simulados vacíos (`signature-assets`, `insurance-networks`, `insurance-carriers`, `service-offerings`); los demás datos de perfil y archivos usan la API real. Los veredictos siguientes son visuales sobre **UI aislada**, no certifican integración completa.
- La actualización posterior de `dev` y el nuevo campo de Facturación no quedan verificados por estas imágenes. Las recapturas públicas posteriores se revisarán por separado; no heredan esta evaluación.

## Hallazgos

| ID | Severidad | Evidencia y efecto | Tratamiento |
|---|---|---|---|
| V1 | MAYOR | En ambas capturas públicas de 390 px, el sello «Especialidad pendiente de verificación» cruza el borde derecho de su insignia de Cardiología. El contenedor ocupa aproximadamente x57–333 y el sello x70–346. Sigue dentro del viewport, pero la composición está visiblemente desbordada. | RECHAZADA. El principal conserva originales en [public-specialty-overflow-claro.png](./diagnostico/public-specialty-overflow-claro.png) y [public-specialty-overflow-oscuro.png](./diagnostico/public-specialty-overflow-oscuro.png). Corrección comunicada en el host `.profesional__especialidades`; su resultado no fue evaluado en esta pasada. |
| V2 | MENOR | Datos personales muestra «Spanish clinical language» y «Native language proficiency»; la portada pública conserva la primera etiqueta. Mezcla de idiomas en una interfaz en español. | Reserva heredada del catálogo, registrada sin cambiar datos o contratos dentro de esta revisión. |
| V3 | MENOR | Después de Actividad actual y Experiencia histórica aparece una tercera tabla laboral, con otro buscador y las mismas instituciones, sin título que distinga su finalidad de edición. Los botones Editar/Retirar aclaran su propósito en escritorio; en móvil son menos evidentes por las columnas plegadas. | Reserva de jerarquía; las agrupaciones solicitadas, estados y controles siguen visibles. Sugerencia: titular explícitamente la sección de gestión. No se editó producto. |
| V4 | MENOR | La captura fullPage del modal incluye fondo sin máscara fuera del viewport capturado, aunque el diálogo y la porción visible del viewport sí están cubiertos correctamente. | Reserva de presentación de la evidencia, no demostración de un fallo del modal. Preferir una captura del viewport para explicar ese estado. |
| V5 | MENOR | En Credenciales públicas de 1024, 1440 y 1920 px permanece el encabezado «ACCIONES» con celdas vacías. No hay descarga ajena, pero ocupa ancho sin aportar una acción. | Reserva de densidad; podría omitirse la columna cuando ninguna fila tenga acciones. No impide leer el contenido. |

## Veredicto individual de las 32 imágenes

Los nombres conservan viewport y tema; las imágenes fullPage tienen mayor altura que el viewport. Las filas identifican los archivos tal como se abrieron en esta primera matriz. Las dos imágenes de V1 están preservadas en `diagnostico/`; las recapturas que sustituyan archivos de `capturas/` no quedan aprobadas por este registro.

| Archivo en `capturas/` | Severidad máxima | Veredicto P2 | Observación concreta |
|---|---|---|---|
| cancelacion-390x844-claro.png | MENOR | ACEPTABLE CON RESERVAS | Diálogo completo, opciones inequívocas y foco visible en Seguir editando. V4: fondo fuera de viewport sin máscara en fullPage. |
| datos-propios-390x844-claro.png | MENOR | ACEPTABLE CON RESERVAS | Idioma, nivel e interpretación presentes; estados vacíos explicados y campos legibles. V2: etiquetas inglesas. |
| listados-390x844-claro-credenciales.png | Ninguna | APROBADA | Título y estado juntos sin romper palabras; grupos Matrículas/Títulos, conteo 13/0/13 y paginación dentro del ancho. |
| listados-390x844-oscuro-credenciales.png | Ninguna | APROBADA | Mismo contenido y controles legibles en oscuro; pendiente no se presenta como aprobado. |
| listados-768x1024-claro-credenciales.png | Ninguna | APROBADA | Primaria y despliegues de detalle legibles; los controles se acomodan dentro del panel. |
| listados-768x1024-oscuro-credenciales.png | Ninguna | APROBADA | Encabezados, sellos y controles distinguibles; sin texto horizontalmente cortado. |
| listados-1024x768-claro-credenciales.png | Ninguna | APROBADA | Columnas de detalle/fuente/acciones legibles y resumen coherente con pendientes. |
| listados-1024x768-oscuro-credenciales.png | Ninguna | APROBADA | Estado y título contrastan con el fondo; fuente y paginación no se solapan. |
| listados-1440x900-claro-credenciales.png | Ninguna | APROBADA | Distribución amplia y números de registros visibles; sin especialidades ni idiomas dentro de Credenciales. |
| listados-1440x900-oscuro-credenciales.png | Ninguna | APROBADA | Sellos pendientes y datos secundarios conservan legibilidad en tema oscuro. |
| listados-1920x1080-claro-credenciales.png | Ninguna | APROBADA | Todas las columnas caben; títulos/estados y conteos mantienen jerarquía clara. |
| listados-1920x1080-oscuro-credenciales.png | Ninguna | APROBADA | Panel, encabezados y controles diferenciados; sin superposición de avisos. |
| listados-390x844-claro-trayectoria.png | MENOR | ACEPTABLE CON RESERVAS | Actividad actual e histórica diferenciadas; cargos largos ajustan a palabras. V3: tercera tabla sin título propio. |
| listados-390x844-oscuro-trayectoria.png | MENOR | ACEPTABLE CON RESERVAS | Sellos y despliegues visibles en móvil oscuro. V3: propósito de tercera tabla poco explícito. |
| listados-768x1024-claro-trayectoria.png | MENOR | ACEPTABLE CON RESERVAS | Grupos y paginaciones caben; declarado separado de En curso. V3 persiste. |
| listados-768x1024-oscuro-trayectoria.png | MENOR | ACEPTABLE CON RESERVAS | Contraste legible y ambos grupos presentes. V3: tercera tabla repite registros sin encabezado de gestión. |
| listados-1024x768-claro-trayectoria.png | MENOR | ACEPTABLE CON RESERVAS | Período separado del sello; acciones Editar/Retirar visibles. V3 persiste. |
| listados-1024x768-oscuro-trayectoria.png | MENOR | ACEPTABLE CON RESERVAS | Estados y acciones legibles sin avisos encima. V3: falta encabezado de tercera tabla. |
| listados-1440x900-claro-trayectoria.png | MENOR | ACEPTABLE CON RESERVAS | Instituciones, cargos y período caben; controles de los tres listados visibles. V3 persiste. |
| listados-1440x900-oscuro-trayectoria.png | MENOR | ACEPTABLE CON RESERVAS | Declarado no se confunde con En curso; contraste legible. V3 persiste. |
| listados-1920x1080-claro-trayectoria.png | MENOR | ACEPTABLE CON RESERVAS | Actual 11 e histórica 1 diferenciadas; acciones propias legibles. V3: tercera tabla sin título. |
| listados-1920x1080-oscuro-trayectoria.png | MENOR | ACEPTABLE CON RESERVAS | Tablas y controles caben; explicación de vínculo declarado no simula aprobación. V3 persiste. |
| public-390x844-claro-credentials.png | MAYOR | RECHAZADA | V1: sello de especialidad sale de la insignia de Cardiología. V2: etiqueta inglesa. Credenciales sí contiene sólo matrícula y títulos. |
| public-390x844-oscuro-credentials.png | MAYOR | RECHAZADA | V1 también visible en oscuro: el sello cruza el borde derecho. V2 persiste. |
| public-768x1024-claro-credentials.png | MENOR | ACEPTABLE CON RESERVAS | Avatar de cabecera completo dentro del viewport; especialidad queda en portada y el sello cabe. V2: idioma en inglés. |
| public-768x1024-oscuro-credentials.png | MENOR | ACEPTABLE CON RESERVAS | Cabecera y panel completos; sellos y controles legibles. V2 persiste. |
| public-1024x768-claro-credentials.png | MENOR | ACEPTABLE CON RESERVAS | Resumen 7/0/7 coherente con pendientes; detalle de seis títulos y matrícula separados. V2/V5. |
| public-1024x768-oscuro-credentials.png | MENOR | ACEPTABLE CON RESERVAS | Credencial, detalle y fuente legibles; no aparece descarga de respaldo ajeno. V2/V5. |
| public-1440x900-claro-credentials.png | MENOR | ACEPTABLE CON RESERVAS | Especialidad en portada; panel sin especialidades y sin acciones de descarga. V2/V5. |
| public-1440x900-oscuro-credentials.png | MENOR | ACEPTABLE CON RESERVAS | Sellos pendientes visibles; la fuente no afirma aprobación. V2/V5. |
| public-1920x1080-claro-credentials.png | MENOR | ACEPTABLE CON RESERVAS | Cabecera, secciones y paginación dentro del ancho disponible. V2/V5. |
| public-1920x1080-oscuro-credentials.png | MENOR | ACEPTABLE CON RESERVAS | Conserva legibilidad y separación de resumen/panel en oscuro. V2/V5. |

## Diez preguntas adversariales

Se agrupan por pantalla porque las celdas de cada grupo tienen el mismo contenido y estado, variando viewport y tema. Todas fueron abiertas individualmente; las diferencias concretas están en la tabla anterior. Los grupos son: Credenciales propias (10), Trayectoria propia (10), Credenciales públicas (10), Datos propios (1) y Cancelación (1).

### Credenciales propias — 10 celdas

1. **Primer defecto visible:** ninguno en el panel de esta matriz. El antiguo título partido ya no aparece; título y estado comparten la primaria.
2. **Cortes o solapamientos:** no se observa recorte horizontal. El corte de filas al fondo coincide con el contenedor vertical de alto limitado; no es evidencia de pérdida de registros. Las pestañas parcialmente visibles en móvil indican el carrusel horizontal, con controles.
3. **Aspecto terminado:** títulos, agrupaciones y controles consistentes; el contenido repetido corresponde a datos de prueba.
4. **Coherencia con pantallas vecinas:** tipografía, bordes, sellos y paginación coinciden con Trayectoria y ficha pública.
5. **Tema oscuro:** sellos pendientes, texto principal y controles siguen legibles en las cinco celdas oscuras; no se observan bloques blancos imprevistos.
6. **Vacío/error/carga:** la matriz muestra listas cargadas. No representa error de descarga, ausencia de resultados ni espera de red; esos estados no se certifican por estas imágenes.
7. **Jerarquía:** Matrículas y Títulos se separan claramente; filtros y controles de página identificables. En móvil los detalles tienen despliegue visible.
8. **Datos:** nombres e instituciones explícitamente sintéticos; no se observan contenidos clínicos ni credenciales de acceso.
9. **Requisito:** agrupación sin especialidades/idiomas y formato denso de doce formaciones demostrados visualmente; conteos de pendientes coherentes. Una imagen no prueba recorrido de todas las páginas.
10. **Motivo para rechazar:** no se encontró un defecto visual abierto en estas diez celdas. Se rechazaría usarlas para afirmar descarga, autorización o integración total, porque esos comportamientos no se deducen de un PNG.

### Trayectoria propia — 10 celdas

1. **Primer defecto visible:** tercera tabla sin título diferenciador, V3; visualmente repite instituciones después de los dos grupos.
2. **Cortes o solapamientos:** cargos largos ajustan por palabras; no hay avisos encima de registros. El corte inferior corresponde al área de scroll vertical, sin invasión horizontal de controles.
3. **Aspecto terminado:** controles y filas son consistentes; la sección de gestión necesita aclarar mejor su propósito, reserva menor.
4. **Coherencia:** usa los mismos sellos, tabla y paginación que Credenciales; no introduce otro lenguaje visual.
5. **Tema oscuro:** declarado, períodos y textos secundarios se distinguen en las cinco variantes oscuras; la reserva V3 es de jerarquía, no contraste.
6. **Vacío/error/carga:** estas celdas sólo presentan registros cargados. No hay una captura de error ni de filtro sin resultados en esta matriz.
7. **Jerarquía:** Actividad actual y Experiencia histórica guían la lectura; la tercera tabla carece de encabezado. Editar/Retirar visibles en escritorio; móvil usa columnas plegables.
8. **Datos:** instituciones y cargos sintéticos, sin datos clínicos ni adjuntos laborales ficticios.
9. **Requisito:** ambos grupos permanecen; verificación Declarado y vigencia En curso son conceptos separados. Botones y páginas visibles no prueban por sí solos permisos ni navegación.
10. **Motivo para rechazar:** no hay defecto visual mayor observado en estas diez celdas; se conserva V3 y no se certifica accesibilidad interactiva o permisos sólo con capturas.

### Credenciales públicas — 10 celdas

1. **Primer defecto visible:** en 390 px el sello sale de la insignia de especialidad (V1), tanto claro como oscuro. En tamaños mayores quedan la etiqueta inglesa V2 y, desde 1024, la columna vacía V5.
2. **Cortes o solapamientos:** V1 desborda su contenedor aproximadamente 13 px, aunque no sale del viewport. La cabecera ya cabe incluso a 768 px. Filas inferiores se recortan por el scroll vertical previsto.
3. **Aspecto terminado:** las dos celdas de 390 px requieren corregir V1. Las demás tienen reservas menores, sin texto principal roto ni avisos encima.
4. **Coherencia:** sellos y tabla comparten estilo con ficha propia; las especialidades se conservan sólo en portada. La columna ACCIONES vacía es innecesaria.
5. **Tema oscuro:** el desbordamiento de 390 también se ve en oscuro, no se excusa por tema. En tamaños restantes los sellos y textos siguen legibles.
6. **Vacío/error/carga:** Sin seguros informados y Todavía no publicó horarios tienen explicación. El vacío de seguros se capturó con auxiliares simulados y no demuestra integración real con aseguradoras. No se ve un estado de error de descarga.
7. **Jerarquía:** portada contiene especialidad; Credenciales agrupa matrícula y seis títulos. Filtros 7/0/7 y controles de página claros; acciones vacías añaden ruido menor.
8. **Datos:** perfil Prueba Listados e instituciones sintéticas; no se muestran historias clínicas, tokens ni enlaces de respaldos privados.
9. **Requisito:** no hay detalle de especialidades dentro de Credenciales; resumen en portada conservado. No aparece control de descarga ajena. Su ausencia visual no acredita autorización del servidor.
10. **Motivo para rechazar:** V1 basta para rechazar las dos celdas públicas de 390 px. Las ocho restantes quedan aceptables con reservas; no se extiende su resultado a la integración total ni a recapturas posteriores.

### Datos propios — 1 celda

1. **Primer defecto visible:** V2, nombres de idioma y nivel en inglés dentro de la interfaz en español.
2. **Cortes o solapamientos:** valores y rótulos caben en el panel móvil; no hay aviso superpuesto ni texto horizontalmente recortado.
3. **Aspecto terminado:** estructura estable; la traducción del catálogo queda como reserva heredada.
4. **Coherencia:** mismas tarjetas, encabezados y estados del perfil; idiomas aparece en Datos personales.
5. **Tema oscuro:** no aplica a esta imagen clara; no hay captura de esta pantalla en oscuro en la matriz entregada a P2.
6. **Vacío/error/carga:** campos sin registrar y activos gráficos ausentes tienen explicación; no se interpreta un vacío auxiliar simulado como integración completada.
7. **Jerarquía:** información personal agrupada y Editar perfil localizable; idiomas conserva idioma, nivel e interpretación.
8. **Datos:** identidad de prueba; no hay información clínica sensible.
9. **Requisito:** traslado de Idiomas demostrado en esta celda; la ausencia dentro de Credenciales se observa en las otras diez celdas propias.
10. **Motivo para rechazar:** no hay defecto mayor visible; V2 reduce la nota. Esta única captura no cubre otros temas, viewports o persistencia.

### Cancelación — 1 celda

1. **Primer defecto visible:** V4, el fullPage muestra partes del editor fuera del viewport sin la máscara; no confundir esa representación con un modal permeable.
2. **Cortes o solapamientos:** el diálogo cabe con márgenes laterales, título y texto completos; los dos botones no se pisan.
3. **Aspecto terminado:** modal coherente con producto; el formato fullPage de la evidencia es menos claro que una captura del viewport.
4. **Coherencia:** tipografía y acciones corresponden al editor; la acción destructiva se diferencia de continuar.
5. **Tema oscuro:** no aplica a la imagen clara; no se aporta su equivalente oscuro en esta matriz.
6. **Vacío/error/carga:** el diálogo explica que se pierde lo cambiado. El indicador del editor al fondo no prueba que esté guardando ni que el descarte persista.
7. **Jerarquía:** Seguir editando y Descartar son inequívocos; foco visible en Seguir editando. La imagen no demuestra el ciclo completo de teclado.
8. **Datos:** editor de cuenta de prueba; sin tokens, archivos privados ni datos clínicos.
9. **Requisito:** confirma la existencia y legibilidad de la confirmación. Rechazar, aceptar, conservar borrador y recargar requieren evidencia funcional adicional.
10. **Motivo para rechazar:** no se identifica fallo geométrico del diálogo; queda V4 como reserva de evidencia. Se rechazaría afirmar focus trap o persistencia sólo a partir de esta captura.

## Dos diagnósticos adicionales — no son entrega

Los archivos siguientes se abrieron por separado. Estos veredictos no sustituyen ni contaminan el conteo de 32 imágenes anterior.

| Archivo | Severidad | Veredicto | Observación |
|---|---|---|---|
| [modal-tab-boundary.png](./diagnostico/modal-tab-boundary.png) | MENOR / límite de evidencia | ACEPTABLE CON RESERVAS | Modal móvil completo, texto y botones legibles, máscara cubre el viewport. No se ve anillo de foco en esta instantánea; no permite atribuir el foco al diálogo, navegador o fondo ni demostrar una fuga. El análisis funcional referido por P1 es evidencia separada. |
| [public-header-overflow.png](./diagnostico/public-header-overflow.png) | MAYOR | RECHAZADA | Avatar superior derecho se recorta en el borde de 768 px; la cabecera no cabe. El panel de credenciales permanece legible. En las imágenes finales de 768 abiertas en esta P2 el avatar sí aparece completo en una segunda fila; el diagnóstico preserva el defecto anterior. |

### Preguntas adversariales — diagnóstico del modal

1. **Primero mal:** no se identifica qué elemento tiene foco porque no aparece anillo en esta instantánea.
2. **Texto cortado:** no; diálogo y botones caben con margen.
3. **Terminación:** estructura visual consistente, sin superposición sobre el propio texto del diálogo.
4. **Coherencia:** mismas acciones y contenido de la captura final de confirmación.
5. **Oscuro:** no aplica, imagen clara; no cubre variante oscura.
6. **Estados:** explica consecuencia del descarte; no representa error ni vacío.
7. **Jerarquía:** Descartar destacado y Seguir editando separado; foco actual indeterminado visualmente.
8. **Datos:** formulario sintético, sin contenido clínico.
9. **Requisito:** muestra confirmación, no preservación del borrador ni comportamiento en frontera de Tab.
10. **Rechazo:** rechazaría usarla como prueba de focus trap. La geometría no muestra un defecto mayor; se registra reserva por lo que no puede demostrar.

### Preguntas adversariales — diagnóstico de cabecera pública

1. **Primero mal:** avatar cortado en el extremo derecho.
2. **Texto/cortes:** control de cuenta incompleto; el resto de la tabla visible es legible.
3. **Terminación:** cabecera responsive sin resolver en esta captura, por lo que se rechaza.
4. **Coherencia:** el shell debe contener sus controles como hace en las recapturas finales de 768.
5. **Oscuro:** no aplica a esta imagen clara; no demuestra la variante oscura antigua.
6. **Estados:** registros cargados, no es un estado vacío ni error de datos; el fallo es geométrico.
7. **Jerarquía:** Credenciales activa es visible; la acción de cuenta parcialmente fuera debilita la navegación.
8. **Datos:** valores sintéticos, sin PHI.
9. **Requisito:** contradice el requisito de caber en el ancho disponible en ese estado anterior.
10. **Rechazo:** MAYOR, avatar fuera del viewport. Mantener como diagnóstico; no entregarlo como pantalla aprobada.

## No cubierto y validez de la evidencia

- Esta revisión no ejecutó interacciones, consola/red, descarga, persistencia, permisos, scroll, teclado ni lector de pantalla. Los PNG no prueban esos comportamientos.
- La matriz no contiene todos los bordes del plan: filtro sin resultados, error recuperable de descarga, registros rechazados/vencidos, todas las páginas, todos los estados de expansión y preview. Su cobertura debe buscarse en pruebas específicas, sin atribuirla a esta P2 visual.
- Datos personales y modal sólo están capturados en 390×844 claro; no se extiende su aprobación a los demás viewports/temas.
- El recorte inferior de filas dentro de tablas de alto máximo no se consideró defecto por sí solo; demostrar que todos los registros se recorren exige la evidencia interactiva correspondiente.
- No se acredita integración completa porque cuatro auxiliares estaban simulados. Tampoco se valida el campo posterior de Facturación ni cambios realizados después de esta matriz.
- V1 exige recapturas de las dos celdas afectadas y revisión de tamaños vecinos del mismo componente. Ambas pasadas deben repetirse sobre esas imágenes nuevas, manteniendo esta primera evaluación y sus rechazos.
