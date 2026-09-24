# El mapa vacía la dirección escrita; «Listo, guardamos…» sólo para lectores — 2026-09-23

Dos pedidos del cliente del 22/09:

- **D-06**: «si una toca una dirección en el mapa, el textfield de ubicación debe ponerse en
  blanco sí o sí». Tocar el plano (poner el pin o correrlo) vacía el campo de dirección y muestra
  «Volvé a escribir la dirección para este punto.»; volver a escribir se lleva el aviso.
- **D-07**: al confirmar el punto, «Listo, guardamos esta dirección.» ya no se ve. Sigue en la
  página sólo para lectores de pantalla, con su anuncio, porque para quien no ve el plano es la
  única señal de que la confirmación ocurrió.

Guion: `playwright/mapa-vacia-direccion.mjs` — **85 comprobaciones, todas en verde**, en una sola
pasada por las cinco pantallas. Red sin respuestas 4xx/5xx. Consola sin errores propios de estas
pantallas: los avisos de CSP por scripts en línea que aparecen en todas las rutas (el inicio de
sesión incluido, que este cambio no toca; ver `src/server/security-headers.ts`) se excluyen de
forma explícita y se cuentan: 10 en la corrida.

Datos: cuenta sintética de la maqueta `paciente@alovida.mock` para el editor; las altas se
recorren sin sesión con datos sintéticos (los documentos que piden laboratorio e imagenología se
adjuntan con la imagen de prueba del repo, `playwright/fixtures/upload-document.png`). Las
direcciones que escribe el guion («Calle Warnes #350», «Calle Sucre #88») son distintas de los
ejemplos de cada campo, para que en la captura un campo vacío (su ejemplo en gris) no se confunda
con lo escrito.

## Qué comprueba el guion en cada mapa

En siete mapas —editor del paciente (domicilio), alta del paciente (domicilio y trabajo), alta de
la aseguradora (casa matriz), alta del laboratorio (central y una sucursal) y alta de
imagenología (central y una sucursal)— las mismas diez:

1. la dirección está escrita; 2. sin tocar el mapa no hay aviso; 3. tocar el mapa vacía el campo;
4. el aviso aparece con su texto; 5. el aviso es una región viva cortés, que no roba el foco;
6. al confirmar, la confirmación ocupa una caja de 1×1 (no se ve); 7. pero está en la página con
su anuncio y su texto; 8. ningún nodo con «Listo, guardamos» se pinta en la vista; 9. volver a
escribir se lleva el aviso; 10. correr el pin vuelve a vaciar el campo.

Además, en el editor: la dirección de trabajo no recibe aviso por el mapa del domicilio, y a
375 y 768 px no hay desborde horizontal.

## Capturas y lo que se miró en cada una

| Captura | Viewport · tema | Qué se miró | Resultado |
|---|---|---|---|
| `despues-editor-domicilio-1-vaciada-1440-claro.png` | 1440 · claro | «Domicilio» vacío (muestra su ejemplo); el aviso justo debajo del campo, antes del mapa; la dirección de trabajo intacta y sin aviso | OK |
| `despues-editor-domicilio-2-confirmada-1440-claro.png` | 1440 · claro | Confirmado: no aparece «Listo, guardamos»; quedan el aviso de que la calle se escribe a mano y «Volver a ubicarme» | OK |
| `despues-editor-domicilio-3-1440-oscuro.png` | 1440 · oscuro | Aviso legible sobre la tarjeta oscura, pin visible, campo vacío | OK |
| `despues-editor-domicilio-4-375-claro.png` | 375 · claro | Campo vacío con el aviso en dos líneas, sin desborde; la barra fija de acciones queda al pie | OK |
| `despues-editor-domicilio-5-768-claro.png` | 768 · claro | Campo vacío con el aviso en una línea, sin desborde; las cinco pestañas entran | OK |
| `despues-alta-domicilio-1-vaciada-1440-claro.png` | 1440 · claro | «Línea de dirección 1» vacía; el aviso encabeza el bloque del mapa, pegado al campo | OK |
| `despues-alta-domicilio-2-confirmada-1440-claro.png` | 1440 · claro | Confirmado sin el texto visible | OK |
| `despues-alta-domicilio-3-1440-oscuro.png` | 1440 · oscuro | Aviso legible sobre la tarjeta oscura del alta; pin visible | OK |
| `despues-alta-trabajo-1-vaciada-1440-claro.png` | 1440 · claro | Lo mismo en el paso del trabajo, con su propio campo y su propio aviso | OK |
| `despues-alta-trabajo-2-confirmada-1440-claro.png` | 1440 · claro | Confirmado sin el texto visible | OK |
| `despues-aseguradora-1-vaciada-1440-claro.png` | 1440 · claro | «Dirección» vacía; el aviso junto al mapa de la casa matriz (ver observación 1) | OK |
| `despues-aseguradora-2-confirmada-1440-claro.png` | 1440 · claro | Confirmado sin el texto visible | OK |
| `despues-laboratorio-central-1-vaciada-1440-claro.png` | 1440 · claro | «Dirección legal de la central» vacía, con su error de obligatorio; el aviso entre el campo y el mapa | OK |
| `despues-laboratorio-central-2-confirmada-1440-claro.png` | 1440 · claro | Confirmado sin el texto visible | OK |
| `despues-laboratorio-sucursal-1-vaciada-1440-claro.png` | 1440 · claro | «Dirección de la sucursal 1» vacía; el aviso justo debajo, dentro de la tarjeta de la sucursal | OK |
| `despues-laboratorio-sucursal-2-confirmada-1440-claro.png` | 1440 · claro | Confirmado sin el texto visible; «Agregar sucursal» sigue debajo | OK |
| `despues-imagenologia-central-1-vaciada-1440-claro.png` | 1440 · claro | Como en el laboratorio: campo vacío con su error de obligatorio y el aviso antes del mapa | OK |
| `despues-imagenologia-central-2-confirmada-1440-claro.png` | 1440 · claro | Confirmado sin el texto visible | OK |
| `despues-imagenologia-sucursal-1-vaciada-1440-claro.png` | 1440 · claro | Dirección de la sucursal vacía y su aviso dentro de su tarjeta | OK |
| `despues-imagenologia-sucursal-2-confirmada-1440-claro.png` | 1440 · claro | Confirmado sin el texto visible | OK |

Las cuatro capturas de imagenología salen de una repetición de ese recorrido (22 comprobaciones
en verde): en la pasada general, la de la central quedó tomada antes de que la tarjeta se
pintara y salió en blanco, aunque sus comprobaciones habían pasado.

## Observaciones, no defectos de este cambio

1. **Direcciones obligatorias** (aseguradora, y la central de laboratorio e imagenología): cuando
   el mapa vacía el campo, el campo muestra también su error de obligatorio. En la aseguradora,
   además, el aviso queda junto al mapa y no junto al campo, porque entre los dos está «Nombre
   comercial». El error señala el campo y el aviso explica por qué quedó vacío; si se prefiere no
   marcarlo en rojo hasta que la persona vuelva a tocarlo, es un cambio chico en cada alta.
   **Corregido el 24/09**; ver «Direcciones obligatorias: corrección del 24/09», abajo.
2. El pin sin confirmar es un círculo claro que sobre el plano claro contrasta poco; en tema oscuro
   se ve bien. Es el estilo del mapa, que este cambio no toca.
3. En tema oscuro, la atribución del mapa («Leaflet | © OpenStreetMap contributors») y el enlace
   «Iniciá sesión» de las altas casi no se leen. Tampoco los toca este cambio.

## Direcciones obligatorias: corrección del 24/09

La observación 1, decidida como producto. En las tres altas con dirección obligatoria, **el vaciado
que hace el mapa ya no pone el campo en rojo**. El error de obligatorio sale cuando la persona entra
y sale del campo, o cuando pulsa «Siguiente» sin reescribirla. En la aseguradora, además, **el mapa
pasa a ir justo después de «Dirección»**; antes estaba después de «Nombre comercial». Así el aviso
queda pegado al campo, como en el laboratorio y la imagenología.

Guion: `node playwright/mapa-vacia-direccion.mjs <url> corregida <altas> <ancho> <tema>`; la primera
línea de cada salida dice la celda. Suma estas comprobaciones en cada dirección obligatoria:
- el vaciado no pone el campo en rojo, y no queda ningún otro control entre el campo y el aviso;
- confirmar el punto tampoco lo pone en rojo, ni escribir y volver a tocar el mapa;
- entrar y salir del campo vacío lo marca, con su mensaje, y el aviso sigue al lado;
- un vaciado nuevo lo deja otra vez sin rojo;
- «Siguiente» lo marca, es el único rojo de la página y no deja pasar.

| Celda | Altas | Resultado |
|---|---|---|
| 1440×900 claro | aseguradora, laboratorio, imagenología | 85/85 |
| 390×844 claro | las tres | 85/85 |
| 1440×900 oscuro | las tres | 85/85 |
| 1920×1080 claro | aseguradora | 23/23 |
| 1024×768 claro | aseguradora | 23/23 |
| 768×1024 claro | aseguradora | 23/23 |

Consola y red sin errores en las seis, con 0 avisos de CSP excluidos. Entre el pie de la ayuda del
campo y el aviso quedan el rótulo del mapa y unos 37–41 px. A 390 en la aseguradora son 58 px,
porque ese rótulo («Ubicación de la casa matriz en el mapa (opcional)») se parte en dos renglones.
Salidas en `docs/trabajo/2026-09-23-perfil-medico-configurar-tu-perfil/evidencia/h5/navegador-h5s2m6-*.txt`.

En una corrida anterior de 1440 oscuro, una captura salió en blanco: sólo el fondo, sin la tarjeta
(`laboratorio-central-1-vaciada`), aunque sus comprobaciones pasaron. Es el mismo síntoma de la
repetición de imagenología de más arriba. Por eso, en la corrida final, de la que salen las 72
capturas de esta sección (las 60 de los cuatro estados y las 12 `4b`), se midieron todas. Una
captura con la tarjeta tiene más del 3 % de píxeles con borde marcado respecto de su vecino, y la
que había salido vacía tenía 0,07 %. Ninguna de las 72 quedó por debajo
(`capturas-h5s2m6-sin-blancos.txt`).

Además de las comprobaciones, el guion informa qué ve la persona justo después de pulsar «Siguiente»
sin reescribir la dirección, antes de mover nada (líneas `ℹ` de cada salida). También toma esa vista
tal cual: son las capturas `4b-tras-siguiente`. A 1920 y 768 el campo en rojo queda a la vista con
su rótulo. A 1440 queda justo en el borde de arriba de la ventana: se ven el campo en rojo y su
mensaje, pero no el rótulo «Dirección». El guion cuenta como «a la vista» cualquier parte del campo
dentro de la ventana. **A 390 y 1024, no queda**: la página no se mueve, el foco queda en el botón
«Siguiente» y el campo queda fuera de la ventana (hallazgo abajo).

**Qué muestra cada captura.** A 1440, 1920 y 1024 la tarjeta se desplaza por dentro y cada captura
es la ventana. En las de las direcciones obligatorias, la tarjeta se lleva hasta el título del paso,
así que no se ven el nombre del alta ni el contador de pasos. A 390 y 768 la captura es la página
entera. La botonera flotante de la maqueta («Datos de prueba», «Ver componentes») tapa el borde de
abajo de la ventana en las capturas de escritorio, y no es parte de lo que se mira. Las capturas de
antes son las `despues-aseguradora-*`, `despues-laboratorio-central-*` y
`despues-imagenologia-central-*` de arriba. Son de antes de que el botón del mapa pasara a ícono y
nombre, así que difieren también en esos botones.

| Captura (`corregida-…`) | Qué se miró | Resultado |
|---|---|---|
| `aseguradora-1-vaciada-1440-claro` | «Datos de la aseguradora»: NIT lleno; «Dirección» vacía, sin borde ni mensaje rojo; debajo, su ayuda, el rótulo del mapa y el aviso; «Nombre comercial» ya no está entre el campo y el aviso, queda bajo el mapa | OK |
| `aseguradora-2-confirmada-1440-claro` | Confirmado: sin rojo; sin «Listo, guardamos»; el aviso sigue; «Volver a ubicarme» y «Quitar la ubicación» en un renglón | OK |
| `aseguradora-3-tocada-1440-claro` | Tras entrar y salir: borde rojo y «Escribí la dirección (hasta 300 caracteres).»; el aviso sigue debajo | OK |
| `aseguradora-4-al-avanzar-1440-claro` | Tras «Siguiente»: sigue en «Datos de la aseguradora»; «Dirección» en rojo; el NIT, lleno, sin rojo | OK |
| `laboratorio-central-{1,2}-1440-claro` | «Dónde está la central»: el campo vacío con su ejemplo en gris, sin rojo; el aviso debajo; confirmado sin rojo | OK |
| `laboratorio-central-{3,4}-1440-claro` | Borde rojo y «Escribí la dirección legal de la central.»; el aviso debajo; en la 4 sigue en el mismo paso | OK |
| `imagenologia-central-{1,2,3,4}-1440-claro` | Igual que el laboratorio, con «tu centro» en el texto del pie | OK |
| `laboratorio-sucursal-{1,2}-1440-claro`, `imagenologia-sucursal-{1,2}-1440-claro` | Sucursal (opcional): vacía sin rojo, con el aviso; confirmada sin el texto visible. Las dos «confirmada» son iguales píxel por píxel: la parte visible (plano, botones, «Agregar sucursal») es la misma en las dos altas; de qué alta sale cada una lo dice el paso del guion que la tomó | OK |
| `aseguradora-{1,2,3,4}-1920-claro` | Lo mismo que a 1440, a lo ancho, desde el título del paso; sin rojo en 1 y 2, rojo con su mensaje en 3 y 4 | OK |
| `aseguradora-{1,2}-1024-claro` | Desde el título del paso: «Dirección» vacía, sin rojo, y el aviso debajo; en la 2, confirmado | OK |
| `aseguradora-{3,4}-1024-claro` | Rojo con su mensaje; el aviso debajo | OK |
| `aseguradora-4b-tras-siguiente-{1920-claro,768-claro}` | Justo después de «Siguiente»: «Dirección» en rojo, con su rótulo y su mensaje, dentro de la ventana | OK |
| `aseguradora-4b-tras-siguiente-{1440-claro,1440-oscuro}` | Justo después de «Siguiente»: el campo en rojo y su mensaje, pegados al borde de arriba; el rótulo «Dirección» queda fuera | OK con reserva |
| `aseguradora-4b-tras-siguiente-1024-claro` | Justo después de «Siguiente»: se ven el aviso, el plano, «Nombre comercial» y la botonera; **«Dirección» y su rojo quedan arriba, fuera de la ventana** | Hallazgo |
| `aseguradora-4b-tras-siguiente-390-claro` | Igual: se ven el plano, «Nombre comercial» y la botonera; ni «Dirección» ni el aviso | Hallazgo |
| `laboratorio-central-4b-tras-siguiente-{1440-claro,1440-oscuro}`, `imagenologia-central-4b-…` (las mismas celdas) | El campo en rojo a la vista, con su rótulo; sobre la flecha, el globo «Siguiente» del botón de sólo ícono. El foco y el puntero quedaron los dos sobre el botón, y la imagen no dice cuál lo abrió | OK |
| `laboratorio-central-4b-tras-siguiente-390-claro`, `imagenologia-central-4b-tras-siguiente-390-claro` | Se ven los botones del plano, la flecha con su globo «Siguiente» y el pie; el campo y el aviso, no | Hallazgo |
| `aseguradora-{1,2,3,4}-768-claro` | Página entera: sin rojo en 1 y 2, rojo con mensaje en 3 y 4; el aviso siempre debajo del campo | OK |
| `aseguradora-{1,2,3,4}-390-claro` | Página entera, sin desborde: el aviso en dos renglones; el rótulo del mapa también en dos; sin rojo en 1 y 2, rojo con mensaje en 3 y 4 | OK |
| `laboratorio-central-{1,2,3,4}-390-claro` | El ejemplo del campo es más largo que el campo y se corta («Zona C…»); sin rojo en 1 y 2, rojo en 3 y 4; el aviso debajo | OK |
| `imagenologia-central-{1,2,3,4}-390-claro` | Igual; el título del alta en dos renglones | OK |
| `laboratorio-sucursal-{1,2}-390-claro`, `imagenologia-sucursal-{1,2}-390-claro` | Sucursal vacía sin rojo y confirmada; los botones del mapa, apilados; la atribución del plano, en dos renglones | OK |
| `aseguradora-{1,2}-1440-oscuro` | Sin rojo; el aviso legible sobre la tarjeta oscura | OK |
| `aseguradora-{3,4}-1440-oscuro` | Borde rojo visible; **el mensaje de error se lee tenue** (hallazgo abajo) | OK con reserva |
| `laboratorio-central-{1,2}-1440-oscuro`, `imagenologia-central-{1,2}-1440-oscuro` | Sin rojo; aviso legible | OK |
| `laboratorio-central-{3,4}-1440-oscuro`, `imagenologia-central-{3,4}-1440-oscuro` | Borde rojo; mensaje tenue | OK con reserva |
| `laboratorio-sucursal-{1,2}-1440-oscuro`, `imagenologia-sucursal-{1,2}-1440-oscuro` | Sucursal vacía sin rojo y confirmada | OK |

**Lo que la segunda revisión dejó como `MENOR` del cambio, y queda así:**
- Entre el campo y el aviso quedan la ayuda del campo y el rótulo del mapa: el aviso encabeza el
  bloque del mapa. Es la misma disposición de las centrales de laboratorio e imagenología.
- En la aseguradora, «Nombre comercial» pasa al final de la página, debajo del mapa y lejos del NIT.
  A 1440 queda fuera de la primera vista. A confirmar con producto.
- En los países con varias zonas horarias, la zona horaria obligatoria también queda después del
  mapa, y la sección se parte en dos páginas: la segunda queda con «Nombre comercial» solo. Hay un
  spec que cubre el orden (comprueba que la zona está en la página y que el mapa sigue pegado a
  «Dirección»); ninguna captura lo muestra.

**Hallazgos, fuera de este cambio:**
- **Al rechazar «Siguiente», el formulario por páginas no lleva la vista ni el foco al campo en
  rojo.** Se vio a 390 y a 1024 (capturas `4b`): la página no se mueve, el foco queda en el botón y
  el campo en rojo queda fuera de la ventana, así que para la persona parece que el botón no hizo
  nada. El motor marca la página y no la mueve: `src/app/shared/components/organisms/paginated-form/paginated-form.ts:548`
  y `:640-652`. Vale para cualquier campo obligatorio de cualquier alta, no sólo para la dirección,
  pero con este cambio es el camino por el que la persona se entera del rojo de la dirección, y a
  esos anchos el aviso del mapa también queda fuera.
- En tema oscuro, el mensaje de error de cualquier campo tiene contraste 2,99:1: texto
  `rgb(181, 83, 60)` sobre la tarjeta `rgb(10, 43, 61)`. AA pide 4,5:1 para texto de ese tamaño, y en
  claro da 4,92:1. El color sale de `src/app/shared/components/molecules/form-field/form-field.css:149`
  (`var(--c-error-500)`, un tono fijo de la rampa), no del token de estado que cambia con el tema
  (`--st-error-fg`, `src/styles.css:229` y `:288`). Se midió con el color calculado en el navegador,
  sobre el alta de la aseguradora. Con este cambio, ese mensaje es lo que aparece al tocar el campo o
  al avanzar.
- El aviso «Volvé a escribir la dirección para este punto.» se anuncia al aparecer, pero no forma
  parte de la descripción del campo. Quien vuelve al campo con un lector de pantalla oye el error y
  no el porqué. Esto es según el código, no se observó con un lector.
- Las altas de laboratorio e imagenología dicen «Tu información clínica la ve el profesional que te
  atiende, nadie más.», un texto pensado para pacientes
  (`src/app/shared/components/organisms/registro-ayuda/registro-ayuda.html:31`).

## No cubierto

- El laboratorio y la imagenología se miraron a 1440 (claro y oscuro) y a 390. No se miraron a 1920,
  1024 ni 768: su página no cambió de orden, y lo que cambia (el rojo) es igual en las tres altas.
- La aseguradora en oscuro sólo se miró a 1440.
- El orden de la aseguradora en un país con varias zonas horarias se cubrió con un spec, sin captura.
- En 375 y 768, del editor del paciente sólo se miró lo que ya figura más arriba.
- **Editor del médico y alta del médico**: el cambio todavía no está hecho en esas dos pantallas.
