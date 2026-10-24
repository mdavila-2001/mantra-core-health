# Refactorización UX/UI del panel principal

**Estado:** piloto visual implementado y revisado en navegador; verificación global de lint con deuda ajena al piloto.
**Alcance de este plan:** `/dashboard`, con las variantes de paciente y de trabajo.
**Criterio rector:** claridad con profundidad moderada, usando la identidad ALOVIDA y los contratos de interfaz ya existentes.

## Resultado buscado

Al abrir el panel, la persona debe reconocer su contexto y la siguiente acción con una mirada. La jornada del personal conserva prioridad; sus accesos y reportes se leen como herramientas de trabajo. La persona paciente ve una entrada de salud cercana y su próxima cita. Superficies, estados y movimiento deben sentirse cuidados y actuales, con una presentación estable en móvil, escritorio y tema oscuro.

Este es el primer piloto de una modernización más amplia. La inspección disponible es estática; no se afirma que el panel se haya observado con usuarios ni que el resto de las rutas esté auditado.

## Hechos observados

- `/dashboard` decide entre `PatientHome` y el panel de trabajo según rol. Los bloques de jornada, reportes y administración también se condicionan por permiso.
- La agenda de trabajo ya prioriza la cita actual, muestra el resto del día y actualiza el reloj cada minuto.
- El árbol de accesos ya agrupa destinos por tarea. Abrir una zona y seleccionar un destino ya tienen feedback visual.
- El panel ya usa `appStaggerList`; la agenda, el árbol y la hoja global incluyen variantes para movimiento reducido.
- La aplicación ya dispone de tokens para color, tipografía, superficies, radios, elevación y movimiento. El piloto no necesita otra paleta ni una dependencia de animación.
- La auditoría de esta iteración fue lectura de código y documentación. No hubo observación de usuarios ni captura previa en navegador.

## Dirección visual del piloto

- **Color:** petróleo como acción e identidad; marfil y superficies semánticas para separar grupos. Ámbar solo para una condición clínica activa o una advertencia.
- **Jerarquía:** agenda primero para quien atiende; zonas de acceso después; cifras y listas en nivel secundario. Para paciente: síntomas, próxima cita y referencias de historia.
- **Tipografía:** Poppins para encabezados cortos; Inter para lectura y datos; cifras tabulares cuando se comparan.
- **Superficies:** panel principal de agenda con fondo temático opaco, contorno y elevación leve; información relacionada agrupada; controles sin vidrio ni desenfoque.
- **Composición:** ritmo de 8/16/24/32 px, bordes discretos, contenido que puede encogerse y envolverse, y una única esquina de firma por pantalla.
- **Movimiento:** respuesta local de 120 ms, cambios de estado de 200 ms y entrada de contenido de hasta 320 ms según los tokens existentes. No se retrasa ninguna acción funcional.

## Plan por incrementos

| ID | Prioridad | Trabajo | Archivos principales | Aceptación |
|---|---|---|---|---|
| P-01 | P0 | Confirmar roles, tareas, tokens y límites reales del panel | `dashboard.ts/html/css`, componentes del panel, `styles.css` | El mapa distingue paciente, personal que atiende y administración; ninguna función cambia de permiso o destino. **Hecho por inspección estática.** |
| P-02 | P1 | Dar presencia a la jornada y mejorar lectura de cifras, cita actual y agenda resumida | `agenda-de-hoy.css` | La cita activa destaca sin competir con el total; el indicador de hora ayuda a situarse y deja de pulsar con movimiento reducido. **Implementado; capturas escritorio/móvil revisadas.** |
| P-03 | P1 | Unificar interacción de zonas y accesos con feedback contenido | `access-tree.css` | Hover, foco y pulsación reflejan el mismo destino; el feedback no usa rebote decorativo. **Hecho; Enter, Escape y retorno de foco comprobados en Chromium.** |
| P-04 | P1 | Mejorar la lectura del resumen y su tabla de intensidad | `consultas-resumen.css`, `styles.css` | Las cifras se agrupan con jerarquía; tabla con scroll local y contraste AA medido en los dos temas. **Hecho.** |
| P-05 | P1 | Refinar la cita y los registros del panel paciente | `patient-home.css` | La fecha continúa siendo el dato dominante; acciones y referencias conservan su sitio. **Hecho; revisado a 320/390/768/1440 px.** |
| P-06 | P0 | Revisar en navegador escritorio y móvil, en claro/oscuro y con varios roles | Panel y `capturas/despues/` | Personal, administración y paciente observados; 320, 390, 768, 1024, 1440 y 1920 px; claro y oscuro. **Hecho en Chromium con datos simulados.** |
| P-07 | P0 | Recorrer carga, error, vacío, agenda terminada, apertura/cierre rápido y movimiento reducido | Panel y directivas de movimiento existentes | Estados de carga, error, vacío y jornada terminada revisados en plantilla y componente; Enter/Escape/foco y `prefers-reduced-motion` verificados en navegador. **Hecho dentro del alcance disponible; estados excepcionales no forzados visualmente.** |
| P-08 | P2 | Hacer inventario de otras áreas antes de extender el sistema | Rutas identificadas en `features/` | Familias y siguiente piloto priorizados abajo, sin cambiar rutas ni contratos. **Hecho.** |
| P-09 | P0 | Cerrar calidad, rendimiento y recuperación del incremento | Archivos del piloto, `EVIDENCIAS.md`, `QA_FINAL.md` | Build, typecheck y E2E enfocado pasan; lint del archivo nuevo pasa. Lint global falla por 256 errores fuera de este piloto. **Hecho con limitación documentada.** |

