# Segunda revisión independiente — recaptura final sobre b84f74aa

- Fecha: 2026-10-03. Revisor: `/root/review_profile_ux`, independiente del implementador.
- P1 cerrada previamente en [doble-revision.md](./doble-revision.md), apartado «recaptura final sobre b84f74aa».
- Se abrieron **las 32 imágenes actuales individualmente** con `view_image`, desde cero. No se heredó aprobación del E2E ni de las imágenes anteriores. No se ejecutaron pruebas, navegadores o compilaciones ni se editó producto.
- Resultado visual: **10 APROBADA, 22 ACEPTABLE CON RESERVAS, 0 RECHAZADA**. No se encontraron defectos visuales MAYOR o BLOQUEANTE abiertos en estas recapturas. Persisten cuatro reservas menores y un límite funcional visible, descritos abajo.
- Este resultado se limita a los viewports, temas y estados de esta matriz; **no acredita integración completa**. El [registro anterior](./final-second-review-first.md) conserva sus dos rechazos y no fue modificado.

## Origen y límites

Se leyó [e2e-current-base-isolated.txt](./e2e-current-base-isolated.txt), cuyo final contiene literalmente:

```text
EVIDENCE_MODE=ISOLATED: signature-assets, insurance-networks, insurance-carriers y service-offerings simulados; resto API real
  4 passed (1.5m)
EXIT_CODE=0
```

Son cuatro GET auxiliares simulados vacíos: `signature-assets`, `insurance-networks`, `insurance-carriers` y `service-offerings`. El resto de datos de perfil/archivos utiliza la API real según la ejecución registrada. No se confunde ese resultado aislado con la ejecución REAL, cuyo fallo de red/consola comunicó el principal.

La captura de cancelación muestra efectivamente «No pudimos traer el catálogo de idiomas» y «Reintentar». La edición de idiomas no está demostrada como disponible. El principal informó que `VS_LANGUAGE` y `VS_LANGUAGE_PROFICIENCY` responden HTTP 200 con `items=0`; esta P2 no repitió esas peticiones. El estado de error es comprensible visualmente, pero su presentación correcta no resuelve el límite funcional.

## Hallazgos y seguimiento

Se mantienen los IDs del registro histórico para poder comparar ambas pasadas.

| ID | Severidad/estado actual | Evidencia y consecuencia |
|---|---|---|
| V1 | MAYOR anterior, corregido visualmente en la recaptura | En las dos públicas de 390 px el sello está ahora completamente dentro de Cardiología, con margen derecho visible; también cabe en los otros ocho estados públicos. Corrección localizada en `src/app/features/account/my-profile/practitioner-profile/practitioner-profile-view/practitioner-profile-view.css:114`: host `.profesional__especialidades`, `inline-size: min(100%, 24rem)` y `min-inline-size: 0`. P1 y esta P2 sobre las nuevas diez imágenes no reproducen el desborde. Los originales rechazados siguen en `diagnostico/public-specialty-overflow-{claro,oscuro}.png`. |
| V2 | MENOR, abierto | Etiquetas «Spanish clinical language» y «Native language proficiency» en Datos personales; la primera también en portada pública. Reserva de traducción heredada del catálogo, sin pérdida de información. Se registra para el reporte; esta revisión no modifica catálogos. |
| V3 | MENOR, abierto | En Trayectoria, la tercera tabla repite instituciones tras Actividad actual/Experiencia histórica sin encabezado que explique que sirve para gestionar los vínculos. Las acciones de escritorio permiten inferirlo; móvil depende del despliegue. No oculta los grupos ni bloquea sus controles. Se conserva como reserva de jerarquía para el reporte. |
| V4 | MENOR, reserva del artefacto | El fullPage de cancelación incluye fondo sin máscara por fuera del viewport, mientras el diálogo y el viewport activo están correctamente cubiertos. No demuestra un fondo interactuable. Una captura del viewport comunicaría mejor este estado. |
| V5 | MENOR, abierto | La tabla pública de 1024/1440/1920 conserva «ACCIONES» con celdas vacías. No hay descarga ajena, pero esa columna aporta ruido visual en una vista que no ofrece esa acción. Reserva de densidad para el reporte. |
| L1 | Límite funcional de integración, sin defecto geométrico adicional | En el fondo del editor, bajo Datos personales, el catálogo de idiomas informa error y ofrece Reintentar. No se observa catálogo cargado ni edición de idiomas disponible. La UI de error está orientada; la disponibilidad funcional queda pendiente de su evidencia real. |

