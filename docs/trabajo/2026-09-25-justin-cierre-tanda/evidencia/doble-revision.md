# Doble revisión crítica de las capturas (regla 35.1)

26 capturas en [`capturas/`](./capturas/). **Primera pasada: hecha.** **Segunda pasada
adversarial: PENDIENTE — no puede ser propia** (regla 35.1.6: prohibido delegar la segunda pasada
al mismo agente que implementó).

## Primera pasada — verificación, una línea por pantalla

| Captura | Qué se buscaba | Nota |
|---|---|---|
| `A-tienda-375/768/1440-claro` | La tienda con resultados en tres anchos | **ACEPTABLE CON RESERVAS** — 1 178 resultados en los tres anchos; la lista respira, pero a 375 el documento mide 403 px (defecto del armazón, no de la pantalla) |
| `A-tienda-1440-oscuro` | Que el oscuro sea oscuro de verdad | **APROBADA** — fondo medido `rgb(8, 22, 28)`, no de vista |
| `A-recetas-375/1440-claro` | «Mis recetas» en móvil y escritorio | **APROBADA** |
| `A-recorrido-1-recetas` | Punto de partida del recorrido | **APROBADA** — 3 recetas ofrecen «dónde comprar» |
| `A-recorrido-2-donde-comprar` | La lista de farmacias con precio | **APROBADA** — las tarjetas traen precio y las dos acciones |
| `A-recorrido-3-agregado` | El estado tras «Agregar» | **RECHAZADA** — no aparece aviso, ni insignia, ni cambio visible. Ver `HALLAZGO-carrito-tras-agregar` |
| `A-recorrido-4-carrito` | El carrito con la línea agregada | **RECHAZADA** — dice «Tu carrito está vacío» |
| `HALLAZGO-carrito-tras-agregar` | Aislar el defecto anterior | **RECHAZADA** (documenta el defecto) — 0 líneas, sin diálogo ni aviso |
| `B-carga-1440-oscuro` | La pantalla de carga masiva en oscuro | **APROBADA** — contraste medido 13,3–14,33:1 |
| `B-teclado-foco` | Dónde cae el foco | **APROBADA** — el foco es visible; el orden completo está en `mediciones.txt` |
| `B-ndjson` | Qué hace con un NDJSON | **APROBADA** — el formato se admite y produce informe |
| `C6-historia-375/768/1440-light/dark` (6) | La historia en tres anchos y dos temas | **APROBADA** — Regla 8 medida: 0 px de diferencia entre holguras, 93,3 % del área, en los dos temas |
| `C4-mis-citas-375/768/1440-light/dark` (6) | El sello de reconsulta | **ACEPTABLE CON RESERVAS** — el sello y su frase se leen enteros en los tres anchos y los dos temas, **pero** se ven **dos citas idénticas** (mismo día, mismo profesional, mismo motivo). Ver el hallazgo del sembrado |

## Lo que la primera pasada encontró y los números no

Dos de los cuatro defectos del cierre **salieron de mirar, no de medir**:

1. **El carrito vacío.** El recorrido registró «insignia: (sin insignia)» y «continuar: false», que
   admite la lectura benigna de «faltan esos `data-testid`». La captura del carrito dice, con
   todas las letras, **«Tu carrito está vacío»**. Eso ya no admite lectura benigna.
2. **Las citas duplicadas.** El conteo `2, 3, 4, 5, 6, 7` podía ser un artefacto del contador. La
   captura a 375 muestra **dos tarjetas idénticas**, y ahí se ve que el duplicado es real y
   visible para el paciente.

## Lo que la primera pasada NO puede hacer

- **No es la segunda pasada.** La primera confirma lo que uno fue a buscar; la adversarial busca lo
  que uno no quiso ver. Hacer las dos yo mismo sería firmar mi propio trabajo.
- Las tres pantallas **`RECHAZADAS`** ya están declaradas como defecto abierto en el `REPORTE.md`,
  con dueño. No se entregan como `HECHO`.

**Quién debería hacer la segunda pasada:** cualquiera del equipo que no haya escrito este cierre.
