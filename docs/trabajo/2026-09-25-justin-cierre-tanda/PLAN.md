# Plan — Cerrar lo que quedó abierto de la tanda del 2026-09-25 (Justin)

- Fecha: 2026-09-25 · Rama: `justin/cierre-tanda-2026-09-25`, desde `origin/mockup` @ `9b8bc46e`
- Cierra los cinco carriles de esa noche: A (Farmacia), B (Carga masiva), C4, C6 y C8.

## Qué falta, de verdad

Los cinco carriles están **mergeados**. Lo que quedó abierto no es código: es **observación**.
Aquella noche había cuatro agentes en paralelo sobre la misma máquina y la regla 70 prohibía
levantar un servidor, así que todo lo visual quedó `UNKNOWN` o `WRITTEN`, la suite completa no se
corrió en ningún carril y tres specs de Playwright se escribieron sin ejecutarse nunca.

Hoy la máquina está libre. Eso cambia el plan por completo: **casi nada de esto exige tocar
código**, y lo que se mide se mide una sola vez, sobre `mockup`, que ya contiene los cinco
carriles.

## Alcance

| Sí | No |
|---|---|
| Correr la suite, el build y los gates, y **clasificar cada rojo** (regla 80.4) | Arreglar rojos de otros carriles (regla 00 §3.2) |
| Ejecutar los specs de Playwright que se escribieron sin correr | Escribir `scripts/pw-guard.mjs` (era artefacto de C0) |
| Tomar las capturas que faltan y **medir** contraste y Regla 8 | Montar el cableado de `consultation/**` que era de C1 |
| Corregir defectos **propios** que la observación destape | Levantar la API real y su stack de cinco almacenes |

## Microtareas

| ID | Carril | Qué | DoD |
|---|---|---|---|
| T1 | A, B, C8 | Suite completa, build, typecheck, lint y los `check-*.mjs` | Salida pegada y **cada rojo clasificado con el corte en que aparece** |
| T2 | A | Capturas de la tienda (3 anchos + oscuro) y de «Mis recetas» (375, 1440) | 6 capturas en disco |
| T3 | A | Recorrido receta → carrito → continuar | Recorrido hecho en navegador, con lo que pase escrito |
| T4 | B | Contraste del tema oscuro **medido**, no afirmado | Relación por elemento, contra el umbral AA |
| T5 | B | Recorrido de teclado observado y NDJSON subido | Orden de foco real y respuesta de la pantalla |
| T6 | B | Los casos de error recorridos en navegador | `no-es-nada.pdf` y `error-red.csv`, en verde |
| T7 | C4 | Ejecutar `clinica-c4-reconsulta.spec.ts` | Resultado por caso, y causa de cada fallo |
| T8 | C4 | Capturas de los sellos, 3 anchos × 2 temas | 6 capturas + primera pasada crítica |
| T9 | C6 | PDF descargado y comprobado | Bytes y cabecera `%PDF-` |
| T10 | C6 | Regla 8 **medida** y capturas en los dos temas | Holguras y porcentaje contra sus umbrales |
| T11 | C8 | Barridos `mockup-barrido` y `mockup-click-sweep` | Corridos con el servidor a mano |

## Ambigüedades registradas antes de empezar (regla 1.2)

1. **`scripts/pw-guard.mjs` no existe.** Los DoD de C4, C6 y C8 lo nombran. Era de C0, que no se
   entregó. **Supuesto:** se corre el servidor a mano, que es la alternativa que los propios
   reportes de esos carriles anotan. No se escribe el guard: es de otro carril.
2. **El cableado de `consulta-casilla-reconsulta` sigue sin existir.** `FollowUpBlock` está en el
   árbol y **no lo monta ninguna plantilla**. Es de C1, que no se entregó. **Supuesto:** los casos
   de C4 que arrancan ahí se ejecutan igual y se reporta que fallan, con la causa. No se monta la
   casilla: sería tomar el carril de otro.
3. **La suite puede estar en rojo por cosas ajenas.** **Supuesto:** se clasifica corriendo los
   mismos specs en el corte base y bisecando hasta el merge culpable. No se arregla nada ajeno.
