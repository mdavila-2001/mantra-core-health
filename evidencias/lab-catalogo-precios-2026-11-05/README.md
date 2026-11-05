# Laboratorio · Agregar del catálogo y Precios por componente (proceso 4.2)

Corrida del 05/11/2026 contra `yarn start:demo` (simulador), con
`node playwright/lab-catalogo-precios.mjs http://localhost:4200 evidencias/lab-catalogo-precios-2026-11-05`.

| Paso | Resultado |
|---|---|
| Elegir «Hemograma completo» en el catálogo y agregar | `Se agregó 1 análisis con sus componentes.` (`04-agregado.png`) |
| Recargar la página (F5) | La tarjeta dice «Ya está en su lista de precios» |
| Precios, buscar «hemograma» | Hemograma completo y debajo sus 6 componentes, cada uno con su monto (`05-precios-con-componentes.png`). El Hemograma escrito a mano por el laboratorio quedó vinculado y conserva 60.00 Bs con 10 % |
| Poner 12 al VCM (entró sin precio sugerido), guardar, recargar | `12.00` · `12.00 Bs` · Visible (`06-vcm-guardado-y-recargado.png`) |
| Teléfono (iPhone 13) y 320 px | Desborde horizontal 0 px (`07`, `08`) |
| Consola | Sin errores |

Contra la API real no se corrió: el entorno de la sesión no tiene la base ni Mongo. Las consultas SQL
nuevas se probaron contra el DDL real en un Postgres 16 local (ver el PR de la API).

En 320 px la columna de precio queda angosta y recorta el monto: lo hace `DataTable` desde antes de este
cambio; está en un issue aparte.
