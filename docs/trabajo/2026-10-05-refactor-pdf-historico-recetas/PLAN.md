# Plan: PDFs clínicos y descarga del histórico de recetas

Fecha: 2026-10-05. Alcance revisado: `mantra-core-health` y `mantra-core-health-api` en sus ramas locales `master`. La sección final registra lo implementado y las verificaciones realizadas.

## Objetivo y resultado esperado

Cada paciente debe poder entrar a **Mi historia clínica → Recetas**, ver todas sus recetas en orden cronológico y descargar con un toque una receta emitida o un PDF de su histórico completo. El documento debe ser claro en pantalla e impresión A4, y distinguir una receta vigente de una invalidada o reemplazada. Las recetas oficiales deben generarse desde datos autorizados por el servidor. La historia clínica, las órdenes y los demás PDFs deben compartir una identidad visual coherente y una paginación fiable.

## Diagnóstico comprobado en el código

1. Ya existe una pestaña `Recetas` y un botón por receta en `src/app/features/account/medical-record/medical-record.html`. El cliente pide `GET /clinical/prescriptions/:id/pdf` desde `clinical.client.ts`. En el checkout actual de la API no hay controlador ni servicio para esa ruta; el mock sí la simula con `pdfMinimo`. Las pruebas del componente inyectan una respuesta simulada y no prueban la API real. Por eso la interfaz promete una descarga que no está respaldada aquí por el backend.
2. La pantalla obtiene las recetas desde `GET /clinical/patients/:patientProfileId/summary?limit=50`. El backend aplica el límite a `medicationRequests` y marca el recorte; no hay paginación ni descarga exhaustiva. El botón `Descargar mi historia completa` reutiliza ese resumen, por lo que también puede omitir recetas antiguas. Su texto actual promete un documento completo aunque haya recortes o fallen lecturas secundarias.
3. `medical-record.ts` captura `activePatientProfileId()` una sola vez y usa `auth.displayName()` para el documento. Si el titular cambia a un dependiente con la pantalla abierta, los datos y el nombre del PDF pueden quedar asociados a personas distintas. Además, `ClinicalReadService.assertOwnRecord` valida titularidad directa y no contempla por ahora el proxy de un dependiente; hay que resolver la regla de acceso antes de ofrecer su histórico.
4. El motor común `shared/utils/pdf-export/pdf-export.ts` dibuja bloques con `jsPDF` y un tema fijo. `abrirEspacio` deja desbordar un bloque más alto que una página; los párrafos, campos y filas largas se miden como unidades indivisibles. La tabla de receta usa cinco columnas en A4. El encabezado repetido de una tabla se inserta tras calcular el espacio de la fila sin reservar el espacio de ambos. Son riesgos concretos de corte y superposición que las pruebas actuales, centradas en llamadas a `jsPDF`, no cubren visualmente.
5. `clinical-pdf.ts` contiene un generador local de recetas mientras la descarga del paciente usa el supuesto PDF oficial del servidor. Antes de rediseñar hay que fijar cuál documento tiene validez oficial y evitar dos versiones contradictorias de la misma receta.

## Contrato de producto

- La lista del paciente muestra las recetas **emitidas**, incluidas las vencidas, invalidadas y reemplazadas, con estado, fecha de emisión, medicamento y profesional cuando el servidor tenga el dato. Los borradores son solo del profesional y nunca se rotulan como receta oficial del paciente.
- Cada fila tiene `Descargar receta` si existe un documento emitido. Los estados inválido y reemplazado aparecen de forma visible dentro del PDF y en la lista; la descarga conserva el registro histórico sin presentarlo como receta vigente.
- Encima de la lista: `Descargar historial de recetas (PDF)`. Un solo archivo, ordenado de más reciente a más antiguo, con portada breve, índice legible y una sección por receta. El histórico se rotula como recopilación; no suplanta el PDF oficial individual. El botón muestra progreso, bloquea duplicados y comunica errores recuperables.
- La lista tiene paginación o carga progresiva y un contador que refleje el total real. `Sin recetas` solo aparece tras consultar la colección completa; `50 de N` no se presenta como `50` totales.
- El PDF de historia clínica general indica claramente si es una exportación parcial. La acción no se llamará `completa` hasta que obtenga todas las páginas de cada sección o el servidor genere una instantánea íntegra.
- Una persona descarga sus propios documentos; un representante solo los del dependiente para el que tenga un poder vigente. La autorización se verifica en cada endpoint y se audita sin exponer datos clínicos en logs o URL públicas.

