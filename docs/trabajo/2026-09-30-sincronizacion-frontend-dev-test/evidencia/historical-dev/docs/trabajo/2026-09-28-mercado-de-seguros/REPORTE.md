# Mercado de seguros del paciente — 28/09/2026

Rama `claude/formulario-libre-deslizable-bug-ko5n7y`, sobre `dev` (`88d0d865`), a pedido del
propietario.

## Pedido

1. Que el paciente pueda ver los productos de cada aseguradora con sus cláusulas y coberturas.
2. Con la misma disciplina que los directorios: que aparezca en «Directorios».
3. Un botón «Hablar con el broker» que lleve al chat con él.

## Qué se hizo

- **Nodo «Directorio de aseguradoras»** en «Directorios» (`/insurers-directory`). Es la misma
  `app-directory-page` que clínicas y farmacias (`PublicDirectoryListing`), sobre
  `GET /public/search/insurers`, con el mapa, los chips y las tarjetas de siempre. También se
  abre en modal desde «Tus accesos», como los otros tres directorios de lugares. La ruta no es
  `insurance-directory` porque `/insurance` es prefijo del proxy.
- **Ficha** (`/insurers-directory/:slug`), con la misma base que la de una clínica
  (`PublicCatalogDetail`):
  - datos de la aseguradora y el botón principal **«Hablar con el broker»**;
  - **una tarjeta con una pestaña por plan** (regla 6): producto, para quién, prima mensual y
    la tabla de cláusulas (cobertura, cuánto cubre, copago, deducible, tope anual,
    autorización previa, documentos que pide y exclusiones);
  - **los brokers**, cada uno con su botón de chat. Uno sin perfil no ofrece el botón.
- **Chat:** `/messaging?escribirA=<slug>`. De paso se arregló un defecto que ya existía: si la
  URL llegaba antes de que el chat conociera el perfil propio, el pedido se descartaba en
  silencio y quedaba la bandeja sin hilo. Afectaba también a «Enviar mensaje» de las fichas
  públicas.
- **Contrato nuevo**, `GET /insurance-marketplace/insurers/:slug`: `InsuranceClient.getMarketplace`,
  simulador y P46 en `PENDIENTES-BACKEND.md`. El simulador lee el mismo catálogo que edita la
  consola de la aseguradora. Los brokers tienen perfil de comunidad de clase `BROKER`, que no
  sale en ningún directorio público.
- Prefijo `/insurance-marketplace` declarado en `proxy.conf.json`, `proxy.conf.docker.json` y
  `deploy/api-locations.conf`.

## Límite honesto

Sólo **Seguros Andina** y **La Vitalicia** tienen catálogo en el simulador. Las otras 19 son
aseguradoras bolivianas reales del corpus público. Su ficha dice «todavía no publicó sus
productos» en lugar de inventarles planes: fabricar coberturas de una empresa real sería una
afirmación falsa sobre ella.

## Verificación ejecutada

- `ng test` sobre `public-directories`, `messaging` y `directories-overview`: 13 archivos,
  114/114. Nuevas: `insurer-detail.spec.ts` (5) y una en `messaging.spec.ts` (el `escribirA`
  que espera al perfil).
- Navegación: 6 pruebas rojas (`access-tree`, `navigation.service`, `insurance-claims`,
  `fichas-estandar`). **Ya fallaban en `dev` sin este cambio**: medido con los cambios
  apartados, mismos títulos. Las listas cerradas que nombran los directorios se actualizaron
  con la sección nueva (quince → dieciséis rutas PAYER; cuatro → cinco nodos).
- `tsc` de la app y de Playwright limpio. ESLint limpio en lo tocado, salvo el error
  preexistente de `directories-overview.spec.ts` (componente anfitrión sin OnPush).
- `check-route-prefixes`, `check-client-prefixes` y `check-api-prefixes` en verde.
- Playwright contra `ng serve` con el simulador, Chromium: `mercado-de-seguros.spec.ts` 1/1.
  Recorrido del paciente: Directorios → aseguradoras → Seguros Andina → pestañas de planes y
  cláusulas → brokers → «Hablar con el broker» → hilo con el broker abierto. Fotos en
  `evidencia/`, inspeccionadas una por una.
- **En `dev`, `environment.development.ts` trae `mockBackend: false`.** Para esta prueba se
  encendió sólo localmente y **no** se commiteó. Con el simulador apagado, `ng serve` necesita
  la API real, que no expone todavía P46.

## No verificado

- Contra la API real y PostgreSQL: el endpoint no existe todavía (P46).
- El modal del directorio de aseguradoras desde «Tus accesos» (panel del médico): compila, pero
  no se recorrió en el navegador.
- La suite completa (`yarn test`) y el lint global.
- Revisión independiente (`NO_SELF_APPROVAL`).
