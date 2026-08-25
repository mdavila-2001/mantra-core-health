# Verificación del plan de UX — 23/08/2026

Recorrido con **usuarios reales contra la API viva** (`localhost:3000`), con la
aplicación servida desde el código de esta rama. No es una prueba de regresión:
es la evidencia con la que se revisa lo entregado. La reproduce
`playwright/ux-evidencia.spec.ts`.

## Cómo se reprodujo

Las dos cuentas se dieron de alta **por las altas públicas de la propia API**,
que es el camino que recorre cualquiera:

```bash
S=ux$(date +%H%M%S)
curl -X POST localhost:3000/iam/auth/register-practitioner -H 'Content-Type: application/json' \
  -d "{\"email\":\"medico-$S@example.test\",\"password\":\"S3cret-passw0rd\",\"name\":\"Lucía\",\"lastName\":\"Salas\",\"licenseNumber\":\"MP-$S\",\"credentialNumber\":\"TIT-$S\",\"professionalTitle\":\"Médica cardióloga\"}"
curl -X POST localhost:3000/iam/auth/register-patient -H 'Content-Type: application/json' \
  -d "{\"nationalId\":\"CI-$S\",\"password\":\"S3cret-passw0rd\",\"name\":\"Ana\",\"lastName\":\"Quispe\"}"

yarn start --port 4201     # el 4200 puede estar ocupado por otra sesión
E2E_BASE_URL=http://localhost:4201 \
E2E_SHOTS="$PWD/evidencias/ux-2026-08-23" \
E2E_DOCTOR_EMAIL="medico-$S@example.test" E2E_PATIENT_ID="CI-$S" \
  npx playwright test playwright/ux-evidencia.spec.ts
```

El recorrido es **idempotente**: si el médico ya tiene horario publicado, se
saltea el alta y sigue por la edición.

## Qué muestra cada captura

| Archivo | Qué prueba | Frente |
| --- | --- | --- |
| `01-menu-del-medico` | El menú **completo** del médico: ocho entradas y «Mi cuenta» | §4.H |
| `02-consulta-medica` | La puerta que no existía, con su camino sin turno | §4.H · 1 |
| `03-evoluciones` | El listado transversal, **diciendo** qué no puede hacer todavía | §4.H · 6 |
| `04-publicar-mi-agenda` | El alta, tal como estaba (sólo en la primera corrida) | D |
| `05-agenda-publicada` | El alta completada, con la salida a «Mi agenda» | D |
| `06-cambiar-mi-horario-precargado` | La misma pantalla reabierta: **precargada** y presentada como cambio, con el aviso de los turnos ya abiertos | D2 |
| `07-mi-agenda-con-horario` | El horario publicado, en palabras | D |
| `08-bloqueo-visible-en-el-mes` | El bloqueo **a la vista** en la solapa del mes | D5 |
| `09-bloqueo-por-rango-y-franja` | Rango de días, franja horaria y motivo, en un solo paso | D4 |
| `10-panel-del-paciente-sintomas` | «¿Qué te pasa?» encabezando el panel | C5 |
| `11-sintomas-reconocidos-y-recomendacion` | Los chips pintados y la recomendación con su porqué | C2 · C3 |
| `12-derivacion-a-urgencias` | Con un síntoma de alarma **deja de recomendar** | C6 |
| `13-directorio-medicos` | Grilla de tarjetas, chips de especialidad, agrupado y contador | A1 · A4 · F1 |
| `14-directorio-clinicas` | El tercer hermano, que no existía | A5 |
| `15-directorio-farmacias` | El cuarto hermano, que no existía | A6 |
| `20-mi-facturacion` | La contabilidad hablando de la plata del médico | H4 |
| `21-directorio-laboratorios-grilla` | Los chips de filtro sobre el directorio que ya existía | A2 · A3 |

## Lo que el recorrido encontró, y se arregló

1. **`/organizations-directory` no abría.** El proxy de desarrollo compara por
   inicio de ruta y `/org` está en su lista, así que la pantalla se iba entera a
   la API y volvía `Cannot GET /organizations-directory`. Es la trampa que el
   propio repositorio documenta en `proxy.conf.json` y que denuncia
   `scripts/check-route-prefixes.mjs` —que no había corrido—. La ruta pasó a
   `clinics-directory`, que además se lee mejor.

2. **Todas las iniciales empezaban con «D».** El directorio de médicos tenía su
   propia copia de «las iniciales de un nombre» y esa copia no descartaba el
   tratamiento; como el backend compone «Dr(a). Nombre Apellido», doce tarjetas
   seguidas decían `DA`, `DC`, `DJ`… La función vive ahora una sola vez en
   `shared/text/iniciales.ts`, con su prueba.

3. **El botón de la edición seguía diciendo «Publicar mi agenda»** al reabrir un
   horario existente, y la felicitación mandaba a «Mi perfil» en vez de a la
   agenda recién cambiada.

## Lo que estas capturas NO prueban

- **La grilla llena de los directorios de laboratorios, clínicas y farmacias.**
  La base local no tiene centros verificados ni fichas públicas de organización,
  así que se ve el estado vacío. Lo que sí se ve es la anatomía —encabezado,
  chips, contador— y la grilla llena se ve en `13-directorio-medicos`, que usa
  el mismo componente.
- **La recomendación con varias especialidades.** En esta base sólo hay
  profesionales con «Medicina general» registrada, y el flujo **no recomienda lo
  que no existe**: por eso `11` muestra una sola. Es el comportamiento correcto,
  visible.
- **Las sedes en la ficha pública y la foto del perfil**: siguen bloqueadas por
  backend (P16 y P17 en `PENDIENTES-BACKEND.md`).
