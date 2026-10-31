# Doble revisión — segunda pasada adversarial (regla 35 / skill `critical-double-review`)

- Revisor: independiente del implementador (regla 70.4.8). Postura: rechazar.
- Fecha: 2026-10-31. Base: capturas reales en `capturas-h1/` (36 png + 4 txt) y `capturas-h8/` (12 png). Todas abiertas como imagen.
- Criterio: el del cliente (perfil admin sin «Mis…»; fichas/formularios centrados, a lo ancho, UNA tarjeta con pestañas; ambos temas; móvil usable; estados honestos; WCAG 2.2 AA).
- Contraste medido con muestreo de píxeles (Pillow) sobre los png; archivo:línea leído en `src/app` (solo lectura).

## VEREDICTO GLOBAL: RECHAZADA

Motivos: (1) la pantalla de entrada del perfil admin (Centro de la plataforma) viola la regla del cliente «tarjetas apiladas donde cabe una con pestañas» (2 tarjetas de portal + 9 de estado) y deja huecos grandes; (2) la matriz viewport × tema está incompleta y parte de la evidencia de H1 es anterior al código final (el menú de H1 no contiene «Instancias y herramientas», que sí aparece en H8); (3) varios MAYOR de contraste, honestidad y consistencia sin corregir. Lo mejor entregado (Instancias y herramientas en 3 pestañas) está bien resuelto en lo estructural y en honestidad, y queda como `ACEPTABLE CON RESERVAS` solo en escritorio.

## Matriz de capturas (qué existe y qué no)

| Pantalla | Claro esc. | Claro tablet | Claro móvil | Oscuro esc. | Oscuro tablet | Oscuro móvil |
|---|---|---|---|---|---|---|
| Menú admin (H1) | sí | sí (drawer) | sí (drawer) | sí | sí | sí |
| Menú superadmin (H1) | sí | sí | sí | sí | sí | sí |
| Menú paciente (H1, referencia) | sí | sí | sí | sí | sí | sí |
| Grupos abiertos admin/superadmin (H1) | sí (recortado) | NO | NO | NO | NO | NO |
| Portada Centro admin/superadmin (H1 21:03) | sí | NO | sí (cortada) | NO | NO | NO |
| Centro de la plataforma (H8) | sí (cortada) | NO | sí (cortada) | sí (cortada) | NO | NO |
| Instancias / Herramientas / Dispositivos (H8) | sí | NO | NO | sí | NO | NO |
| Portal de inventario: Ciclo / Resumen (H8) | sí | NO | NO | NO | NO | NO |
| Flujo 2.7 «Datos que toca» (H8) | sí | NO | NO | NO | NO | NO |
| Superadmin: analítica, catálogo de datos, contabilidad, observabilidad, usuarios (H1 20:56) | sí | NO | NO | NO | NO | NO |

## Pasada 1 — verificación (una línea por captura)

H1 menús (todas con grupos colapsados):
- P1 — admin-claro-escritorio / admin-oscuro-escritorio — Menú sin «Mis…» (solo «Mi perfil», «Notificaciones», Administración, Facturación, Contabilidad, Superadministración, Herramientas). OK en lo pedido. DEFECTO: el contenido es «Hola, Marcelo / Últimos pacientes» (aterrizaje anterior a la portada Centro); en claro el título queda pegado bajo la barra superior (y=55–68), en oscuro queda el tooltip «Tema» colgado.
- P1 — admin-/superadmin-*-tablet y *-movil (claro/oscuro) — drawer de 300 px, grupos colapsados, sin «Mis…». OK. DEFECTO: no demuestra el contenido de los grupos en móvil/tablet.
- P1 — admin-claro-escritorio-grupos-abiertos / superadmin-claro-escritorio-grupos-abiertos — Sin «Mis…» en lo visible; DEFECTO: recortada abajo (Herramientas no se ve completa) y solo claro/escritorio.
- P1 — superadmin-claro/oscuro-escritorio — igual que admin, con selector de organización. DEFECTO igual (título bajo la barra; tooltip «Tema» pegado en oscuro).
- P1 — paciente-* (6) — referencia: menú con «Mis …». OK como contraste. DEFECTO menor: barra superior translúcida deja ver el contenido por detrás (paciente-*-escritorio, y=5–50).
- P1 — portada-admin-/superadmin-escritorio — Centro con 2 tarjetas de portal + 6 de estado. DEFECTO: ver B1.
- P1 — portada-admin-/superadmin-movil — Centro apilado. DEFECTO: la captura se corta en «Despliegues vigentes»; faltan «Pruebas» y «Respaldos».
- P1 — superadmin-analitica-web / catalogo-datos / observabilidad — una tarjeta con pestañas, a lo ancho. OK en estructura. DEFECTOS en la pasada 2.
- P1 — superadmin-contabilidad — DEFECTO: lenguaje y controles de doctor (ver M8).
- P1 — superadmin-usuarios — formulario a lo ancho, sin tarjeta. DEFECTO (ver M9).

