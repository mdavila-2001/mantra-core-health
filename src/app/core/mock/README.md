# Backend simulado (rama `mockup`)

Esta rama es un clon de `dev` en el que **ninguna petición sale a la red**: el
interceptor `mock-backend.interceptor.ts` va al final de la cadena y contesta
cada llamada a la API desde datos en memoria. Sirve para recorrer y probar
todas las pantallas sin levantar la API ni la base de datos.

## Cómo correrla

```bash
yarn install
yarn start            # http://localhost:4200
```

No hace falta `.env`, proxy ni backend. El interruptor es `mockBackend: true`
en `src/environments/environment*.ts`; con `false` la aplicación vuelve a
hablar con la API real.

## Cuentas de prueba

Cualquier contraseña no vacía sirve. El cartel flotante de la esquina inferior
las lista y permite copiarlas.

| Cuenta | Correo | Qué ve |
|---|---|---|
| Médica | `medica@alovida.mock` | Dra. Valeria Rojas Mendoza. Cardióloga con agenda, pacientes, historias clínicas, recetas, vitrina, artículos, contabilidad, visitas de laboratorio. Dos organizaciones. |
| Paciente | `paciente@alovida.mock` | Ana Lucía Pérez Quiroga. Citas pasadas y futuras, historia clínica, resultados de laboratorio, recetas, pedidos de farmacia, seguros, comunidad. |
| Administradora | `admin@alovida.mock` | Todos los roles administrativos: organizaciones, personas, identidad, terminología, moderación, geolocalización, contabilidad, activos, cotizaciones, laboratorio farmacéutico. |
| Superadmin | `superadmin@alovida.mock` | Comodín: entra a todo. Tres organizaciones. |
| Visitador | `visitador@alovida.mock` | Carla Fernández Ríos, visitadora médica de Laboratorios Inti. Solicitudes de visita, agenda de visitas, registros. |

También entran por número de documento (`4567890`, `7654321`, `1112223`,
`9998887`, `5556667`).

## Qué hay adentro

- `mock-router.ts`: tabla `(método, patrón)` → manejador; gana el patrón con
  más segmentos literales. Ayudas `notFound`, `conflict`, `validation`, etc.
- `mock-store.ts`: `uuid(semilla)` determinista, fechas relativas a hoy,
  paginación por cursor, `Coleccion` en memoria (las escrituras persisten
  mientras dure la pestaña) e imágenes SVG como `data:` URL.
- `mock-session.ts`: cuentas, emisión y lectura de tokens (JWT sin firma).
- `faker/`: el generador de datos. `semilla.ts` (siembra por nombre de
  entidad), `bolivia.ts` (cédula con extensión, NIT, celulares +591,
  municipios y coordenadas reales, aseguradoras, importes en Bs) y
  `clinico.ts` (CIE-10, ATC, vías, unidades y signos vitales por edad,
  **siempre elegidos del catálogo**, nunca inventados). Se importa `fk` desde
  `faker/index.ts`; `@faker-js/faker` no se importa en ningún otro sitio y
  `check-architecture.mjs` lo comprueba.
- `fixtures/`: terminología (conjuntos de valores y conceptos), personas
  (60 profesionales y 120 pacientes: los primeros 15 y 13 están escritos a
  mano —son los que la aplicación nombra por id o por slug— y el resto los
  genera `faker/`), agenda (recursos, plantillas, cupos ±21 días, reservas en
  todos los estados), clínica (condiciones, alergias, recetas, observaciones,
  encuentros, notas, órdenes) y comunidad (vitrinas, publicaciones,
  comentarios, reseñas, grupos, conversaciones).

  Los datos generados son **deterministas**: el paciente número 37 es el mismo
  en cada recarga y en cada máquina, así que un enlace copiado sigue abriendo
  lo mismo. Añadir volumen no es cosmético: con quince profesionales no había
  segunda página que probar.
- `handlers/`: un archivo por dominio de la API; `handlers/index.ts` los
  registra todos.

Lo que ninguna ruta cubre cae en una respuesta genérica y queda anotado en la
consola como `[mock] sin manejador para …`: ese es el inventario de lo que
falta.

