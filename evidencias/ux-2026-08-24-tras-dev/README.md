# El mismo recorrido, después de traer `dev` — 24/08/2026

Esta carpeta **no** es una entrega nueva: es la de
[`ux-2026-08-23/`](../ux-2026-08-23/) vuelta a correr sobre la rama ya mergeada
con `origin/dev`, que entretanto se llevó el motor de formularios (PR #212) y
las promociones de farmacia (PR #213). Un merge que compila y pasa las pruebas
todavía puede haber roto lo que se ve, así que se vuelve a mirar.

Mismo método que el 23/08: usuarios dados de alta por las altas públicas de la
API viva, aplicación servida desde el código de esta rama. Lo reproduce
`playwright/ux-evidencia.spec.ts`, igual que la vez pasada — sólo cambia el
puerto:

```bash
S=ux$(date +%H%M%S)
curl -X POST localhost:3000/iam/auth/register-practitioner -H 'Content-Type: application/json' \
  -d "{\"email\":\"medico-$S@example.test\",\"password\":\"S3cret-passw0rd\",\"name\":\"Lucía\",\"lastName\":\"Salas\",\"licenseNumber\":\"MP-$S\",\"credentialNumber\":\"TIT-$S\",\"professionalTitle\":\"Médica cardióloga\"}"
curl -X POST localhost:3000/iam/auth/register-patient -H 'Content-Type: application/json' \
  -d "{\"nationalId\":\"CI-$S\",\"password\":\"S3cret-passw0rd\",\"name\":\"Ana\",\"lastName\":\"Quispe\"}"

yarn ng serve --port 4301 --proxy-config proxy.conf.json
E2E_BASE_URL=http://localhost:4301 \
E2E_SHOTS="$PWD/evidencias/ux-2026-08-24-tras-dev" \
E2E_DOCTOR_EMAIL="medico-$S@example.test" E2E_PATIENT_ID="CI-$S" \
  npx playwright test playwright/ux-evidencia.spec.ts
```

Las capturas `01`–`21` son las mismas del 23/08 y prueban lo mismo: su tabla
está en el [README de aquella carpeta](../ux-2026-08-23/README.md). Lo que sigue
es lo que **este** merge obligaba a comprobar.

## Lo que se fue a mirar

| Archivo | Qué prueba |
| --- | --- |
| `01-menu-del-medico` | **El menú sobrevivió al merge.** Nueve entradas —las ocho del cliente más «Formularios», el generador que él mismo pidió— y ninguna «Promociones». En «Tus accesos», dos filas más abajo, «Promociones» y «Pedidos de farmacia» siguen ahí: se sacaron del menú, no del alcance |
| `22-hints-de-k2-en-el-motor-paciente` | «Sexo al nacer» y «Ocupación» explicados por el motor, no por el HTML que `dev` reescribió |
| `23-hints-de-k2-en-el-motor-matricula` | «Número de matrícula» y «Fecha de inscripción» — la segunda dice justo lo que se confunde: cuándo te registraste, no cuándo vence |
| `24-hints-de-k2-en-el-motor-titulo` | «Título profesional», con el ejemplo de cómo queda escrito en la ficha |
| `25-hints-de-k2-en-el-motor-organizacion` | «Nombre comercial» y «Sigla» |
| `26-hints-de-k2-en-el-motor-nit-y-direccion` | «NIT» y «Dirección» |

Los ocho hints de K2 vivían en el HTML de las dos altas. `dev` reescribió ese
HTML entero como declaración de campos del motor, así que la mudanza era el
choque del merge: acá se ve que ninguno se perdió en el camino.

**El de «Género» no está, y es correcto.** `dev` sacó el campo —preguntarlo al
lado del sexo al nacer pedía dos veces algo que la persona lee como lo mismo—,
así que su explicación se fue con él.

## Lo que esto sigue sin probar

Lo mismo que el 23/08, palabra por palabra: la tabla de síntomas **no está
validada clínicamente**, y las grillas de laboratorios, clínicas y farmacias se
ven con la base local, que no tiene esos datos —la anatomía sí, los datos no—.