H8:
- P1 — centro-claro-escritorio / centro-oscuro-escritorio — Centro con 11 tarjetas. DEFECTO B1. Cortadas en «Respaldos».
- P1 — centro-claro-movil — apilado, usable; cortada en «Dispositivos».
- P1 — instancias-instancias-claro/oscuro — UNA tarjeta, 3 pestañas, a lo ancho, estados con evidencia. OK estructural. DEFECTOS M3/M5/M6.
- P1 — instancias-herramientas-claro/oscuro — ídem; cortada antes del aviso final.
- P1 — instancias-dispositivos-claro/oscuro — ídem; las sumas cuadran (690+640+60+10 = 1400; 540+480+230+90+60 = 1400; 620+410+200+110+60 = 1400; 1010+240+110+40 = 1400).
- P1 — portal-operacion-resumen / portal-operacion-ciclo — pestañas dentro de tarjeta, pero con navegación local propia. DEFECTO M4.
- P1 — flujo-datos-que-toca — una tarjeta con 5 pestañas, honesta («Los casos… todavía no están en el QA Lab», «Nunca se corrió»). OK. DEFECTO menor de espaciado.

## Pasada 2 — las diez preguntas (agrupadas por pantalla; las celdas del mismo componente tienen idéntico contenido y se declara)

Preguntas: (1) ¿qué rompe en 390 px? (2) ¿otro tema? (3) ¿información solo por color? (4) ¿cortado/solapado? (5) ¿jerarquía en 3 s? (6) ¿vacíos o ancho desperdiciado? (7) ¿contraste dudoso? (8) ¿estados honestos? (9) ¿consistencia con la app? (10) ¿qué rechazaría?

### A. Menú del perfil admin/superadmin (H1 menús, 12 capturas + 2 grupos abiertos)
1. En 390 px el drawer ocupa 300 px y deja 90 px de contenido atenuado; legible. Rompe la verificación, no la UI: los grupos están colapsados, no se ve ni un solo ítem de Administración/Superadministración en móvil. 2. Oscuro: coherente, el drawer casi se funde con el fondo, el borde se pierde. 3. El estado activo (barra verde + fondo) lleva además texto en negrita; OK. «Caída/Degradada» no aplica aquí. 4. «Orquestación de pruebas», «Proveedores de identidad», «Instancias y herramientas» envuelven a dos líneas; aceptable pero rompe el ritmo vertical. 5. Se entiende en 3 s qué hay (sin «Mis…»), pero los encabezados de grupo se leen como deshabilitados. 6. Mitad inferior del drawer vacía, normal. 7. Encabezados de grupo («Administración», «Superadministración», «Herramientas»): fg ≈ `#86A6B7` sobre ≈ `#0A4C6E` = 3,6:1 y 3,8:1 medidos; texto de ~14 px normal exige 4,5:1. FALLA AA. 8. N/A. 9. «Superadministración» no lleva chevrón en escritorio (colapsado) pero sí en el drawer móvil/tablet; Administración y Herramientas sí lo llevan en ambos. Inconsistente. 10. Rechazaría: contraste de los encabezados, falta de la evidencia móvil/tablet con grupos abiertos, y que el menú de H1 es anterior a «Instancias y herramientas» (que H8 sí muestra).

