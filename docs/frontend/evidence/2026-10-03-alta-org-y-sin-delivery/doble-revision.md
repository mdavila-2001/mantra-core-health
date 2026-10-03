# Doble revisión de las capturas

Capturas en [`capturas/`](./capturas). Las 13 se abrieron como imagen **dos veces**: una pasada de verificación contra el criterio y una segunda, adversarial, buscando motivos para rechazar. La segunda pasada **la hizo primero la misma sesión que implementó**, lo que la regla del proyecto prohíbe; por eso se agregó al final una **revisión independiente** (agente de sólo lectura, sin ver mis conclusiones). **La nota final de cada pantalla es la más baja de las dos.**

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

---

# Revisión independiente (agente de sólo lectura, sin acceso a mis notas)

Se le dio sólo el criterio de aceptación y las 13 imágenes. Devolvió un veredicto global **RECHAZADO**, que se registra sin suavizar. Notas por pantalla y nota final (la más baja):

| Captura | Mi nota | Nota independiente | **Final** |
|---|---|---|---|
| alta-valido-exito | APROBADA | APROBADA | **APROBADA** |
| alta-visual-exito-movil | APROBADA | APROBADA (justo en 44 px) | **APROBADA** |
| alta-visual-exito-oscuro | APROBADA | APROBADA | **APROBADA** |
| alta-error-sigla-repetida | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS (MAYOR: error no accionable) | **ACEPTABLE CON RESERVAS** |
| alta-error-correo-repetido | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS (MAYOR: campo no marcado) | **ACEPTABLE CON RESERVAS** |
| alta-error-pdf-falso | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS «bordeando RECHAZADA» (MAYOR: poco énfasis) | **ACEPTABLE CON RESERVAS** |
| alta-limite-quitar-y-resubir | APROBADA | ACEPTABLE CON RESERVAS (MAYOR: «Quitar» pequeño y layout que colapsa) | **ACEPTABLE CON RESERVAS** |
| pedido-escritorio-1 | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | **ACEPTABLE CON RESERVAS** |
| pedido-escritorio-2 | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | **ACEPTABLE CON RESERVAS** |
| pedido-escritorio-3 | ACEPTABLE CON RESERVAS | **RECHAZADA** (BLOQUEANTE: «Confirmar pedido» tapado por botones flotantes) | **RECHAZADA** |
| pedido-movil-1 | ACEPTABLE CON RESERVAS | **RECHAZADA** (MAYOR: encabezado desborda) | **RECHAZADA** |
| pedido-movil-2 | ACEPTABLE CON RESERVAS | **RECHAZADA** (MAYOR: mismo desborde) | **RECHAZADA** |
| pedido-movil-3 | ACEPTABLE CON RESERVAS | **RECHAZADA** (MAYOR: desborde y 0.00 Bs) | **RECHAZADA** |

## Clasificación de los hallazgos: qué es de este trabajo y qué no

La pregunta de este trabajo en el flujo B era «¿queda algún envío a domicilio?»: **no queda ninguno en las 6 capturas**, y el revisor lo confirma. Las 4 pantallas `RECHAZADA` lo son por causas que **no introdujo este cambio**:

| Hallazgo | Severidad | ¿De este trabajo? | Estado |
|---|---|---|---|
| «Confirmar pedido» tapado por «Datos de prueba» / «Ver componentes» (escritorio) | BLOQUEANTE | **No.** Es el aviso de la maqueta (`src/app/core/mock/mock-banner.ts`: «El aviso de la rama `mockup`»). En una captura de página completa los elementos fijos caen sobre el último contenido, lo que agrava el efecto. **No se verificó** que no se renderice en `production-api`. | Sin corregir; tarea de seguimiento |
| Encabezado desborda en móvil (604 px a 390) | MAYOR | **No.** Medido sobre `origin/mockup` limpio con la misma salida (README). | Sin corregir; tarea de seguimiento |
| 0.00 Bs en el resumen frente a 424.50 Bs en el paso previo | MAYOR | **No demostrado.** Son líneas «La farmacia no la tiene» de la maqueta; este cambio sólo quitó la línea de envío. **No se comparó contra la base.** | Sin corregir; a investigar |
| Textos que insinúan elegir cómo se recibe («Elegí cómo recibís tu pedido…», «la entrega y el pago se eligen…») | MENOR | **Sí: sobras de este cambio.** | **Corregido**: PR #886 (test), #887 (dev), #888 (mockup) |
| Error de sigla/correo repetidos sólo en un banner del paso 8, sin ir al campo | MAYOR | **No.** Comportamiento previo del formulario de alta. | Sin corregir; tarea de seguimiento |
| Mensaje de PDF inválido de ~11 px y sin énfasis; «Quitar» ~11 px; la tarjeta de subida colapsa | MAYOR | **No.** Componentes previos de subida de archivos. | Sin corregir; tarea de seguimiento |

## Veredicto honesto
- **Criterio funcional de este trabajo:** cumplido (botón de «Ir a iniciar sesión» visible y operativo en claro, móvil y oscuro; cero delivery en las 6 pantallas del pedido).
- **Puerta visual completa (`visual-quality-gate`):** **NO aprobada**. Con 4 pantallas `RECHAZADA` (por causas ajenas) no se puede declarar el cambio visualmente verificado: queda **`VERIFIED_FUNCTIONAL_ONLY`**.
