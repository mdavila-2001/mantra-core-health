# Recaptura final del portal admin — índice

Rama `claude/upbeat-darwin-rm3rn2`. Capturas de vista (no página completa).

- **antes**: worktree de `1d95bdcc` (estado rechazado), `ng serve` en 4201, `antes-1440-claro.png` y `antes-390-claro.png`.
- **después**: checkout principal sobre `8d97097b` + trabajo de primitivas ya en árbol, `ng serve` en 4200;
  `despues-{1440-claro,1440-oscuro,768-claro,390-claro,390-oscuro}.png`.
- Cada captura exigió h1 visible, sin `vite-error-overlay` y más de 80 caracteres de texto (hasta 3 intentos).
- scrollWidth = `document.documentElement.scrollWidth` / `innerWidth`. Consola = errores de `console.error` y `pageerror`.
- Defectos: lectura propia de 1440 claro y 390 claro, **sin aprobar nada**; los mira un revisor independiente.

| Pantalla | Archivos | scrollWidth (después) | Consola | Defectos vistos |
|---|---|---|---|---|
| centro | `centro/` antes×2, después×5 | todos = ancho | sin errores | 1440: media pantalla vacía bajo las tarjetas (no es defecto de layout). 390: correcto. |
| auditoria | `auditoria/` antes×2, después×5 | todos = ancho | sin errores | 1440: selects «Quién» y «Resultado» truncados («Cualquier per…», «Cualquier res…»); fechas con marcador `mm/dd/yyyy` (formato EE. UU. del navegador). 390: los filtros ocupan toda la primera vista y «Aplicar filtros» queda bajo la barra inferior. |
| rbac-matrix | `rbac-matrix/` antes×2, después×5 | todos = ancho (antes 390: 447/390, desbordaba) | sin errores | 1440: el rótulo «Vista» queda unos px más abajo que «Módulo»; el buscador no tiene rótulo visible. 390: las 4 cifras apiladas en una columna empujan la matriz muy abajo. |
| roles | `roles/` antes×2, después×5 | todos = ancho | sin errores | 1440: selector de rol en rejilla de 4 con «Recepción» huérfana en la 2.ª fila. 390: pestañas-enlace cortadas a la derecha («Permisos por cam…», con desplazamiento). |
| field-permissions | `field-permissions/` antes×2, después×5 | todos = ancho | sin errores | 1440: select de rol a media anchura y «Agregar una regla» deshabilitado aislado a la derecha; misma rejilla 4+1. 390: pestaña activa centrada, vecinas cortadas en los bordes (esperado con desplazamiento). |
| who-can | `who-can/` antes×2, después×5 | todos = ancho | sin errores | 1440: correcto; «Más contexto (opcional)» como fila completa con borde, poco jerarquizada. 390: correcto. |
| access-reviews | `access-reviews/` antes×2, después×5 | todos = ancho | sin errores | 1440: «Ver estado →» con tipografía más grande/pesada que el resto de la tabla. 390: tabla apilada (rótulo arriba, valor debajo) larga; correcto. |
| mutabilidad | `mutabilidad/` antes×2, después×5 | todos = ancho | sin errores | 1440: 5 cifras en fila, rótulos partidos en 2 líneas («CON MODO / DECIDIDO», «IMPUESTO POR LA / BASE») y desalineados con las de 1 línea. 390: cifras en 1+2 columnas; en las de 2 columnas «11 de 13» parte en dos líneas y el texto queda muy estrecho. |
| ui-catalog | `ui-catalog/` antes×2, después×5 | todos = ancho | sin errores | 1440: correcto; «0» de «Reglas vigentes» como enlace subrayado aislado a la derecha. 390: cifras en 2 columnas con rótulos y descripciones muy partidos («RETIRADOS / DEL CÓDIGO», «Ya no los / declara la / interfaz»). |
| ui-rules | `ui-rules/` antes×2, después×5 | todos = ancho | sin errores | 1440: correcto. 390: mismas cifras estrechas en 2 columnas («No se muestran / salvo que una / regla los / muestre»). |
| ui-preview | `ui-preview/` antes×2, después×5 | todos = ancho | sin errores | 1440: correcto; vacío centrado con aire. 390: correcto; el vacío queda bajo la primera vista. |
| catalog-fit | `catalog-fit/` antes×2, después×5 | todos = ancho | sin errores | 1440: 5 cifras en fila con rótulo partido («ANTIGÜEDAD DEL / DATO»); «comprobación(es)» con paréntesis en el aviso. 390: las cifras ocupan más de una vista entera antes de las pestañas. |
| runtime-pieces | `runtime-pieces/` antes×2, después×5 | todos = ancho | sin errores | 1440: tres botones en la cabecera compiten (dos contorneados + uno lleno); rótulos partidos («ANTIGÜEDAD DEL / DATO», «FUERA DEL / REGISTRO»); «evaluado hace 0 s». 390: «10 de / 18» parte en dos líneas en la cifra de 2 columnas; botones de cabecera ocupan tres filas. |
| dq-issues | `dq-issues/` antes×2, después×5 | todos = ancho | sin errores | 1440: el menú lateral muestra «Calidad de datos» (un único ítem) mientras la pantalla es «Incidencias». 390: cifras 2×2 correctas; las pestañas de la tarjeta quedan cortadas por la barra inferior en la primera vista. |
| dq-rules | `dq-rules/` antes×2, después×5 | todos = ancho | sin errores | 1440: correcto; mismo menú lateral de un ítem («Calidad de datos»). 390: cifras 2×2 con rótulos de 3 líneas («CON / INCIDENCIAS / ABIERTAS»). |
| privacy | `privacy/` antes×2, después×5 | todos = ancho | sin errores | 1440: correcto. 390: pestañas de estado con flechas de desplazamiento; cifras de 2 columnas con texto partido. |
| policies | `policies/` antes×2, después×5 | todos = ancho | sin errores | 1440: «Sin estado» como insignia con el mismo peso que «Activa». 390: tabla apilada; correcto. |
| pii | `pii/` antes×2, después×5 | todos = ancho (antes 390: 560/390, desbordaba) | sin errores | 1440: rótulo partido («TABLAS CON DATOS / PERSONALES») desalinea la cifra respecto de las otras tres. 390: cifras de 2 columnas muy partidas («COLUMNAS / OBSERVADAS», «TABLAS CON / DATOS / PERSONALES»). |