### B. Aterrizaje «Hola, … / Últimos pacientes» (admin-*, superadmin-* escritorio)
1. Lo primero: los nombres de paciente son enlaces con el azul puro del navegador (claro) y lila del navegador (oscuro), mientras «Ver el listado completo» usa el teal de la marca. 2. En oscuro el lila sobre el fondo oscuro de la tarjeta se lee bien pero se ve ajeno al sistema. 3. No. 4. Claro: el título «Hola, Marcelo…» queda recortado contra el borde de la barra superior (captura tomada con scroll); oscuro: tooltip «Tema» flotando. 5. Jerarquía clara pero pobre: para un admin de gestión/medición, la entrada es una lista de pacientes. 6. ≈ 45 % de la altura vacío bajo la tarjeta. 7. Azul `#0000EE` sobre blanco 8,6:1, pasa; el problema es de marca, no de ratio. 8. «212 en AloVida Plataforma» para el superadmin repite los mismos 5 nombres/IDs (PAC-20000…20004) que «Clínica Los Olivos»: dato de maqueta presentado como de la organización; solo lo cubre el badge flotante «Datos de prueba». 9. Rompe el patrón de enlaces (`app-link`) usado en el resto. 10. Rechazaría: enlace sin estilo del sistema, y que el superadmin vea nombres de pacientes de una organización «Plataforma».
- Código: `src/app/features/dashboard/dashboard.html:~135` (`<a [routerLink]… class="panel__fila-nombre">` sin `app-link`) y `dashboard.css:102`.

### C. Centro de la plataforma (portada-* H1; centro-* H8)
1. 390 px: usable (una columna), pero ~2 600 px de alto y la captura se corta; 11 tarjetas apiladas, el usuario hace scroll infinito. 2. Oscuro: correcto, «No lista» en salmón legible. 3. «No lista» se acompaña de texto; el color solo refuerza. Pills «Caída» rojo / texto presente. OK. 4. Captura cortada en «Respaldos» (escritorio) y en «Dispositivos» (móvil): no se puede decir qué hay debajo. 5. En 3 s se ve un muro de tarjetas iguales; el estado «Caída»/«No lista» no gana jerarquía sobre «API hoy». 6. La tarjeta «Portal de reportería» tiene ≈ 220 px de vacío interno en escritorio (portada) y la rejilla 4+4+1 deja «Respaldos» huérfana, con dos tercios de fila vacíos. 7. Textos secundarios de 11–12 px (`Solicitudes`, `Controles`) en gris medio; límite. 8. Honesto en el detalle («Sólo 2 de 6 críticas respondieron a una sonda en vivo»), pero la tarjeta «Instancias» del Centro muestra «Vivas 5 / Caída» sin decir que el detalle es SIMULADO (la pantalla de detalle sí lo dice fila por fila). 9. Los códigos crudos `INC_SEV3`, `OPS_ENV_PRD`, `DEP_SUCCEEDED` no se ven en ninguna otra pantalla de la app. 10. Rechazaría: es el patrón que el cliente prohibió (tarjetas apiladas donde cabe UNA con pestañas).
- Código: `src/app/features/dashboard/platform-home/platform-home.html:13` (2 `app-card` de portal), `:37, 60, 83, 114, 139, 159, 182, 206, 229` (9 `app-card` de estado); `platform-home.css:27` (`repeat(auto-fit, minmax(18rem, 1fr))` produce la fila huérfana). Tarjeta Instancias: `platform-home.html:59-79`.

### D. Instancias y herramientas (3 pestañas, claro/oscuro, escritorio)
1. 390 px: NO CAPTURADA; no hay evidencia. La tabla de 6–7 columnas (`Se da por caída después de`, `Cómo se comprobó`, `Variables que faltan`) es candidata clara a desborde horizontal. 2. Oscuro: correcto; píldoras con buen contraste; el aviso «Esto no está medido» pasa a verde (semántica de éxito para algo no medido). 3. Estados con texto; las píldoras «Sin dato», «Sin sondear» y «Apagada» comparten un teal-gris casi igual al de «Viva»/«Responde» (fondos `#F0F9F8` vs `#DFEDE9`, ambos verdosos): se distinguen por la palabra, poco por el color. 4. `worker-` / `workflow`, `worker-` / `read-` / `models` se parten en 2–3 líneas en una columna estrecha mientras «Se da por caída después de» reserva ≈ 200 px para un número alineado a la derecha: columnas mal repartidas. Aviso final cortado en la captura (Instancias y Herramientas). 5. Buena: título, estado general, aviso, 4 cifras, tabla. 6. Los dos `select` («Todos los tipos», «Todos los estados») ocupan 1 086 px cada uno, apilados: ancho completo innecesario para controles de 3–5 opciones. Igual «Toda la salud» y «Web y móvil». Dispositivos deja ≈ 600 px vacíos bajo la tarjeta. 7. Etiquetas `CAÍDAS/DEGRADADAS` en mayúsculas 11 px: límite pero pasa (≥ 5:1 medido en píldoras 5,0–6,7:1). 8. Muy bueno: «Evaluado el … (reloj de la API)», «SIMULADO ·» por fila, «Caída quiere decir sin latido recibido…». Reservas: aparecen identificadores internos en texto de usuario (`HEARTBEAT_EXPIRED`, `PROBE_SLOW`, `NEVER_SEEN`, `botsExcluded:`, `appVersionWeb:`, `breakdownRowCap:`, `replicasOfApi:`, «UNSPECIFIED»). 9. Es la mejor aplicación del patrón (una tarjeta, pestañas); su lenguaje técnico no se parece a Observabilidad/Analítica. 10. Rechazaría (solo por estos puntos): selects a ancho completo, identificadores crudos, columnas mal repartidas y falta de captura móvil/tablet.
- Código: `src/app/features/admin/instances/instances.html:19-20` (tarjeta + `app-tabs`, correcto), `:66-82, :181, :235` (`app-select` en `instancias__filtros`), `instances.css:35-41` (flex-wrap sin ancho máximo para los `select`; el control segmentado sí lo tiene en `:45-48`).