## Qué sobrevive a F5

Las tablas de negocio —citas, bloqueos, historia clínica, publicaciones,
mensajes, pedidos, cotizaciones, asientos, solicitudes…— se guardan en
`sessionStorage` (`Coleccion.persistirEn`, al pie de cada fixture o
manejador) y se recuperan al recargar. Lo guardado gana sobre el fixture:
recargar no pisa lo que la persona acaba de escribir. Cerrar la pestaña deja
la maqueta limpia otra vez.

Sólo se escribe la tabla que se tocó, así que el almacenamiento no se llena
con catálogos. Si cambiás un fixture y la pantalla sigue mostrando lo viejo,
es esto: vaciá `sessionStorage` (o cerrá la pestaña).

## Escenarios de flujo completo

Dos recorridos de punta a punta —paciente elige, reserva, y del otro lado se
ve— con datos que el simulador ya trae. Los cupos se generan alrededor de
**hoy** (±21 días, `fixtures/agenda.ts`), así que acá no hay fechas fijas: el
criterio de elección da el mismo resultado cualquier día que se corra.

Todo lo que aparece es **sintético**: la médica y la paciente de prueba, y los
13 «Profesional demo NN» (`PROFESIONALES_DEMO_REGISTRADOS`, `origen: 'DEMO'`).
Las personas de las planillas del propietario no tienen agenda (D-H3-PROV-01)
y no se usan en ningún escenario.