## Matriz individual

Los nombres incluyen viewport y tema; fullPage puede tener mayor altura que el viewport. Todas las imágenes son de `capturas/` y fueron abiertas en esta nueva P2.

| Archivo | Severidad visual máxima | Veredicto P2 | Observación concreta |
|---|---|---|---|
| [cancelacion-390x844-claro.png](./capturas/cancelacion-390x844-claro.png) | MENOR | ACEPTABLE CON RESERVAS | Diálogo y dos decisiones completos; foco visible en Seguir editando. V4 en fullPage. Fondo: Idiomas en Datos personales, error explícito y Reintentar (L1). |
| [datos-propios-390x844-claro.png](./capturas/datos-propios-390x844-claro.png) | MENOR | ACEPTABLE CON RESERVAS | Idioma, nivel e interpretación visibles; valores y estados vacíos caben. V2: etiquetas de catálogo en inglés. |
| [listados-390x844-claro-credenciales.png](./capturas/listados-390x844-claro-credenciales.png) | Ninguna | APROBADA | Título y estado en primaria, sin palabras partidas. Matrícula 1/formaciones 12 y conteo 13/0/13; paginación cabe. |
| [listados-390x844-oscuro-credenciales.png](./capturas/listados-390x844-oscuro-credenciales.png) | Ninguna | APROBADA | Sellos pendientes y despliegues visibles en oscuro; sin invasión horizontal de controles. |
| [listados-768x1024-claro-credenciales.png](./capturas/listados-768x1024-claro-credenciales.png) | Ninguna | APROBADA | Encabezado, primaria, búsqueda y página legibles; detalles plegables identificados por flecha. |
| [listados-768x1024-oscuro-credenciales.png](./capturas/listados-768x1024-oscuro-credenciales.png) | Ninguna | APROBADA | Texto principal/secundario y controles contrastan; no se confunde pendiente con aprobado. |
| [listados-1024x768-claro-credenciales.png](./capturas/listados-1024x768-claro-credenciales.png) | Ninguna | APROBADA | Instituciones largas ajustan por palabras; estado, detalle y fuente se distinguen dentro del panel. |
| [listados-1024x768-oscuro-credenciales.png](./capturas/listados-1024x768-oscuro-credenciales.png) | Ninguna | APROBADA | Encabezados y sellos completos; búsqueda/paginación sin solapamiento. |
| [listados-1440x900-claro-credenciales.png](./capturas/listados-1440x900-claro-credenciales.png) | Ninguna | APROBADA | Detalles y números diferencian registros; panel sólo contiene matrícula y formación. |
| [listados-1440x900-oscuro-credenciales.png](./capturas/listados-1440x900-oscuro-credenciales.png) | Ninguna | APROBADA | Grupos y filtros conservan jerarquía; los sellos pendientes se leen sobre fondo oscuro. |
| [listados-1920x1080-claro-credenciales.png](./capturas/listados-1920x1080-claro-credenciales.png) | Ninguna | APROBADA | Columnas y controles distribuidos dentro del ancho; matrícula larga se ajusta sin perder caracteres. |
| [listados-1920x1080-oscuro-credenciales.png](./capturas/listados-1920x1080-oscuro-credenciales.png) | Ninguna | APROBADA | Texto, encabezados y selector de página visibles; sin avisos superpuestos. |
| [listados-390x844-claro-trayectoria.png](./capturas/listados-390x844-claro-trayectoria.png) | MENOR | ACEPTABLE CON RESERVAS | Grupos actual/histórico presentes y cargos ajustados por palabras. V3: tercera tabla sin título propio. |
| [listados-390x844-oscuro-trayectoria.png](./capturas/listados-390x844-oscuro-trayectoria.png) | MENOR | ACEPTABLE CON RESERVAS | Sellos y flechas completos en móvil oscuro; paginaciones caben. V3 persiste. |
| [listados-768x1024-claro-trayectoria.png](./capturas/listados-768x1024-claro-trayectoria.png) | MENOR | ACEPTABLE CON RESERVAS | Instituciones y cargos legibles; período plegado y sellos Declarado visibles. V3 persiste. |
| [listados-768x1024-oscuro-trayectoria.png](./capturas/listados-768x1024-oscuro-trayectoria.png) | MENOR | ACEPTABLE CON RESERVAS | Los tres controles de página caben; ambos grupos distinguibles. V3: repetición sin rótulo explicativo. |
| [listados-1024x768-claro-trayectoria.png](./capturas/listados-1024x768-claro-trayectoria.png) | MENOR | ACEPTABLE CON RESERVAS | Declarado y período separados; Editar/Retirar visibles en tabla propia. V3 persiste. |
| [listados-1024x768-oscuro-trayectoria.png](./capturas/listados-1024x768-oscuro-trayectoria.png) | MENOR | ACEPTABLE CON RESERVAS | Textos largos y explicación de vínculos sin sello caben; controles legibles. V3 persiste. |
| [listados-1440x900-claro-trayectoria.png](./capturas/listados-1440x900-claro-trayectoria.png) | MENOR | ACEPTABLE CON RESERVAS | Períodos completos y agrupaciones 11/1 conservadas; tres tablas sin desborde horizontal visible. V3 persiste. |
| [listados-1440x900-oscuro-trayectoria.png](./capturas/listados-1440x900-oscuro-trayectoria.png) | MENOR | ACEPTABLE CON RESERVAS | Estados no implican aprobación por estar En curso; acciones propias legibles. V3 persiste. |
| [listados-1920x1080-claro-trayectoria.png](./capturas/listados-1920x1080-claro-trayectoria.png) | MENOR | ACEPTABLE CON RESERVAS | Institución, cargo, período y acciones alineados; actual/histórico separados. V3 persiste. |
| [listados-1920x1080-oscuro-trayectoria.png](./capturas/listados-1920x1080-oscuro-trayectoria.png) | MENOR | ACEPTABLE CON RESERVAS | Tabla y acciones caben; explicación de Declarado conserva legibilidad. V3 persiste. |
| [public-390x844-claro-credentials.png](./capturas/public-390x844-claro-credentials.png) | MENOR | ACEPTABLE CON RESERVAS | V1 corregido: sello completamente dentro de Cardiología, margen visible. Especialidad sólo en portada; V2 permanece. |
| [public-390x844-oscuro-credentials.png](./capturas/public-390x844-oscuro-credentials.png) | MENOR | ACEPTABLE CON RESERVAS | Contención del sello también corregida en oscuro; Credenciales muestra matrícula/seis títulos. V2 permanece. |
| [public-768x1024-claro-credentials.png](./capturas/public-768x1024-claro-credentials.png) | MENOR | ACEPTABLE CON RESERVAS | Sello y etiqueta de idioma en bloques separados sin colisión; avatar completo dentro de cabecera. V2. |
| [public-768x1024-oscuro-credentials.png](./capturas/public-768x1024-oscuro-credentials.png) | MENOR | ACEPTABLE CON RESERVAS | Cabecera y resumen caben; primaria y flechas legibles. V2. |
| [public-1024x768-claro-credentials.png](./capturas/public-1024x768-claro-credentials.png) | MENOR | ACEPTABLE CON RESERVAS | Resumen 7/0/7 coherente con pendientes; especialidad contenida en portada. V2/V5. |
| [public-1024x768-oscuro-credentials.png](./capturas/public-1024x768-oscuro-credentials.png) | MENOR | ACEPTABLE CON RESERVAS | Sellos, detalle y fuente legibles; no se ve descarga ajena. V2/V5. |
| [public-1440x900-claro-credentials.png](./capturas/public-1440x900-claro-credentials.png) | MENOR | ACEPTABLE CON RESERVAS | Resumen de especialidad completo y separado del panel; filtros y página caben. V2/V5. |
| [public-1440x900-oscuro-credentials.png](./capturas/public-1440x900-oscuro-credentials.png) | MENOR | ACEPTABLE CON RESERVAS | Detalles y pendientes contrastan; Contenido de portada no se duplica dentro de Credenciales. V2/V5. |
| [public-1920x1080-claro-credentials.png](./capturas/public-1920x1080-claro-credentials.png) | MENOR | ACEPTABLE CON RESERVAS | Márgenes del sello preservados; tabla, consultas/otros servicios y vacío de horarios legibles. V2/V5. |
| [public-1920x1080-oscuro-credentials.png](./capturas/public-1920x1080-oscuro-credentials.png) | MENOR | ACEPTABLE CON RESERVAS | No aparecen fondos claros imprevistos ni controles recortados; sello contenido. V2/V5. |