## Registro de movimiento

| ID | Disparador y propósito | Elemento y cambio | Tiempo | Interrupción y foco | Movimiento reducido / fallback |
|---|---|---|---|---|---|
| M-01 | Entrada inicial del panel; comunicar que aparece un grupo nuevo | Hijos directos de la rejilla, opacidad y desplazamiento breve por `appStaggerList` | Base más retraso de 45 ms, hasta 8 pasos | La acción y el foco no esperan. El contenido permanece visible si Web Animations API no está disponible. | La directiva no anima con la preferencia activa; contenido visible desde el inicio. |
| M-02 | Abrir una zona o acceder a otro grupo | Entrada breve del contenido y desplazamiento leve del icono/flecha | Base y feedback rápido, desde tokens existentes | Otra zona puede abrirse inmediatamente; se conserva el control de retorno. | La hoja del árbol elimina las animaciones de entrada. |
| M-03 | La posición del reloj representa el minuto actual | Halo suave alrededor de la marca de hora | Ciclo de 2,4 s; no retrasa carga ni acción | No captura puntero ni mueve contenido; desaparece si el elemento ya no existe. | `prefers-reduced-motion` apaga el halo y mantiene la marca fija. |
| M-04 | El cursor recorre citas y referencias | Realce de fondo, borde o elevación leve; no se anima el dato clínico | 120–200 ms | No altera el orden ni el tamaño de las filas. | Sin desplazamiento para la lectura ni pérdida de funcionalidad. |

## Cambios de esta iteración

- La agenda recibe una superficie protagonista con borde de marca, profundidad leve y resumen de cifras mejor agrupado.
- La cita destacada y la lista comunican foco y continuidad sin introducir una segunda paleta.
- El indicador del minuto actual obtiene un halo suave con apagado explícito para movimiento reducido.
- El árbol reduce la inclinación y el rebote de iconos; el feedback se expresa por contraste, escala leve y elevación.
- El reporte separa cifras y tabla con contenedores legibles, incluyendo desplazamiento horizontal localizado.
- La ficha de próxima cita y las referencias del paciente reciben separación y foco visibles.

## Evidencia de esta iteración

- [Panel de personal, escritorio (1280×720)](capturas/despues/panel-personal-escritorio.png)
- [Panel de personal, móvil (390×844)](capturas/despues/panel-personal-movil.png)
- [Panel de paciente, escritorio (1280×720)](capturas/despues/panel-paciente-escritorio.png)
- La sesión de personal mock y la de paciente mock alcanzaron `/dashboard`. La variante paciente conserva el buscador de síntomas, la cita y sus referencias.
- La medición simple de anchura a 390 px en la sesión paciente fue `390 / 390`. La captura móvil de personal muestra la agenda adaptada a una columna. Estas observaciones no sustituyen el barrido de tamaños ni una revisión con teclado.
- La consola del servidor local registró avisos CSP por scripts inline de desarrollo en `/auth`; el build de producción finalizó. No se atribuyen esos avisos a estos estilos ni se certifica seguridad del entorno.
- El servidor local usó datos del simulador, no una API real.

### Cierre del 5 de octubre de 2026

- [Personal oscuro, escritorio](capturas/despues/panel-personal-escritorio-oscuro.png) · [personal oscuro, móvil](capturas/despues/panel-personal-movil-oscuro.png) · [personal a 320 px](capturas/despues/panel-personal-320.png).
- [Paciente oscuro, escritorio](capturas/despues/panel-paciente-escritorio-oscuro.png) · [paciente oscuro, móvil](capturas/despues/panel-paciente-movil-oscuro.png) · [paciente claro, móvil](capturas/despues/panel-paciente-movil.png).
- `playwright/panel-hoy.spec.ts`: 2/2; roles de personal y administración y anchos 390/768/1024/1440/1920 px. `playwright/panel-refactor-visual.spec.ts`: 2/2; paciente y personal, foco, Escape, scroll interno, 320 px, oscuro y movimiento reducido.
- Las celdas no vacías del mapa superan 4,5:1 en claro y oscuro; el mínimo de los pares elegidos es 4,97:1. La primera inspección detectó colores oscuros ineficaces por el encapsulamiento CSS de Angular; ahora son tokens semánticos en la hoja global.

### Seguimiento de agenda y navegación · 5 de octubre de 2026

