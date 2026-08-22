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

## Cómo reproducir

```bash
cd mantra-core-health
yarn start --port 4300
E2E_BASE_URL=http://localhost:4300 E2E_API_URL=http://localhost:3000 \
  npx playwright test playwright/carril-chat-realtime.spec.ts --reporter=list
```