## Diez preguntas adversariales por pantalla

Se agrupan las celdas de idéntico contenido/estado: Credenciales propias (10), Trayectoria propia (10), ficha pública (10), Datos personales (1) y Cancelación (1). Cada imagen se abrió individualmente; la matriz anterior registra diferencias de tema y viewport. Las respuestas no son una aprobación de interacciones no observadas.

### Credenciales propias — diez celdas

1. **¿Qué se ve primero mal?** No se encontró defecto visual abierto en este panel. La repetición de Título universitario pertenece al fixture; el detalle distingue números e instituciones en escritorio y hay despliegues en móvil.
2. **¿Hay cortes, solapamiento o bordes invadidos?** No se ve desborde horizontal. El corte inferior de filas pertenece al área de scroll de alto limitado; no prueba pérdida de registros. Las pestañas parciales tienen flechas de carrusel y la activa se ve completa.
3. **¿Parece terminado?** Primaria de título/estado coherente, agrupaciones claras y controles uniformes. La tabla propia reserva acciones para registros que tengan respaldo; esta matriz no muestra esos botones.
4. **¿Es coherente con pantallas vecinas?** Sellos, tipografía, bordes y controles coinciden con Trayectoria/ficha pública; la pestaña activa usa el estilo de la base actual.
5. **¿Qué falla en oscuro?** No se observa texto desaparecido, iconos ilegibles ni superficies blancas inesperadas en las cinco celdas oscuras.
6. **¿Vacío/error/carga orientan?** El panel está cargado; no representa búsqueda vacía, error o descarga pendiente. La fuente ausente dice Sin fuente registrada. No se certifican otros estados con estos PNG.
7. **¿La jerarquía guía?** Filtros, Matrículas y Títulos están separados; buscador y paginación localizables. En móvil título y estado no compiten por dos columnas estrechas.
8. **¿Hay datos inventados o sensibles?** La cuenta y las instituciones están identificadas como pruebas sintéticas. No se observan historias clínicas, tokens o archivos privados.
9. **¿Muestra el requisito literal?** Credenciales contiene sólo matrícula/formación, conteos 13/0/13 y doce formaciones en formato denso; no especialidades o idiomas. El recorrido de todos los registros exige la prueba interactiva separada.
10. **¿Por qué rechazarlo?** No hay motivo visual MAYOR observado en estas diez celdas. Se rechazaría extrapolar su resultado a descarga, autorización, persistencia o integración completa.

