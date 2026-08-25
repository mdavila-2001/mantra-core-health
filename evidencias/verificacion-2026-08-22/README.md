# Verificación del 22/08/2026 — chat entre entes, pestaña «Formularios» y disciplina de formularios

Rama `pablo/motor-de-formularios` (front, HEAD `a6ec5f6`) servida con `yarn start --port 4300`
contra la API del compose (`http://localhost:3000`, `mantra-redesa-api-1`).

## 1 · Chat entre entes — **funciona**

`yarn pw playwright/carril-chat-realtime.spec.ts` con `E2E_BASE_URL=http://localhost:4300` y
`E2E_API_URL=http://localhost:3000`: **6 de 6 en verde, 3,4 min**. Cuentas creadas frescas por la
propia corrida (doctora, paciente y broker), dos navegadores en paralelo.

| Captura | Qué prueba |
|---|---|
| `p1-doctor-envio.png` · `p1-paciente-recibio-en-vivo.png` | El mensaje del doctor aparece en el hilo del paciente **sin recargar** (WebSocket, no sondeo). |
| `p2-bandeja-no-leido-en-vivo.png` | La bandeja pinta el no-leído en vivo, con el hilo cerrado. |
| `p3-doble-check-en-vivo.png` | El doble check se pinta cuando la otra punta abre el hilo. |
| `p4-broker-doctor-en-vivo.png` | **Entes distintos**: un broker (organización) chatea con un doctor. No hay ACL por tipo de cuenta. |
| `n1-enviar-deshabilitado.png` | El textarea vacío no habilita «Enviar». |
| `n2-fallback-sondeo.png` | Con el socket caído a mano, el mensaje igual llega por el sondeo de 60 s. |

## 2 · Pestaña «Formularios» sólo para doctor — **no existe todavía**

| Captura | Qué muestra |
|---|---|
| `f1-menu-doctor-sin-formularios.png` | Menú de una cuenta `PRACTITIONER` recién creada: 25 secciones, **ninguna llamada «Formularios»**. |
| `f2-doctor-en-formularios-clinicos.png` | El doctor que entra a mano a `/administration/clinical-forms` es devuelto a `/dashboard` por `seccionRolesGuard`. |
| `f3-menu-admin-con-formularios-clinicos.png` | Lo que existe hoy es **«Formularios clínicos»**, bajo *Administración* y sólo para `SECURITY_ADMIN`. |
| `f4-admin-formularios-clinicos.png` | Esa pantalla, vista por el admin: arma plantillas por especialidad, no es el generador del doctor. |

El bloqueo de fondo sigue en la API: `POST /forms/assignments` exige `SECURITY_ADMIN`
(`forms-assignments.controller.ts:98`), mientras que `GET` ya admite `CLINICIAN`/`PRACTITIONER`
(línea 56). Sin ese permiso un doctor puede declarar un campo pero no colgarlo de un formulario.

## 3 · Disciplina de 4 campos por página y barra — **el motor existe, no está aplicado**

| Captura | Qué muestra |
|---|---|
| `g2-motor-4-campos-barra-paso-1.png` | `app-paginated-form` en la vitrina: 4 campos, stepper de 2 pasos y barra en 0 % (`aria-valuenow=0`). |
| `g3-motor-validacion-no-deja-pasar.png` | «Siguiente» sin escribir nada no avanza: valida la página, no el formulario entero. |
| `g1-alta-paciente-pared-de-campos.png` | `/auth/register/patient`: **12 controles en una sola pantalla, 0 barras de avance**. La pantalla para la que se construyó el motor todavía no lo usa. |
| `g4-auditoria-disciplina-formularios.png` | Barrido de las 78 plantillas con `[formGroup]`: **0 usan el motor** y **41 pasan de 4 campos por página**. |

El conteo de «campos» sale de los controles declarados en la plantilla (incluye los
condicionales), así que es un techo, no lo que se ve a la vez. Aun así ninguna pantalla tiene
paginación ni barra: la diferencia entre 12 y 28 en el alta de paciente es de campos ocultos, no
de páginas.

## 4 · Lo que se construyó después de verificar

### La pestaña «Formularios» del doctor

| Captura | Qué muestra |
|---|---|
| `h1-menu-doctor-con-formularios.png` | El menú de la doctora, ahora con **«Formularios»** bajo *Atención*. No aparece para el admin ni para el paciente: la sección declara `exclusiveRoles`. |
| `h2-lista-formularios-estandar.png` | Los 43 formularios estándar del catálogo, para elegir cuál extender. |
| `h3-formulario-abierto-presupuesto-y-previa.png` | La anamnesis general abierta: 14 campos del estándar (que no se tocan), el presupuesto «1 de 12 campos propios» con su barra, y la vista previa. |
| `h4-vista-previa-4-campos-y-barra.png` | La vista previa es el motor de verdad: 4 campos en la página y su barra. |
| `h5-campo-propio-agregado.png` | Tras agregar «¿Fuma?»: aparece marcado «Tuyo» y el presupuesto pasa a «2 de 12». |

El recorrido corre contra la API parcheada (`:3011`), con el permiso nuevo de
`POST /forms/assignments`. Sin ese cambio, el paso de agregar el campo devuelve 403.

### La disciplina, aplicada

| Captura | Qué muestra |
|---|---|
| `i1-caso-verificacion.png` · `i2-concesion.png` · `i3-protocolo.png` | Tres pantallas internas ya migradas. La de protocolo pedía 12 campos de una vez; ahora dice «Paso 1 de 8». |
| `j1-alta-aseguradora-paginada.png` | El alta pública de aseguradora: 14 campos en una pantalla → 4 pasos con nombre. |
| `j2-alta-organizacion-paginada.png` | El alta de organización, con su «Cancelar» junto al «Atrás». |

`node scripts/check-form-pages.mjs` queda en verde: 34 formularios revisados,
ninguno pide más de cuatro campos de una vez. Declara aparte lo que **no** es un
formulario lineal (la vitrina, el motor, el repetidor de mapeos, el constructor
de agenda semanal) y lo que **falta** (`register-patient`, en reescritura en otra
rama).

## Cómo reproducir

```bash
cd mantra-core-health
yarn start --port 4300
E2E_BASE_URL=http://localhost:4300 E2E_API_URL=http://localhost:3000 \
  npx playwright test playwright/carril-chat-realtime.spec.ts --reporter=list
```
