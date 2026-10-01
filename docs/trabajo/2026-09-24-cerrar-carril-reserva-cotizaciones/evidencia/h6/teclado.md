# Recorrido de teclado — generado por playwright/cierre-carril-reserva-cotizaciones.spec.ts

1. Directorio: foco en la primera especialidad + Enter → abre su lista (una navegación)
2. Directorio: foco en el título del primer resultado + Enter → abre la ficha
3. Cotizaciones: foco en «Qué querés cotizar», escribir «paracetamol» → resultados con precio y procedencia
4. Tab ×2 → «Vertical» recibe el foco (antes pasa por el control propio del campo de búsqueda)
5. Tab → «Ordenar por»; Flecha abajo → «Cercanía» (ordena por los km que calculó la API)
6. La acción de la primera fila («Directorio de farmacias», ícono + texto) recibe el foco visible y Enter la abre → `/pharmacies-directory` (captura `teclado-foco-accion-1440-light.png`; anillo rgba(79, 179, 169, 0.45) sobre rgb(255, 255, 255) → 1.48:1)
7. Ficha: foco visible en el primer cupo y Enter → abre la reserva con ese cupo (`/my-account/appointments/book/<cupo>`; captura `teclado-foco-cupo-1440-light.png`; claro: anillo rgba(79, 179, 169, 0.45) sobre rgb(255, 255, 255) → 1.48:1; oscuro (`teclado-foco-cupo-1440-dark.png`): anillo rgba(87, 194, 183, 0.42) sobre rgb(255, 255, 255) → 1.37:1)
