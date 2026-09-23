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

## Escenarios de flujo completo

Dos recorridos de punta a punta, para verificar de una sola vez que reservar y
atender siguen funcionando después de un cambio en el simulador o en la
agenda. Los dos parten de una cuenta limpia (sin turnos previos: si ya
reservaste con esa cuenta en esta pestaña, vaciá `sessionStorage` primero).

### Escenario A — `paciente@` reserva con la médica un cupo de mañana

1. Entrá como `paciente@alovida.mock` → `/directory` → especialidad
   Cardiología → **Valeria Rojas Mendoza** (la médica de prueba, con agenda
   propia y consultorio: dos sedes).
2. «Sedes y horarios» → elegí un cupo de la franja de mañana (08:00–12:00,
   plantilla `template-medica-manana`, L-V y sábado) → reservar.
3. La reserva queda en `sessionStorage` (`reservas`, `Coleccion.persistirEn`)
   con estado `SOLICITADA` o `CONFIRMADA` según la política de la plantilla.
4. Entrá como `medica@alovida.mock` → `Panel` → «Consultas» (o `/agenda`): el
   turno recién creado aparece con el paciente `Ana Lucía Pérez Quiroga`.
5. Verifica: `mock-backend.spec.ts` en verde con ambas cuentas.

### Escenario B — `paciente@` reserva con un registrado (R-03)

1. Entrá como `paciente@alovida.mock` → `/directory` → cualquier especialidad
   con un profesional marcado «Usuario de AloVida» (los 13 de
   `USUARIO_MEDICOS_1.md`; ver `fixtures/registered-people.ts`) — por ejemplo
   Odontología, **Romel Rivero Saavedra**.
2. «Revisar disponibilidad»: antes de R-03 decía «Todavía no publicó
   horarios» para los 13; ahora los 12 con especialidad mapeada tienen cupos
   ±21 días (el 13.º, sin especialidad declarada en la planilla, sigue sin
   agenda — es el caso límite documentado, no un olvido).
3. Elegí un cupo y reservá. El estado queda igual que el escenario A: según
   la política de la plantilla del recurso (`POLITICA_ESTANDAR`,
   `agenda.ts`), no hay una política distinta para los registrados.
4. Verifica: `agenda-casos-limite.spec.ts` (los 12 con recurso, el 13.º sin
   él) y `agendas-cobertura.spec.ts` (el conteo directorio/con-recurso/con-cupos).

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
