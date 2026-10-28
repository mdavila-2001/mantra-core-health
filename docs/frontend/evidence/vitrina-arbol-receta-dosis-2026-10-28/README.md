# Vitrina de medicamentos — árbol, receta obligatoria y dosis máxima (2026-10-28)

Capturas tomadas con Playwright (Chromium) contra `ng serve` con el backend
simulado (`mockBackend: true`), ruta `/search/medications`. Script: `captura.cjs`.

| Viewport | Árbol | Modal |
|---|---|---|
| 390×844 | `arbol-390.png` | `modal-390.png` |
| 768×1024 | `arbol-768.png` | `modal-768.png` |
| 1024×768 | `arbol-1024.png` | `modal-1024.png` |
| 1440×900 | `arbol-1440.png` | `modal-1440.png` |
| 1920×1080 | `arbol-1920.png` | `modal-1920.png` |

Extras: `modal-venta-libre-1440.png` y `modal-venta-libre-1440-oscuro.png`.

Medido en cada viewport: desborde horizontal 0 px; ningún `pageerror`.

**No verificado:** los tiles del mapa salen grises porque la sesión de la nube no
llega a OpenStreetMap (red bloqueada). Pasaba igual antes del cambio. Tampoco hay
evidencia contra la API real: es una vista sólo de lectura, sin mutaciones.

**Dosis máxima e indicaciones:** a propósito dicen «sin fuente oficial cargada»
(B-13). Se completan cuando corran los importadores de CIMA/FDA
(`mantra-core-health-api/tools/terminology-import/clinical-pharmacology` y
`drug-treatments`), que hoy no llegan a esos dominios.
