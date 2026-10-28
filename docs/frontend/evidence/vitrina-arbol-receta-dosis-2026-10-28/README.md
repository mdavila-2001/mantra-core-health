# Vitrina de medicamentos — árbol, receta obligatoria y dosis máxima (2026-10-28)

Capturas tomadas con Playwright (Chromium de la imagen, `PW_CHROMIUM=/opt/pw-browsers/chromium`)
contra `ng serve --port 4300` con el backend simulado (`mockBackend: true`), ruta
`/search/medications`. Script: `captura.cjs <carpeta>`.

| Viewport | Árbol (compuesto y una marca abiertos) | Modal |
|---|---|---|
| 390×844 | `arbol-390.png` | `modal-390.png` |
| 768×1024 | `arbol-768.png` | `modal-768.png` |
| 1024×768 | `arbol-1024.png` | `modal-1024.png` |
| 1440×900 | `arbol-1440.png` | `modal-1440.png` |
| 1920×1080 | `arbol-1920.png` | `modal-1920.png` |

Otras capturas:

- `arbol-plegado-1440.png`: el árbol recién abierto, todo plegado.
- `arbol-1440-oscuro.png` y `modal-receta-1440-oscuro.png`: modo oscuro.
- `arbol-venta-libre-1440.png`, `modal-venta-libre-1440.png` y `modal-venta-libre-1440-oscuro.png`: un compuesto que ninguna farmacia publica bajo receta.
- `arbol-teclado-foco-1440.png`: foco por teclado.

## Lo que mide el script (última corrida)

- **Desborde horizontal:** 0 px en los cinco viewports.
- **Teclado:**
  - Enter sobre el `summary` abre el compuesto.
  - Tab lleva a «Ver ficha, farmacias y mapa».
  - Shift+Tab vuelve al `summary` con `:focus-visible` y un contorno sólido de 4 px (la regla global de `alovida.css`).
- **Modal:** Esc lo cierra.
- **`pageerror`:** ninguno.
- **`requestfailed`:** ninguno, sin contar los tiles de OpenStreetMap.
- **`console.error`:** dos tipos, ninguno de este cambio:
  - 51 × `ERR_TUNNEL_CONNECTION_FAILED`: los tiles del mapa, que la red de la nube bloquea. Por eso el mapa sale gris; pasaba igual antes del cambio.
  - 14 × violación de CSP por scripts en línea de `ng serve`: se repite en cualquier página del servidor de desarrollo.

## Lo que no se verificó en navegador

- **Carga, error y vacío del árbol:** el backend simulado responde en el acto y sin fallar, así que no se ven en navegador. Están cubiertos por `medication-tree.spec.ts`: carga, error con reintento y vacío.
- **API real:** no se probó contra ella. Es una vista sólo de lectura, sin mutaciones.

## Dosis máxima e indicaciones

A propósito dicen «sin fuente oficial cargada» (B-13). Se completan cuando corran los importadores de CIMA y FDA (`mantra-core-health-api/tools/terminology-import/clinical-pharmacology` y `drug-treatments`). Hoy no llegan a esos dominios.

## Receta

- **«Con receta»** se afirma con el dato de la tarjeta.
- **«Venta libre»** sólo se afirma con la disponibilidad completa, es decir con las ofertas de todo el país. La tarjeta sale de ofertas ya recortadas por la búsqueda y el radio, así que su «sin receta» no alcanza para afirmarlo.
- **El dato lo declaran las farmacias**, no un registro regulatorio, y el texto lo dice así.