## Arquitectura propuesta

### Fuente oficial de recetas en la API

Agregar a `clinical` una lectura paginada exclusiva de recetas y dos descargas autenticadas:

- `GET /clinical/patients/:patientProfileId/prescriptions?cursor=&limit=`: `items`, `nextCursor`, `total` y estado legible; orden estable por `issuedAt DESC, id DESC`. Filtrar borradores del portal en el servidor. Resolver nombres de medicamento y profesional sin obligar al paciente a consultar el padrón.
- `GET /clinical/prescriptions/:id/pdf`: bytes `application/pdf`, `Content-Disposition` con nombre seguro, `Cache-Control: private, no-store`; consulta por ID y control de titularidad/proxy antes de generar. El contenido procede de la receta sellada, con emisor, matrícula si existe, fecha, indicaciones y estado actual. Sin documento oficial para un borrador.
- `GET /clinical/patients/:patientProfileId/prescriptions/history.pdf`: exportación exhaustiva en streaming o por lotes internos, con límite operativo documentado y error explícito si no puede completarse. No construirla a partir de los 50 elementos que ve el navegador.

Encapsular la comprobación de titularidad y proxy en un servicio reutilizado por los tres endpoints y por el resumen, con pruebas para cuenta propia, dependiente autorizado, poder revocado y paciente ajeno. Revisar la semántica de receta invalidada/reemplazada con las reglas clínicas existentes antes de fijar el texto final de validez.

### Motor de composición

Separar **datos del documento**, **composición** y **entrega**. Definir modelos tipados para receta, histórico, atención e historia; ningún generador leerá directamente el DOM ni inventará datos faltantes. Usar un único diseño de papel: tipografías con caracteres españoles embebidas, escalas, márgenes, colores, encabezado, pie y estados. El backend producirá las recetas oficiales y el histórico de recetas. El motor del navegador seguirá sirviendo PDFs no oficiales durante la migración y adoptará el mismo diseño; retirar el generador local de receta cuando dejen de existir consumidores.

Refactorizar el maquetador común en fases `medir → decidir saltos → dibujar`. Los bloques largos deben dividirse por línea o subbloque con control de viudas y huérfanas; una fila de tabla debe caber junto con su encabezado repetido o dividirse de forma explícita. Para recetas, sustituir la tabla de cinco columnas por tarjetas o grupos de datos por medicamento: nombre y presentación destacados; dosis, frecuencia, vía, duración e indicaciones debajo. Esto permite textos largos y resulta más legible en móvil, pantalla y A4.

### Experiencia del paciente

En `medical-record.ts/.html/.css`, pasar el perfil activo a una fuente reactiva y cancelar/reiniciar cargas al cambiar de persona. Usar el nombre de `PatientContextService.activePatientName()` o el nombre verificado que devuelva la API. La pestaña `Recetas` leerá el endpoint paginado independiente del resumen clínico. Mostrar el botón del histórico al comienzo de la pestaña; mantener descarga individual en cada tarjeta. En móvil, acciones de ancho completo y una etiqueta corta `Descargar PDF`; el nombre accesible incorpora medicamento y fecha. No convertir errores de red en un estado vacío.

## Entregas en orden

