# Doble revisión de capturas — orden de estudio por tipo (06/11/2026)

Capturas: `evidencia/*.png` (390 / 820 / 1440 px, claro y oscuro), generadas por
`playwright/orden-tipo-laboratorio-imagenologia.mjs` contra el simulador. Consola: 0 errores; 33/33 chequeos de comportamiento (`recorrido.log`).

## Primera pasada (quien implementa)
Miradas una a una: formulario de laboratorio y de imagen en los tres viewports; árbol de cada tipo (Sangre, Orina, Heces, Fluidos); ficha de imagen; cuerpo 3D + lista de regiones; histórico con el detalle. Defectos propios encontrados y corregidos **antes** de la segunda pasada:
- `ResizeObserver loop…` (21 errores de consola) al montar el visor sin altura definida → altura fija en el contenedor; 0 errores.
- Lista «Para revisar» sin viñetas (reset global) → `list-style: disc`.
- Pieza 3D resaltada contradiciendo la región elegida por lista → se quita el resalte al elegir por lista.

## Segunda pasada (agente revisor independiente, adversarial)
Veredicto sobre el primer juego de capturas: **ACEPTABLE CON RESERVAS**, sin BLOQUEANTE, 4 MAYOR.

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| MA1 | MAYOR | El visor 3D no refleja la región elegida; tocar vísceras suele dar «sin región» (≈la mitad de las mallas del atlas no trae región) | **ABIERTO** — se agregó leyenda; el resalte por región necesita asignar región a todas las mallas (dato del atlas) |
| MA2 | MAYOR | «Qué laboratorio lo realiza» no permite elegir un laboratorio concreto: es la recomendación de sede existente, y con el catálogo actual quedan deshabilitadas | **ABIERTO** — decisión de producto (A5) |
| MA3 | MAYOR | Textos con «procedimiento» en flujos de laboratorio/imagen | **CORREGIDO** (`termino`, con prueba) |
| MA4 | MAYOR | Falta evidencia de imagen en móvil y de oscuro tablet/escritorio | **CORREGIDO** (`06a/06b/06c` y `03a/03b` en 3 viewports × 2 temas; un árbol por tipo) |
| M1 | MENOR | Copy «no se inventan estudios…» en voz de desarrollador | CORREGIDO |
| M2 | MENOR | Sólo se veía el árbol de Sangre | CORREGIDO (Orina, Heces, Fluidos capturados) |
| M3 | MENOR | «Tipo: Laboratorio» redundante bajo Estudio | ABIERTO (comportamiento previo de la pantalla) |
| M4 | MENOR | «Tipo de imagen» sin asterisco y «Tipo de análisis *» con él | ABIERTO (es opcional a propósito) |
| M5 | MENOR | Radios deshabilitados casi invisibles | ABIERTO (componente compartido, fuera de alcance) |
| M6 | MENOR | Aviso de la ficha chico y en cursiva | ABIERTO (sin medir contraste) |
| M7 | MENOR | Ritmo desigual de filas del histórico | ABIERTO (previo) |

## Estado
La recaptura posterior a las correcciones **no tuvo una tercera pasada independiente** (la regla 35.1.4 la exige tras cada corrección). Peldaño visual: `VERIFIED_FUNCTIONAL_ONLY`. Notas por pantalla de la segunda pasada: 00, 04, 07, 08 APROBADA; 01, 02, 03, 05, 06 ACEPTABLE CON RESERVAS (06 móvil RECHAZADA por evidencia insuficiente, ya recapturada y no re-revisada por un tercero).
