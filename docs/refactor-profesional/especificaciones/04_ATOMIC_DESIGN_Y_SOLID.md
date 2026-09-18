# Atomic Design, SOLID y límites de responsabilidad

## Dos problemas diferentes que se complementan

Atomic Design describe cinco niveles de composición: átomos, moléculas, organismos, plantillas y páginas. Brad Frost lo presenta como un modelo para trabajar entre las partes y el conjunto, no como una secuencia rígida de fabricación. Véase [Atomic Design Methodology](https://atomicdesign.bradfrost.com/chapter-2/).

En este kit, esa taxonomía se aplica a la presentación. Las funcionalidades de negocio se organizan según su responsabilidad y contratos. No colocar un repositorio HTTP en `atoms/` ni obligar a que toda función encaje en una metáfora visual.

## Clasificación operativa propuesta

| Nivel | Responsabilidad | Ejemplos | Evitar |
|---|---|---|---|
| Átomo | Control o elemento semántico básico con estados | Button, Link, Input, Label, Icon | Red, permisos de negocio, navegación implícita |
| Molécula | Conjunto con un propósito local | FormField, SearchField, StatusBadge | Formularios completos o coordinación de varias entidades |
| Organismo | Región funcional reconocible | ResultsToolbar, DataTable, EditorPanel | API pública que exponga todo el estado interno |
| Plantilla | Composición espacial y puntos de inserción | ListDetailLayout, SettingsLayout | Conocimiento de endpoints o IDs concretos |
| Página | Ruta y composición de una tarea real | Lista con filtro, detalle editable | Reimplementar controles o concentrar toda la lógica |

Los nombres son ejemplos; el proyecto puede usar su taxonomía existente si expresa las mismas responsabilidades. Un componente compuesto puede vivir en una funcionalidad si es específico de ella. Solo extraerlo al sistema compartido cuando haya consumidores reales o una coherencia global clara que proteger.

## Organización de referencia

Esta estructura es ilustrativa y debe mapearse a rutas existentes:

| Ubicación propuesta | Contenido |
|---|---|
| `src/ui/tokens/` | Valores y asignaciones semánticas |
| `src/ui/atoms/`, `molecules/`, `organisms/` | Componentes compartidos con contratos documentados |
| `src/ui/templates/` | Composición de página reutilizable |
| `src/features/projects/domain/` | Reglas y tipos del ejemplo de proyectos |
| `src/features/projects/application/` | Casos de uso y coordinación |
| `src/features/projects/data/` | Adaptadores y transformación de respuestas |
| `src/features/projects/ui/` | Presentación específica y conexión con casos de uso |
| Carpeta real del router | Rutas, carga y límites de errores propios del framework |

En una app pequeña no hace falta una carpeta para cada casilla. La estructura debe hacer más fácil localizar y cambiar una responsabilidad. Una abstracción que solo renombra una función y reparte su lectura entre cinco archivos aumenta el coste sin proteger nada.

## SOLID aplicado con criterio

| Principio | Aplicación en UI | Señal de problema | Verificación |
|---|---|---|---|
| S: responsabilidad única | Separar presentación, política y transporte cuando cambian por motivos distintos | Editar colores obliga a tocar persistencia | Cambiar estilo sin modificar caso de uso |
| O: abierto/cerrado | Composición y variantes explícitas en puntos de extensión reales | Cada variante añade condicionales por nombre de pantalla | Nuevo consumidor dentro del contrato sin alterar consumidores existentes |
| L: sustitución | Variantes conservan promesas semánticas y de interacción | Un “botón” deja de soportar teclado o deshabilitado | Suite de contrato compartida según semántica |
| I: segregación | Props y operaciones que cada consumidor necesita | Vista de lectura recibe métodos de escritura y objeto gigante | Interfaz de lectura usable sin permisos de edición |
| D: inversión | Caso de uso depende de un contrato estable de acceso | UI importa cliente HTTP global y conoce formato del proveedor | Adaptador de prueba y adaptador real cumplen el mismo contrato |

El concepto de responsabilidad se relaciona con razones de cambio, no con “una función por archivo”; puede contrastarse con [The Single Responsibility Principle](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html). La [regla de dependencias de Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) aporta un criterio para proteger políticas frente a detalles. Las traducciones concretas al frontend de esta tabla son propuestas del kit.

## Contrato de componente

Documentar propósito, semántica HTML, entradas, eventos, estado controlado/no controlado, invariantes, foco, teclado, errores, contenido extremo y responsabilidades excluidas. Incluir ejemplos de uso y de uso incorrecto cuando eviten un fallo probable.

Ejemplo: un Button de acción ejecuta `onPress`, conserva nombre accesible y tiene una política explícita para `busy`. No decide dónde guardar datos ni muestra un éxito antes de que lo confirme su consumidor. Un Link navega y conserva URL, apertura en nueva pestaña y comportamiento de historial. No son sustitutos semánticos simplemente porque compartan estilos.

## Contrato de caso de uso

Para “guardar edición”, definir entrada válida, resultado, errores recuperables, falta de permiso, conflicto de versión y resultado desconocido. El adaptador convierte respuestas de infraestructura a ese vocabulario. La UI representa esos estados sin interpretar directamente códigos arbitrarios de cada proveedor.

La cancelación de una petición de red no prueba que el servidor haya cancelado la operación. Las garantías de idempotencia deben existir donde se procesa el efecto; un flag `isSubmitting` en el navegador solo evita parte de las pulsaciones duplicadas.

## Estado y datos

Separar estado del servidor, estado navegable —filtros/página en URL cuando corresponde— y estado efímero local —popover abierto—. No duplicar cada dato del servidor en un store global y en cinco hooks. Elegir una fuente de verdad y una política clara de invalidación.

Una actualización optimista es una política de producto: necesita reversión, reconciliación y manejo de conflicto. Es apropiada para algunas acciones reversibles y de bajo riesgo, pero no se adopta por estética. La UI siempre distingue guardado confirmado, cambio pendiente y resultado desconocido.

## Migración técnica

Identificar una dependencia concreta que dificulte el piloto. Establecer un seam —punto donde se puede sustituir un comportamiento— y su interfaz. Introducir un adaptador compatible, migrar un consumidor y comprobar su contrato. Extender a consumidores restantes y retirar el camino antiguo al demostrar equivalencia.

Evitar interfaces universales anticipadas. Si no existe variación real, preferir una función clara o un módulo cohesivo. Los tests y consumidores deben cruzar la misma interfaz pública, salvo pruebas internas justificadas de algoritmos complejos.

## Gates

No hay ciclos nuevos entre funcionalidades y UI compartida. Los átomos no importan features. Los cambios de transporte no requieren tocar cada pantalla. Cada variante visual conserva semántica. Los casos de uso críticos tienen una prueba significativa. El árbol de carpetas ayuda a comprender el producto y no solo demuestra que se conocen términos arquitectónicos.