| Entrega | Trabajo | Criterio de salida |
| --- | --- | --- |
| 1. Contrato y acceso | Definir estados visibles, modelo de proxy y endpoints; agregar pruebas de autorización y contrato HTTP en API. | Un paciente ajeno recibe 403; el titular y representante vigente reciben solo documentos permitidos. |
| 2. Descarga real | Implementar PDF oficial individual en API y conectar la descarga existente; quitar la promesa de oficialidad de los borradores. | Descarga real desde API con nombre, tipo MIME, contenido y datos clínicos correctos; mock y API comparten contrato. |
| 3. Histórico completo | Lectura paginada, botón de exportación y PDF consolidado generado en servidor; corregir los textos de exportación parcial del resumen. | Con más de 50 recetas, aparecen y se exportan todas exactamente una vez y en orden. |
| 4. Rediseño del papel | Prototipos visuales de receta de una y varias páginas, historia y orden; aplicar tema y nuevo maquetador; migrar consumidores por tipo. | Sin texto cortado, superposiciones, páginas vacías ni datos ilegibles en los casos de prueba. |
| 5. Cierre | Pruebas de integración, revisión visual, accesibilidad, impresión y retirada del camino local de receta sin consumidores. | Flujo completo desde `Mi historia clínica` probado con API real y con cuenta de dependiente autorizada. |

## Verificación necesaria

- Fixtures con nombres largos, tildes, símbolos de dosis, indicaciones de varios párrafos, muchos medicamentos, celdas extensas y 1/2/N páginas. Comparar imágenes renderizadas de PDFs aprobadas por diseño; extraer texto para asegurar que no se perdió contenido. Revisar A4 a color y en escala de grises.
- Prueba integrada de receta emitida, vencida, invalidada y reemplazada; comprobar contenido, estado y nombre del archivo. Probar 51+ recetas, paginación estable, descarga consolidada y ausencia de duplicados.
- Recorrido de navegador en móvil y escritorio: una descarga individual, histórico, progreso, error y reintento, cambio de titular a dependiente y revocación de poder.
- Comprobar que `Content-Disposition` y los enlaces no filtran datos sensibles, que las respuestas PDF no se cachean y que las descargas no aceptan un ID de otro paciente.

## Decisiones de diseño pendientes antes de implementar

Validar con producto y clínica el texto exacto para recetas anuladas/reemplazadas y si el PDF histórico debe incluirlas todas o permitir un filtro adicional de vigentes. El valor por defecto recomendado es **todo el histórico**, con estado visible y sin borradores. Validar una muestra visual de receta e historia antes de migrar todos los tipos de PDF.

## Estado de implementación — 2026-10-05

La descarga individual y la descarga del historial ya tienen endpoints reales en la API. El historial consulta todas las recetas emitidas en lotes de 200 con orden estable, y el listado del paciente usa paginación por `offset` y `limit` cuando el resumen de 50 registros queda recortado. Los tres endpoints comprueban acceso; el historial requiere titular o representante con poder activo y vigente. Las descargas tienen `Content-Type: application/pdf`, nombre seguro, `Cache-Control: private, no-store` y un evento de auditoría sin contenido clínico.

En **Mi historia clínica → Recetas** hay descarga individual, descarga de todo el historial, contador y `Ver más recetas`. Al cambiar de perfil se recargan los datos y se usa el nombre del paciente activo. El resumen clínico general ya se rotula como **resumen**, y su PDF advierte si una fuente falló o si el resumen fue recortado. La interfaz omite borradores y solo muestra la acción de compra para estados vigentes conocidos. Para dependientes, se evita incorporar órdenes y resultados de la cuenta titular en su resumen.

El documento de receta del servidor usa un diseño A4 con identidad visual, datos del paciente y profesional, medicamento, dosis, vía, frecuencia, cantidad, vigencia, indicaciones, estado histórico y pie numerado. El PDF de historial incluye un índice numerado que corresponde con cada sección de receta. Los colores, márgenes y escala tipográfica del servidor reflejan los tokens del motor del portal. Se corrigió la división de bloques largos y filas altas del maquetador del navegador. Al abrir `Recetas`, la pantalla consulta siempre el listado autorizado del servidor, que aporta el total real y el profesional cuando está registrado. El PDF tiene un límite operativo de 5.000 recetas; si lo supera, responde 413 y la pantalla indica cómo solicitar una copia. La muestra con indicaciones largas está en `evidencia/preview-historico.pdf`; sus páginas renderizadas están en el mismo directorio.

