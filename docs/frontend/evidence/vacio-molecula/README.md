# Estado vacío · la molécula (19/09/2026)

El propietario bajó el vacío de «Cotizaciones» con una frase: **«se ve como un
texto tirau»**. Era literal — un título, un párrafo y la indicación de la
próxima acción como texto pelado en medio de un rectángulo blanco, sin ancla
visual, sin jerarquía y sin nada que dijera de qué estado se trataba.

El arreglo va **en la molécula** (`app-empty-state`), no en la pantalla: la
usan 77 plantillas y, a través de `app-view-state-host`, todas las secciones
que declaran sus nueve estados M34. Lo que cambió:

- **medallón por variante** — disco tonal con aro y halo, y el dibujo dentro:
  bandeja para «todavía no hay nada», lupa para «tu búsqueda no encontró nada»
  y nube tachada para «algo falló». El tono sale de los tríos `--st-*` del
  sistema, así que el modo oscuro lo resuelve el tema;
- **el dibujo propio del consumidor entra en el mismo medallón** (y apaga el de
  la casa), para que los dos caminos se vean igual de terminados;
- **jerarquía tipográfica** — título en Poppins 600 con medida corta, bajada en
  tinta secundaria a ~60 caracteres, y aire propio entre las tres piezas;
- **la próxima acción sin ruta ya no es prosa**: va en cápsula punteada, que se
  lee como instrucción y no finge ser un botón.

La prueba de navegador la levanta `playwright/vacios-molecula.spec.ts` contra el
backend simulado:

```bash
yarn ng serve --port 4200 &
E2E_BASE_URL=http://localhost:4200 npx playwright test playwright/vacios-molecula.spec.ts
```

| Captura | Qué muestra |
|---|---|
| `vacio-390.png` | Teléfono. El medallón encoge con la caja —porcentaje, no media query de ventana— y la cápsula sigue entera. |
| `vacio-768.png` | Tablet. |
| `vacio-1440.png` | Escritorio. El ancho de referencia del sistema. |
| `vacio-1440-oscuro.png` | El mismo vacío en tema oscuro: el disco y el aro salen de los tokens, no de valores fijos. |
| `vacio-muestra-sistema.png` | Las tres variantes juntas en el sistema de diseño: dos con dibujo propio del consumidor, una con el de la casa. |

Lo que las capturas acompañan, y que las aserciones del spec son las que
realmente fijan:

- el medallón **ocupa lugar** y es un disco (alto = ancho, radio completo), con
  el dibujo visible dentro — no un `<svg>` sin tamaño en el DOM;
- la indicación tiene borde **punteado** y cuerpo distinto al de la bajada;
- el título manda por tamaño sobre la bajada;
- donde el consumidor proyecta su dibujo, el de la casa queda en `display:none`
  y el propio se ve a la medida del disco (la regla vive sólo en CSS, así que
  se comprueba con estilo calculado);
- no hay desborde horizontal en ninguno de los tres anchos.
