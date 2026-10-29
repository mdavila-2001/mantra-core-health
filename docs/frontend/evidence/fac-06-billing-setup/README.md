# FAC-06 · «Configuración para facturar» — evidencia de navegador

Chromium sin ventana (Playwright) contra el front de esta rama (`real-api`) y la API de la rama
`itzan/fac-06-billing-setup-dev` (`origin/dev` + FAC-06) en local, con su base construida por el DDL del
repositorio. La médica es una cuenta sintética `@alovida.test` dada de alta por el alta asistida real, con su
consultorio propio: sin ejercicio fiscal y con «Cita médica» en `0.00`. Zona `America/La_Paz`, 2026-10-29.
`recorrido.log` es la salida literal, con cada respuesta de la API que pidió la pantalla.

| Paso | Qué se ve | Capturas |
|---|---|---|
| Contabilidad | El encabezado del resumen enlaza a «Configuración para facturar», con cualquiera de las dos versiones | `fac06-summary-link-1440.png` |
| Vista contable sin ejercicio | El aviso dice que se abre en «Configuración para facturar» y ofrece «Abrir el ejercicio», que lleva a la pantalla | `fac06-cockpit-missing-year-1440.png` |
| Antes | «Ejercicio fiscal»: la práctica no tiene (la API responde 404). «Precio de la consulta»: «Defina el precio», nunca «0,00 Bs» | `fac06-before-fiscal-year-1440.png`, `fac06-before-price-1440.png` |
| Precio 0 | `422 PATCH /billing/service-catalog/:id`: «El precio tiene que ser mayor que 0» junto al campo | `fac06-price-zero-rejected-1440.png` |
| Precio 150 | `200 PATCH`: «150,00 Bs» | `fac06-price-saved-1440.png` |
| Abrir el ejercicio | `201 POST /accounting/fiscal-years`: FY2026, del 01/01/2026 al 31/12/2026, mes en curso 2026-10, 12 meses | `fac06-fiscal-year-opened-1440.png` |
| Recarga | El ejercicio y el precio siguen | (en `recorrido.log`) |
| Emisor | «Emisor de prueba»; la práctica todavía no tiene emisor, porque no registró consultas | `fac06-issuer-1440.png` |
| Teléfono, 390 px | Las tres pestañas, sin desborde horizontal (0 px) | `fac06-fiscal-year-390.png`, `fac06-price-390.png`, `fac06-issuer-390.png` |

El consultorio de esta médica nació sin «Cita médica»: el alta del consultorio propio no la crea, y la repone
el seed de contenido del arranque de la API (`SEED_CONTENT_ON_BOOT`), con el que se reinició una vez para
este recorrido (mdavila-2001/mantra-core-health-api#1102). Sin el servicio, la pestaña lo dice y lleva a
«Mis servicios».

El 404 de «la práctica no tiene ejercicios fiscales» sale en la consola del navegador: lo escribe el
interceptor que registra toda respuesta fallida de la API, el mismo que ya lo hacía en la vista contable.
