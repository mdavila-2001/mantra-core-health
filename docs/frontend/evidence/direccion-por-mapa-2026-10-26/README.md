# La dirección empieza por el mapa — 2026-10-26

Pedido del cliente: en las altas de usuario, en especial paciente y médico, **primero** se marca el
lugar en el mapa de Bolivia (con el acercamiento al punto) y **después** aparece, ya lleno, el
formulario con calle, distrito, municipio, provincia y departamento.

## Qué hace ahora

- `app-address-by-map` (`features/auth/shared-registration/address-by-map/`): mapa de Bolivia entero
  con provincias; al tocarlo el mapa se acerca al punto (zoom 15) y aparece el formulario.
- Departamento, provincia y municipio salen de cruzar el punto con los límites que el producto ya
  trae (`shared/geo/bolivia-locator.ts`: provincias ADM2 + contornos municipales). Sin geocodificador
  externo: `connect-src` sigue en `'self'`.
- La calle y el distrito los escribe la persona. No hay capa de calles ni de distritos.
- Un toque fuera de Bolivia no abre el formulario y lo dice. Tocar otro punto vacía la calle escrita (D-06).
- Salidas sin puntero: «Usar mi ubicación» y «No puedo marcarlo: completar a mano».
- Montado en: alta de paciente (domicilio y trabajo) y alta de médico (domicilio y consultorio).

## Contrato

El API no cambia: viaja `residenceMunicipalityConceptId`, `homeAddressLines`, `homeLatitude/Longitude`
(y los equivalentes de trabajo/consultorio). **No hay columna de distrito** en `common.addresses`: el
distrito viaja pegado a la calle (`Av. Banzer #42, Distrito 5`). La provincia se muestra pero no se
guarda aparte: el código INE del municipio ya la define.

## Evidencia

`playwright/direccion-por-mapa.spec.ts`, 6 recorridos en Chromium contra `ng serve --configuration
development,demo`, todos en verde: mapa primero sin formulario; toque dentro de Bolivia llena
provincia y departamento; «Usar mi ubicación» en Santa Cruz llena Santa Cruz de la Sierra / Andrés
Ibáñez / Santa Cruz; tocar otro punto vacía la calle; «completar a mano»; 375 px sin desborde; y el
domicilio del médico.

| Captura | Qué se miró |
|---|---|
| `1-mapa-primero-1440.png` | Paciente: mapa de Bolivia y ningún formulario todavía |
| `2-formulario-lleno-1440.png` | Tras tocar: pin, acercamiento y formulario |
| `2b-santa-cruz-1440.png` | Municipio, provincia y departamento llenos |
| `3-formulario-lleno-375.png` | 375 px, una columna, sin desborde |
| `4-medico-mapa-primero-1440.png` | Médico: mapa primero |
| `5-medico-formulario-lleno-1440.png` | Médico: formulario lleno |

## Límites de lo verificado

- Los mosaicos de OpenStreetMap no cargan en el entorno de prueba (fondo gris); provincias y pin sí.
- La maqueta trae sólo un subconjunto de municipios: si el del punto no está, queda por elegir.
- No se probó contra la API real ni el consultorio del médico en navegador (cubierto por pruebas unitarias).
- Las pantallas de edición de perfil (`practitioner-profile-edit`, `work-history`) siguen con el
  selector anterior; los scripts históricos `playwright/*.mjs` de evidencia de septiembre quedaron
  atados a la UI anterior.
