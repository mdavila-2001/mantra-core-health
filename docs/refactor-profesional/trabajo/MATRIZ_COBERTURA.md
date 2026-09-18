# Matriz de cobertura — fase 08

Alcance de esta iteración: **un piloto completo y tres familias transversales**. El resto de las
232 rutas no se rediseñó; se lista por familia con su estado real para que nada quede omitido
en silencio.

## Piloto

| Ruta · rol | Estado | Normal | Vacío | Sin resultados | Error | Carga | Teclado | 375/768/1440 | Oscuro |
|---|---|---|---|---|---|---|---|---|---|
| `/my-account/appointments` · paciente | **Migrada** | ✅ E2E | sin cambios (unit) | sin cambios (unit) | sin cambios (unit) | sin cambios | ✅ E2E | ✅ E2E | ✅ captura |
| `/my-account/appointments` · cuenta sin perfil de paciente | Sin botón «Pedir una cita» | ✅ unit | — | — | — | — | — | — | — |

## Familias transversales

| Familia | Cambio | Rutas alcanzadas | Verificación |
|---|---|---|---|
| Marco autenticado (cajón a < ancho de organización) | H-01 | todas las del shell con selector de organización | unit (2) + E2E + kill-test |
| Tablas (`app-data-table`) | nombre de fila, sombra de scroll | 24 plantillas | unit (3) + E2E en Consultas; las otras 23 heredan sin prueba propia |
| Movimiento | tokens | 35 hojas | 1 327 pruebas de `shared/` + medición de duración computada |
| Fechas con «de» | `::first-letter` | panel del paciente · agenda de organización · facturación | panel ✅ observado; los otros dos **escritos, no observados** |

## No migrado (con razón)

| Familia | Razón |
|---|---|
| Navegación global | D-04 |
| Panel de la médica (H-10) | decisión de producto pendiente (D-05) |
| Maquetas del diseñador (`features/alovida/`, 126 pantallas) | son el entregable de diseño, sin persistencia; ya llevan aviso |
| Resto de listados, formularios y fichas | fuera del alcance de una sesión; plan en `PLAN_SITUADO.md` |

## Compatibilidad

Ninguna URL cambió; no hay redirecciones nuevas. `#pedir-turno` es un ancla nueva y estable.