## Resumen

- 36/36 «antes» y 90/90 «después» capturados; ningún fallo, ningún reintento, ninguna captura en blanco.
- Desborde horizontal: ninguno en «después»; en «antes» desbordaban rbac-matrix 390 (447) y pii 390 (560).
- Consola: sin `console.error` ni `pageerror` en las 126 cargas.
- Defectos que se repiten (para el revisor, no corregidos):
  1. Cifras (KPI) a 390 en dos columnas: rótulos de 2–3 líneas y cifras partidas («10 de / 18», «11 de / 13»). Afecta mutabilidad, ui-catalog, ui-rules, catalog-fit, runtime-pieces, dq-rules, privacy, pii.
  2. Cifras a 1440 con 5 tarjetas: rótulos partidos y cifras desalineadas entre tarjetas (mutabilidad, catalog-fit, runtime-pieces; pii con 4).
  3. Selects truncados en la fila de filtros de Auditoría a 1440.
  4. Menú lateral de «Calidad de datos clínicos» con un único ítem «Calidad de datos» que no nombra la pantalla (Incidencias / Reglas).
  5. A 390 la barra inferior tapa la acción primaria o las pestañas de la tarjeta en la primera vista (auditoria, dq-issues).
- Temas oscuros y 768: capturados y medidos, no leídos uno a uno (muestra: rbac-matrix 390 oscuro, correcto).
