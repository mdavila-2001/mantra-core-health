# Plan — Alta de paciente: mapa, GPS obligatorio, calle automática, libreta de direcciones y empresas del SEPREC

- Fecha: 2026-10-26 · Repos: `mantra-core-health` (front), `mantra-core-health-api` (API), `mantra-core-health-model` (modelo) · Rama: `claude/ecstatic-keller-pp0xrx` en los tres, sobre `origin/dev`.
- Origen: mensaje del cliente del 26/10/2026 (foto del paso «Lugares donde vive» en `demo.alovidasalud.arauzsoftware.com`, captura del paso de contacto con «Servicio de ambulancia» duplicado, y el CSV `datosbolivia-tejido-directorio-tabla-1-2026-10-26.csv`).
- Nota de proceso: el plan se escribió durante la ejecución, no antes; queda como registro fiel de lo que se hizo y de lo que no.

## Lo que pidió el cliente, y cómo se leyó

| # | Pedido (literal o resumido) | Lectura tomada |
|---|---|---|
| 1 | «que se mantenga el cuadrado de fondo gris y que se mantenga lo demás negro» | En el **acercamiento** (el cuadrado): relleno gris y líneas negras (departamento, vecinos y bordes). |
| 2 | «que resalte el resaltado … debería ser azul petróleo el color y sea rojo» | El municipio elegido en **azul petróleo** con borde blanco; el punto, **rojo**. |
| 3 | «que sea obligatorio el campo de GPS» | El punto de la casa, **confirmado**, es obligatorio para pasar de «Lugares donde vive». |
| 4 | «cuando se dé click en la ubicación GPS lo resalte en el mapa» | El punto GPS elige y resalta el municipio que lo contiene (y su departamento). |
| 5 | «que haya una etiqueta completa» | Debajo del mapa: «Departamento: … · Provincia: … · Municipio: …». |
| 6 | «Llene la línea de dirección» | La calle se escribe sola desde el punto (geocodificación inversa vía la API). |
| 7 | «varias ubicaciones guardadas como si fuera pedidos ya para los envíos» + «DECISIÓN FULLSTACK» | Libreta de direcciones del paciente: modelo + API + pantalla. |
| 8 | «sigue el duplicado, fijate si es mi versión o el server» | Diagnóstico de qué build sirve el demo. |
| 9 | «EN LAS PROFESIONES COMO SEEDERS INYECTAR ESTAS EMPRESAS» | Las empresas del CSV al **seeder de empresas** (`VS_BO_EMPLOYER`), con procedencia. |
| 10 | «el de otro … PRIMERO, como primer elemento de un select» | «Otra empresa» primera en el buscador de empresas (como «Otra ocupación»). |

## Ambigüedades registradas (confirmar con el cliente / Pablo)

- **A-1 «lo demás negro»**: se tomó como líneas negras sobre el cuadrado gris. La primera lectura (departamento relleno de negro) se descartó al verla: con Santa Cruz el cuadrado quedaba casi todo negro. Si quería el relleno negro, es un cambio de dos líneas de CSS.
- **A-2 «PROFESIONES como seeders … estas empresas»**: el CSV es un directorio de empresas; se sembró en el catálogo de **empresas**, no en el de profesiones.
- **A-3 «etiqueta completa»**: se tomó como los tres niveles con nombre (Departamento · Provincia · Municipio). La calle no se agrega a esa línea.
- **A-4 proveedor de geocodificación (P-03-7)**: se eligió Nominatim/OpenStreetMap (ODbL, gratis, 1 consulta/s en el servidor público). Para volumen real conviene un servidor propio o pago: se cambia con `GEOCODING_REVERSE_URL`. Confirmar con Pablo.
- **A-5 GPS obligatorio = punto CONFIRMADO**: se exige pulsar «Confirmar dirección actual», como ya se exigía para que el punto viajara.

## Alcance

- IN: lo de la tabla de arriba, sus pruebas, sus dobles en la capa mock del front (el sitio demo corre con `mockBackend: true`), y la documentación del contrato.
- OUT: usar la libreta en el flujo de envíos de farmacia (todavía no hay pantalla que elija dirección de envío); partir `register-patient.ts`; los `check-*` que ya fallaban en `dev`.

## H1 — Mapa del alta (front)

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H1.M1 | Acercamiento gris/negro/petróleo/rojo | `department-map.spec` verde + captura | HECHO |
| H1.M2 | Etiqueta completa con provincia | 2 pruebas nuevas en `department-map.spec` | HECHO |
| H1.M3 | `municipalityAt` (punto → municipio) | `locality-detail.spec` 12/12, con geometría real | HECHO |
| H1.M4 | GPS elige municipio en `app-location-picker` | 4 pruebas nuevas; falla sin la función (comprobado) | HECHO |

## H2 — Alta: GPS obligatorio, calle desde el punto, «Otra empresa» primera (front)

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H2.M1 | Control `gpsDomicilio` obligatorio | `register-patient.spec` 150+ verde | HECHO |
| H2.M2 | Calle desde el punto (`ReverseGeocodingClient`) | 6 pruebas nuevas (escribe, navegador, no pisa, 503, tardía, municipio) | HECHO |
| H2.M3 | «Otra empresa» primera y visible al buscar | prueba nueva | HECHO |

## H3 — Libreta de direcciones (modelo → API → front)

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H3.M1 | Modelo v4.2.61: `label`, `is_preferred`, índices, patch | patch 2× en Postgres 16 + índice único rechaza 2.ª preferida + contrato 4/4 | HECHO |
| H3.M2 | API: concepto, entidad, puerto, servicio, controlador | 11 pruebas con doble que imita el índice | HECHO |
| H3.M3 | Front: cliente + pantalla «Mis direcciones» + pestaña | `address-book.spec` 6/6, `my-profile.spec` 47/47 | HECHO |
| H3.M4 | Dobles mock (demo) | `check-mock-vs-client` sin las rutas nuevas | HECHO |
| H3.M5 | API real de punta a punta contra Postgres | arrancar la API y ejercitar las rutas | BLOQUEADO: Docker Hub 429 |

## H4 — Geocodificación inversa (API)

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H4.M1 | `POST /public/geo/reverse` con caché, timeout, 1/s, tope de cola | 11 pruebas (doble en 3 niveles + respuesta real capturada) | HECHO |

## H5 — Empresas del SEPREC (API)

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H5.M1 | Generador desde el CSV + procedencia | `bo-employers.catalog.spec` 4/4 | HECHO |

## H6 — Duplicado de «Servicio de ambulancia»

| ID | Microtarea | DoD | Estado |
|---|---|---|---|
| H6.M1 | Diagnóstico: ¿versión local o servidor? | bundle descargado del demo | HECHO |