### E. Portal de inventario — Resumen / Ciclo de la petición
1. 390 px: NO CAPTURADA; una navegación lateral de 238 px dentro de otra de 240 px no cabe en móvil sin rediseño. 2. Oscuro: NO CAPTURADA. 3. «Riesgo alto» con texto. 4. Backticks Markdown crudos en la UI: «`helmet`», «`x-request-id`», «`correlationId`»; rutas `src/main.ts:162` en monoespaciado. 5. Tres controles de «volver» a la vez (flecha circular, «Volver a las operaciones» a ancho completo, miga «Portal ›» y miga «Panel /…»): jerarquía confusa; la acción principal no existe. 6. Columna izquierda: tarjeta oscura de ≈ 590 px y debajo ≈ 1 000 px de vacío (bloque pegado a la izquierda con columna vacía, lo que el cliente prohíbe); botón «Volver…» de ancho completo innecesario. 7. Pestaña activa «Ciclo de la petición» con fondo gris relleno y las otras sin él: estado hover residual o inconsistencia. 8. Honesto («Estas 21 etapas… Es lectura del código, no una traza de una petición real»; «Generado por la maqueta»). 9. Dos migas de pan distintas y un buscador propio: no es el patrón del resto. 10. Rechazaría: navegación triplicada, columna vacía, 21 sub-tarjetas apiladas dentro de la pestaña.

### F. Flujo 2.7 — Datos que toca
1. 390 px NO CAPTURADA (cinco pestañas + dos columnas «Escribe/Lee» a 50 %). 2. Oscuro NO CAPTURADA. 3. Chips «POST» y «Sin operación en el contrato» con texto. 4. «Suma de 3 de 3 operaciones cruzadas…» queda pegada a la tarjeta siguiente (≈ 8 px), sin respiro; backticks crudos en «`POST /payments/checkout-sessions`». 5. Clara. 6. Aceptable; ≈ 400 px vacíos abajo. 7. Pasa. 8. Excelente: «0 de 3 casos sembrados», «Nunca se corrió», aviso del QA Lab. 9. Miga «Catálogo de flujos / Flujo 2.7» distinta de «Panel / Superadministración / …» del resto. 10. Rechazaría solo por la falta de móvil/oscuro y el espaciado.

### G. Páginas superadmin de H1 (analítica, catálogo de datos, observabilidad, contabilidad, usuarios)
1. 390 px NO CAPTURADAS. 2. Oscuro NO CAPTURADAS. 3. Pestañas con subrayado + color; OK. 4. Catálogo de datos: «billing.invoices Factura» con la descripción pegada al nombre sin separación; esquema y nombre con pesos distintos en el mismo enlace. 5. Analítica: gráfico de 7 barras sin eje ni valores (solo leyenda debajo): ilegible como dato. 6. Observabilidad: ≈ 45 % vacío abajo. Analítica: `select` «Todos los portales» a 1 120 px. 7. Pasa lo medido. 8. Observabilidad y Analítica dicen «calculado en el servidor sobre una ventana acotada»; correcto. Contabilidad: «Bs 12 240,00» sin marca de fuente en la captura. 9. Usuarios: formulario sin tarjeta, con stepper decorativo (línea ECG) y dos pasos para tres campos. Contabilidad: dos filas de pestañas (Resumen/Anotar… y Ganancias/Por cobrar…) más conmutadores «Doctor/Contador» y «Este mes/Este año», con textos «Sus pacientes y lo que cobró», «¿Qué quiere anotar?»: vista de doctor dentro del perfil de administración. 10. Rechazaría Contabilidad (mezcla de perfil) y Usuarios (no está en UNA tarjeta).

