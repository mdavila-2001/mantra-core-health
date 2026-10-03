# Resultado de revisión — frontend

## Cambios
- Logo institucional leído por contenido autorizado del tenant, con alternativa de presentación al fallar.
- Nombres adicionales después del tercer nombre, eliminación estable y límites de longitud; se conserva el formulario de ejecutivos actualmente existente en dev.
- Diploma principal: número, universidad y PDF producen una credencial universitaria; deduplicación por número y reuso de subida tras fallos. Universidad sin PDF conserva el comportamiento opcional reciente. PDF máximo 5 MB.

## Evidencia local
- Dev: 7 archivos de tests, 236 casos aprobados; después del último ajuste de validación inline, sus 6 tests aprobados. Lint dirigido y build production-api aprobados.
- Vista previa aislada contra API real: aseguradora, farmacia, laboratorio e imágenes agregan y quitan nombres sin errores JS ni HTTP.
- Médico: recorrido completo, HTTP 201; una credencial con número, universidad y fileId. SQL confirmó la persistencia. La cuenta sintética de prueba quedó bloqueada.
- Capturas de diploma inspeccionadas a 390x844 claro, 768x1024 oscuro y 1280x900 claro: etiquetas y controles legibles, sin desborde de página. El input universitario largo usa desplazamiento interno normal en tablet. Nombres: capturas desktop inspeccionadas en las cuatro instituciones.
- Evidencia privada del servidor: docs/trabajo/2026-10-03-pr-remotos/evidencia, fuera de este repositorio. No contiene datos clínicos en lo publicado.

## Alcance de verificación
Pruebas dirigidas; no se afirma que toda la suite del repositorio haya sido ejecutada. No se cubrió la matriz completa de estados/temas de cada formulario institucional. CI remoto se consulta en los PR; permanecen en borrador hasta que pase.

## Integración y reversión
API primero, frontend después, en cada destino. Test recibe estos commits sobre origin/test y conserva su cambio de dirección de domicilio. Revertir los commits de frontend restaura el comportamiento previo. No se cambian contratos de registro del API ni se borran datos.
