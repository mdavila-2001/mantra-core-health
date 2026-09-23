# Usos de los organismos canónicos

Generado por `node scripts/inventario-organismos.mjs`. No editar a mano: se regenera.

Cada arista lleva **relación**, **archivo y línea**, **condición de renderizado** y **mundo**
(producto, organismo, catálogo, maqueta o prueba). Un `imports-available` sin
`template-instantiates` es una pieza disponible que nadie monta. El detalle completo, con
todas las aristas, está en `usos-organismos.json`.

## Consumidores por mundo (componentes distintos que instancian la pieza)

| Pieza | Producto | Catálogo | Maqueta | Organismo | Prueba | Proyectan contenido (producto) | Importan solo tipos (producto) |
|---|---:|---:|---:|---:|---:|---:|---:|
| `DataTable` | 28 | 2 | 0 | 0 | 1 | 0 | 28 |
| `ContentDialog` | 24 | 1 | 2 | 1 | 1 | 13 | 0 |
| `ViewStateHost` | 65 | 2 | 0 | 3 | 1 | 20 | 191 |
| `FilterBar` | 4 | 1 | 0 | 2 | 1 | 0 | 0 |
| `PageHeader` | 169 | 1 | 0 | 1 | 1 | 26 | 0 |
| `DirectoryPage` | 5 | 0 | 0 | 0 | 0 | 4 | 6 |
| `historialDeCursor` | 4 | 1 | 0 | 0 | 1 | 0 | 0 |

## Hallazgos (0)

Ninguno: todo import de un organismo se instancia, y todo selector está importado.

## Condiciones de renderizado en producto

Cuántas instancias de cada organismo están bajo un control de flujo, y cuántas siempre.

| Pieza | Siempre | Bajo `@if`/`@for`/`@case` |
|---|---:|---:|
| `DataTable` | 26 | 32 |
| `ContentDialog` | 12 | 16 |
| `ViewStateHost` | 57 | 19 |
| `FilterBar` | 3 | 1 |
| `PageHeader` | 161 | 8 |
| `DirectoryPage` | 4 | 1 |
