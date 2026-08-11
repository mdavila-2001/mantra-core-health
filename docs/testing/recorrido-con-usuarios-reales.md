# Recorrido con usuarios reales

Las mismas pantallas que el [recorrido visual](recorrido-visual.md), pero
**contra la API viva y con cuentas que se crean de verdad**. Responde una
pregunta que ninguna otra suite del repositorio responde: *¿la aplicación
funciona con los permisos que el backend le da a cada tipo de persona?*

```bash
yarn recorrido:real
```

Deja el reporte en `artifacts/real/reporte.html`, con las capturas y —arriba de
todo— la tabla de hallazgos.

---

## Por qué existe, si ya hay tres suites

| Suite | Red | Responde |
| --- | --- | --- |
| `yarn test` | sin red | ¿la unidad hace lo suyo? |
| `yarn e2e` | simulada | ¿los journeys funcionan? |
| `yarn recorrido` | simulada | ¿cómo se ve todo hoy? |
| **`yarn recorrido:real`** | **la de verdad** | **¿funciona con permisos reales?** |

Las tres primeras simulan la red **a propósito**, y hacen bien: una suite que
depende de una base de datos falla al azar y se termina ignorando. Pero un
simulador responde lo que la pantalla espera, y por eso hay una clase entera de
defectos que no puede encontrar:

- Un endpoint que exige un parámetro que la pantalla no manda. Así apareció el
  `422 PRECONDITION_FAILED` de `GET /scheduling/bookings`, que no admite listar
  citas sin acotar por recurso o por paciente.
- Un prefijo del proxy que se come una ruta de la aplicación. `/admin` desviaba
  `/administration/patients` hacia la API, que respondía `Cannot GET`.
- Un rol que en la práctica no alcanza para la pantalla que su menú le ofrece.
- Un desplegable que nace con valor y muestra el placeholder. Con formularios no
  se veía, porque escriben el valor después de montar.

## Los cuatro actores

Salen de las suites por actor del backend
(`test/smoke/modules/{paciente,medico,organizacion,administrador}.smoke.ts`), que
son el contrato vivo de qué puede hacer cada tipo de usuario. Copiar de ahí y no
inventar payloads es lo que hace que un cambio de contrato rompa esta suite **en
el alta**, que es donde se entiende.

| Actor | Cómo nace | Qué prueba que nada más prueba |
| --- | --- | --- |
| **Administrador** | sembrado por `BOOTSTRAP_ADMIN_*` | el sistema entero; su `SUPERADMIN` es comodín, así que cualquier error es del producto |
| **Paciente** | `POST /iam/auth/register-patient` | entra con **documento**, no con correo, y choca con la puerta de verificación de identidad |
| **Médico** | `POST /iam/auth/register-practitioner` | registrarse no es estar habilitado; el archivo clínico sin buscador de padrón |
| **Organización** | `POST /iam/auth/register-organization` | un tenant **sin datos**: los estados vacíos sólo se ven así |

Cada corrida crea cuentas nuevas con un sufijo único. Es el mismo trato que
hacen los smokes del backend: evita el `409` de «ese documento ya existe» y deja
cada corrida independiente, a cambio de que la base acumule cuentas de prueba.

## Qué la hace fallar

No una aserción por pantalla —para eso están las otras suites— sino un
**vigilante** que escucha toda la sesión y anota:

- errores de consola,
- excepciones sin capturar,
- respuestas `4xx`/`5xx` de la API.

Y falla si queda alguno. Con dos excepciones documentadas en
`e2e/real/support/sesion.ts`:

- **Los `403` que el producto convierte en una salida** están en una lista de
  rutas esperadas. Un paciente recién registrado *tiene* que recibir
  `403 IDENTITY_VERIFICATION_REQUIRED` en su resumen; lo que se juzga es que la
  pantalla lo convierta en una puerta y no en un muro. Un `403` en cualquier
  otra ruta sigue siendo un hallazgo.
- **Las violaciones de CSP por scripts en línea** son un artefacto de
  `ng serve`: los hashes que autoriza `src/server/security-headers.ts` salen del
  artefacto construido, que no es el que sirve el servidor de desarrollo. La CSP
  de producción la verifica `yarn e2e`, que sí corre contra el artefacto. No se
  descartan en silencio: quedan como nota de cobertura en el reporte.

## Dos decisiones de infraestructura que no son arbitrarias

**Corre contra `ng serve`, no contra el artefacto.** Por CORS: la API arranca
con `app.enableCors({ origin: false })`, así que el navegador no puede llamarla
desde otro origen. Hace falta un proxy en el mismo origen, y el que existe es el
de `ng serve` (`proxy.conf.json`). El servidor de SSR no proxea nada.

**Navega por el router, no recargando la página.** Cada carga completa cuesta un
canje de refresh token —la sesión sólo persiste el refresh— y
`POST /iam/auth/token/refresh` está limitado a diez por minuto. Un recorrido de
quince pantallas con `page.goto` gastaba quince canjes y el decimoprimero volvía
`429`, que la aplicación —con razón— trata como sesión caída: la suite se rompía
contra una protección que funciona bien. Y además es más fiel: nadie recorre una
aplicación reescribiendo la dirección quince veces.

Por lo mismo, cada actor tiene **una** prueba y no seis: `POST /iam/auth/login`
está limitado a diez por minuto y por IP.

## Qué hace falta para correrla

La API levantada con su base. Sin eso el comando lo dice en dos segundos, en vez
de fallar tres minutos después con un tiempo de espera que no menciona el
motivo:

```bash
# almacenes
docker compose up -d postgres mongodb redis opensearch minio
# la API, en su repositorio
corepack yarn start
```

| Variable | Para qué | Por defecto |
| --- | --- | --- |
| `E2E_API_URL` | dónde vive la API | `http://localhost:3000` |
| `E2E_BASE_URL` | dónde se sirve la aplicación | `http://127.0.0.1:4300` |
| `E2E_ADMIN_EMAIL` · `E2E_ADMIN_PASSWORD` | la cuenta sembrada | `admin@redesa.test` |
| `E2E_REUSAR_SERVIDOR=false` | levantar un servidor limpio en vez de reutilizar | reutiliza |

El puerto es el **4300** y no el 4200 a propósito: el 4200 lo suele ocupar el
contenedor de desarrollo, y matarlo para hacerle lugar rompería el entorno de
quien lo esté usando.
