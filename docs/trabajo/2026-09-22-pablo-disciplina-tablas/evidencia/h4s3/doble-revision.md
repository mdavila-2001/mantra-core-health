# Doble revisión — historial laboral como tabla (H4.S3)

Capturas finales (post-corrección), cuenta sintética `medica@alovida.mock`, stock de componentes
(`/design-system/stock/.../work-history`, `layout=tabla`, `secciones=historial`) y app real:

| Captura | Viewport × tema |
|---|---|
| `capturas-post-fix/historial-1440-dark.png` | 1278 px de contenido, oscuro |
| `capturas-post-fix/historial-1440-light.png` | 1278 px, claro |
| `capturas-post-fix/historial-375-dark.png` | 318 px (Móvil chico), oscuro |
| `capturas-post-fix/historial-375-light.png` | 318 px, claro |
| `capturas-post-fix/real-app-1440-dark.png` | app real `/my-account/edit` → Dónde atiendo (paginación real) |

Medido por script (`scrollWidth === clientWidth`, consola sin errores) en las 4 celdas del stock.

## Defecto de la primera revisión, ya corregido

- **MAYOR — institución y cargo pegados** («Clínica Los OlivosJefa de servicio»): la celda no tenía el
  envoltorio de apilado. Corrección: `work-history.html` (`celdaInstitucionHistorial` dentro de
  `.historial__institucion`, mismo patrón que `layout="flat"`). Re-capturado; en las 4 celdas nombre y
  cargo salen apilados. `work-history.spec.ts` 83/83 tras el cambio
  (`evidencia/h4s3/work-history-spec-post-fix.txt`).

## Pasada 1 (verificación, sobre las re-capturas)

- P1 — historial-1440-dark — OK: Institución/Período/Adjunto/Acciones, filtro, «1–3 de 3».
- P1 — historial-1440-light — OK.
- P1 — historial-375-dark — OK: Período y Adjunto se pliegan al detalle, Editar/Retirar accesibles, sin scroll lateral.
- P1 — historial-375-light — OK.
- P1 — real-app-1440-dark — OK: paginación en una fila abajo a la derecha (`display:flex`, medido).

## Pasada 2 (adversarial)

1. Lo primero que vería mal: en el stock la paginación aparece apilada y con los selects a todo el ancho.
   Se investigó: en el stock la hoja de estilos de `app-pagination` no llega al iframe (0 reglas
   `pagination__*` en el documento); en la app real `host=flex`, `nav=flex` y la captura real la muestra
   correcta. Es un artefacto del stock, no del producto. **MENOR**, registrado.
2. Texto cortado/solapado: ninguno en las 4 celdas. En real, la última fila queda recortada por el alto
   máximo con scroll vertical: es la regla 6 del ADR-0015, no un defecto.
3. ¿Terminado o prototipo?: «Sin adjunto» queda 8–9 px más arriba que Editar/Retirar (alineación
   vertical distinta entre celdas). **MENOR**, no corregido: es alineación de `data-table`, fuera de mi
   alcance para esta pieza.
4. Coherencia con vecinas: mismos tokens, mismo `.historial__institucion` que la lista plana.
5. Oscuro: sin pérdida de contraste visible; claro: bien.
6. Estados vacío/error/carga del historial: **no capturados** (ver No cubierto).
7. Jerarquía: la acción primaria («Añadir elemento a tu historial») está al final, visible.
8. Datos: sólo cuenta y datos sintéticos del simulador; sin PHI.
9. ¿Muestra lo que pide el requisito?: tabla con institución, cargo, período, adjunto y acciones; editar
   y retirar con confirmación (flujo verificado antes en navegador: `h4s3-guardado.png`, `h4s3-retirado.png`).
10. Motivo por el que rechazaría el PR: ninguna ruta monta hoy `layout="tabla"`; el historial como tabla
    sólo se ve en el stock hasta que Itzan lo monte. Es alcance declarado, no defecto.

## Nota

`h4s3-editar-modal.png` y `h4s3-confirmar-guardar.png` (modal y confirmación) no se re-capturaron: el
cambio de markup no toca el modal. **ACEPTABLE CON RESERVAS**: modal y confirmaciones sólo en tema oscuro.

## Notas por pantalla

- Historial como tabla, escritorio y móvil, claro y oscuro: **ACEPTABLE CON RESERVAS** (dos MENOR
  registrados; estados vacío/error sin capturar; modal sólo oscuro).

## No cubierto

Estados vacío/error/carga del historial en captura · modal de edición en claro · 768 px · teclado
(H4.S2.M9 sigue abierto).