**Verificación realizada:** compilación del API; comprobación de tipos de ambos repositorios; 31 pruebas dirigidas del API y 103 del frontend en la iteración anterior; inspección visual de las cuatro páginas de muestra con índice, medicación, vía, cantidad, instrucciones largas y pies numerados. El frontend ahora consulta el listado del servidor al abrir Recetas y muestra el profesional disponible. No se ejecutó un recorrido HTTP contra una base de datos real ni una prueba manual en móvil. El historial de hasta 5.000 recetas se consolida en memoria antes de entregar el PDF; para cargas concurrentes o historiales extremos falta evaluar streaming. El maquetador del navegador y el del servidor siguen separados, aunque comparten tokens visuales. La muestra todavía necesita aprobación clínica y de diseño antes de atribuirle valor legal.

### Cierre de verificación — 2026-10-05

- `yarn typecheck` y `yarn build` terminaron con código 0 en frontend y API.
- Las pruebas dirigidas terminaron correctamente: frontend 70/70 (historia clínica, cliente y mocks) y API 7/7 (servicio y controlador de recetas).
- La carga inicial de recetas diferencia carga, error recuperable y lista vacía confirmada; el caso de error y reintento quedó cubierto.
- Se inspeccionaron las cuatro páginas del PDF de muestra: índice, detalle, continuación de indicaciones largas y numeración de páginas.
- No se hizo un recorrido HTTP con PostgreSQL real ni prueba manual móvil; requieren un entorno desplegado con datos de prueba. La exportación sigue limitada a 5.000 recetas y ensambla el PDF en memoria.
- La revisión visual fue técnica. Producto y un profesional clínico deben aprobar la muestra y el texto de validez antes de atribuir valor legal; una prueba automatizada no sustituye esa aprobación.

### Verificacion final posterior al cierre inicial - 2026-10-05

- Frontend: `yarn typecheck` y `yarn build` pasaron. Las suites dirigidas de historia clinica, cliente y mocks pasaron 70/70; tras el ultimo ajuste, el spec de historia clinica paso 27/27 y ESLint dirigido termino sin errores.
- API: `yarn typecheck` y `yarn build` pasaron; pruebas dirigidas de controlador/servicio 7/7 y `prescription-documents.service.spec.ts` 4/4. ESLint dirigido y `git diff --check` sin errores.
- Playwright Chromium: una prueba responsive paso en 320 y 390 px; `scrollWidth` coincide con el viewport en ambos tamanos. Se corrigio el encabezado a 320 px y el CTA de la tarjeta.
- La pantalla separa carga, error recuperable y vacio confirmado; permite reintentar el fallo de una pagina adicional. La auditoria de descargas no registra contenido clinico.
- Se inspeccionaron PDFs con indicaciones largas: historial de 4 paginas y receta individual de 2, con texto e identificadores extraibles. Esto no valida matricula profesional, firma criptografica ni valor legal.
- No se ejecuto el flujo HTTP contra PostgreSQL real. La exportacion esta limitada a 5.000 recetas y ensambla el PDF en memoria; falta evaluar streaming y cargas concurrentes.
- Acceso delegado: cada lectura y descarga resuelve el poder activo, sus fechas de vigencia y el `ValueSet` indicado por `scopeValueSetId`; para el historial de recetas exige el codigo interno `patient-portal-prescriptions-read`. El resumen conserva el scope independiente `patient-portal-clinical-summary-read`. Las pruebas verifican rechazo cuando el scope no coincide. La asignacion operativa de ese ValueSet al emitir poderes debe configurarse en los datos del producto.
- La revision visual fue tecnica. Producto, diseno y un profesional clinico deben aprobar la muestra y el texto de validez antes de atribuir valor legal.
