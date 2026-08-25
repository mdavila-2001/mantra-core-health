# Los íconos de la navegación — 24/08/2026

Siete íconos repartidos entre cincuenta y cinco secciones no son un set: son un
reparto. `orders` —una hoja de papel— cargaba catorce, `settings` doce, y el
resultado era que **«Chats» era una onda de electrocardiograma**, «Directorio de
médicos» una casa y «Directorio de farmacias» un documento.

Un ícono aporta una sola cosa: reconocer una sección sin leerla. Repetido
catorce veces no aporta nada, y donde más se nota es en la rejilla de «Tus
accesos», que muestra treinta juntas.

| Archivo | Qué prueba |
| --- | --- |
| `01-menu-del-medico` | La rejilla de «Tus accesos» del médico, con **treinta y dos secciones y treinta y dos dibujos**: la farmacia es una cápsula, la consulta un estetoscopio, la clínica un edificio con cruz, el laboratorio un matraz, los grupos dos personas, los chats un globo de diálogo |
| `02-los-44-del-set` | Los cuarenta y cuatro del set, a 40 px y **a 20 px, que es el tamaño real del menú** — un ícono que sólo funciona grande no funciona |

## Tres se redibujaron después de mirarlos

La hoja de contacto no es decoración: los tres primeros intentos se cayeron ahí
y no se habrían caído leyendo el código.

- **`pill`** giraba el rectángulo de la cápsula con `transform` y dejaba la
  juntura sin girar. Salían dos trazos cruzados en diagonal: **idéntico al
  eslabón de `link`**, que está a cuatro casillas. Ahora el cuerpo y la juntura
  giran juntos, en un `<g>`.
- **`stethoscope`** sin olivas ni campana era un diapasón. Se le agregaron las
  dos olivas arriba y la campana abajo, que es lo que lo hace un estetoscopio.
- **`scalpel`** tenía un tercer trazo colgando de un costado que parecía otra
  pieza. Quedaron dos: hoja y mango, en línea.

## Cómo se sacaron

`01` sale del recorrido de siempre, `playwright/ux-evidencia.spec.ts`, con el
médico dado de alta por el alta pública de la API viva — el mismo método que
[`ux-2026-08-24-tras-dev/`](../ux-2026-08-24-tras-dev/README.md) documenta.

`02` es una hoja de contacto armada leyendo los `@case` de `nav-icon.ts`: no
existe una vitrina de íconos en el sistema de diseño (`docs/design-system/icons.md`
lo dice en «Lo que no hay»), y para revisar cuarenta y cuatro formas hacía falta
verlas juntas y en los dos tamaños.
