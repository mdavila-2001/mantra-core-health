# CM-06 · Procedimientos por sede — evidencia

- **Fecha:** 2026-10-25 · base `origin/dev` `eae8f7ad` + el commit del carril.
- **Dónde se corrió:** `ng serve --configuration development,demo` (maqueta), cuenta `admin@alovida.mock`,
  ruta `/administration/services-catalog/procedure-offers`, Chromium sin interfaz.
- **Cableado usado sólo para esta corrida** (no va en este commit; es de CM-00 y CM-07): la ruta
  `administration/services-catalog/procedure-offers`, `registerHealthcareServices(router)` en
  `handlers/index.ts`, la extensión del simulador `'POST /practices/:practiceId/healthcare-services': ['serviceCatalogId']`
  y las prácticas `practice-cm-norte` y `practice-cm-sur` en `GET /practices`.
- `veredictos.json`: 20 comprobaciones, 20 en verde. `requests.json`: lo que la consola de la aplicación registró.

## Qué se midió

| Comprobación | Resultado |
|---|---|
| Tarjeta centrada: holguras izquierda y derecha respecto de `.app-main__inner` | 40,0 px y 40,0 px |
| Ancho de la tarjeta respecto del área | 93,3 % |
| Sin desborde horizontal a 390×844, 768×1024, 1024×768 y 1920×1080 | sin desborde |
| Consola sin errores | 0 (el 409 provocado a propósito aparece en `requests.json` y se excluye del conteo) |

## Recorrido

Publicar «10.02.02 Colonoscopia total» con precio 600 → aparece la fila sin recargar con «Referencia: 24 UMA» y
«600 Bs» · publicar «Endoscopia alta + biopsia» sin precio → «No aparece en búsquedas» · repetir la colonoscopia →
409, el texto «Este procedimiento ya está publicado en esta sede» y el formulario conserva el precio 650 ·
desactivar la endoscopia digestiva alta → «Desactivado» · **recargar** → siguen las 4 filas y sigue desactivada ·
fijar el precio de la fila sin precio (480) desde el modal → la fila pasa a «480 Bs» y deja de decir «No aparece».

## Qué NO prueba esta carpeta

- **UI → request → response en el navegador:** en la maqueta las peticiones las atiende un interceptor dentro de la
  aplicación, así que el navegador no las ve como tráfico de red. El cuerpo exacto de cada petición (`POST` con
  `{ practiceSiteId, serviceConceptId, serviceCatalogId }`, `PATCH { active }`, `PATCH { serviceCatalogId }`) lo prueban
  `healthcare-services.client.spec.ts` y `procedure-offers.spec.ts` contra `HttpTestingController`. La persistencia
  tras recargar es la del doble (`sessionStorage`), no la de una base real.
- **Contra la API real:** no se corrió. Dependen de las ramas de la API de CM-01 y CM-02 (ver el reporte del PR).
- **S5 (403 de otra organización) en el navegador:** la maqueta no lo produce; lo cubre `procedure-offers.spec.ts`.
- **Claro/oscuro:** claro a 390, 768, 1024, 1440 y 1920; oscuro a 390 y 1440.