### Trayectoria propia — diez celdas

1. **¿Qué se ve primero mal?** V3: tercera tabla sin título de gestión repite instituciones después de los dos grupos.
2. **¿Hay cortes o desborde?** Cargos e instituciones ajustan por palabras. No hay avisos encima de filas; el corte al fondo corresponde al scroll vertical. Paginaciones caben incluso en 390 px.
3. **¿Parece terminado?** Tablas y controles consistentes; la falta de explicación de la tercera sección queda como reserva menor.
4. **¿Es coherente con vecinos?** Mismos sellos, tipografía y controles que Credenciales. Las filas resaltadas por el puntero no ocultan su contenido.
5. **¿Qué falla en oscuro?** No se observa pérdida de legibilidad en sellos Declarado, texto secundario o acciones; V3 no depende del tema.
6. **¿Vacío/error/carga orientan?** Sólo se capturaron registros cargados; esta matriz no representa estado de error ni filtro sin resultados. No se atribuye esa cobertura a las imágenes.
7. **¿La jerarquía guía?** Actual e histórica tienen títulos propios; los botones Editar/Retirar de la tercera tabla aclaran parcialmente su fin en escritorio. En móvil las columnas plegadas hacen más útil el título faltante.
8. **¿Hay datos sensibles?** Instituciones y cargos sintéticos; no hay contenidos clínicos ni enlaces a respaldos laborales inexistentes.
9. **¿Muestra el requisito literal?** Ambas agrupaciones permanecen. Donde el período está visible, En curso se muestra separado de Declarado; en móvil se ofrece despliegue. El PNG no demuestra permisos o el resultado de pulsar acciones.
10. **¿Por qué rechazarlo?** No se identifica defecto mayor en estas diez celdas; V3 impide una nota sin reservas. Sería incorrecto presentar las capturas como prueba de permisos y navegación de páginas.

