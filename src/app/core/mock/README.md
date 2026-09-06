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
- `fixtures/`: terminología (conjuntos de valores y conceptos), personas
  (15 profesionales, 13 pacientes), agenda (recursos, plantillas, cupos ±21
  días, reservas en todos los estados), clínica (condiciones, alergias,
  recetas, observaciones, encuentros, notas, órdenes) y comunidad (vitrinas,
  publicaciones, comentarios, reseñas, grupos, conversaciones).
- `handlers/`: un archivo por dominio de la API; `handlers/index.ts` los
  registra todos.

Lo que ninguna ruta cubre cae en una respuesta genérica y queda anotado en la
consola como `[mock] sin manejador para …`: ese es el inventario de lo que
falta.

## Cómo se verifica

```bash
# cada ruta del simulador, con cada cuenta: nada lanza ni devuelve 500
npx ng test --include=src/app/core/mock/mock-backend.spec.ts --watch=false

# cada pantalla de la aplicación, con cada cuenta, en Chromium
yarn start &
E2E_BASE_URL=http://localhost:4200 npx playwright test playwright/mockup-barrido.spec.ts
# → artifacts/playwright/mockup/MOCKUP_MATRIX.md
```
