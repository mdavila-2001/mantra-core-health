# Doble revisión de capturas — «Órdenes» (laboratorio / imagenología)

Capturas: Playwright contra `ng serve --configuration development,demo`, Chromium, viewports 390×844, 768×1024 y 1440×1250
(1440 de alto 1250 y sin «página completa»: la captura de página completa redimensiona el viewport y dispara la animación
de la barra lateral, y eso contaminó tres tandas anteriores). Consola y red: ver `recorrido-final.log`.

## Pasadas

| # | Quién | Sobre qué | Resultado |
|---|---|---|---|
| 1 | Quien implementó | Primer juego | Escritorio bien; en 390 la tabla ocultaba el estado → se pasó a `stackedOnMobile` |
| 2 | Revisor independiente (`visual-reviewer`) | Segundo juego (9 capturas) | NO entregable: capturas viejas, pestañas equivocadas, panel de subida al final y sin decir a qué orden, menú tapando filas |
| 3 | Revisor independiente (otro agente) | Tercer juego (24 capturas) | (b) panel y (c) tablet resueltos; (a) 5 capturas de 1440 con la barra lateral a media animación → BLOQUEANTE |
| 4 | Quien implementó | Cuarto juego (final) | 1440 ya estable (viewport alto, sin página completa); revisadas 05, 04 y 01 a ojo |

**Pendiente de rigor:** el juego final no pasó por una nueva revisión independiente (la regla 35.1.4 pide dos pasadas
sobre cada recaptura). Por eso la entrega visual queda `ACEPTABLE CON RESERVAS`, no `APROBADA`.

## Correcciones hechas por las revisiones
- Estado ilegible en celular → ficha apilada (`stackedOnMobile`).
- Panel de subida: pasó arriba de la tabla, nombra la orden («Paciente · Estudio»), el título cambia de «Subiendo» a
  «Resultados subidos» y cada archivo en curso tiene `<progress>` con nombre accesible.
- Tablet: «Pedida» pasa a prioridad 1 (ya no queda plegada tras un ▼).
- Placeholder del buscador acortado («Paciente o estudio»).
- «Limpiar la lista» ya no hereda la posición de grilla de los botones de archivo.

## Hallazgos que NO se corrigieron (componente compartido o fuera de alcance)
- Menú de acciones pegado al borde derecho en 390; ítems deshabilitados sin explicar por qué (`app-row-actions`).
- Pestañas cortadas bajo la flecha en 390 (`app-tabs`), y tarjeta dentro de tarjeta (mismo patrón que el catálogo de la farmacia).
- Botón «Acciones» ≈40 px de alto (compartido).
- Nombre del paciente en 3 líneas en la ficha apilada (`app-data-table`).

## No cubierto
- Estado «Subiendo» con barra de progreso: la maqueta completa la subida al instante, así que no hay captura; lo cubre
  `laboratory-orders.spec.ts` («mientras se sube…»).
- Orden **Rechazada**: ninguna orden sembrada está en ese estado y la UI no la produce (no es una de las cuatro acciones).
  Cubierta por `lab-portal.handlers.spec.ts` y `laboratory-orders.logic.spec.ts`, sin captura.
- Estados de carga y de error de la tabla, teclado/foco, contraste medido, tema oscuro en 768.
