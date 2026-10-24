# Contabilidad: tableros y registros en pestañas separadas (30/09/2026)

**Pedido:** `/administration/accounting` mezclaba registros con tableros en una sola
página larga y se veía caótica. Debe ir en pestañas separadas.

## Qué cambia

`/administration/accounting` tiene ahora dos pestañas, bajo el selector de consultorio:

| Pestaña | Contiene |
|---|---|
| **Resumen** (abre acá) | «Tu práctica en tres números», ¿Cuánto hiciste?, ¿En qué se te va la plata?, Lo que está pendiente, Lo que tenés y lo que debés, y el pie hacia la vista contable y los libros |
| **Registros** | Una tarjeta con Gastos · Activos · Deudas · Transacciones · Cuentas, cada una con su tabla y su alta/edición/baja |

- `ContabilidadSimple` gana el input `parte` (`todo` | `numeros` | `registros`). Cada instancia
  sólo lee lo que pinta: «Resumen» no pide cuentas ni registros y «Registros» no pide el resumen.
- El panel inactivo no se renderiza (comportamiento de `app-tab`), así que no queda nada vivo
  detrás.
- No cambian rutas, contratos de API, permisos ni datos.

## Evidencia (`evidencia/`)

`resumen-1440.png`, `registros-1440.png`, `resumen-390.png`, `registros-390.png`.

Corrida contra `ng serve` con la maqueta, rol doctora:

- `playwright/contabilidad-pestanas.spec.ts` — 2/2: en Resumen no hay tarjeta de registros ni
  botón «Nuevo gasto»; en Registros no hay tableros; fondo `rgb(255, 255, 255)`; tarjeta a
  ancho del área (1120 de 1200 px a 1440, 366 de 390 a 390); ningún elemento del contenido se
  sale del ancho a 390 px; sin errores de página.
- `playwright/contabilidad-simple.spec.ts` — 1/1, actualizado: ahora entra por la pestaña
  «Registros» (incluido tras recargar) y comprueba que en «Resumen» no hay tablas.
- Unitarias `src/app/features/accounting/**` — 5 archivos, 70 pruebas, todas pasan (3 nuevas
  sobre la separación).
- `yarn typecheck` sin errores; `eslint` limpio sobre lo tocado.

## Lo que NO se verificó / hallazgos aparte

- No se corrió la suite unitaria completa (~5 000 pruebas), sólo la del módulo.
- No se probó contra la API real: sólo la maqueta.
- **Preexistente, no tocado:** a 390 px la página entera tiene 23 px de desborde horizontal
  porque la cabecera del shell junta ocho controles (`.app-header__derecha` llega a 413 px).
  Pasa igual en `/administration/accounting/cockpit`, en `/libros` y en `/my-account`, que no
  se tocaron aquí.
- Al recargar (F5) la pantalla vuelve a «Resumen»; la pestaña no viaja en la URL.
