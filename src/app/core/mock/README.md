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

## Contratos que el simulador declara y la API real todavía no publica

Son deuda declarada, no funciones existentes del backend. La pantalla los
consume; el backend tiene que darlos de alta con esta misma forma.

| Ruta | Quién la usa | Qué devuelve |
|---|---|---|
| `GET /insurance-carrier-catalog/members/:memberIdentifier` | Alta de paciente, campo «Número de asegurado» | La afiliación (`carrierId`, `planId`, `planName`, `isPublic`) y la persona tal como la aseguradora la tiene (nombres, documento, nacimiento, sexo, teléfono, correo). 404 si ninguna aseguradora reconoce el número. Los números válidos son `AF-` + los dígitos del código del paciente (`AF-20000` es Ana Pérez, Seguros Andina · Plan Integral). |
| `GET /insurance-carrier-catalog/:id` | «Mi seguro» del paciente | La ficha pública de una aseguradora del catálogo (productos, planes, coberturas y red), con la misma forma que `GET /insurance-carriers/:id`, que sólo sirve desde el tenant de la propia aseguradora. |
| `POST /iam/auth/register-patient` · `insuranceMemberIdentifier` | Alta de paciente | **Todavía no se envía.** El DTO del backend no lo declara y `forbidNonWhitelisted` lo convertiría en un 400 que rompe el alta entera, así que `IamClient.registerPatient` lo deja fuera del cuerpo a propósito (hay una prueba que lo fija). La pantalla ya lo captura y lo compone; cuando el backend lo publique, alcanza con listarlo en ese método. |
| `GET /profiles/patients/me` · `coverages[].carrierId` | «Mi seguro» | El identificador de la aseguradora en el catálogo público; la API real manda sólo `carrierName`, y la pantalla cae a buscarla por nombre. |

## Cómo se verifica

```bash
# cada ruta del simulador, con cada cuenta: nada lanza ni devuelve 500
npx ng test --include=src/app/core/mock/mock-backend.spec.ts --watch=false

# cada pantalla de la aplicación, con cada cuenta, en Chromium
yarn start &
E2E_BASE_URL=http://localhost:4200 npx playwright test playwright/mockup-barrido.spec.ts
# → artifacts/playwright/mockup/MOCKUP_MATRIX.md
```

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
