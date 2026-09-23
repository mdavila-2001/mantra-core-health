# Adjudicación del carril original de 51 microtareas

Fecha: 2026-09-23. Esta tabla no reescribe el plan maestro: reconcilia la
evidencia disponible en la rama de producto para que el avance no confunda
trabajo funcional, decisión de producto y gate global.

## Base legada

El reporte predecesor `2026-09-23-reserva-y-cotizaciones/REPORTE.md` declara
**20/51**. Ese reporte conserva las pruebas de `result-card` (7/7),
disponibilidad (13/13), lógica de cotizaciones (3/3), tipo y las brechas, pero
no registró una fila por ID. Se conserva ese número como avance legado, sin
convertir su resumen narrativo en IDs inventados.

## Microtareas nuevas, no solapadas con el reporte legado

| ID original | Estado | Evidencia |
|---|---|---|
| H3.S2.M8 | HECHO | Seis capturas revisadas en 390/768/1440 px, claro/oscuro: `evidencia/capturas.md`. El reporte legado decía explícitamente que no había verificación visual final. |
| H5.S1.M3 | HECHO | Mock backend: 21/21 PASS, `evidencia/gates.md`. |
| H5.S1.M4 | HECHO | Barrido de rutas serial: 5/5 PASS, `evidencia/gates.md`. |
| H5.S2.M1 | HECHO | `git grep` no encontró `iconOnly` en los archivos reservados, `evidencia/controles.md`. |
| H5.S2.M2 | HECHO | Cotizaciones no declara botones propios ni acciones sólo-ícono; los tres controles llevan etiqueta visible, `evidencia/controles.md`. |
| H6.S1.M1 | HECHO | Capturas finales miradas, `evidencia/capturas.md`. |
| H6.S1.M2 | HECHO | Playwright cubre Enter en Directorio, búsqueda, vertical y orden en Cotizaciones. |
| H2.S1.M3 | HECHO | La portada bloquea activaciones repetidas; unit 29/29 y Playwright comprueban cuatro toques → `pushState: 1`, con captura. |

Resultado recalculable actual: **20 legado + 8 no solapadas = 28/51 HECHO**.

## Decisión de producto

| ID original | Estado | Motivo |
|---|---|---|
| H4.S1.M1–M6 | DESCARTADO | El producto decidió que Cotizaciones debe mostrar sólo cotizaciones; recetas y estudios quedan en sus superficies propias. La ausencia se prueba en `playwright/cotizaciones-paciente.spec.ts`. No suman como HECHO. |

## Pendientes que no se pueden declarar terminados

- H1.S2 y H2.S2: falta una comparación antes/después del mismo flujo completo
  hasta cupos; la muestra local actual no reemplaza la medición histórica.
- H3.S2.M2–M4: origen elegible, tabla/acciones y todos los estados requieren
  contratos y componentes que no se pueden simular como datos de negocio.
- H5.S1.M1–M2: lint global continúa rojo (243 errores) y el test completo no
  se puede declarar verde por ese estado global.
