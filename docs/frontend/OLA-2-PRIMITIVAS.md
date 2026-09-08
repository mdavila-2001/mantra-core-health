# Ola 2 · Auditoría de primitivas

**Fecha:** 2026-09-08 · **Alcance:** 23 átomos, 37 moléculas, 29 organismos.

---

## Resultado: sin deuda de foco ni de motion

La auditoría automática marcó **38 primitivas sin `:focus-visible`** y **17 que
animan sin `prefers-reduced-motion`**.

**Las dos cifras son falsos positivos, y verificarlas fue el trabajo.**

### Por qué

Ambas preocupaciones están resueltas **de forma central**, a propósito:

```css
/* src/styles/alovida.css:378 */
:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible { … }
```

Ese `:where()` cubre todo elemento interactivo del producto. Y la doc de
accesibilidad no lo deja a interpretación:

> | Anillo de foco propio por componente | **No: el global de `:focus-visible`** |

Lo mismo con el movimiento: `src/styles.css:125` dice que las animaciones se
gobiernan *«solo por el bloque `prefers-reduced-motion` del final del archivo»*,
y hay cuatro bloques de ese tipo entre `styles.css` y `alovida.css`.

### La conclusión importante

Agregar `:focus-visible` a esas 38 primitivas **habría sido una regresión**: se
veía como accesibilidad y era romper la arquitectura documentada del sistema,
duplicando en 38 lugares una regla que existe en uno.

Un anillo de foco por componente es exactamente cómo se desincroniza un sistema
de diseño: el día que el anillo cambie, 38 lugares quedan viejos y nadie se
entera.

## Deuda de tokens: cerrada

Tras DD-001 queda **un** color literal en todo `src/` que coincide exacto con
una rampa (`#a2a4a4` → `--c-neutral-200`).

Sobre los que quedan sin tokenizar, la distinción que importa:

- **A `--c-*` es seguro**: mismo valor en claro y oscuro, no cambia
  comportamiento.
- **A `--brand-*`, `--bg-*`, `--text-*` NO es mecánico**: esos tokens *cambian
  de valor con el tema*. Sustituir un literal por uno de ellos altera el modo
  oscuro. Es una decisión de diseño, no un refactor, y necesita a quien defina
  el diseño.

## Lo que esta auditoría NO cubre

Sigue pendiente, y es trabajo por componente, no automatizable:

- matriz visual de cada primitiva con todas sus variantes;
- los nueve estados M34 por primitiva;
- recorrido de teclado real (orden de tabulación, trampas de foco en diálogos);
- pruebas de componente donde falten.

Son 89 primitivas. A una microtarea por primitiva con los gates del playbook,
es un programa, no una corrida.