## Hallazgos

### BLOQUEANTE
- **B1 — Centro de la plataforma incumple la regla del cliente (tarjetas apiladas)**. `centro-claro-escritorio.png`, `centro-oscuro-escritorio.png`, `centro-claro-movil.png`, `portada-admin-*.png`, `portada-superadmin-*.png`. 2 tarjetas de portal + 9 de estado en rejilla irregular (4+4+1 huérfana); «Portal de reportería» con ≈ 220 px de hueco interno; el estado crítico («Caída», «No lista») no destaca. Debe ser UNA tarjeta con pestañas (p. ej. Portales · Estado · Instancias · Calidad). `src/app/features/dashboard/platform-home/platform-home.html:13, 37–229`, `platform-home.css:27`.
- **B2 — Evidencia insuficiente para cerrar la matriz** (`FAIL: INSUFFICIENT_EVIDENCE` en esas celdas): no hay tablet ni móvil de Instancias, Herramientas, Dispositivos, Portal de inventario, Flujo 2.7 ni de las páginas superadmin de H1; no hay oscuro de Portal de inventario, Flujo 2.7 ni de esas páginas; no hay menús con grupos abiertos en móvil/tablet/oscuro. Capturas cortadas (centro-claro/oscuro-escritorio en «Respaldos», centro-claro-movil, portada-*-movil, instancias-*-claro/oscuro antes del aviso final).

