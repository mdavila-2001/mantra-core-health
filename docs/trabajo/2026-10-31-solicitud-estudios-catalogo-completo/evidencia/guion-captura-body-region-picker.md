# Guion de captura: `app-body-region-picker` (H4.D)

Estado: **no ejecutado** (no se usó navegador). Lo corre el orquestador, un solo navegador, sin `networkidle`.

Montaje: dentro de la ranura del 3D de `imaging-study-picker` (H4.C), a lo ancho de la tarjeta (composition-rules §5).

1. Abrir la orden de imagenología con modalidad RX. Esperar el lienzo (`[data-testid="anatomy-viewer-canvas"]`, `data-status="ready"`). Captura 390 / 768 / 1440, claro y oscuro: visor arriba, lista y atribución debajo.
2. Clic en la mano izquierda del modelo. Esperar `[data-testid="body-region-viva"]` = «Región: Mano, izquierda.»; el trigger de la lista dice «Mano · Miembro superior»; el segmentado marca Izquierda; la cámara encuadra la mano.
3. Elegir «Rodilla» en la lista (teclado: Enter, escribir «rod», Enter). Verificar resaltado y encuadre de fémur y tibia; luego «Derecha» en el segmentado: el encuadre pasa al lado derecho.
4. Clic en el fémur cerca de la tibia: debe elegir Rodilla (artículación por punto); clic en la diáfisis: no cambia y avisa «elíjala desde la lista».
5. Elegir «Senos paranasales»: aviso «no tiene modelo 3D propio», zona ocre (relacionada), nada en verde.
6. Con `allowed=['MANO']` tocar el cráneo: aviso «Este estudio no admite Cráneo.» y el valor no cambia.
7. Sin WebGL 2 (flag de Chromium): aviso del visor y la lista sigue eligiendo.
8. Consola y red: sin errores; `body-regions.json` (≈40 KB) y `parts.json` una sola vez.