### Ficha pública — diez celdas

1. **¿Qué se ve primero mal?** Etiqueta de idioma en inglés V2; en escritorio, columna pública vacía V5. El desborde anterior V1 ya no está presente.
2. **¿Hay cortes o desborde?** Sello dentro de Cardiología en los diez casos. En 390 tiene margen lateral claro; en tamaños vecinos no invade Idiomas. Avatar de cabecera completo a 768. Corte de tabla sólo vertical y previsto.
3. **¿Parece terminado?** Composición de portada corregida y panel estable; quedan traducción y columna innecesaria como reservas menores.
4. **¿Es coherente con vecinos?** La especialidad conserva su insignia de portada; tabla/sellos coinciden con vista propia. Consultas/Otros servicios usa pestañas del producto.
5. **¿Qué falla en oscuro?** Ningún desborde o pérdida de texto observable en las cinco celdas; el sello corregido conserva contraste y bordes.
6. **¿Vacío/error/carga orientan?** Seguros y horarios explican sus vacíos. El vacío de seguros procede de auxiliares simulados; no se presenta como prueba de integración. La captura no muestra error de descarga ni estado de carga.
7. **¿La jerarquía guía?** Portada con especialidad y luego Credenciales con matrícula/seis títulos; filtros 7/0/7 coherentes. V5 ocupa ancho sin una acción pública disponible.
8. **¿Hay datos sensibles?** Perfil Prueba Listados, instituciones y matrículas sintéticos. No se ve control o enlace a documentos de otro usuario.
9. **¿Muestra el requisito literal?** El resumen de especialidad permanece en portada y no aparece en Credenciales; no hay descarga ajena visible. Esa ausencia no certifica autorización del servidor.
10. **¿Por qué rechazarlo?** V1 ya no justifica rechazo de las recapturas actuales. Las reservas V2/V5 quedan abiertas. Se rechazaría afirmar integración total, basándose sólo en esta matriz aislada.

### Datos personales — una celda

1. **¿Qué se ve primero mal?** V2: idioma/nivel en inglés dentro de una ficha en español.
2. **¿Hay cortes o desborde?** Identificadores largos y valores ajustan dentro de la tarjeta; no hay aviso encima de los campos ni recorte horizontal.
3. **¿Parece terminado?** Campos y estados vacíos organizados; la traducción queda como detalle heredado pendiente.
4. **¿Es coherente con vecinos?** Misma tarjeta, cabecera y edición del resto del perfil; Idiomas pertenece a Datos personales.
5. **¿Qué falla en oscuro?** No aplica a esta imagen clara; la matriz no aporta esta pestaña en oscuro.
6. **¿Vacío/error/carga orientan?** Sin registrar, falta de nacimiento y activos gráficos ausentes están explicados. El texto de seguros no acredita conexión real con aseguradoras.
7. **¿La jerarquía guía?** Datos personales activa y Editar perfil claros; idioma, nivel e interpretación conservados en el mismo campo.
8. **¿Hay datos sensibles?** Identidad de prueba y documento con prefijo de fixture; no se observa PHI o secreto.
9. **¿Muestra el requisito literal?** Conserva idioma, nivel e interpretación fuera de Credenciales. Las diez imágenes propias de ese panel complementan la comprobación visual de ausencia.
10. **¿Por qué rechazarlo?** No hay defecto visual mayor observado; V2 exige reserva. No extender esta sola imagen a otros viewports, temas ni estados de edición.

