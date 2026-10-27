# Port visual de `mockup` a `dev` y `test` (26/10/2026)

## Cómo se midió

Las dos ramas se levantaron con **el mismo backend simulado** (`mockBackend`, `demoPresets` y
`designMockups` encendidos sólo en local, sin commitear) y se fotografió cada pantalla del
catálogo `docs/reports/generated/rutas.json`, más las públicas, a 1440 px, con las cuentas
`*@alovida.mock` que corresponden a cada ruta.

Resultado del barrido: **370 pantallas**. 146 iguales (<1 % de píxeles distintos), 144 con
diferencias leves y 80 claramente distintas. Las 101 que pasan del 3 % se revisaron a ojo:
en la mayoría `dev` va por delante o sólo cambian los datos simulados.

Las cuentas de organización (laboratorio, farmacia, imagenología, visitador) no entran al panel sino a su
portada, así que se barrieron aparte siguiendo su menú: 75 pantallas más (puntos 11 y 12). En `dev`, la
sesión simulada de `imagen@alovida.mock` vuelve al acceso; sus pantallas son las del laboratorio.

## Lo que `mockup` tiene y `dev` no

| # | Qué | Dónde | Estado |
| --- | --- | --- | --- |
| 1 | Barra de avance «latido» (ECG) sobre el paso a paso de todos los asistentes | `paginated-form`, `progress` | Franja 1 (PR #1465 / #1466) |
| 2 | Sello animado del tipo de cuenta en la cabecera de cada alta, ayuda en beige, tarjeta con borde | `features/auth` | **Franja 2** (este PR) |
| 3 | «Crear cuenta» separado de «Registre su organización» (`/auth/register/organization-type`) | `register-account-type`, rutas, login | **Franja 2** (este PR) |
| 4 | Íconos a la izquierda de los campos (115 campos en 41 pantallas) | `app-form-field icon` | **Franja 3** |
| 5 | Pestaña «Flujo de dinero», textos llanos y registros con glosario, buscador y paginación | `features/accounting` | **Franja 4** |
| 6 | Citas como tarjetas con franja de color; «Abrir sesión y ver pago» | agenda, mis citas | **No se porta.** El estilo de `mockup` es el «Pulse» del 08/10, que `dev` reemplazó a propósito el 12/10 (carril F, superficies tonales). «Abrir sesión y ver pago» necesita `GET /billing/simulated/patient/charges` y `/payment-reports`, que la API no tiene |
| 7 | Directorio de médicos: filtros laterales, contador, orden, grilla/lista | `/directory` | **No se porta.** En `dev` la grilla de especialidades es la portada del mismo listado con facetas (carril 18, REQ-18-002) |
| 8 | Catálogo de formularios estándar en el constructor | `/form-builder` | **No se porta.** `dev` es más nuevo: «Mis formularios» por defecto y el catálogo detrás de «Cargar formulario» (25/10) |
| 9 | Glosario: vista Tarjetas/Tabla; tabla de créditos del atlas | `features/glossary` | **Franja 5** |
| 10 | Insignias «Verificado» verdes; panel de la médica con tonos cálidos; textos de proveedores de identidad | varios | **Franja 5**: textos del ingreso con proveedor. Las insignias y el panel de `dev` son más nuevos (separan «Verificada contra» de «Fuente de revisión»; tonos del carril F) |
| 11 | Recepción de muestras: «Sonido de alarma» y cartel de orden nueva; «Pidió …» bajo cada estudio | `features/lab-reception` | **Franja 6**. «Pidió …» sólo aparece cuando la API mande `requesterDisplayName` en la bandeja del laboratorio (P-LAB-SOLICITANTE, hoy no lo manda) |
| 12 | «Horarios y equipos» del laboratorio e imagenología | `/administration/center-schedule` | **No se porta: necesita backend.** Usa `GET/PUT/PATCH /diagnostic-units/me/schedule`, que la API no tiene |

Lo que **no** se porta: el backend simulado (`core/mock`) y lo que en `mockup` manda datos nuevos
a la API (p. ej. «dónde estudió cada especialidad» en el alta del médico), que necesita backend.

## Franja 2 — evidencia

Cada imagen: **izquierda `mockup` · centro `dev` antes · derecha esta rama**.

- `franja2_auth_register.jpg` — «Crear cuenta» con las cuentas de persona.
- `franja2_auth_register_laboratory.jpg`, `_pharmacy`, `_practitioner`, `_patient`,
  `_medical-center` — sello en la cabecera, línea ECG y ayuda en beige.

## Franja 3 — evidencia

- `franja3_my-account_questionnaires.jpg`, `franja3_administration_patients_new.jpg` — íconos a
  la izquierda de cada campo (izquierda `mockup` · centro `dev` antes · derecha esta rama).

## Franja 4 — evidencia

- `franja4_administration_accounting.jpg` — Contabilidad con «Ingresos y gastos · Pendientes · Bienes y deudas · Flujo de dinero» y la redacción llana (izquierda `mockup` · centro `dev` antes · derecha esta rama).

## Franja 5 — evidencia

- `franja5_glossary_tabla.jpg` — glosario con el selector Tarjetas/Tabla en la vista Tabla.
- `franja5_atlas_creditos.jpg` — créditos del atlas anatómico en tabla (fuente, licencia, cita, DOI).

## Franja 6 — evidencia

- `franja6_laboratory_reception.jpg` — recepción de muestras con «Sonido de alarma» (izquierda `mockup` · centro `dev` antes · derecha esta rama).
