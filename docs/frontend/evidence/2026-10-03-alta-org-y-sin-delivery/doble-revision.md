# Doble revisión de las capturas

Capturas en [`capturas/`](./capturas). Las 13 se abrieron como imagen **dos veces**: una pasada de verificación contra el criterio y una segunda, adversarial, buscando motivos para rechazar. Quien revisó es la misma sesión que implementó (no hubo un segundo revisor independiente: queda dicho en «No cubierto» del README).

Severidades: **BLOQUEANTE** impide entregar · **MAYOR** debe corregirse pronto · **MENOR** deuda. Nota: `RECHAZADA` · `ACEPTABLE CON RESERVAS` · `APROBADA`; ante la duda, la más baja.

## Alta de organización (aseguradora), contra la API real — rama de `test`

| Captura | 1.ª pasada (¿cumple?) | 2.ª pasada (adversarial) | Nota |
|---|---|---|---|
| `alta-valido-exito` | «Tu cuenta está lista» y botón «Ir a iniciar sesión» **con estilo de botón** (antes era texto plano: ese era el defecto). | Sin hallazgos. Texto del estado de aprobación pendiente presente. | **APROBADA** |
| `alta-visual-exito-movil` (390×844) | Tarjeta ajustada al ancho, botón a ancho completo. | Altura del botón verificada por aserción ≥ 44 px y `scrollWidth` ≤ 390. Sin hallazgos. | **APROBADA** |
| `alta-visual-exito-oscuro` | Texto claro sobre fondo oscuro, botón aqua con tinta oscura. | Contraste legible a simple vista; **no se midió con herramienta** (MENOR: sin medición WCAG). | **APROBADA** |
| `alta-error-sigla-repetida` | El mensaje nombra la sigla («La sigla «…» ya está en uso… Elegí otra.»); el formulario conserva lo escrito. | **MENOR:** el ícono de la alerta queda en su propia línea sobre el texto (componente ajeno, preexistente). | **ACEPTABLE CON RESERVAS** |
| `alta-error-correo-repetido` | «Ya existe una cuenta con ese correo»; el paso «Tu cuenta» sigue en pantalla con los datos. | Mismo **MENOR** del ícono. El mensaje es correcto pero genérico (no dice qué hacer: iniciar sesión o recuperar la clave). | **ACEPTABLE CON RESERVAS** |
| `alta-error-pdf-falso` | El servidor rechazó el archivo (422) y la zona queda sin archivo, con mensaje rojo «Solo se admiten documentos PDF». | **MENOR:** el archivo se llamaba `.pdf`; el mensaje no explica que *su contenido* no es un PDF válido. | **ACEPTABLE CON RESERVAS** |
| `alta-limite-quitar-y-resubir` | Tras subir: «Reemplazar archivo», nombre y peso, y «Quitar» disponible; el flujo siguió. | Sin hallazgos. | **APROBADA** |

## Pedido de farmacia sin delivery — maqueta de `mockup` (corrida final)

> Estas 6 capturas son de la **maqueta de `mockup`** (`yarn start:dev`), no de `test`: la corrida sobre `test` se sobrescribió. El código visual del pedido es el mismo (cherry-pick sin conflictos).

| Captura | 1.ª pasada (¿cumple?) | 2.ª pasada (adversarial) | Nota |
|---|---|---|---|
| `pedido-escritorio-1-confirma-tu-pedido` | «Cómo lo recibís: Retirás el pedido en la farmacia.», sin selector ni opciones de envío. | **MENOR (captura):** la captura de página completa duplica la cabecera fija a mitad de imagen; es un artefacto de la captura. | **ACEPTABLE CON RESERVAS** |
| `pedido-escritorio-2-checkout-entrega` | Stepper de **3** pasos (Entrega, Medio de pago, Resumen); «Retirás tu pedido en FARMACIA HIPERMAXI · Sucursal principal.» | **MENOR:** el paso queda con una sola línea de contenido; correcto pero pobre. | **ACEPTABLE CON RESERVAS** |
| `pedido-escritorio-3-checkout-resumen` | Resumen sin línea de envío; «Entrega: Recojo en FARMACIA HIPERMAXI». | **MAYOR (ajeno a este cambio):** los botones flotantes de la maqueta «Datos de prueba» y «Ver componentes» **se superponen a «Confirmar pedido»**. Son del modo demo/maqueta, previos al cambio; **no se verificó** que no aparezcan en el build de producción. | **ACEPTABLE CON RESERVAS** |
| `pedido-movil-1-confirma-tu-pedido` | Sin selector ni texto de envío; «Retirás el pedido en la farmacia.» | **MAYOR (ajeno):** el encabezado de `mockup` desborda en móvil: la página mide 604 px a 390 y la cabecera se sale por la derecha. | **ACEPTABLE CON RESERVAS** |
| `pedido-movil-2-checkout-entrega` | Paso «Entrega» informativo y botón «Siguiente». | Mismo **MAYOR** del encabezado; el stepper pasa «3 Resumen» a una segunda línea (aceptable). | **ACEPTABLE CON RESERVAS** |
| `pedido-movil-3-checkout-resumen` | Sin línea de envío; «Confirmar pedido» visible y habilitado. | Mismo **MAYOR** del encabezado y cabecera fija duplicada por la captura. | **ACEPTABLE CON RESERVAS** |

## Veredicto
Ninguna pantalla `RECHAZADA` y ningún hallazgo **BLOQUEANTE** atribuible a este cambio. Los dos **MAYOR** son de la maqueta de `mockup` y existían antes: el desborde del encabezado en móvil (medido sobre `origin/mockup` limpio, ver README) y los botones flotantes de la maqueta sobre el botón principal.