- `/schedule` se revisó en Chromium con sesión médica simulada en 390×844 (día claro y oscuro, semana oscura), 320×720 (semana oscura y «Mis horarios» con preview del horario anterior) y 1280×900 (día claro). Se comprobó que día/semana y la grilla con el histórico abren y se leen; a 390 y 320 px la semana presenta dos columnas y la grilla del modal tiene desplazamiento horizontal interno.
- En el encabezado móvil a 390 px se comprobó que «Más accesos» expone Red social, Tutoriales, Chats (4 no leídos), facturas, solicitudes y ajustes. Activar «Tutoriales» navegó a `/tutorials` y cerró el menú; Escape también lo cierra y devuelve el foco al botón. El menú abierto midió 252×269 px a 390×844; el ancho de `documentElement` y `body` coincidió con el viewport tanto a 390 como a 320 px.
- Capturas persistidas: `schedule-dia-claro-movil-390.png`, `schedule-dia-claro-escritorio-1280.png`, `schedule-dia-oscuro-movil-390.png`, `schedule-semana-oscuro-movil-390.png`, `schedule-semana-oscuro-movil-320.png`, `schedule-mis-horarios-preview-320.png` y `header-mas-accesos-oscuro-movil-390.png`.
- En la vista mensual oscura, la primera pasada a 320×720 detectó textos de cupos superpuestos; `schedule-mes-oscuro-movil-320-antes-ajuste.png` conserva el defecto previo. Tras compactar los conteos (`N libres`/`Bloq.`) y mantener las causas completas en el nombre accesible, se verificó la vista a 320×720 y 390×844: sin solapamiento ni overflow horizontal del documento. Capturas posteriores: `schedule-mes-oscuro-movil-320.png` y `schedule-mes-oscuro-movil-390.png`.
- El recorrido de `/schedule` incluyó día, semana, mes e histórico del 3 de octubre con reservas/estados, en sesión médica simulada. La inspección no cubre otros roles ni una API real. La primera compilación de desarrollo mostró un desacuerdo `Event`/`KeyboardEvent`; se ajustó el tipo y la reconstrucción posterior quedó sin errores. La consola conserva dos errores CSP por scripts inline en `/auth` durante desarrollo, fuera del recorrido de agenda.

## Inventario para la siguiente pantalla

El inventario existente (`INVENTARIO.md`, `MATRIZ_COBERTURA.md` y `docs/reports/generated/rutas.json`) distingue las familias de rutas. Sus conteos se generaron en fechas anteriores y no equivalen a una auditoría visual actual de cada pantalla.

| Prioridad | Familia y rutas representativas | Motivo de prioridad | Paso siguiente |
|---|---|---|---|
| P1 | Agenda del personal: `/schedule`, `/schedule/book/:slotId` | Es el destino directo de la acción principal de este panel; el hallazgo H-09 ya registró desplazamiento horizontal a 1280 px. | Recorrido visual verificado en Chromium para día/semana/mes e histórico; cobertura limitada al rol y tamaños indicados en Evidencias/QA. |
| P1 | Archivo clínico: `/medical-records/:profileId`, `/medical-records/:profileId/consultation` | Datos clínicos y acciones de alto impacto; requieren jerarquía y estados inequívocos. | Auditar con escenarios de permiso y datos largos antes de cambiar estilos. |
| P2 | Paciente: `/my-account/appointments`, `/my-account/medical-record` | Continúan el trayecto de la cita del panel; `Mis citas` ya fue piloto de otra iteración. | Reutilizar su cobertura y revisar continuidad visual sin rehacer flujos ya migrados. |
| P2 | Administración: `/administration/patients`, `/administration/organizations/:tenantId` | Densidad de tablas, filtros y formularios; mayor complejidad por rol. | Inventariar vistas y estados por permiso; seleccionar un flujo concreto. |
| P3 | Directorios y contenido público | Lectura y exploración, con menor riesgo operacional. | Revisar después de los trayectos clínicos y de agenda. |

Fuera de `/dashboard`, `/schedule` tiene una revisión visual verificada en Chromium para el recorrido documentado y capturas antes/después del ajuste mensual. Esto no equivale a auditar todos los roles, anchos o navegadores ni a probar el flujo con una API real.

## Riesgos y recuperación

- **Tema oscuro:** el degradado de la agenda usa roles de superficie; revisar la captura real y retirarlo por un fondo sólido temático si el contraste se degrada.
- **Tabla en móvil:** la matriz sigue siendo bidimensional; su scroll queda dentro del contenedor para evitar desplazar toda la página.
- **Movimiento:** el halo es decorativo y no comunica el dato por sí solo. La línea y su posición siguen siendo estables cuando se reduce movimiento.
- **Reversión:** cambios contenidos en hojas CSS del panel. Restaurar esos archivos devuelve el tratamiento anterior sin tocar lógica, permisos, API ni datos.

## Siguiente acción

Usar la cobertura registrada como base para la siguiente revisión; ampliar a otros roles y navegadores en un alcance separado. La deuda de lint global debe tratarse en una tarea propia para evitar mezclar 256 errores de otras áreas con este cambio de diseño.