**Qué estado queda.** Cuando la reserva la hace el paciente desde el portal,
la reserva es una **solicitud**: la pantalla llama a `requestHold`, no a
`confirmHold` (`features/agenda/booking-new/booking-new.ts`, «el paciente
solicita; el mostrador confirma», corrección #11), y el simulador la crea con
`BK-REQUESTED` (`handlers/scheduling.handlers.ts`). El paciente la ve como
«Pedido» en «Mis citas», y la médica como «Solicitada» en «Consultas». Aunque
el botón del segundo paso dice «Confirmar la reserva», lo que se envía es la
solicitud.

**Cambio de cuenta.** Las reservas se guardan en `sessionStorage`
(`mock.agenda.reservas`), que es de la pestaña. Para que la médica vea lo que
reservó la paciente hay que cerrar sesión y entrar en **la misma pestaña**. Una
pestaña o un navegador nuevos empiezan con la maqueta limpia. Los cupos no se
guardan: después de F5, el cupo reservado vuelve a ofrecerse aunque la reserva
siga ahí.

### Escenario A — la paciente pide turno con la médica, y la médica lo ve

| Paso | Cuenta | Qué se hace | Qué se ve |
|---|---|---|---|
| 1 | `paciente@alovida.mock` | `/directory` → «Cardiología» → buscar «Valeria» → abrir la tarjeta | Ficha de Valeria Rojas Mendoza con «Sedes y horarios» |
| 2 | paciente | En «Agenda de Valeria Rojas Mendoza» (Clínica Los Olivos · Sede Central), elegir el **primer cupo libre de mañana antes de las 12:00**. De lunes a sábado es de la clínica; si mañana es domingo, el de la mañana es de la guardia del consultorio | La pantalla «Reservar un turno» con quién, cuándo y dónde |
| 3 | paciente | Escribir un motivo → «Retener el cupo» → «Confirmar la reserva» | Aviso «Turno solicitado». En «Mis citas» aparece el turno como «Pedido» |
| 4 | paciente → médica | Cerrar sesión y entrar como `medica@alovida.mock` **en la misma pestaña** | — |
| 5 | `medica@alovida.mock` | «Consultas médicas» (`/schedule`) → vista «Día» → «Mañana» | Fila con la hora del cupo, «Ana Lucía Pérez Quiroga», **«Solicitada»** y el motivo |

La médica tiene dos agendas: la de la clínica (mañanas, de lunes a sábado) y la
de su consultorio (tardes de lunes, miércoles y viernes, y guardia el domingo).
De lunes a sábado, la franja de la mañana es la de la clínica.

### Escenario B — la paciente pide turno con un profesional de demostración

| Paso | Cuenta | Qué se hace | Qué se ve |
|---|---|---|---|
| 1 | `paciente@alovida.mock` | `/directory` → «Medicina General» → buscar «Profesional demo 01» → abrir la tarjeta | Tarjeta «Profesional demo 01», «Profesional de demostración», «Clínica Los Olivos». En la ficha, «Agenda simulada · Profesional demo 01» |
| 2 | paciente | Elegir el **primer cupo libre** de la semana que se muestra | «Reservar un turno» con «Profesional demo 01» y «Clínica Los Olivos · Sede Central» |
| 3 | paciente | Motivo → «Retener el cupo» → «Confirmar la reserva» | «Turno solicitado». En «Mis citas»: «Agenda simulada · Profesional demo 01», **«Pedido»** |

Los 13 de demostración no tienen cuenta propia, así que este escenario termina
del lado de la paciente. Cualquier otro «Profesional demo NN» sirve: los
impares atienden en Clínica Los Olivos y los pares en Hospital San Lucas, las
dos instituciones inventadas de la maqueta; la especialidad de cada uno está en
`ESPECIALIDADES_DEMO` (`fixtures/personas.ts`).

### Cómo se verifican

```bash
# Los datos: 13 demos con recurso, plantilla L-V y cupos ±21 días; la médica y la
# planilla del propietario como deben estar
yarn test --include=src/app/core/mock/mock-backend.spec.ts --watch=false

# Las pantallas del recorrido abren sin error con las dos cuentas
yarn start:dev
E2E_BASE_URL=http://localhost:4200 yarn playwright test playwright/mockup-barrido.spec.ts --workers=1 --grep "Médica|Paciente"
```

El recorrido completo (reservar y mirarlo del otro lado) **no tiene todavía un
E2E versionado**: se recorre a mano con las tablas de arriba.

## Cómo se verifica

```bash
# cada ruta del simulador, con cada cuenta: nada lanza ni devuelve 500
npx ng test --include=src/app/core/mock/mock-backend.spec.ts --watch=false

# cada pantalla de la aplicación, con cada cuenta, en Chromium
yarn start &
E2E_BASE_URL=http://localhost:4200 npx playwright test playwright/mockup-barrido.spec.ts --workers=1
# → artifacts/playwright/mockup/MOCKUP_MATRIX.md

# cada botón de cada pantalla, con cada cuenta: se pulsa, se cierra lo que
# abre, y se anota excepción, error de consola, 5xx o petición sin manejador
E2E_BASE_URL=http://localhost:4200 npx playwright test playwright/mockup-click-sweep.spec.ts --workers=1
# → artifacts/playwright/mockup/MOCKUP_CLICKS.md
```

## Lo que el simulador no puede cubrir

Una `<img src="/public/media/<id>">` la pide el navegador directo: no pasa
por `HttpClient` ni por el interceptor. Por eso `/public/media/*` se sirve
fuera del simulador, con `public/mock-media.svg`: en `yarn start` lo hace el
`bypass` de `proxy.conf.mjs` (que reexporta `proxy.conf.json` y le antepone
esa entrada) y en el contenedor, una ruta de `src/server.ts`. Las vitrinas
llevan además `avatarUrl`/`coverUrl` como `data:`, que es lo que pintan las
pantallas públicas.

## En un VPS (Docker)

Un solo contenedor: la imagen de producción (`Dockerfile`, SSR con Express)
con el backend simulado adentro. Sin API, sin base, sin nginx.

```bash
git clone -b mockup https://github.com/mdavila-2001/mantra-core-health.git
cd mantra-core-health
cp deploy/mockup.env.example .env        # APP_DOMAIN = tu dominio o IP
docker compose --env-file .env up -d --build
# → http://<dominio>:8080
```

En Coolify: recurso Docker Compose sobre la rama `mockup`, dejando el archivo
por defecto (`/docker-compose.yml`), dominio al servicio `web` (puerto 4000) y
la variable `APP_DOMAIN` con ese dominio. Los detalles están en la cabecera del
propio compose.

`APP_DOMAIN` no es opcional: sin ella el despliegue queda verde y el dominio
devuelve 400, porque el servidor de renderizado sólo reconoce los hosts que
lleva horneados.