### MAYOR
- **M1 — Contraste de encabezados de grupo del menú** 3,6:1 y 3,8:1 (< 4,5:1), y parecen deshabilitados. Todas las capturas de menú y de página. Componente de la barra lateral (`shell-layout`/navegación; no localizado con certeza).
- **M2 — Evidencia de H1 anterior al código final**: los menús/aterrizajes `admin-*`, `superadmin-*` (18:56–19:00) y las páginas superadmin (20:56) son previos a la portada (21:03) y a H8 (02:46); el menú de H1 no muestra «Instancias y herramientas». Regla 30.4: no se hereda evidencia vieja. Re-capturar.
- **M3 — Selects a ancho completo innecesario** (Instancias, Herramientas, Dispositivos, Analítica web). `instances.html:66-82, 181, 235`; `instances.css:35-41`.
- **M4 — Portal de inventario: navegación triplicada y columna vacía** (flecha, «Volver a las operaciones», dos migas) con tarjeta lateral oscura y ≈ 1 000 px vacíos debajo; sin móvil. `portal-operacion-*.png`.
- **M5 — Honestidad del resumen**: la tarjeta «Instancias» del Centro afirma «Vivas 5 / Caída» sin indicar que el detalle es SIMULADO (el detalle sí lo hace fila por fila). `platform-home.html:59-79`.
- **M6 — Identificadores internos y Markdown crudo en texto de usuario**: `HEARTBEAT_EXPIRED`, `PROBE_SLOW`, `NEVER_SEEN`, `UNSPECIFIED`, `botsExcluded:`, `appVersionWeb:`, `breakdownRowCap:`, `replicasOfApi:`, `INC_SEV3`, `OPS_ENV_PRD`, `DEP_SUCCEEDED`; backticks `` ` `` literales en Portal de inventario y Flujo 2.7.
- **M7 — Enlaces de pacientes con el color por defecto del navegador** (azul puro / lila), fuera del sistema. `dashboard.html:~135`, `dashboard.css:102`.
- **M8 — Contabilidad mezcla perfiles**: «Ver como Doctor/Contador», «Sus pacientes y lo que cobró», «¿Qué quiere anotar?», dos filas de pestañas. `superadmin-contabilidad.png`. Contradice «el perfil de administración no mezcla perfiles».
- **M9 — Alta de usuario no está en UNA tarjeta** (formulario suelto con stepper decorativo). `superadmin-usuarios.png`.
- **M10 — Superadmin ve «Últimos pacientes: 212 en AloVida Plataforma»** con los mismos 5 nombres/IDs que «Clínica Los Olivos» (`superadmin-*-escritorio.png`): dato de maqueta con aspecto de dato real; solo lo cubre el badge flotante.

### MENOR
- m1 — Título «Hola, …» recortado bajo la barra superior (admin/superadmin claro y oscuro escritorio, y=55–68) y tooltip «Tema» colgado en capturas oscuras: capturas con hover/scroll residual; repetir limpias.
- m2 — «Superadministración» sin chevrón en escritorio y con chevrón en drawer.
- m3 — «Sin dato», «Sin sondear» y «Apagada» comparten teal-gris casi idéntico al de «Viva»/«Responde»; el aviso «Esto no está medido» en verde en oscuro.
- m4 — Tabla de instancias: columnas mal repartidas, `worker-` / `workflow` en 2–3 líneas.
- m5 — «Suma de 3 de 3…» pegada a la tarjeta siguiente (Flujo 2.7); en la tarjeta Instancias del Centro el texto «…no llegó su latido.» queda pegado a la etiqueta «Caídas».
- m6 — Pestaña activa con relleno en «Ciclo de la petición» pero no en «Resumen».
- m7 — Migas de pan inconsistentes (Flujo 2.7 y Portal de inventario frente al resto).
- m8 — Gráfico de barras de Analítica web sin eje ni valores.
- m9 — Barra superior translúcida del paciente deja ver contenido (fuera del alcance; referencia).
- m10 — Enlaces de lista del Centro a 15 px con ≈ 26 px de paso: objetivo bajo en móvil (WCAG 2.5.8 límite).

## Nota por pantalla (ante la duda, la más baja)

| Pantalla (archivos) | Nota |
|---|---|
| Menú admin claro/oscuro × esc./tablet/móvil (`admin-*`) | ACEPTABLE CON RESERVAS en lo pedido (sin «Mis…»), pero RECHAZADA como evidencia final por M1 y M2; contará como RECHAZADA hasta recapturar |
| Menú superadmin (`superadmin-*-escritorio/tablet/movil`) | RECHAZADA (M1, M2) |
| Grupos abiertos admin/superadmin (`*-grupos-abiertos`) | RECHAZADA (B2: recortada y solo claro/escritorio) |
| Menú paciente (`paciente-*`) | APROBADA como referencia (fuera de alcance) |
| Aterrizaje «Últimos pacientes» (`admin-*-escritorio`, `superadmin-*-escritorio`) | RECHAZADA (M7, M10, m1) |
| Centro de la plataforma, `portada-*` y `centro-*` | RECHAZADA (B1, B2) |
| Instancias, Herramientas, Dispositivos — escritorio claro/oscuro | ACEPTABLE CON RESERVAS en escritorio (M3, M6 deben corregirse; honestidad y estructura correctas) |
| Instancias/Herramientas/Dispositivos — tablet y móvil | RECHAZADA (no capturadas) |
| Portal de inventario — Resumen y Ciclo | RECHAZADA (M4, M6) |
| Flujo 2.7 — Datos que toca | ACEPTABLE CON RESERVAS (m5, M6; faltan móvil y oscuro → RECHAZADA en esas celdas) |
| Superadmin Analítica web | ACEPTABLE CON RESERVAS (M3, m8) |
| Superadmin Catálogo de datos | ACEPTABLE CON RESERVAS |
| Superadmin Observabilidad | ACEPTABLE CON RESERVAS |
| Superadmin Contabilidad | RECHAZADA (M8) |
| Superadmin Usuarios | RECHAZADA (M9) |

## Corrección y re-captura exigidas (regla 35.1.4)
B1, B2, M1–M10 requieren cambio de código o recaptura y luego las dos pasadas sobre las nuevas capturas (los tres viewports 390/820/1440 × claro/oscuro, capturas completas sin recorte, sin tooltips colgados).

## No cubierto por esta revisión
- Comportamiento (foco, teclado, trampa de foco del drawer, `prefers-reduced-motion`): una captura estática no lo prueba; no se ejecutó nada contra la app.
- Consola y red solo se conocen por `consola-y-red.txt` de H1 («sin errores de consola ni respuestas >=400»); H8 no trae archivo equivalente.
- Autorización y persistencia: fuera de esta revisión visual.
- Menús de otros roles admin distintos de PLATFORM_ADMIN/superadmin.