### Cancelación y editor de fondo — una celda

1. **¿Qué se ve primero mal?** FullPage muestra máscara sólo sobre el viewport (V4); al recorrer el fondo se encuentra el catálogo de idiomas no disponible (L1), que no debe ocultarse en el reporte.
2. **¿Hay cortes o desborde?** Modal completo con márgenes, título y texto enteros; ambas opciones caben. El editor de fondo no muestra invasión horizontal del bloque de idiomas.
3. **¿Parece terminado?** La confirmación está presentada coherentemente. La edición de idiomas queda funcionalmente pendiente por el catálogo, aunque su estado de error es comprensible.
4. **¿Es coherente con vecinos?** Modal usa tipografía y decisiones del producto; Idiomas aparece bajo Datos personales, después de especialidades.
5. **¿Qué falla en oscuro?** No aplica a esta imagen clara; no se dispone de su equivalente oscuro en la matriz.
6. **¿Vacío/error/carga orientan?** El modal explica que los cambios se pierden; el fondo dice No pudimos traer el catálogo de idiomas y ofrece Reintentar. No se infiere que reintentar funcione ni que el catálogo esté cargado.
7. **¿La jerarquía guía?** Seguir editando tiene foco visible y Descartar está claramente separado. El fondo queda subordinado al diálogo; la imagen no prueba el ciclo de Tab.
8. **¿Hay datos sensibles?** Cuenta sintética, sin contenido clínico ni credenciales de acceso. Los valores del fondo no provienen de producción según el escenario de prueba.
9. **¿Muestra el requisito literal?** Confirmación visible y legible; la preservación del borrador y el valor persistido tras recargar son evidencia funcional distinta. L1 impide usarla para afirmar edición completa de idiomas.
10. **¿Por qué rechazarlo?** No hay defecto geométrico mayor del diálogo. Se rechazaría entregar el flujo completo de idiomas como integrado o inferir focus trap/persistencia a partir de la captura. V4 queda como reserva de evidencia y L1 como límite funcional explícito.

## No cubierto

- Esta P2 no ejecutó teclado, lector de pantalla, scroll, filtrado, cambios de página, descargas, permisos, recarga, consola o red. El log aislado leído es evidencia separada; no sustituye la integración REAL fallida comunicada por el principal.
- No hay capturas de todos los bordes del plan: preview, error recuperable de respaldo, registros rechazados/vencidos, cada página, cada detalle expandido, filtro sin resultados o todos los estados de carga. Debe recurrirse a las pruebas específicas sin atribuir esa cobertura a esta matriz.
- Datos personales y cancelación sólo tienen 390×844 claro. No se aprueban implícitamente sus variantes restantes, ni Facturación por no estar visible.
- Se observó el error del catálogo de idiomas, pero no su recuperación. El principal informó catálogos vacíos reales; esta revisión no alteró ni simuló esos datos.
- Las filas parcialmente cortadas al borde inferior corresponden a tablas con scroll limitado. Su accesibilidad completa requiere la evidencia interactiva; no se deduce exclusivamente de que exista paginación.
- Los diagnósticos anteriores mantienen sus veredictos históricos en [final-second-review-first.md](./final-second-review-first.md) y [diagnostic-second-review.md](./diagnostic-second-review.md). El cierre visual de V1 corresponde sólo a estas diez recapturas públicas y ambas pasadas nuevas.
