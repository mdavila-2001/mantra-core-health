# Diseño — reserva única y cotizaciones del paciente

## Objetivo

Evitar navegaciones repetidas al elegir un profesional o un cupo, reducir el tiempo de carga de disponibilidad y ofrecer una superficie de cotización del paciente sin inventar precios ni contratos clínicos.

## Alcance y límites

- Directorio: un estado de navegación local bloquea activaciones repetidas y comunica la carga a tecnología asistiva.
- Disponibilidad: las consultas por sede continúan siendo necesarias mientras `GET /scheduling/slots` no admita filtro por profesional; se ejecutan en paralelo y el próximo hueco se busca en paralelo sólo para sedes sin cupos visibles.
- Cotizaciones: vive como una pantalla de cuenta separada, compone los datos ya disponibles y declara como no publicados los precios sin procedencia. La ruta y el renglón de navegación dependen de los archivos reservados para Ender; la pantalla se prueba de forma aislada hasta que esa dependencia esté disponible.
- Documentos: sólo receta y orden diagnóstica si el contrato no revela una orden de servicio médico. No se modifican sus módulos dueños.
- No se modifica `app.routes.ts`, `core/navigation/**`, `booking-new/**`, el interceptor de mock ni contratos API.

## Flujo

1. El directorio marca el enlace activado como navegando hasta `NavigationEnd`, `NavigationCancel` o `NavigationError`; un segundo click o Enter no genera otra navegación.
2. La disponibilidad resuelve recursos y dispara sus lecturas de semana en paralelo. Para una sede vacía, semana y búsqueda del próximo hueco empiezan juntas; el resultado sólo muestra el segundo cuando el primero está vacío.
3. Cotizaciones normaliza la búsqueda, filtra cuatro verticales y ordena precio conocido (nulos al final) o distancia. Sin origen, la ordenación por cercanía explica cómo elegirlo.
4. Las recetas y órdenes precargan los términos y su vertical. Todo precio conserva su fuente; una ausencia se expresa como «Precio no publicado».

## Estados y accesibilidad

Se usan `ViewState` para carga, error, vacío y datos. Los indicadores incluyen `role="status"`, los controles activos emplean `aria-busy` y `aria-disabled`, y los botones nuevos combinan icono y texto. La navegación por teclado pasa por el mismo bloqueo que el clic.

## Pruebas

Las pruebas unitarias verifican un único disparo, resolución concurrente y ordenamientos. Las pruebas de pantalla cubren datos, vacío, error y ausencia de origen. Los recorridos de navegador y las capturas se ejecutan sólo cuando el servidor puede compilar; el baseline actual no compila por `component-index.generated` ausente fuera de este alcance.

## Dependencias declaradas

- Ender: ruta lazy y entrada «Cotizaciones»; además, la latencia del mock y un eventual filtro de slots por profesional.
- Negocio: fuente monetaria para servicios, imagenología y análisis; UMA no se convierte a bolivianos.
- API: no existe una orden de servicio médico identificada en el contrato actual, salvo evidencia posterior.
