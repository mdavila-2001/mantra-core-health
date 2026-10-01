# Doble revisión de capturas (regla 35) — perfil del médico: configurar tu perfil

Cada captura de navegador de este carril se revisa dos veces:

- **Primera pasada — verificación:** quien implementó abre cada captura y la contrasta con el
  criterio de aceptación, una línea por captura. Vive en el `README.md` de cada carpeta de
  evidencia, en la tabla «Capturas y lo que se miró en cada una».
- **Segunda pasada — adversarial:** la hace un revisor que no implementó el cambio, después de
  cerrada la primera, con las diez preguntas de la regla y la postura de quien tiene que rechazar
  la entrega. Cada hallazgo lleva severidad (`BLOQUEANTE` / `MAYOR` / `MENOR`) y cada pantalla una
  nota (`RECHAZADA` / `ACEPTABLE CON RESERVAS` / `APROBADA`). Ante la duda, la más baja.

| Hito | Evidencia (primera pasada) | Segunda pasada |
|---|---|---|
| H5 · el mapa vacía la dirección | `docs/frontend/evidence/mapa-vacia-direccion-2026-09-23/README.md` | ronda 1 |
| H7 · «Mis puntos» como quinta pestaña | `docs/frontend/evidence/mis-puntos-quinta-pestana-2026-09-23/README.md` | ronda 1 (capturas del #606), rondas 2 a 5 (recapturas) |
| H6 · ícono y nombre (D-05) | `docs/frontend/evidence/d05-iconos-2026-09-23/README.md` | rondas 2 a 5 |
| H5.S2.M6 · direcciones obligatorias | la misma carpeta de H5, sección «Direcciones obligatorias: corrección del 24/09» | rondas 6 a 8 |

## Las rondas

1. **Ronda 1 — H5 y H7, sobre las capturas del #606.** H5 y H7 llegaron a `mockup` con el #606
   antes de esta revisión. La regla 35 ya estaba publicada cuando se abrió ese PR y no se aplicó;
   su segunda pasada se hizo después de la fusión, sobre las mismas capturas. Lo que encontró no se
   borra ni se suaviza: sus pantallas `RECHAZADA` bajaron a `A MEDIAS` las microtareas que las
   entregaban (H7.S1.M2 y H7.S1.M5) y abrieron dos nuevas (H5.S2.M6 y H7.S1.M7), en el `PLAN.md`.
2. **Ronda 2 — H6 y la recaptura de H7.** Rechazó dos pantallas por defectos del cambio (H6-01, las
   flechas del calendario en escalera a 360; H6-02, el aro con un menos del mapa tomado como
   excepción), una por evidencia insuficiente (H6-E1, el calendario visto en un solo consumidor) y
   dos de H7 por código de otros (H7R-01 y H7R-02). Las tres de H6 abrieron H6.S1.M7, M8 y M9.
3. **Ronda 3**, sobre las capturas corregidas: cerró H6-01; H6-02 siguió en la copia del mapa que
   tiene el alta del paciente, y faltaba el estado de tres botones del mapa (H6-E6).
4. **Ronda 4**: cerró H6-02 y H6-11; encontró que, sin punto, el botón decía «Quitar la ubicación» y
   cerraba el mapa (H6-12).
5. **Ronda 5**: cerró H6-12 y H6-E9. **Todas las pantallas de H6 quedan `ACEPTABLE CON RESERVAS`,
   sin `MAYOR` del cambio.** H7 conserva dos pantallas `RECHAZADA` por código de otros, y por eso
   H7.S1.M6 queda `A MEDIAS`.

6. **Ronda 6 — H5.S2.M6**, sobre la corrección de H5-01 y H5-02 (decisión de producto del 24/09):
   cerró los dos. Las tres altas y las sucursales quedan `ACEPTABLE CON RESERVAS`. Pidió corregir la
   evidencia: faltaban 1920, 1024 y 768, había tres afirmaciones del README que las imágenes no
   sostenían, y en una captura no se veía el título del paso.
7. **Ronda 7**, sobre las capturas rehechas en seis celdas: mismas notas. Encontró que el spec de
   varias zonas horarias no comprobaba que la zona estuviera en la página, que dos filas del README no
   coincidían con sus imágenes y que ninguna captura mostraba lo que se ve justo después de
   «Siguiente». La salida `navegador-h5s2m6-1440-oscuro-laboratorio-repetido.txt` que cita esta
   ronda no viaja: después se rehicieron todas las capturas en una sola corrida, que no necesitó
   repetición.
8. **Ronda 8**, sobre las capturas `4b`: mismas notas, sin `MAYOR` del cambio. Pasó a observado un
   hallazgo del formulario por páginas: a 390 y 1024, tras «Siguiente», el campo en rojo queda fuera
   de la ventana (`MAYOR` heredado, a decidir por producto). Dejó tres `MENOR` de redacción del
   README, ya corregidos.

Cada ronda lleva el estado de los hallazgos de la anterior (`CERRADO`, `SIGUE`, `CAMBIA`).

**Contexto de quien implementó, que no cambia ninguna nota:**

- H7-01 (ronda 1: «Mis puntos» del menú lateral llevaba a la pantalla aparte) ya no ocurre en
  `mockup`: el renglón salió del menú y la dirección vieja redirige a la ficha, las dos cosas del
  23/09 y de otro carril (`src/app/core/navigation/navigation.map.ts:1363`,
  `src/app/app.routes.ts:1072`). Lo que queda es H7R-01: esa redirección abre «Datos personales», no
  la billetera.
- H7R-02 (la pestaña elegida por la URL queda fuera de la vista en el teléfono) nace en la tira de
  pestañas compartida, que sólo se corre cuando la persona elige
  (`src/app/shared/components/molecules/tabs/tabs.ts:88-95`). No es de este carril.
- H5-01 y H5-02 (el campo obligatorio en rojo apenas el mapa lo vacía; el aviso lejos del campo en
  la aseguradora) están en la observación 1 del #606. Se dejaron como observación a la espera de
  una decisión de producto; la segunda pasada los califica `MAYOR` del cambio, y así quedan
  (H5.S2.M6).

---

<!-- Ronda 1 -->

## Segunda pasada visual: H5 (el mapa vacía la dirección) y H7 («Mis puntos» como quinta pestaña)

- Fecha: 2026-09-24
- Material revisado:
  - `docs/frontend/evidence/mapa-vacia-direccion-2026-09-23/`: 20 PNG y `README.md`.
  - `docs/frontend/evidence/mis-puntos-quinta-pestana-2026-09-23/`: 9 PNG y `README.md`.
- Se abrieron como imagen las 29 capturas y se leyeron completos los dos README.
- Postura: revisión adversarial. Se parte de que la entrega tiene defectos.
- Límite del método: solo se miraron imágenes. Lo que una imagen no puede mostrar queda como «no observable en imagen» y no se da por verificado en esta pasada. Eso incluye la región viva, el texto reservado a lectores de pantalla, que un clic no abra nada y la URL usada.
- Regla de nota:
  - `RECHAZADA`: hay algún BLOQUEANTE o MAYOR del cambio.
  - `ACEPTABLE CON RESERVAS`: solo quedan MENOR del cambio.
  - `APROBADA`: no quedan hallazgos abiertos.
  - Los hallazgos heredados se listan aparte y no cuentan para la nota. Ante la duda, se pone la nota más baja.

### Resumen de notas

| Hito | Pantalla | Nota | Motivo |
|---|---|---|---|
| H5 | Editor del paciente: Contacto › Domicilio | ACEPTABLE CON RESERVAS | El cambio solo deja hallazgos MENOR (H5-03 a H5-06). Los MAYOR abiertos son heredados (H5-07 y H5-08) |
| H5 | Alta del paciente: domicilio y trabajo | ACEPTABLE CON RESERVAS | H5-04, H5-05, H5-06 y H5-12, todos MENOR |
| H5 | Alta de la aseguradora: casa matriz | **RECHAZADA** | H5-01 y H5-02, MAYOR del cambio |
| H5 | Alta del laboratorio: paso de la central | **RECHAZADA** | H5-01, MAYOR del cambio |
| H5 | Alta del laboratorio: paso de sucursales | ACEPTABLE CON RESERVAS | H5-04 y H5-05, MENOR |
| H5 | Alta de imagenología: paso de la central | **RECHAZADA** | H5-01, MAYOR del cambio |
| H5 | Alta de imagenología: paso de sucursales | ACEPTABLE CON RESERVAS | H5-04 y H5-05, MENOR |
| H7 | Mi perfil › pestaña «Mis puntos» | **RECHAZADA** | H7-01, MAYOR del cambio: el menú lateral sigue llevando a la pantalla aparte |
| H7 | Mi perfil en edición | **RECHAZADA** | H7-04, MAYOR de origen no determinado. La única captura de este estado está a medio pintar y no sirve como prueba |
| H7 | `/my-account/loyalty` (ruta propia) | ACEPTABLE CON RESERVAS | Solo quedan MENOR heredados, y hay una única celda (1440 · claro) |

---

### H5: el mapa vacía la dirección escrita (D-06) y «Listo, guardamos…» deja de verse (D-07)

#### Capturas

Los viewports de 1440 no están a 900 px de alto. Las de ventana muestran unos 1000 px, y las marcadas como «página completa» muestran la página entera.

| Archivo | Viewport | Tema | Estado |
|---|---|---|---|
| `despues-editor-domicilio-1-vaciada-1440-claro.png` | 1440 (página completa) | claro | Pin puesto, campo vaciado, aviso visible |
| `despues-editor-domicilio-2-confirmada-1440-claro.png` | 1440 (página completa) | claro | Punto confirmado |
| `despues-editor-domicilio-3-1440-oscuro.png` | 1440 (página completa) | oscuro | Pin puesto, campo vaciado, aviso visible |
| `despues-editor-domicilio-4-375-claro.png` | 375 (no es el 390 del repo) | claro | Campo vaciado y aviso |
| `despues-editor-domicilio-5-768-claro.png` | 768×1024 | claro | Campo vaciado y aviso |
| `despues-alta-domicilio-1-vaciada-1440-claro.png` | 1440 | claro | Campo vaciado y aviso |
| `despues-alta-domicilio-2-confirmada-1440-claro.png` | 1440 | claro | Confirmado. El campo queda fuera del encuadre |
| `despues-alta-domicilio-3-1440-oscuro.png` | 1440 | oscuro | Campo vaciado y aviso, sin confirmar |
| `despues-alta-trabajo-1-vaciada-1440-claro.png` | 1440 | claro | Campo vaciado y aviso |
| `despues-alta-trabajo-2-confirmada-1440-claro.png` | 1440 | claro | Confirmado. El campo queda fuera del encuadre |
| `despues-aseguradora-1-vaciada-1440-claro.png` | 1440 | claro | Campo obligatorio vaciado, con error rojo y aviso |
| `despues-aseguradora-2-confirmada-1440-claro.png` | 1440 | claro | Confirmado. Se ve el campo con el error |
| `despues-laboratorio-central-1-vaciada-1440-claro.png` | 1440 | claro | Campo obligatorio vaciado, con error rojo y aviso |
| `despues-laboratorio-central-2-confirmada-1440-claro.png` | 1440 | claro | Confirmado, con el error todavía visible |
| `despues-laboratorio-sucursal-1-vaciada-1440-claro.png` | 1440 | claro | Campo opcional vaciado y aviso |
| `despues-laboratorio-sucursal-2-confirmada-1440-claro.png` | 1440 | claro | Confirmado. El campo queda fuera del encuadre |
| `despues-imagenologia-central-1-vaciada-1440-claro.png` | 1440 | claro | Igual que la central del laboratorio |
| `despues-imagenologia-central-2-confirmada-1440-claro.png` | 1440 | claro | Igual que la central del laboratorio |
| `despues-imagenologia-sucursal-1-vaciada-1440-claro.png` | 1440 | claro | Igual que la sucursal del laboratorio |
| `despues-imagenologia-sucursal-2-confirmada-1440-claro.png` | 1440 | claro | Igual que la sucursal del laboratorio |

#### Las diez preguntas, por captura o por grupo

##### G1 · `despues-editor-domicilio-1-vaciada-1440-claro.png`

1. **Lo primero que se ve mal:** el pin casi no se distingue. Es un círculo claro sobre un plano claro (H5-07, heredado). Además, el campo «Domicilio», que está vacío, muestra en gris una dirección completa («Av. Prolongación Beni #5100, esq. 6to anillo») que a primera vista parece escrita (H5-06).
2. **Texto cortado o solapado:** en el formulario no hay texto cortado. Los botones flotantes de la maqueta («Datos de prueba», «Ver componentes») tapan el borde izquierdo del mapa (H5-11). El fondo de la barra lateral se corta a unos 1000 px, un efecto de la captura de página completa (H5-E4).
3. **¿Terminado o prototipo?** El aviso se ve terminado: callout con ícono, alineado a la columna del campo. El ícono ⊖ suelto junto a «Volver a ubicarme», sin rótulo, sí se ve de prototipo (H5-09, heredado).
4. **Coherencia con el producto:** el aviso usa el callout informativo del sistema, con el mismo ancho, radio y margen que el campo. Es coherente.
5. **Tema oscuro:** no aplica, porque la captura es clara. El oscuro está en G3.
6. **¿El estado orienta?** El aviso dice qué hacer. Debajo del mapa hay otras tres líneas de ayuda que compiten con él (H5-04).
7. **Jerarquía:** la vista va al aviso y al primario «Confirmar dirección actual». Es correcto.
8. **Datos:** «Ana Lucía Pérez Quiroga», «6200 0000» y «ana-perez@correo.mock» son datos de la cuenta de maqueta, con dominio `.mock`. No se ve ningún dato real ni sensible.
9. **¿Muestra el requisito?** Sí. «Domicilio» está vacío, el aviso aparece con el texto exacto y está entre el campo y el mapa. La dirección de trabajo sigue intacta y sin aviso.
10. **Motivo de rechazo:** el pin invisible y el ejemplo que parece un dato. Ninguno llega a MAYOR del cambio.

##### G2 · `despues-editor-domicilio-2-confirmada-1440-claro.png`

1. **Lo primero que se ve mal:** después de confirmar no queda ninguna señal visible positiva. Solo desaparece el botón (H5-05). «Volver a ubicarme» queda sangrado respecto de la columna, con el ⊖ suelto a la derecha (H5-09).
2. **Texto cortado o solapado:** «Volver a ubicarme» está unos 14 px a la derecha del borde de la columna, que en el resto está en x≈305. No hay cortes.
3. **¿Terminado o prototipo?** Terminado, salvo la fila huérfana «Volver a ubicarme ⊖».
4. **Coherencia con el producto:** es coherente con G1.
5. **Tema oscuro:** no aplica, la captura es clara.
6. **¿El estado orienta?** «El punto del mapa se guarda tal cual… escribila vos arriba» orienta. El aviso sigue arriba, que es lo correcto por D-06 hasta que se vuelva a escribir.
7. **Jerarquía:** la zona del mapa se queda sin acción principal y la vista cae en «Guardar cambios». Es aceptable.
8. **Datos:** igual que G1.
9. **¿Muestra el requisito?** Sí para D-07: «Listo, guardamos esta dirección.» no se ve. Que siga en la página para lectores de pantalla no se puede observar en una imagen: lo sostienen las comprobaciones 6 a 8 del README.
10. **Motivo de rechazo:** no hay MAYOR del cambio. Quedan las reservas H5-03 y H5-05.

##### G3 · `despues-editor-domicilio-3-1440-oscuro.png`

1. **Lo primero que se ve mal:** el plano sigue en colores claros dentro de la tarjeta oscura y encandila. La atribución «Leaflet | © OpenStreetMap contributors» no se lee (H5-08, heredado; observación 3 del README).
2. **Texto cortado o solapado:** no hay cortes. Los botones flotantes de la maqueta tapan el borde del mapa.
3. **¿Terminado o prototipo?** El aviso y los controles se ven terminados. El plano claro rompe el tema.
4. **Coherencia con el producto:** el aviso toma bien los tokens oscuros: fondo verde azulado, borde y texto claro. Es coherente con los demás callouts.
5. **Tema oscuro:** encandila el plano y la atribución pierde contraste. El pin, que es oscuro, sí se ve, y se ve mejor que en claro.
6. **¿El estado orienta?** Igual que G1.
7. **Jerarquía:** «Confirmar dirección actual», en tono claro sobre fondo oscuro, destaca. Es correcto.
8. **Datos:** igual que G1.
9. **¿Muestra el requisito?** Sí: el campo está vacío, el aviso se lee y el pin se ve.
10. **Motivo de rechazo:** solo hay heredados (H5-08).

##### G4 · `despues-editor-domicilio-4-375-claro.png`

1. **Lo primero que se ve mal:** «Datos de prueba» tapa el conmutador de tema del encabezado (H5-11, maqueta). El pin apenas se ve.
2. **Texto cortado o solapado:**
   - El ejemplo del campo se corta al borde («…6to ar»), que es el recorte normal de un input.
   - «Santa Cruz de la Sierra · Santa…» termina en puntos suspensivos.
   - «Contacto» queda pegado bajo el encabezado fijo.
   - No hay desborde horizontal.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente con el editor en escritorio.
5. **Tema oscuro:** no aplica, la captura es clara, y no hay captura oscura a este ancho.
6. **¿El estado orienta?** El aviso ocupa dos líneas y se lee.
7. **Jerarquía:** la barra fija «Cancelar / Guardar cambios» tapa el pie del mapa. Ni el botón de confirmar ni la fila de «Volver a ubicarme» entran en el encuadre.
8. **Datos:** igual que G1.
9. **¿Muestra el requisito?** En parte. Se ven el vaciado y el aviso, pero a este ancho no se ve la confirmación (D-07). Además, 375 no es el viewport de 390 del repo (H5-E1).
10. **Motivo de rechazo:** la evidencia en móvil está incompleta. No se ve ningún MAYOR del cambio.

##### G5 · `despues-editor-domicilio-5-768-claro.png`

1. **Lo primero que se ve mal:** «Datos de prueba» tapa la mitad del botón circular de volver (maqueta).
2. **Texto cortado o solapado:** el avatar de la tarjeta queda cortado bajo el encabezado fijo, por el desplazamiento de la página. Las cinco pestañas entran enteras.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente. «Mis puntos» aparece apagada en edición, lo que coincide con H7.
5. **Tema oscuro:** no aplica.
6. **¿El estado orienta?** El aviso ocupa una línea y se lee.
7. **Jerarquía:** correcta.
8. **Datos:** igual que G1.
9. **¿Muestra el requisito?** Sí para el vaciado. No muestra la confirmación.
10. **Motivo de rechazo:** nada propio del cambio.

##### G6 · `despues-alta-domicilio-1-vaciada-1440-claro.png` y `despues-alta-trabajo-1-vaciada-1440-claro.png`

Las dos capturas tienen el mismo contenido. Cambian el título del paso, el ejemplo del campo y el paso activo del indicador.

1. **Lo primero que se ve mal:** el pin casi no se ve sobre el plano amarillo claro (H5-07). El texto «Todavía no elegiste departamento.» convive con un mapa que ya ubica un punto (heredado).
2. **Texto cortado o solapado:** el indicador de pasos está cortado por el borde superior, un problema de encuadre (H5-E2). Los botones flotantes tapan la esquina del mapa.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** el aviso es idéntico al del editor.
5. **Tema oscuro:** no aplica. El oscuro está en G8, y solo para domicilio.
6. **¿El estado orienta?** El aviso orienta, pero queda bajo el rótulo «Ubicación GPS (opcional)», separado del campo por su ayuda y por ese rótulo. Se lee como parte del mapa, no del campo (H5-12).
7. **Jerarquía:** correcta.
8. **Datos:** son datos sintéticos y el recorrido se hace sin sesión.
9. **¿Muestra el requisito?** Sí: «Línea de dirección 1» está vacía con su ejemplo y se ve el aviso.
10. **Motivo de rechazo:** nada MAYOR del cambio.

##### G7 · `despues-alta-domicilio-2-confirmada-1440-claro.png` y `despues-alta-trabajo-2-confirmada-1440-claro.png`

Las dos capturas tienen el mismo contenido. Cambian la ayuda final y las tarjetas informativas.

1. **Lo primero que se ve mal:** el campo de dirección no entra en el encuadre, así que la captura no prueba que siga vacío después de confirmar (H5-E2). El rótulo «Ubicación GPS (opcional)» sale cortado por el borde superior.
2. **Texto cortado o solapado:** además del rótulo cortado, los botones flotantes tapan texto de la última tarjeta informativa (H5-11).
3. **¿Terminado o prototipo?** La fila «Volver a ubicarme ⊖» queda sangrada (H5-09).
4. **Coherencia con el producto:** es coherente con el editor.
5. **Tema oscuro:** no aplica, y no hay captura del estado confirmado en oscuro.
6. **¿El estado orienta?** Orienta de más. El aviso de arriba, «escribila vos arriba» debajo del mapa y la tarjeta «La calle la escribís vos» dicen lo mismo tres veces (H5-04).
7. **Jerarquía:** las flechas de navegación son claras.
8. **Datos:** no se ven datos personales.
9. **¿Muestra el requisito?** Sí para D-07: no se ve «Listo».
10. **Motivo de rechazo:** el encuadre de la evidencia. Nada MAYOR del cambio.

##### G8 · `despues-alta-domicilio-3-1440-oscuro.png`

1. **Lo primero que se ve mal:** el plano claro encandila. La atribución y el enlace «Iniciá sesión» casi no se leen (H5-08; observación 3 del README).
2. **Texto cortado o solapado:** el campo sale cortado por el borde superior, por el encuadre.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** el aviso usa bien los tokens oscuros.
5. **Tema oscuro:** encandila el plano, y la atribución y el enlace pierden contraste.
6. **¿El estado orienta?** Sí.
7. **Jerarquía:** «Confirmar dirección actual» destaca. Es correcto.
8. **Datos:** no se ven datos.
9. **¿Muestra el requisito?** Sí para el vaciado en oscuro.
10. **Motivo de rechazo:** solo hay heredados.

##### G9 · `despues-aseguradora-1-vaciada-1440-claro.png` y `despues-aseguradora-2-confirmada-1440-claro.png`

1. **Lo primero que se ve mal:** «Dirección *» aparece en rojo, con «Escribí la dirección (hasta 300 caracteres).», apenas se toca el mapa. El aviso informativo queda lejos, después de «Nombre comercial (opcional)» (H5-01 y H5-02).
2. **Texto cortado o solapado:** en `-2` el rótulo «NIT» sale cortado por el borde superior. En `-1` los botones flotantes tapan la esquina inferior izquierda del mapa.
3. **¿Terminado o prototipo?** Cada pieza se ve terminada, pero la combinación de un error rojo y un aviso verde azulado, en dos lugares distintos, se ve sin resolver.
4. **Coherencia con el producto:** es incoherente con los otros seis mapas, donde el aviso va pegado a su campo.
5. **Tema oscuro:** no aplica. No hay captura oscura (ver «No cubierto»).
6. **¿El estado orienta?** El error culpa a la persona de algo que hizo el sistema. El aviso explica por qué, pero está a unos 200 px del campo.
7. **Jerarquía:** la vista va al rojo, no a la acción. Hay dos focos que compiten.
8. **Datos:** el NIT está vacío y no se ven datos.
9. **¿Muestra el requisito?** Cumple lo literal: el campo está vacío y el aviso tiene el texto pedido. Agrega un estado de error que el requisito no pide.
10. **Motivo de rechazo:** H5-01 y H5-02.

##### G10 · Paso de la central del laboratorio y de imagenología

Capturas: `despues-laboratorio-central-1-vaciada-1440-claro.png`, `-2-confirmada`, `despues-imagenologia-central-1-vaciada-1440-claro.png` y `-2-confirmada`. Las cuatro son idénticas salvo el título y el número de paso.

1. **Lo primero que se ve mal:** el borde y el mensaje rojo «Escribí la dirección legal de la central.» aparecen al lado del aviso informativo. El rojo sigue en el estado confirmado (H5-01).
2. **Texto cortado o solapado:** los botones flotantes tapan «Sin el punto, tu laboratorio/centro no aparece…» y, en `-2`, el botón circular de volver (H5-11).
3. **¿Terminado o prototipo?** Cada pieza está terminada. El estado mezclado se ve sin resolver.
4. **Coherencia con el producto:** laboratorio e imagenología son coherentes entre sí. Frente a la sucursal (G11), el mismo gesto produce error en un paso y no en el otro.
5. **Tema oscuro:** no aplica, y no hay captura oscura.
6. **¿El estado orienta?** Hay dos voces para un mismo hecho: una acusa y la otra explica.
7. **Jerarquía:** en `-1` el rojo le gana a «Confirmar dirección actual».
8. **Datos:** el ejemplo es una calle pública con número de ejemplo. No se ven datos personales.
9. **¿Muestra el requisito?** Sí en lo literal, pero con un estado de error que el requisito no pide.
10. **Motivo de rechazo:** H5-01.

##### G11 · Paso de sucursales del laboratorio y de imagenología

Capturas: `despues-laboratorio-sucursal-1-vaciada-1440-claro.png`, `-2-confirmada`, `despues-imagenologia-sucursal-1-vaciada-1440-claro.png` y `-2-confirmada`. Las cuatro son idénticas salvo el número de paso.

1. **Lo primero que se ve mal:** el pin casi no se ve. Dentro de la tarjeta «Sucursal 1» hay dos ⊖ idénticos con funciones distintas: uno quita la sucursal (arriba a la derecha) y el otro va junto a «Volver a ubicarme» (H5-09).
2. **Texto cortado o solapado:** en `-2` los botones flotantes tapan la última línea de «Tus datos están a salvo».
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** el aviso va dentro de la tarjeta de la sucursal, pegado a su campo. Es la ubicación correcta.
5. **Tema oscuro:** no aplica, y no hay captura oscura.
6. **¿El estado orienta?** Sí. Como el campo es opcional, no aparece el error, y eso demuestra que el rojo de H5-01 no es necesario para orientar.
7. **Jerarquía:** correcta.
8. **Datos:** «Sucursal Equipetrol» y «Av. San Martín 456» son ejemplos. En `-1` también el nombre de la sucursal está vacío. La imagen no deja distinguir si el mapa vació solo la dirección; la comprobación 3 del README cubre la dirección, no el nombre.
9. **¿Muestra el requisito?** Sí en `-1`. En `-2` el campo queda fuera del encuadre (H5-E2).
10. **Motivo de rechazo:** nada MAYOR del cambio.

#### Hallazgos de H5

##### Defectos del cambio

| ID | Severidad | Hallazgo | Capturas |
|---|---|---|---|
| H5-01 | **MAYOR** | En las altas con dirección obligatoria, el vaciado que hace el propio sistema pone el campo en error rojo al instante, y el error sigue después de confirmar. Aparecen dos mensajes con dos tonos para un mismo hecho, y el error culpa a la persona de un vaciado que hizo el sistema. **Discrepo de la observación 1 del README, que lo da como «no defecto de este cambio»:** antes de este cambio, tocar el mapa no vaciaba el campo, así que ese error no existía. El README mismo reconoce que evitarlo «es un cambio chico en cada alta». En las sucursales, con el campo opcional, el mismo gesto no produce error. | `despues-aseguradora-1/2`, `despues-laboratorio-central-1/2`, `despues-imagenologia-central-1/2` |
| H5-02 | **MAYOR** | En la aseguradora, el aviso queda junto al mapa y no junto a «Dirección»: entre los dos están «Nombre comercial (opcional)» y su ayuda. El error señala el campo y la explicación está a unos 200 px. Es incoherente con los otros seis mapas, donde el aviso va pegado a su campo. La ubicación del aviso es decisión de este cambio, porque el aviso es nuevo. | `despues-aseguradora-1/2` |
| H5-03 | MENOR | En el editor, la ayuda del propio campo dice «Vaciarlo lo quita de tu ficha». Con el campo vaciado por el mapa, «Guardar cambios» habilitado y el aviso en tono informativo, confirmar y guardar sin reescribir borraría la dirección escrita. El requisito lo pide así («sí o sí»), pero el tono del aviso no anticipa esa consecuencia. Falta confirmar con quien lleva D-06 si corresponde un tono de advertencia. | `despues-editor-domicilio-1/2/3` |
| H5-04 | MENOR | Alrededor del mapa, el mismo mensaje aparece varias veces: el aviso nuevo, «escribila vos arriba» debajo del mapa y, en las altas, la tarjeta «La calle la escribís vos». Llegan a haber cuatro o cinco líneas de ayuda en torno al mapa y la jerarquía se diluye. | Todas las `-2`; en las `-1`, las tres líneas bajo el mapa |
| H5-05 | MENOR | Con D-07, quien ve la pantalla solo percibe la confirmación porque el botón desaparece. En tema claro el pin no cambia de forma visible. Cumple el requisito, y queda como reserva de usabilidad. | Todas las `-2` |
| H5-06 | MENOR | El campo vaciado muestra en gris un ejemplo con forma de dirección completa, como «Av. Prolongación Beni #5100, esq. 6to anillo» o «Av. Cañoto esq. Ballivián 234, Zona Central». D-06 pide que el campo quede «en blanco sí o sí», y de un vistazo no parece en blanco. El ejemplo es heredado, pero debilita el objetivo del cambio. | Todas las `-1`, `despues-editor-domicilio-3/4/5` y `despues-alta-domicilio-3` |
| H5-12 | MENOR | En el alta del paciente, el aviso queda bajo el rótulo «Ubicación GPS (opcional)» y se lee como parte del bloque del mapa, no de «Línea de dirección 1». El README lo describe como «pegado al campo», pero entre los dos están la ayuda y ese rótulo. | `despues-alta-domicilio-1`, `despues-alta-trabajo-1` y `despues-alta-domicilio-3` |

##### Heredados (no cuentan para la nota)

| ID | Severidad | Hallazgo | Coincide con el README | Capturas |
|---|---|---|---|---|
| H5-07 | MAYOR | En tema claro el pin sin confirmar casi no se ve: es un círculo claro sobre un plano claro. Para D-06 importa, porque la persona necesita ver dónde tocó. | Observación 2 | Todas las claras |
| H5-08 | MAYOR | En tema oscuro, el plano sigue claro y encandila dentro de la tarjeta oscura, la atribución es ilegible y «Iniciá sesión» casi no se lee. | Observación 3 | `despues-editor-domicilio-3`, `despues-alta-domicilio-3` |
| H5-09 | MENOR | Al desaparecer «Confirmar dirección actual», «Volver a ubicarme» queda sangrado unos 14 px respecto de la columna. El ⊖ que lo sigue no tiene rótulo, es un blanco chico y repite el glifo de «quitar sucursal» dentro de la misma tarjeta. Es probablemente heredado, pero no hay captura de antes para confirmarlo. | No | Todas las `-2` y las `-sucursal-1` |
| H5-10 | MENOR | El avatar del encabezado dice «AL» y el de la tarjeta «AQ», y son la misma persona. | No | `despues-editor-domicilio-1` a `-5` |
| H5-11 | MENOR | Los botones flotantes de la maqueta, «Datos de prueba» y «Ver componentes», tapan contenido: el borde del mapa, el conmutador de tema a 375, el botón de volver a 768, líneas de ayuda y el botón circular de volver en las altas. No son del producto, pero tapan parte de lo que se quiere probar. | No | Casi todas |

##### Defectos de la evidencia

| ID | Severidad | Hallazgo |
|---|---|---|
| H5-E1 | MENOR | El móvil se capturó a 375 y no a 390, que es el viewport del repo. Solo hay móvil para el editor. |
| H5-E2 | MENOR | Las capturas confirmadas del alta del paciente y de las sucursales (`despues-alta-domicilio-2`, `despues-alta-trabajo-2`, `despues-laboratorio-sucursal-2` y `despues-imagenologia-sucursal-2`) dejan el campo fuera del encuadre, así que no prueban que siga vacío después de confirmar. Además hay rótulos y el indicador de pasos cortados por el borde superior (`despues-alta-*-1/2` y `despues-aseguradora-2`). |
| H5-E3 | MENOR | Ninguna captura muestra que volver a escribir se lleve el aviso (comprobación 9) ni que correr el pin vuelva a vaciar el campo (comprobación 10). Tampoco hay capturas de antes para comparar. |
| H5-E4 | MENOR | En las capturas de página completa del editor, el fondo de la barra lateral se corta a unos 1000 px. |

#### Notas por pantalla de H5

| Pantalla | Nota | Por qué |
|---|---|---|
| Editor del paciente: Contacto › Domicilio | ACEPTABLE CON RESERVAS | El cambio solo deja MENOR: H5-03, H5-04, H5-05 y H5-06. Siguen abiertos los MAYOR heredados H5-07 y H5-08 |
| Alta del paciente: domicilio y trabajo | ACEPTABLE CON RESERVAS | H5-04, H5-05, H5-06 y H5-12, todos MENOR |
| Alta de la aseguradora | **RECHAZADA** | H5-01 y H5-02 |
| Alta del laboratorio: central | **RECHAZADA** | H5-01 |
| Alta del laboratorio: sucursales | ACEPTABLE CON RESERVAS | H5-04 y H5-05 |
| Alta de imagenología: central | **RECHAZADA** | H5-01 |
| Alta de imagenología: sucursales | ACEPTABLE CON RESERVAS | H5-04 y H5-05 |

---

### H7: «Mis puntos» como quinta pestaña (N-03)

#### Capturas

| Archivo | Viewport | Tema | Estado |
|---|---|---|---|
| `despues-ficha-1440-claro.png` | 1440 | claro | Ficha con «Datos personales» activa y cinco pestañas |
| `despues-puntos-1440-claro.png` | 1440 | claro | Pestaña «Mis puntos» activa, en estado vacío S3 y con el puntero encima |
| `despues-puntos-1440-oscuro.png` | 1440 | oscuro | Igual que la anterior, en oscuro |
| `despues-puntos-768-claro.png` | 768×1024 | claro | Pestaña activa en estado vacío |
| `despues-puntos-375-claro.png` | 375 (no es el 390 del repo) | claro | Panel de puntos. La pestaña activa no se ve en la tira |
| `despues-puntos-375-oscuro.png` | 375 | oscuro | Igual que la anterior, en oscuro |
| `despues-url-directa-1440-claro.png` | 1440 | claro | Entrada por `?pestana=puntos`. La URL no se ve en la imagen |
| `despues-ruta-propia-1440-claro.png` | 1440 | claro | `/my-account/loyalty` con cabecera y migas propias |
| `despues-editor-1440-claro.png` | 1440 (página completa) | claro | Edición, con «Mis puntos» apagada. La barra lateral está a medio pintar |

#### Las diez preguntas, por captura o por grupo

##### P1 · `despues-ficha-1440-claro.png`

1. **Lo primero que se ve mal:** nada propio del cambio. El avatar del encabezado dice «AL» y el de la tarjeta «AQ» (heredado).
2. **Texto cortado o solapado:** no hay cortes. Los cinco rótulos están bien repartidos.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** «Mis puntos» tiene la misma tipografía, el mismo peso y el mismo espaciado que las demás pestañas.
5. **Tema oscuro:** no aplica, la captura es clara.
6. **¿El estado orienta?** No aplica: es la ficha con datos.
7. **Jerarquía:** la tira se lee clara y «Datos personales» está marcada como activa.
8. **Datos:** «PAC-20000», el documento «5000000» y el nacimiento «21/06/1990» son datos sintéticos de la cuenta de maqueta. Son datos de identidad, y se admiten por ser de maqueta.
9. **¿Muestra el requisito?** Sí: hay cinco pestañas y «Mis puntos» es la última.
10. **Motivo de rechazo:** nada propio de esta captura. Ver H7-01 sobre el menú lateral.

##### P2 · `despues-puntos-1440-claro.png` y `despues-url-directa-1440-claro.png`

Las dos capturas tienen el mismo contenido. La única diferencia es el estilo de la pestaña activa (H7-06).

1. **Lo primero que se ve mal:** el menú lateral marca «Mi perfil» mientras, en el mismo menú, el ítem «Mis puntos» queda sin marcar, y ese ítem lleva a otra pantalla (H7-01).
2. **Texto cortado o solapado:** no hay cortes.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** el vacío usa el mismo componente que la ruta propia. La pestaña activa se ve distinta en las dos capturas: en una tiene fondo gris y rótulo oscuro, en la otra rótulo de marca sin fondo (H7-06).
5. **Tema oscuro:** no aplica.
6. **¿El estado orienta?** Sí. Es un S3 que explica por qué está vacío y ofrece una salida, «Ver mis pedidos». El título «Todavía no hay nada acá» es genérico (H7-03, heredado).
7. **Jerarquía:** la vista va del ícono al título y después a la salida. Que la salida sea un enlace de texto es suficiente.
8. **Datos:** el nombre es de la maqueta.
9. **¿Muestra el requisito?** Sí: la billetera está dentro de la tarjeta y hay una sola cabecera, «Mi perfil». En `url-directa` la URL no se ve, así que la entrada por `?pestana=puntos` descansa solo en el guion (H7-07).
10. **Motivo de rechazo:** H7-01.

##### P3 · `despues-puntos-1440-oscuro.png`

1. **Lo primero que se ve mal:** «Ver mis pedidos», la única acción del estado vacío, y la miga «Panel» se ven apagadas sobre el fondo oscuro (H7-08, heredado).
2. **Texto cortado o solapado:** no hay cortes.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** el subrayado activo, verde azulado, es coherente con los tokens oscuros.
5. **Tema oscuro:** el enlace del vacío pierde contraste frente al cuerpo del texto. No se midió el contraste. El ícono y el texto se leen.
6. **¿El estado orienta?** Sí.
7. **Jerarquía:** en oscuro la salida pesa menos que el texto, así que la jerarquía se invierte.
8. **Datos:** igual que P1.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** H7-01. H7-08 es heredado.

##### P4 · `despues-puntos-768-claro.png`

1. **Lo primero que se ve mal:** «Datos de prueba» tapa el botón de volver (maqueta).
2. **Texto cortado o solapado:** no hay cortes y los cinco rótulos entran justos. Hay una franja gris en el borde izquierdo (heredado).
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente.
5. **Tema oscuro:** no aplica, y no hay captura oscura a 768.
6. **¿El estado orienta?** Sí.
7. **Jerarquía:** correcta.
8. **Datos:** igual que P1.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** solo H7-01.

##### P5 · `despues-puntos-375-claro.png` y `despues-puntos-375-oscuro.png`

Las dos capturas tienen el mismo contenido. En la oscura se suma el enlace apagado.

1. **Lo primero que se ve mal:** no se ve cuál es la pestaña activa. La tira muestra «Datos personales | Contacto» sin ninguna marca y el panel muestra la billetera (H7-05).
2. **Texto cortado o solapado:** «la red.» queda sola en la última línea. «Datos de prueba» tapa el conmutador de tema.
3. **¿Terminado o prototipo?** Terminado, salvo la tira.
4. **Coherencia con el producto:** es coherente con los otros anchos.
5. **Tema oscuro:** «Ver mis pedidos» y «Panel» se ven apagados (H7-08).
6. **¿El estado orienta?** Sí.
7. **Jerarquía:** sin la marca de pestaña activa, se pierde la referencia de dónde está la persona.
8. **Datos:** igual que P1.
9. **¿Muestra el requisito?** No. A 375 la captura no muestra «Mis puntos» como pestaña, solo su contenido.
10. **Motivo de rechazo:** H7-05, con evidencia insuficiente para el requisito en móvil, más H7-01.

##### P6 · `despues-editor-1440-claro.png`

1. **Lo primero que se ve mal:** la marca «AloVida» sale recortada a «AloVi» bajo el botón de plegar, y el menú tiene rótulos partidos en dos líneas (H7-04).
2. **Texto cortado o solapado:**
   - La marca aparece recortada.
   - Hay una banda gris entre el menú y el contenido.
   - El contenido está unos 33 px más a la izquierda que en las demás capturas de 1440.
3. **¿Terminado o prototipo?** Se ve a medio pintar.
4. **Coherencia con el producto:** «Mis puntos» aparece apagada con el gris de deshabilitado, igual que a 768 en `despues-editor-domicilio-5-768-claro.png` de H5.
5. **Tema oscuro:** no aplica, y no hay edición en oscuro.
6. **¿El estado orienta?** La pestaña deshabilitada no explica por qué lo está (H7-02).
7. **Jerarquía:** correcta. «Guardar cambios» es el primario.
8. **Datos:** son de maqueta. El ejemplo «María» en «Tercer nombre» se confunde con un valor (heredado).
9. **¿Muestra el requisito?** En parte. Se ve la pestaña apagada. Que «pulsarla no abre nada» no se puede observar en una imagen.
10. **Motivo de rechazo:** H7-04. La captura no sirve como evidencia de un estado limpio, y la primera pasada la marcó «OK» sin notarlo.

##### P7 · `despues-ruta-propia-1440-claro.png`

1. **Lo primero que se ve mal:** nada roto. El menú marca «Mis puntos», y eso confirma que el ítem del menú lleva a la pantalla aparte (es la evidencia de H7-01).
2. **Texto cortado o solapado:** no hay cortes.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** la miga «Mi cuenta» no es un enlace y usa otro nombre que «Mi perfil» (heredado).
5. **Tema oscuro:** no aplica.
6. **¿El estado orienta?** Sí, con el mismo vacío que la pestaña.
7. **Jerarquía:** correcta.
8. **Datos:** no se ven datos.
9. **¿Muestra el requisito?** Sí: la ruta sigue con su cabecera y sus migas.
10. **Motivo de rechazo:** nada propio de esta pantalla. Sostiene H7-01.

#### Hallazgos de H7

##### Defectos del cambio

| ID | Severidad | Hallazgo | Capturas |
|---|---|---|---|
| H7-01 | **MAYOR** | La misma billetera tiene ahora dos lugares, y el menú lateral no acompaña. En la pestaña, el menú marca «Mi perfil» y deja sin marcar el ítem «Mis puntos» del mismo menú. Ese ítem lleva a `/my-account/loyalty`, la pantalla aparte con cabecera propia: en la captura de la ruta propia, el menú marca «Mis puntos». El texto de N-03 en el README es «la billetera de puntos deja de ser una pantalla aparte con su propia cabecera». Para quien entra desde el menú principal, nada cambió. Si conservar la ruta es un paso de transición (el README menciona un redirect de la ruta vieja que todavía no existe), hay que declararlo como pendiente, con dueño. Tal como se entrega, el producto muestra dos navegaciones incoherentes para lo mismo. | `despues-puntos-1440-claro/oscuro`, `despues-url-directa-1440-claro`, `despues-ruta-propia-1440-claro` |
| H7-02 | MENOR | En edición, «Mis puntos» aparece apagada y, según el README, pulsarla no hace nada. No hay ninguna pista visible de por qué está deshabilitada. | `despues-editor-1440-claro`; también `despues-editor-domicilio-5-768-claro` de H5 |

##### De origen no determinado

| ID | Severidad | Hallazgo | Capturas |
|---|---|---|---|
| H7-04 | **MAYOR** | La captura de edición salió con la barra lateral en un estado intermedio: <br>• la marca «AloVida» aparece recortada a «AloVi» bajo el botón de plegar; <br>• «Lugares cercanos», «Mi historia clínica» y «Mis cuestionarios» salen partidos en dos líneas; <br>• hay una banda gris entre el menú y el contenido; <br>• el contenido está corrido unos 33 px a la izquierda. <br>Puede ser un artefacto de la captura o un salto real de la maqueta al entrar en edición, y la imagen no permite distinguirlo. La primera pasada la dio por «OK». Hay que tomarla de nuevo. Si en un estado estable se repite, es un defecto del producto. | `despues-editor-1440-claro` |

##### Heredado en su mecanismo, con evidencia insuficiente para el requisito

| ID | Severidad | Hallazgo | Coincide con el README | Capturas |
|---|---|---|---|---|
| H7-05 | **MAYOR** | A 375, la pestaña activa, «Mis puntos», queda fuera de la parte visible de la tira. La tira muestra «Datos personales \| Contacto» sin marca y el panel muestra la billetera. El README explica que se seleccionó antes de achicar la ventana, así que la captura no representa a quien entra desde el móvil, por ejemplo por `?pestana=puntos` (el destino del redirect previsto). Por ser la última, es la pestaña más expuesta a este comportamiento. En móvil, la evidencia no muestra la quinta pestaña. | Sí, en la observación de la tira | `despues-puntos-375-claro/oscuro` |

##### Heredados y de evidencia (no cuentan para la nota)

| ID | Severidad | Hallazgo | Capturas |
|---|---|---|---|
| H7-03 | MENOR | El título del vacío, «Todavía no hay nada acá», no nombra los puntos, y la pestaña no tiene encabezado de sección. Es el mismo vacío que la ruta propia. | P2 a P5 y P7 |
| H7-06 | MENOR (evidencia) | Dos capturas del mismo estado se tomaron con el puntero encima de la pestaña activa: el fondo es gris y el rótulo oscuro, a diferencia del rótulo de marca de `url-directa`. | `despues-puntos-1440-claro/oscuro` |
| H7-07 | MENOR (evidencia) | La URL no se ve en `despues-url-directa-1440-claro`, así que la imagen sola no prueba que se entró por `?pestana=puntos`. | `despues-url-directa-1440-claro` |
| H7-08 | MENOR | En oscuro, «Ver mis pedidos» y la miga «Panel» se ven con menos contraste que el cuerpo del texto. Se leen, pero no se midieron. Es la misma familia que la observación 3 del README de H5 («Iniciá sesión»). | `despues-puntos-1440-oscuro`, `despues-puntos-375-oscuro` |
| H7-09 | MENOR | Hay detalles menores heredados: <br>• los botones flotantes de la maqueta tapan el conmutador de tema a 375 y el botón de volver a 768; <br>• «la red.» queda sola en la última línea a 375; <br>• el avatar del encabezado dice «AL» y el de la tarjeta «AQ»; <br>• la miga «Mi cuenta» no es un enlace y usa otro nombre que «Mi perfil»; <br>• el ejemplo «María» se confunde con un valor en edición; <br>• hay una franja gris en el borde izquierdo a 768 y a 375. | Varias |

#### Notas por pantalla de H7

| Pantalla | Nota | Por qué |
|---|---|---|
| Mi perfil › pestaña «Mis puntos» (P1 a P5) | **RECHAZADA** | H7-01, MAYOR del cambio. Además, la evidencia en móvil no muestra la pestaña (H7-05) |
| Mi perfil en edición (P6) | **RECHAZADA** | H7-04, MAYOR de origen no determinado. Ante la duda, nota más baja hasta tener una captura en estado estable. H7-02 es MENOR |
| `/my-account/loyalty` (P7) | ACEPTABLE CON RESERVAS | Cumple «sigue con su cabecera y migas». Solo quedan MENOR heredados. Su existencia sostiene H7-01, que se computa en la pestaña |

---

### No cubierto

La matriz del repo tiene cinco viewports (390×844, 768×1024, 1024×768, 1440×900 y 1920×1080) y dos temas (claro y oscuro).

#### H5

| Pantalla | Celdas presentes | Celdas que faltan |
|---|---|---|
| Editor del paciente | Claro: 375 (en lugar de 390), 768 y 1440. Oscuro: 1440 | 390 en los dos temas · 768 en oscuro · 1024×768 en los dos temas · 1920×1080 en los dos temas · el estado confirmado fuera de 1440 claro |
| Alta del paciente: domicilio | Claro: 1440. Oscuro: 1440, solo sin confirmar | 390, 768, 1024 y 1920 en los dos temas · el estado confirmado en oscuro |
| Alta del paciente: trabajo | Claro: 1440 | Todo lo demás, incluido el oscuro |
| Aseguradora, laboratorio (central y sucursal) e imagenología (central y sucursal) | Claro: 1440 | Todo lo demás, incluido el oscuro (el README lo declara) |
| Editor del médico y alta del médico | Ninguna | Toda la matriz. El README declara que el cambio no está hecho ahí |

**Por qué importa cada ausencia:**

- **390, en todas las altas:**
  - La fila de confirmación («Confirmar dirección actual», «Volver a ubicarme» y ⊖), el aviso en dos o más líneas y, en las centrales, el error rojo junto al aviso no se vieron nunca en móvil.
  - En el editor, la barra fija de acciones tapa el pie del mapa, y la captura de 375 no llega a la fila de confirmación.
  - 375 no reemplaza a 390, que es el viewport declarado.
- **1024×768:**
  - Es el ancho de escritorio más angosto con el menú lateral desplegado, donde la columna del formulario es mínima.
  - Ahí no se vieron ni el aviso ni la combinación de error y aviso de H5-01.
- **1920×1080:** tiene menor riesgo, pero no se vio el ancho del aviso frente a la tarjeta centrada.
- **Oscuro de la aseguradora, el laboratorio y la imagenología:**
  - Son justamente las pantallas con H5-01.
  - El rojo del error y el callout verde azulado sobre la tarjeta oscura no se vieron nunca juntos.
  - H5-08 ya muestra que en oscuro el mapa y los enlaces fallan.
- **Estado confirmado en oscuro y en móvil:** la ausencia visible de «Listo» (D-07) solo se vio a 1440 en claro.
- **Editor y alta del médico:**
  - D-06 no restringe la pantalla: «si una toca una dirección en el mapa…».
  - Dos pantallas con el mismo mapa siguen con el comportamiento viejo.
  - El README lo declara, pero el alcance del requisito queda incompleto y el producto queda incoherente entre roles.
- **Comportamientos que no se ven en ninguna captura:**
  - Volver a escribir se lleva el aviso (comprobación 9).
  - Correr el pin vuelve a vaciar el campo (comprobación 10).
  - No se sabe si «Volver a ubicarme», que mueve el pin por GPS, también vacía el campo.
  - No se sabe si arrastrar el pin vacía el campo igual que un clic.
  - No se vio cómo se pone el pin sin ratón (teclado), ni si ese camino dispara D-06.
  - No se oyó el anuncio de la región viva con un lector de pantalla: solo hay comprobaciones sobre el DOM.
  - No hay capturas de antes, así que la desaparición de «Listo, guardamos esta dirección.» no se puede comparar.

#### H7

| Pantalla | Celdas presentes | Celdas que faltan |
|---|---|---|
| Pestaña «Mis puntos» | Claro: 375 (en lugar de 390), 768 y 1440. Oscuro: 375 y 1440 | 390 en los dos temas · 768 en oscuro · 1024×768 en los dos temas · 1920×1080 en los dos temas |
| Edición con la pestaña apagada | Claro: 1440 (inválida, H7-04); 768 aparece de casualidad en H5 | Oscuro en todos los anchos · 390 · 1024 · 1920 |
| Entrada por `?pestana=puntos` | Claro: 1440 | 390 en los dos temas, que es donde la pestaña puede quedar fuera de la tira (H7-05) · oscuro |
| `/my-account/loyalty` | Claro: 1440 | Oscuro y todos los demás anchos |

**Por qué importa cada ausencia:**

- **390 y entrada directa en móvil:** es el caso real del redirect previsto. Si la tira no desplaza la pestaña activa hasta verla, el paciente llega a su billetera sin saber en qué pestaña está.
- **Edición en oscuro:** el gris de deshabilitado sobre la tarjeta oscura puede desaparecer. No hay ninguna celda que lo muestre.
- **Edición en móvil:** a 375 la quinta pestaña queda fuera de la tira. No se sabe si en edición se distingue apagada, ni si se puede llegar a ella con las flechas.
- **1024×768 y 1920×1080:** no se vio cómo se reparten los cinco rótulos entre el menú desplegado y el ancho máximo de la tarjeta.

**Estados de la billetera dentro de la pestaña:** solo se vio el vacío S3. No se vieron:

- los estados con saldo, canje y comprobante;
- la carga y el error.

El README los delega a `loyalty.spec.ts`, que es una prueba unitaria y no muestra cómo se ven. Dentro de una tarjeta con pestañas, el ancho disponible y un posible diálogo de canje abierto desde una pestaña son superficies nuevas que ninguna captura cubre.

**Interacciones sin evidencia:**

- Qué pasa al pulsar el lápiz estando en «Mis puntos», cuando la pestaña activa pasa a estar deshabilitada.
- Si cambiar de pestaña con un clic actualiza `?pestana=` en la URL, y qué hace el botón de atrás del navegador.
- Con teclado, si las flechas recorren la tira, si se salta la pestaña deshabilitada y si el foco es visible.

Nada de esto se ve en las capturas.

**Evidencia sobre el comportamiento:** que «pulsarla no abre nada» y la entrada por URL se sostienen solo en el guion. La imagen no las prueba (H7-07).

---

<!-- Ronda 2 -->

## Segunda pasada visual: H6 (ícono y nombre, D-05) y H7 recapturado («Mis puntos» como quinta pestaña)

- Fecha: 2026-09-24
- Material revisado:
  - `docs/frontend/evidence/d05-iconos-2026-09-23/`: 14 PNG `antes-*`, 24 PNG `despues-*`, `README.md`, `desborde-mi-perfil-antes.json` y `dom-formulario-por-paginas-{antes,despues}.json`.
  - `docs/frontend/evidence/mis-puntos-quinta-pestana-2026-09-23/`: 24 PNG `despues-*` (recaptura del 24/09) y `README.md`.
  - Salidas del guion: `docs/trabajo/2026-09-23-perfil-medico-configurar-tu-perfil/evidencia/h6/pasada-antes.txt` (3/3), `.../h6/pasada-despues.txt` (137/137) y `.../h7/navegador-recaptura.txt` (61/61, con dos líneas `ℹ`).
- Se abrieron como imagen las 62 capturas (38 de H6 y 24 de H7). Se leyeron completos los dos README, las tres salidas del guion y los tres JSON. Los dos JSON del formulario por páginas se compararon byte a byte: son idénticos.
- Para confirmar hallazgos se leyó código del repo; cada cita va con `ruta:línea`. Leer código no cuenta como verificación: lo que sólo sale del código se marca «según el código, no observado».
- Postura: revisión adversarial. Se parte de que la entrega tiene defectos.
- Límite del método: sólo se miraron imágenes. Lo que una imagen no puede mostrar queda como «no observable en imagen» y no se da por verificado en esta pasada: el orden del teclado, el nombre accesible, que un clic no abra nada y la URL con la que se entró.
- Regla de nota:
  - `RECHAZADA`: hay algún BLOQUEANTE o MAYOR del cambio o del requisito.
  - `ACEPTABLE CON RESERVAS`: sólo quedan MENOR del cambio.
  - `APROBADA`: no quedan hallazgos abiertos.
  - Los heredados se listan aparte y no cuentan para la nota.
  - Una pantalla que el cambio toca y que no tiene ninguna captura recibe `RECHAZADA`: no hay con qué aprobarla.
  - Ante la duda, se pone la nota más baja.

### Resumen de notas

| Hito | Pantalla | Nota | Motivo |
|---|---|---|---|
| H6 | «Mi perfil»: ficha con «Editar» | ACEPTABLE CON RESERVAS | El cambio sólo deja MENOR (H6-05 y H6-06). Queda abierto el MAYOR heredado H6-09, que depende de cómo se lea D-05 |
| H6 | Calendario de nacimiento: días | **RECHAZADA** | H6-01, MAYOR del cambio: a 360 la navegación queda en escalera |
| H6 | Calendario de nacimiento: años | ACEPTABLE CON RESERVAS | H6-03 y H6-04, MENOR |
| H6 | «Mi perfil» en edición › Contacto: botón ⊖ del mapa (sin captura) | **RECHAZADA** | H6-02, MAYOR del cambio: el ⊖ quedó declarado excepción sin serlo en su contexto, y ninguna captura lo muestra |
| H6 | El calendario en sus otros consumidores (sin captura) | **RECHAZADA** | H6-E1: el organismo lo montan 22 plantillas y sólo se vio una, en modo fecha |
| H7 | Ficha con cinco pestañas | ACEPTABLE CON RESERVAS | Sólo heredados y MENOR |
| H7 | Pestaña «Mis puntos», elegida con un clic | ACEPTABLE CON RESERVAS | H7R-03, MENOR del cambio. H7-01 de la pasada anterior quedó resuelto: el menú lateral ya no tiene «Mis puntos» |
| H7 | Entrada por `/my-account?pestana=puntos` | **RECHAZADA** | H7R-02, MAYOR: a 390 nada en la pantalla dice en qué pestaña está la persona |
| H7 | Dirección vieja `/my-account/loyalty` | **RECHAZADA** | H7R-01, MAYOR del requisito: termina en «Datos personales», no en la billetera |
| H7 | Editor con «Mis puntos» apagada | ACEPTABLE CON RESERVAS | H7R-04, MENOR. H7-04 de la pasada anterior quedó resuelto: la barra lateral sale entera |

---

### H6: «Editar» y el calendario con ícono y nombre (D-05)

Criterio del cliente (D-05, 22/09): «cada botón de acción tiene ícono + nombre». La única excepción es la del ADR-0012 §3: significado universal en su contexto, con `aria-label` y globo visible, justificada en una línea al lado del botón.

#### Capturas

Todas son de la ventana, no de la página entera, como declara el README.

**Después (24):**

| Archivo | Viewport | Tema | Estado |
|---|---|---|---|
| `despues-editar-1440-claro.png` | 1440×900 | claro | Ficha, «Editar» a la derecha de la cabecera de la tarjeta |
| `despues-editar-1440-oscuro.png` | 1440×900 | oscuro | Igual |
| `despues-editar-1920-claro.png` | 1920×1080 | claro | Igual, con la columna centrada |
| `despues-editar-1024-claro.png` | 1024×768 | claro | Igual |
| `despues-editar-768-claro.png` | 768×1024 | claro | Igual |
| `despues-editar-390-claro.png` | 390×844 | claro | «Editar» todavía al lado del nombre |
| `despues-editar-390-oscuro.png` | 390×844 | oscuro | Igual |
| `despues-editar-360-claro.png` | 360×800 | claro | «Editar» baja debajo de la identidad |
| `despues-calendario-dias-1440-claro.png` | 1440×900 | claro | Panel de días, junio de 1990, el 21 marcado |
| `despues-calendario-dias-1440-oscuro.png` | 1440×900 | oscuro | Igual |
| `despues-calendario-dias-1920-claro.png` | 1920×1080 | claro | Igual |
| `despues-calendario-dias-1024-claro.png` | 1024×768 | claro | Igual |
| `despues-calendario-dias-768-claro.png` | 768×1024 | claro | Igual |
| `despues-calendario-dias-390-claro.png` | 390×844 | claro | Las cuatro flechas en un renglón |
| `despues-calendario-dias-390-oscuro.png` | 390×844 | oscuro | Igual |
| `despues-calendario-dias-360-claro.png` | 360×800 | claro | Flechas en dos renglones, en escalera |
| `despues-calendario-anios-1440-claro.png` | 1440×900 | claro | Panel de años 1970–1999, 1990 marcado |
| `despues-calendario-anios-1440-oscuro.png` | 1440×900 | oscuro | Igual |
| `despues-calendario-anios-1920-claro.png` | 1920×1080 | claro | Igual |
| `despues-calendario-anios-1024-claro.png` | 1024×768 | claro | Igual |
| `despues-calendario-anios-768-claro.png` | 768×1024 | claro | Igual |
| `despues-calendario-anios-390-claro.png` | 390×844 | claro | Igual |
| `despues-calendario-anios-390-oscuro.png` | 390×844 | oscuro | Igual |
| `despues-calendario-anios-360-claro.png` | 360×800 | claro | Igual, las dos flechas en un renglón |

**Antes, referencia (14):** `antes-editar-{1440-claro, 1440-oscuro, 1920-claro, 1024-claro, 768-claro, 390-claro, 390-oscuro, 360-claro}.png` y `antes-calendario-{dias,anios}-{1440,390,360}-claro.png`. Muestran el lápiz solo y redondo, la cruz sola del calendario y las flechas de sólo ícono a los lados del mes.

**Sin captura:** el formulario por páginas. Se comparó el HTML ya hidratado de su botonera en seis pantallas. Los dos JSON son idénticos y ningún comentario de justificación llega a la página. En cuatro de las seis (`/auth/register/practitioner`, `laboratory`, `imaging-center` y `patient`) el botón «Siguiente» es de sólo ícono.

#### Las diez preguntas, por captura o por grupo

##### G1 · «Editar» a 1440 (claro y oscuro), 1920, 1024 y 768

Las cinco capturas tienen el mismo contenido. Cambian el ancho de la columna y la grilla de datos, que a 768 pasa a una columna.

1. **Lo primero que se ve mal:** nada del cambio. «Editar» tiene lápiz y nombre. En la misma tarjeta, «Cambiar contraseña» es un botón de sólo texto (H6-09). La cabecera de la página tiene seis botones de sólo ícono: volver, campana, tema, birrete, chat y engranaje (H6-10).
2. **Texto cortado o solapado:** no hay. A 1920 la flecha de volver queda en x≈300, fuera de la columna centrada, que empieza en x≈400 (heredado). A 768 la etiqueta «Demo» pisa el borde inferior del encabezado (heredado).
3. **¿Terminado o prototipo?** Terminado. El botón usa el mismo contorno y el mismo alto que «Cambiar contraseña».
4. **Coherencia con el producto:** es coherente. «Editar» usa la variante `outline` en tamaño `sm`, igual que los otros botones de la ficha.
5. **Tema oscuro:** el borde y el texto de «Editar» se leen sobre la tarjeta oscura. La miga «Panel» sigue apagada (heredado, observación 4 del README).
6. **¿El estado orienta?** No aplica: es la ficha con datos.
7. **Jerarquía:** dos botones de contorno y ninguno primario. En una ficha de lectura es correcto.
8. **Datos:** «Ana Lucía Pérez Quiroga», «PAC-20000», el documento «5000000» y «21/06/1990» son datos sintéticos de la cuenta de maqueta.
9. **¿Muestra el requisito?** Sí para «Editar». El requisito, leído al pie de la letra, no se cumple en la pantalla completa (H6-09 y H6-10), pero eso no lo introduce el cambio.
10. **Motivo de rechazo:** nada del cambio en estas celdas.

##### G2 · «Editar» a 390 (claro y oscuro)

1. **Lo primero que se ve mal:** «Editar» empieza unos 18 px después del final de «Ana Lucía Pérez Quiroga». Con un nombre más largo no se sabe si el botón baja o si el nombre se parte. No hay captura con un nombre largo (ver «No cubierto»).
2. **Texto cortado o solapado:** no hay. La tira de pestañas muestra «Datos personales | Contacto» con sus flechas, que es su comportamiento normal.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente con los anchos mayores.
5. **Tema oscuro:** se lee. El borde del botón es tenue, pero visible.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** correcta.
8. **Datos:** igual que G1.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** nada MAYOR.

##### G3 · «Editar» a 360

1. **Lo primero que se ve mal:** «Editar» baja y queda alineado con el borde del avatar (x≈37), no con el bloque del nombre (x≈97). Se lee como un botón suelto entre la identidad y las pestañas (H6-05). El avatar del encabezado sale cortado contra el borde derecho: es el desborde de 4 px, heredado (observación 1 del README, `desborde-mi-perfil-antes.json`).
2. **Texto cortado o solapado:** «Contacto» queda cortado contra la flecha de la tira, lo normal de la tira. La etiqueta «Demo» pisa el avatar del encabezado.
3. **¿Terminado o prototipo?** Funciona, pero la posición del botón se ve improvisada.
4. **Coherencia con el producto:** en los demás anchos «Editar» está a la derecha de la cabecera. Acá cambia de lado y de fila.
5. **Tema oscuro:** no aplica. No hay captura oscura a 360.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** el botón queda entre la identidad y las pestañas, y empuja la tira unos 50 px hacia abajo.
8. **Datos:** igual que G1.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** H6-05, MENOR.

##### G4 · Calendario, días, a 1440 (claro y oscuro), 1920, 1024 y 768

1. **Lo primero que se ve mal:**
   - Los cuatro botones dicen «Año», «Mes», «Mes» y «Año». Qué es anterior y qué es siguiente lo dice sólo un chevron de unos 10 px (H6-03).
   - Arriba a la derecha dice «Cerrar» y abajo dice «Cancelar», y los dos hacen lo mismo (H6-04).
2. **Texto cortado o solapado:** no hay. «‹‹ Año» queda alineado con «lun» y «Año ››» con «dom».
3. **¿Terminado o prototipo?** Terminado. La cabecera del panel creció unos 44 px: entre el título y los días de la semana había 112 px y ahora hay 156.
4. **Coherencia con el producto:** en el mismo diálogo conviven botones con ícono y nombre («Cerrar» y las flechas) y botones de sólo texto («Cancelar» y «Confirmar»). Es la mezcla que deja H6-09.
5. **Tema oscuro:** se lee todo. Las flechas son finas pero se ven, y «Confirmar» va en aqua con texto oscuro.
6. **¿El estado orienta?** No aplica. No hay captura de las flechas deshabilitadas, por ejemplo al llegar al límite de fechas (H6-E3).
7. **Jerarquía:** «Confirmar» es el primario. Es correcto.
8. **Datos:** la fecha de nacimiento es sintética.
9. **¿Muestra el requisito?** Sí: «Cerrar» y las cuatro flechas tienen ícono y nombre. Los nombres accesibles completos («Año anterior», etc.) no se observan en una imagen; los sostiene el guion.
10. **Motivo de rechazo:** sólo MENOR (H6-03 y H6-04).

##### G5 · Calendario, días, a 390 (claro y oscuro)

1. **Lo primero que se ve mal:** en el centro quedan «‹ Mes» y «Mes ›» separados por unos 46 px. Se lee «Mes Mes» (H6-03).
2. **Texto cortado o solapado:** no hay. Las cuatro flechas entran en un renglón, como dice el README.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente con G4.
5. **Tema oscuro:** se lee.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** correcta.
8. **Datos:** igual que G4.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** sólo MENOR.

##### G6 · Calendario, días, a 360

1. **Lo primero que se ve mal:** las flechas quedan en escalera. «‹‹ Año ‹ Mes» va pegado a la izquierda, con la mitad derecha vacía. Un renglón más abajo, «Mes › Año ››» va pegado a la derecha, con la mitad izquierda vacía (H6-01).
2. **Texto cortado o solapado:** no hay y no hay desborde.
3. **¿Terminado o prototipo?** Parece un salto de línea accidental, no una disposición pensada. La cabecera pasa de tres a cinco renglones (título, mes, anteriores, siguientes y días). Entre el título y los días había 112 px en la referencia de 360 y ahora hay unos 199.
4. **Coherencia con el producto:** en los otros siete anchos las cuatro flechas van en un renglón. En la referencia de 360, que eran de sólo ícono, también.
5. **Tema oscuro:** no aplica. No hay captura oscura a 360.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** la navegación ocupa un cuarto de la pantalla antes del primer día. «Confirmar» sigue a la vista.
8. **Datos:** igual que G4.
9. **¿Muestra el requisito?** Cumple el criterio que se fijó el plan (H6.S1.M6): las anteriores a la izquierda y las siguientes a la derecha. Pero no se ve terminado, y el README la marca «OK».
10. **Motivo de rechazo:** H6-01. Es el defecto que tendría que resolverse antes de entregar. 360 no está en la matriz del repo, pero es un ancho de teléfono común, y el propio README lo sumó.

##### G7 · Calendario, años (las ocho celdas)

1. **Lo primero que se ve mal:** «30 años» aparece igual a los dos lados, y la dirección la da sólo el chevron (H6-03).
2. **Texto cortado o solapado:** no hay. A 360 las dos flechas siguen en un renglón.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente con el panel de días. El selector sigue diciendo «Junio 1990» y no nombra el rango de años (heredado).
5. **Tema oscuro:** se lee y 1990 va marcado en aqua.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** correcta.
8. **Datos:** igual que G4.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** sólo MENOR (H6-03 y H6-04).

##### G8 · Las 14 referencias `antes-*`

1. **Lo primero que se ve mal:** es el estado previo que el cambio corrige: el lápiz solo, la cruz sola y las flechas de sólo ícono.
2. **Texto cortado o solapado:** no hay. `antes-editar-360-claro` ya muestra el avatar cortado del encabezado. Confirma que el desborde de 4 px es heredado.
3. a 7. No aplican. Son referencia y coinciden con lo que describe el README.
8. **Datos:** igual que G1.
9. **¿Muestra el requisito?** Sirven para comparar. En `antes-calendario-dias-360-claro` las cuatro flechas entraban en el renglón del mes, así que la escalera de H6-01 es nueva.
10. **Motivo de rechazo:** no aplica.

#### Hallazgos de H6

##### Defectos del cambio

| ID | Severidad | Hallazgo | Capturas o código |
|---|---|---|---|
| H6-01 | **MAYOR** | A 360 la navegación del calendario queda en escalera: «‹‹ Año ‹ Mes» a la izquierda y, un renglón más abajo, «Mes › Año ››» a la derecha. En cada renglón queda media fila vacía. La cabecera crece de 112 a unos 199 px y se ve como un salto de línea accidental. La corrección (`date-picker.css:228` y `:244`) evitó que «Mes ›» cayera debajo de «‹ Mes», pero el resultado sigue sin verse terminado, y el README lo da por «OK». Hay alternativas a evaluar con el dueño del sistema de diseño. Una son dos renglones simétricos: «‹ Mes · Mes ›» arriba y «‹‹ Año · Año ››» abajo. Otra es dejar el salto de año sólo en la grilla de años, a la que ya lleva el selector del mes. | `despues-calendario-dias-360-claro` |
| H6-02 | **MAYOR** | El ⊖ «Quitar la ubicación de tu casa» / «…de tu trabajo» se declaró excepción del ADR-0012 §3 como «quitar un elemento» (`ubicacion-picker.html:36`, `:80` y `:122`; `evidencia/h6/iconos.md`, filas 3 a 8 y 27 a 29). El ejemplo del ADR es «quitar un elemento **de una lista**», y el propio ícono está dibujado para eso (`nav-icon.ts:366-370`: «sacá esto de la lista»). Acá no hay lista: se borra el valor de un campo, y el botón está al lado de un mapa, donde un «menos» en un aro se lee como «alejar». La segunda pasada anterior de H5 ya lo vio como un ⊖ sin rótulo, con un blanco chico y el mismo glifo que «quitar sucursal» en la misma tarjeta. El significado no es universal en su contexto. Está en «Mi perfil» en edición, pestaña «Contacto» (`patient-profile-edit.html:297` y `:337`), y ninguna captura de esta entrega lo muestra ni muestra su globo. Hay que confirmarlo con el dueño del ADR. Mientras tanto, la lectura prudente es ícono y nombre. | Sin captura |
| H6-03 | MENOR | Los nombres visibles se repiten a los dos lados: «Año · Mes · Mes · Año» y «30 años · 30 años». La dirección la da sólo un chevron de unos 10 px. A 390 queda «‹ Mes   Mes ›» en el centro. El nombre accesible completo («Mes anterior», etc.) no se ve. | Todas las del calendario |
| H6-04 | MENOR | En el mismo diálogo, «Cerrar» (arriba) y «Cancelar» (abajo) hacen exactamente lo mismo: los dos llaman a `close()` (`date-picker.html:96` y `:286`). Antes la cruz no tenía nombre y no competía. Ahora hay dos verbos para una sola acción, y quien lo lee puede suponer que uno descarta y el otro no. | Todas las del calendario |
| H6-05 | MENOR | A 360 «Editar» baja y se alinea con el avatar, no con el bloque del nombre. Queda como un botón suelto que empuja la tira de pestañas. | `despues-editar-360-claro` |
| H6-06 | MENOR | El cambio deja en rojo tres comprobaciones de un guion existente del repo: `playwright/mi-perfil-paciente.mjs:93` (lápiz sin texto), `:94` (`aria-label` «Editar») y `:99` (el globo dice «Editar»). El globo se quitó con el cambio (`my-profile.ts`, import de `Tooltip`). El README las declara viejas y las deja por ser de otro dueño, lo que es correcto como frontera. Pero la entrega tiene que decir con quién quedó acordada la actualización. Si no, la próxima corrida de ese guion da tres fallos que nadie espera. | Código |
| H6-07 | MENOR | «Siguiente» del alta, que es la acción principal de cada página, queda como flecha dentro de un círculo lleno, declarada excepción de «pasar de página». El ADR nombra «navegar a la página siguiente», y el plan registra la duda como Q-I11, con su supuesto y a quién confirmarla. Está bien registrada, pero sigue abierta. | `dom-formulario-por-paginas-despues.json` |

##### Heredados (no cuentan para la nota)

| ID | Severidad | Hallazgo | Coincide con el README | Capturas o código |
|---|---|---|---|---|
| H6-08 | MAYOR | El globo de ayuda se cuelga del `<body>` (`tooltip.ts:131`) y queda debajo de todo `<dialog>` abierto con `showModal()`. Ninguna excepción de sólo ícono dentro de un modal nativo puede cumplir «globo visible». El guion lo confirma. Es lo que obligó a darle nombre a «Cerrar». Afecta a cualquier botón de sólo ícono dentro de un diálogo del producto. | Sí, «Hallazgo» | `pasada-despues.txt` |
| H6-09 | MAYOR (a confirmar) | Leído al pie de la letra, D-05 («ícono + nombre») también alcanza a los botones de sólo texto. En las pantallas de esta entrega hay cinco: «Cambiar contraseña» (`my-profile.html:289`), «Cancelar» y «Guardar cambios» en el editor, y «Cancelar» y «Confirmar» en el calendario. El encargo acotó H6 a los botones de sólo ícono, y el cambio siguió el encargo. Hay que confirmar con quien lleva D-05 cuál es la lectura. Si es la literal, estas pantallas no cumplen, y en el calendario la mezcla ya se nota (G4, pregunta 4). | No | `despues-editar-*`, `despues-calendario-*` |
| H6-10 | MENOR | Detalles heredados: <br>• la cabecera tiene seis botones de sólo ícono (el birrete no tiene un significado universal); es D-05 de otro carril; <br>• a 360 la página desborda 4 px y el avatar del encabezado sale cortado; <br>• la etiqueta «Demo» pisa el borde del encabezado a 390, 768 y 360; <br>• las píldoras de la maqueta quedan sobre el contenido a 1024; <br>• la miga «Panel» se ve apagada en oscuro; <br>• hay una franja de unos 12 px, de otro tono, entre la barra lateral y el contenido. | En parte (observaciones 1 y 4) | Varias |

##### Defectos de la evidencia

| ID | Severidad | Hallazgo |
|---|---|---|
| H6-E1 | **MAYOR** | El calendario es un organismo compartido: lo montan 22 plantillas de `src/app` (las que contienen `<app-date-picker`), cinco de ellas en modo fecha y hora, que agrega el selector de hora debajo de la grilla. Uno de los consumidores está dentro de otro diálogo (`dependent-form-dialog.html:62`). El cambio le agrega un renglón a la cabecera en todos, y dos a 360. La evidencia muestra uno solo: la fecha de nacimiento del paciente, en modo fecha. La regla del equipo para un componente compartido es mirar las pantallas que lo usan. Queda sin ver si en modo fecha y hora, a 1024×768, «Confirmar» sigue entrando o pasa a un desplazamiento interno (`date-picker.css:184-185`). |
| H6-E2 | MENOR | Ninguna captura muestra una de las 23 excepciones (el ⊖, las flechas del formulario por páginas, volver) ni su globo, que es justo la condición que el ADR exige y la que H6-08 demuestra frágil. La comparación del DOM prueba que nada cambió. No prueba que la excepción cumpla. |
| H6-E3 | MENOR | Hay tema oscuro sólo a 1440 y a 390. Faltan 1920, 1024 y 768. No hay captura de los botones nuevos del calendario deshabilitados, con foco ni con el puntero encima. |
| H6-E4 | MENOR | `pasada-antes.txt` (línea 2) guarda una ruta absoluta del equipo donde se corrió el guion, y las dos salidas nombran el entorno en que se sirvió la app. Lo que viaja en el PR no lleva ninguna de las dos cosas. Además, el `PLAN.md` quedó atrás del README: H6.S1.M5 cita «92/92» y «23 capturas», y el README dice 137/137 y 24. |
| H6-E5 | MENOR | La observación 3 del README cita `mi-perfil-paciente.mjs:93-94` y le falta la `:99`. La observación 2 nombra las altas de laboratorio y de centro de imagen, y omite `register-practitioner.html:57`, que también enciende `[iconOnlyNav]`. Es coherente con dejar al médico fuera, pero conviene decirlo. |

#### Notas por pantalla de H6

| Pantalla | Nota | Por qué |
|---|---|---|
| «Mi perfil»: ficha con «Editar» | ACEPTABLE CON RESERVAS | Del cambio quedan H6-05 y H6-06, MENOR. H6-09 (MAYOR heredado) puede cambiar la lectura cuando se confirme |
| Calendario: días | **RECHAZADA** | H6-01. Además H6-03 y H6-04 |
| Calendario: años | ACEPTABLE CON RESERVAS | H6-03 y H6-04, MENOR |
| «Mi perfil» en edición › Contacto (⊖ del mapa), sin captura | **RECHAZADA** | H6-02, y no hay ninguna imagen del botón ni de su globo |
| El calendario en sus otros 21 consumidores, sin captura | **RECHAZADA** | H6-E1: el cambio modificó su aspecto y no se vio en ninguno |
| Formulario por páginas (seis altas), sin captura | ACEPTABLE CON RESERVAS | El DOM es idéntico y el cambio son sólo comentarios. Queda H6-07, registrado como Q-I11 |

---

### H7 recapturado: «Mis puntos» como quinta pestaña (N-03)

Criterio del cliente (N-03, 22/09): la billetera de puntos deja de ser una pantalla aparte con su propia cabecera y pasa a ser la quinta pestaña de «Mi perfil», dentro de la misma tarjeta. En el editor, la pestaña aparece apagada.

#### Capturas

Son de la página entera, según el README. Por eso el editor y la ficha a 390 son más altos que la ventana.

| Archivo | Tamaño de la imagen | Tema | Estado |
|---|---|---|---|
| `despues-ficha-1440-claro.png` | 1440×900 | claro | Ficha en «Datos personales», cinco pestañas |
| `despues-ficha-1440-oscuro.png` | 1440×900 | oscuro | Igual |
| `despues-ficha-1920-claro.png` | 1920×1080 | claro | Igual |
| `despues-ficha-1024-claro.png` | 1024×768 | claro | Igual |
| `despues-ficha-768-claro.png` | 768×1024 | claro | Igual |
| `despues-ficha-390-claro.png` | 390×994 | claro | Igual. La tira muestra dos pestañas |
| `despues-ficha-390-oscuro.png` | 390×994 | oscuro | Igual |
| `despues-puntos-1440-claro.png` | 1440×900 | claro | «Mis puntos» elegida con un clic, vacío S3, puntero encima |
| `despues-puntos-1440-oscuro.png` | 1440×900 | oscuro | Igual |
| `despues-puntos-1920-claro.png` | 1920×1080 | claro | Igual |
| `despues-puntos-1024-claro.png` | 1024×768 | claro | Igual |
| `despues-puntos-768-claro.png` | 768×1024 | claro | Igual |
| `despues-puntos-390-claro.png` | 390×844 | claro | Igual. La tira se corrió hasta la pestaña |
| `despues-puntos-390-oscuro.png` | 390×844 | oscuro | Igual |
| `despues-url-directa-1440-claro.png` | 1440×900 | claro | Entrada por `?pestana=puntos`. La URL no se ve |
| `despues-url-directa-390-claro.png` | 390×844 | claro | Igual. La pestaña activa no está a la vista |
| `despues-ruta-vieja-1440-claro.png` | 1440×900 | claro | Entrada por `/my-account/loyalty`. Termina en «Datos personales». La URL no se ve |
| `despues-editor-1440-claro.png` | 1440×1067 | claro | Edición, «Mis puntos» apagada |
| `despues-editor-1440-oscuro.png` | 1440×1067 | oscuro | Igual |
| `despues-editor-1920-claro.png` | 1920×1080 | claro | Igual |
| `despues-editor-1024-claro.png` | 1024×1260 | claro | Igual, formulario en dos columnas |
| `despues-editor-768-claro.png` | 768×1605 | claro | Igual, en una columna |
| `despues-editor-390-claro.png` | 390×1648 | claro | La pestaña apagada queda fuera de la tira visible |
| `despues-editor-390-oscuro.png` | 390×1648 | oscuro | Igual |

#### Las diez preguntas, por captura o por grupo

##### P1 · Ficha a 1440 (claro y oscuro), 1920, 1024 y 768

1. **Lo primero que se ve mal:** nada del cambio. El menú lateral ya no tiene «Mis puntos», así que H7-01 de la pasada anterior quedó resuelto.
2. **Texto cortado o solapado:** no hay. A 1024 las píldoras de la maqueta quedan pegadas bajo la tarjeta.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** «Mis puntos» tiene la tipografía, el peso y el espaciado de las demás pestañas. A 1920 las cinco se reparten a lo ancho.
5. **Tema oscuro:** se lee. La miga «Panel» está apagada (heredado).
6. **¿El estado orienta?** No aplica: es la ficha con datos.
7. **Jerarquía:** «Datos personales» es la activa, con subrayado y rótulo de marca.
8. **Datos:** sintéticos de maqueta, igual que G1 de H6.
9. **¿Muestra el requisito?** Sí: hay cinco pestañas y «Mis puntos» es la última.
10. **Motivo de rechazo:** nada del cambio.

##### P2 · Ficha a 390 (claro y oscuro)

1. **Lo primero que se ve mal:** «Mis puntos» no se ve. La tira muestra «Datos personales | Contacto», y la quinta pestaña queda a tres toques de flecha. Nada avisa que existe (H7R-05).
2. **Texto cortado o solapado:** no hay. «Demo» pisa el borde del encabezado.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente con el comportamiento de la tira en el resto del producto.
5. **Tema oscuro:** se lee. La flecha izquierda sale apagada porque la tira está al principio, que es lo correcto.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** correcta.
8. **Datos:** igual que P1.
9. **¿Muestra el requisito?** La pestaña existe, pero en esta captura no se ve. Se ve en P4.
10. **Motivo de rechazo:** la descubribilidad en el teléfono, que es heredada.

##### P3 · «Mis puntos» con un clic, a 1440 (claro y oscuro), 1920, 1024 y 768

1. **Lo primero que se ve mal:**
   - La pestaña activa tiene fondo gris y rótulo oscuro, porque el puntero quedó encima. Es el mismo defecto de evidencia de la pasada anterior (H7R-E1).
   - «Editar» sigue en la cabecera de la tarjeta mientras se ve la billetera, que no tiene nada que editar (H7R-03).
2. **Texto cortado o solapado:** no hay.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** el vacío es el S3 de la billetera, sin cabecera propia. Dentro del panel no hay un encabezado que nombre la sección (heredado).
5. **Tema oscuro:** «Ver mis pedidos», la única salida, se ve más apagado que el texto que lo rodea (heredado, H7-08 de la pasada anterior).
6. **¿El estado orienta?** Sí: explica por qué está vacío y ofrece una salida. El título «Todavía no hay nada acá» es genérico (heredado).
7. **Jerarquía:** la vista va del ícono al título y después a la salida. En oscuro la salida pesa menos que el cuerpo.
8. **Datos:** no se ven datos de la billetera.
9. **¿Muestra el requisito?** Sí: la billetera está dentro de la tarjeta, hay una sola cabecera («Mi perfil») y el menú ya no ofrece la pantalla aparte.
10. **Motivo de rechazo:** nada MAYOR. H7R-03 es MENOR.

##### P4 · «Mis puntos» con un clic, a 390 (claro y oscuro)

1. **Lo primero que se ve mal:** la pestaña activa sigue con el gris del puntero encima. En oscuro, «Ver mis pedidos» se ve apagado.
2. **Texto cortado o solapado:** no hay. La tira se corrió a «Seguros y tutores | Mis puntos» y la flecha derecha sale apagada.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente con los anchos mayores.
5. **Tema oscuro:** el enlace se ve apagado (heredado).
6. **¿El estado orienta?** Sí.
7. **Jerarquía:** correcta.
8. **Datos:** no se ven.
9. **¿Muestra el requisito?** Sí. Resuelve H7-05 de la pasada anterior cuando la persona elige la pestaña.
10. **Motivo de rechazo:** nada MAYOR.

##### P5 · `despues-url-directa-1440-claro.png`

1. **Lo primero que se ve mal:** nada roto. Es el estado activo limpio, con subrayado y rótulo de marca y sin puntero encima, que es el que debieron mostrar las capturas de P3.
2. **Texto cortado o solapado:** no hay.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente.
5. **Tema oscuro:** no aplica, y no hay entrada por URL en oscuro.
6. **¿El estado orienta?** Sí.
7. **Jerarquía:** correcta.
8. **Datos:** no se ven.
9. **¿Muestra el requisito?** La billetera abierta, sí. Que se entró por `?pestana=puntos` no se ve en la imagen: lo sostiene el guion (H7R-E2).
10. **Motivo de rechazo:** nada propio de esta celda.

##### P6 · `despues-url-directa-390-claro.png`

1. **Lo primero que se ve mal:** nada en la pantalla dice dónde está la persona. La tira muestra «Datos personales | Contacto» sin ninguna marca, con el comienzo de «Facturación» cortado contra la flecha. El panel dice «Todavía no hay nada acá» y no nombra los puntos (H7R-02).
2. **Texto cortado o solapado:** el comienzo de «Facturación» asoma cortado junto a la flecha derecha.
3. **¿Terminado o prototipo?** Está a medio resolver: hay un contenido abierto que no corresponde a ninguna pestaña visible.
4. **Coherencia con el producto:** es incoherente con P4, donde la misma pestaña, elegida con un clic, queda a la vista y subrayada.
5. **Tema oscuro:** no aplica, y no hay captura oscura de esta entrada.
6. **¿El estado orienta?** El vacío orienta sobre el programa de puntos, no sobre dónde está la persona.
7. **Jerarquía:** la vista cae en un vacío sin título de sección.
8. **Datos:** no se ven.
9. **¿Muestra el requisito?** No. La billetera está, pero la quinta pestaña no se ve. La entrada por `?pestana=` es parte de este cambio (plan, H7.S1.M6) y es el destino que va a tener la redirección de la dirección vieja.
10. **Motivo de rechazo:** H7R-02.

##### P7 · `despues-ruta-vieja-1440-claro.png`

1. **Lo primero que se ve mal:** la dirección que era «Mis puntos» abre «Datos personales» (H7R-01).
2. **Texto cortado o solapado:** no hay.
3. **¿Terminado o prototipo?** La pantalla sí.
4. **Coherencia con el producto:** la cabecera muestra la campana con 3 y el chat sin contador, cuando en todas las demás capturas son 4 y 2. O la cabecera no había terminado de cargar o los datos no son los mismos (H7R-E2).
5. **Tema oscuro:** no aplica.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** correcta para una ficha.
8. **Datos:** sintéticos.
9. **¿Muestra el requisito?** No, para quien entra por la dirección vieja. El README lo declara (hallazgo 1) y lo atribuye a quien lleva la redirección.
10. **Motivo de rechazo:** H7R-01.

##### P8 · Editor a 1440 (claro y oscuro), 1920, 1024 y 768

1. **Lo primero que se ve mal:** «Mis puntos» aparece apagada y nada dice por qué (H7R-04). La barra lateral sale entera en las cinco, así que H7-04 de la pasada anterior quedó resuelto.
2. **Texto cortado o solapado:** no hay. «+ Agregar otro nombre» flota en una columna vacía a 1440, 1920 y 1024 (heredado). A 1024 las píldoras de la maqueta tocan el borde inferior de la tarjeta.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** «Editar» desaparece en edición, como declara la plantilla. La pestaña apagada usa el gris de deshabilitado del sistema.
5. **Tema oscuro:** la pestaña apagada se distingue del resto sin desaparecer.
6. **¿El estado orienta?** No aplica: es un formulario.
7. **Jerarquía:** «Guardar cambios» es el primario.
8. **Datos:** el ejemplo «María» de «Tercer nombre» se confunde con un valor (heredado).
9. **¿Muestra el requisito?** Sí: la pestaña sigue en la tira y apagada. Que «pulsarla no abre nada» no se puede observar en una imagen.
10. **Motivo de rechazo:** H7R-04, MENOR.

##### P9 · Editor a 390 (claro y oscuro)

1. **Lo primero que se ve mal:** la pestaña apagada no aparece, porque queda detrás de la flecha (H7R-E3).
2. **Texto cortado o solapado:** no hay.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente.
5. **Tema oscuro:** se lee.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** «Cancelar» y «Guardar cambios» van al pie, con el primario bien marcado.
8. **Datos:** igual que P8.
9. **¿Muestra el requisito?** No muestra la pestaña apagada en el teléfono. Descansa sólo en el guion.
10. **Motivo de rechazo:** evidencia insuficiente. No hay un defecto visible.

#### Hallazgos de H7

##### Defectos del cambio y del requisito

| ID | Severidad | Hallazgo | Capturas o código |
|---|---|---|---|
| H7R-01 | **MAYOR** | Fuera de la tira de pestañas, ninguna puerta lleva a la billetera. `/my-account/loyalty` redirige a `/my-account` (`app.routes.ts:1072`) y abre «Datos personales», como se ve en la captura. Según el código, «Tus accesos» del Panel sigue ofreciendo «Mis puntos» con esa dirección. La sección está registrada (`navigation.map.ts:1356`), sale del menú pero no de «Tus accesos» (`navigation.types.ts:337-340`), `visibleSections` filtra con `isVisibleTo` (`navigation.service.ts:62-65`) y es lo que recibe el árbol de accesos (`dashboard.html:100`). Eso no se observó en el navegador. N-03 queda cumplido sólo para quien abre «Mi perfil» y toca la quinta pestaña. El arreglo es una línea en un archivo de otro dueño (destino `/my-account?pestana=puntos`), que este mismo cambio habilitó. Tiene que llegar coordinado con este PR o quedar declarado como pendiente con su dueño. | `despues-ruta-vieja-1440-claro` |
| H7R-02 | **MAYOR** | Al entrar por `?pestana=puntos` a 390, la pestaña activa queda fuera de la parte visible de la tira, sin marca, y el panel no nombra la sección. La persona ve «Todavía no hay nada acá» sin saber de qué. El mecanismo es heredado: la tira sólo se corre ante la elección de la persona (`tabs.ts:88-95`), y la ficha fija la pestaña desde la URL al construirse (`my-profile.ts:231-232`). Pero la entrada por URL es de este cambio (plan, H7.S1.M6), y es justamente la que va a recibir a todo el que venga de la dirección vieja cuando se corrija H7R-01. El README lo da «OK para este cambio». Discrepo: sin corregirlo, H7R-01 se arregla trasladando el problema al teléfono. | `despues-url-directa-390-claro` |
| H7R-03 | MENOR | «Editar» sigue a la vista y activo mientras se ve «Mis puntos». Según el código, al pulsarlo la pestaña activa pasa a estar deshabilitada y la tira salta a «Datos personales» (`tabs.ts:72-84`). No se observó. Un botón que edita las otras cuatro pestañas, al lado de una billetera que no se edita, invita a esperar otra cosa. | `despues-puntos-*`, `despues-url-directa-*` |
| H7R-04 | MENOR | En edición, «Mis puntos» aparece apagada y nada explica por qué. Sigue abierto H7-02 de la pasada anterior. | `despues-editor-*` salvo 390 |

##### Heredados (no cuentan para la nota)

| ID | Severidad | Hallazgo | Capturas |
|---|---|---|---|
| H7R-05 | MENOR | Detalles heredados: <br>• a 390 la quinta pestaña queda a tres toques de flecha y nada indica que existe; <br>• el vacío tiene un título genérico y el panel no tiene encabezado de sección; <br>• en oscuro, «Ver mis pedidos» y la miga «Panel» tienen menos contraste que el cuerpo (no se midió); <br>• «Demo» pisa el encabezado a 390 y 768, y las píldoras de la maqueta tocan la tarjeta a 1024; <br>• el ejemplo «María» se confunde con un valor; <br>• la línea decorativa de la barra lateral aparece en posiciones distintas en capturas del mismo tamaño (`despues-ficha-1440-claro` frente a `despues-puntos-1440-claro`): hay al menos una animación continua. Convendría confirmar que respeta el movimiento reducido. | Varias |

##### Defectos de la evidencia

| ID | Severidad | Hallazgo |
|---|---|---|
| H7R-E1 | MENOR | Siete capturas de «Mis puntos» (1440 claro y oscuro, 1920, 1024, 768 y 390 claro y oscuro) se tomaron con el puntero encima de la pestaña. Muestran el estado de cursor encima y no el de activa. Es H7-06 de la pasada anterior, que la recaptura no corrigió. El README lo explica, pero la recaptura era la oportunidad de sacar el puntero. |
| H7R-E2 | MENOR | La URL no se ve en `despues-url-directa-*` ni en `despues-ruta-vieja-1440-claro`. La ruta vieja es indistinguible de la ficha salvo por los contadores de la cabecera, que además no coinciden con el resto (3 y ninguno, frente a 4 y 2). O esa celda se tomó con la cabecera cargando, o los datos cambiaron. El README dice que cada celda se carga de cero, y eso no explica la diferencia. |
| H7R-E3 | MENOR | A 390 el editor no muestra la pestaña apagada, que queda detrás de la flecha. Que en el teléfono aparezca apagada descansa sólo en el guion. |
| H7R-E4 | MENOR | «61/61 comprobaciones en verde» incluye dos resultados negativos para el requisito, marcados como `ℹ`: la pestaña fuera de la vista al entrar por URL a 390 y la dirección vieja que abre «Datos personales». El README los declara como hallazgos, pero el conteo se lee como todo verde. |
| H7R-E5 | MENOR | Sólo se vio el vacío S3. El criterio de H7.S1 en el plan nombra «el saldo, canjear y el comprobante como hoy, dentro de la tarjeta», y no hay ninguna imagen de eso, ni de la carga ni del error. El README lo delega a `loyalty.spec.ts`, que no muestra cómo se ve. Hay tema oscuro sólo a 1440 y a 390. |

#### Notas por pantalla de H7

| Pantalla | Nota | Por qué |
|---|---|---|
| Ficha con cinco pestañas (P1 y P2) | ACEPTABLE CON RESERVAS | Sin hallazgos del cambio. Quedan los heredados de H7R-05 |
| Pestaña «Mis puntos», con un clic (P3 y P4) | ACEPTABLE CON RESERVAS | H7R-03, MENOR. Evidencia con reservas: H7R-E1 y H7R-E5 |
| Entrada por `?pestana=puntos` (P5 y P6) | **RECHAZADA** | H7R-02 a 390 |
| Dirección vieja `/my-account/loyalty` (P7) | **RECHAZADA** | H7R-01 |
| Editor con «Mis puntos» apagada (P8 y P9) | ACEPTABLE CON RESERVAS | H7R-04, MENOR. A 390 la evidencia no alcanza (H7R-E3) |

#### Estado de los hallazgos de la pasada anterior de H7

| Hallazgo anterior | Estado en la recaptura |
|---|---|
| H7-01: el menú lateral llevaba a la pantalla aparte | Resuelto en la base: el menú ya no tiene «Mis puntos». Su efecto se trasladó a H7R-01 |
| H7-02: la pestaña apagada no explica por qué | Sigue abierto (H7R-04) |
| H7-03: título genérico del vacío | Sigue (heredado, H7R-05) |
| H7-04: editor capturado a medio pintar | Resuelto: la barra lateral sale entera en las siete celdas |
| H7-05: a 375 la pestaña activa fuera de la tira | Resuelto al elegirla con un clic (P4). Confirmado al entrar por URL (H7R-02) |
| H7-06: capturas con el puntero encima | Sigue (H7R-E1) |
| H7-07: la URL no se ve | Sigue (H7R-E2) |
| H7-08: contraste de «Ver mis pedidos» y «Panel» en oscuro | Sigue (heredado, H7R-05) |
| Faltaban 390, 1024 y 1920 | Resuelto en tema claro. En oscuro siguen faltando 768, 1024 y 1920 |

---

### No cubierto

La matriz del repo tiene cinco viewports (390×844, 768×1024, 1024×768, 1440×900 y 1920×1080) y dos temas (claro y oscuro).

#### H6

| Pantalla | Celdas presentes | Celdas que faltan |
|---|---|---|
| «Mi perfil»: ficha con «Editar» | Claro: los cinco, más 360. Oscuro: 1440 y 390 | Oscuro a 1920, 1024 y 768 |
| Calendario: días y años | Igual que la ficha | Igual que la ficha. Además, flechas deshabilitadas, foco visible y puntero encima |
| El calendario en sus otros 21 consumidores | Ninguna | Toda la matriz, y en especial el modo fecha y hora a 1024×768 y el calendario dentro de otro diálogo |
| Las 23 excepciones justificadas | Ninguna | Al menos una celda por tipo (⊖, flechas del formulario, volver) con el globo a la vista |
| Formulario por páginas | Ninguna (el DOM se comparó) | No es necesaria para probar que nada cambió. Sí lo es para juzgar H6-07 |

**Por qué importa cada ausencia:**

- **Nombre largo:** a 390 «Editar» queda a unos 18 px del final del nombre. Con un nombre de cuatro partes largas no se sabe si baja, como a 360, o si el nombre se parte contra el botón.
- **Modo fecha y hora:** el panel suma el selector de hora. Con un renglón más en la cabecera, a 1024×768 «Confirmar» puede quedar debajo de un desplazamiento interno.
- **Teclado y lector de pantalla:** el orden cambió: el mes pasó delante de las flechas. Lo cubre `date-picker.spec.ts`, no el navegador, y el README lo declara.
- **Pantallas del médico:** van por separado, y el README lo declara.

#### H7

| Pantalla | Celdas presentes | Celdas que faltan |
|---|---|---|
| Ficha y pestaña «Mis puntos» | Claro: los cinco. Oscuro: 1440 y 390 | Oscuro a 1920, 1024 y 768 |
| Entrada por `?pestana=puntos` | Claro: 1440 y 390 | Oscuro, 768 y 1024 |
| Dirección vieja | Claro: 1440 | 390, que es donde se juntan H7R-01 y H7R-02, y el oscuro |
| Editor | Claro: los cinco. Oscuro: 1440 y 390 | Oscuro a 1920, 1024 y 768. A 390, la pestaña apagada a la vista |
| «Tus accesos» del Panel | Ninguna | La entrada «Mis puntos» y a dónde lleva (H7R-01) |

**Estados de la billetera dentro de la pestaña:** sólo se vio el vacío S3. No se vieron:

- el saldo, el canje y el comprobante;
- el diálogo de canje abierto desde una pestaña;
- la carga y el error.

**Interacciones sin evidencia:**

- Pulsar «Editar» estando en «Mis puntos» (H7R-03).
- Si cambiar de pestaña con un clic actualiza `?pestana=` en la URL, y qué hace el botón de atrás del navegador. Según el código, la URL se lee una sola vez al construir la ficha.
- Con teclado, si las flechas recorren la tira, si se saltan la pestaña apagada y si el foco es visible.

Nada de esto se ve en las capturas.

---

<!-- Ronda 3 -->

## Segunda pasada visual, repetida sobre las capturas corregidas: H6 (D-05) y H7 («Mis puntos»)

- Fecha: 2026-09-24
- Material revisado (todas las capturas se tomaron de nuevo):
  - `docs/frontend/evidence/d05-iconos-2026-09-23/`: 18 PNG `antes-*`, 28 PNG `despues-*`, `README.md`, `desborde-mi-perfil-antes.json` y `dom-formulario-por-paginas-{antes,despues}.json`.
  - `docs/frontend/evidence/mis-puntos-quinta-pestana-2026-09-23/`: 24 PNG `despues-*` y `README.md`.
  - Salidas del guion: `docs/trabajo/2026-09-23-perfil-medico-configurar-tu-perfil/evidencia/h6/pasada-antes.txt` (3/3), `.../h6/pasada-despues.txt` (171/171) y `.../h7/navegador-recaptura.txt` (61/61, con dos líneas `ℹ`).
- Se abrieron como imagen las 70 capturas: 46 de H6 y 24 de H7. Se leyeron completos los dos README y las tres salidas. Los dos JSON del formulario por páginas siguen siendo idénticos.
- Se leyó código para confirmar hallazgos, citado con `ruta:línea`. Leer código no cuenta como verificación: lo que sólo sale del código se marca «según el código, no observado».
- Postura: la misma de la pasada anterior. Se parte de que la entrega tiene defectos.
- Límite del método: sólo se miraron imágenes. El orden del teclado, el nombre accesible, que un clic no abra nada y la URL con la que se entró no se observan en una imagen.
- Regla de nota, sin cambios:
  - `RECHAZADA`: queda algún BLOQUEANTE o MAYOR del cambio o del requisito.
  - `ACEPTABLE CON RESERVAS`: sólo quedan MENOR del cambio.
  - `APROBADA`: no queda ningún hallazgo abierto.
  - Los heredados no cuentan para la nota.
  - Una pantalla o un estado que el cambio toca y que no tiene ninguna captura recibe `RECHAZADA`.
  - Ante la duda, va la nota más baja.
- Estados de los hallazgos anteriores:
  - `CERRADO`: con la captura que lo prueba.
  - `SIGUE`: el hallazgo no cambió.
  - `CAMBIA`: se resolvió en parte o cambió su alcance o su severidad.
  - Los hallazgos nuevos llevan un ID nuevo.

### Resumen de notas

| Hito | Pantalla | Nota | Motivo |
|---|---|---|---|
| H6 | «Mi perfil»: ficha con «Editar» | ACEPTABLE CON RESERVAS | Sólo MENOR del cambio (H6-05 y H6-06) |
| H6 | Calendario: días | ACEPTABLE CON RESERVAS | H6-01 cerrado. Quedan H6-03 y H6-04, MENOR |
| H6 | Calendario: años | ACEPTABLE CON RESERVAS | H6-03 y H6-04, MENOR |
| H6 | Calendario en la vitrina, modo fecha y hora | ACEPTABLE CON RESERVAS | H6-03, H6-04 y H6-E8, MENOR |
| H6 | Mapa del editor, punto guardado, botón «Quitar» | ACEPTABLE CON RESERVAS | H6-11, MENOR |
| H6 | Mapa: estado sin confirmar y los otros cinco consumidores (sin captura) | **RECHAZADA** | H6-E6, MAYOR |
| H6 | Alta del paciente: quitar la ubicación (sin captura) | **RECHAZADA** | H6-02 cambia de alcance: sigue abierto ahí como MAYOR |
| H6 | Formulario por páginas (sin captura, DOM idéntico) | ACEPTABLE CON RESERVAS | H6-07, MENOR |
| H7 | Ficha con cinco pestañas | ACEPTABLE CON RESERVAS | Sólo heredados. Evidencia con reservas (H7R-E5) |
| H7 | Pestaña «Mis puntos», elegida con un clic | ACEPTABLE CON RESERVAS | H7R-03, MENOR. H7R-E1 cerrado |
| H7 | Entrada por `?pestana=puntos` | **RECHAZADA** | H7R-02 sigue, MAYOR |
| H7 | Dirección vieja `/my-account/loyalty` | **RECHAZADA** | H7R-01 sigue, MAYOR |
| H7 | Editor con «Mis puntos» apagada | ACEPTABLE CON RESERVAS | H7R-04, MENOR |

---

### H6: «Editar», el calendario y el mapa con ícono y nombre (D-05)

Criterio del cliente (D-05, 22/09): «cada botón de acción tiene ícono + nombre». La única excepción es la del ADR-0012 §3: significado universal en su contexto, con `aria-label` y globo visible, justificada en una línea al lado del botón.

#### Capturas

Todas son de la ventana, no de la página entera.

**Después (28):**

| Archivo | Viewport | Tema | Estado |
|---|---|---|---|
| `despues-editar-{1440-claro, 1440-oscuro, 1920-claro, 1024-claro, 768-claro}.png` | 1440, 1920, 1024 y 768 | claro, y oscuro a 1440 | «Editar» a la derecha de la cabecera de la tarjeta |
| `despues-editar-390-{claro,oscuro}.png` | 390×844 | los dos | «Editar» al lado del nombre |
| `despues-editar-360-claro.png` | 360×800 | claro | «Editar» debajo de la identidad |
| `despues-calendario-dias-{1440-claro, 1440-oscuro, 1920-claro, 1024-claro, 768-claro, 390-claro, 390-oscuro, 360-claro}.png` | los cinco del repo, más 360 | claro, y oscuro a 1440 y 390 | Días de junio de 1990, con el 21 marcado |
| `despues-calendario-anios-{mismas ocho celdas}.png` | Igual | Igual | Años 1970–1999, con 1990 marcado |
| `despues-vitrina-fecha-y-hora-{1440,390}-claro.png` | 1440 y 390 | claro | Otro consumidor en modo fecha y hora, septiembre de 2026 |
| `despues-mapa-quitar-{1440,390}-claro.png` | 1440 y 390 | claro | Editor › Contacto, mapa del domicilio con el punto guardado |

**Antes, referencia (18):**

- «Editar» en sus ocho celdas.
- El calendario, días y años, a 1440, 390 y 360 en claro.
- La vitrina en modo fecha y hora, a 1440 y 390 en claro.
- El mapa, a 1440 y 390 en claro.

#### Las diez preguntas, por captura o por grupo

##### G1 · «Editar» a 1440 (claro y oscuro), 1920, 1024 y 768

Las capturas son iguales a las de la pasada anterior.

1. **Lo primero que se ve mal:** nada del cambio. En la misma tarjeta, «Cambiar contraseña» es de sólo texto (H6-09).
2. **Texto cortado o solapado:** no hay. A 768 la etiqueta «Demo» pisa el encabezado (heredado).
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente. Usa el mismo contorno y el mismo alto que «Cambiar contraseña».
5. **Tema oscuro:** el borde y el texto se leen sobre la tarjeta oscura.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** correcta.
8. **Datos:** sintéticos de maqueta («Ana Lucía Pérez Quiroga», «PAC-20000», «5000000»).
9. **¿Muestra el requisito?** Sí para «Editar».
10. **Motivo de rechazo:** nada del cambio.

##### G2 · «Editar» a 390 (claro y oscuro)

1. **Lo primero que se ve mal:** «Editar» queda a unos 18 px del final del nombre. No hay captura con un nombre largo.
2. **Texto cortado o solapado:** no hay.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente con los anchos mayores.
5. **Tema oscuro:** se lee.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** correcta.
8. **Datos:** igual que G1.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** nada MAYOR.

##### G3 · «Editar» a 360

1. **Lo primero que se ve mal:** «Editar» sigue bajando y alineándose con el avatar, no con el nombre (H6-05, sigue).
2. **Texto cortado o solapado:** el avatar del encabezado sale cortado. Es el desborde heredado de 4 px.
3. **¿Terminado o prototipo?** Funciona, pero la posición se ve improvisada.
4. **Coherencia con el producto:** en los demás anchos el botón va a la derecha.
5. **Tema oscuro:** no aplica. No hay captura oscura a 360.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** el botón empuja la tira de pestañas hacia abajo.
8. **Datos:** igual que G1.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** H6-05, MENOR.

##### G4 · Calendario, días, a 1440 (claro y oscuro), 1920, 1024 y 768

1. **Lo primero que se ve mal:**
   - Los cuatro botones siguen diciendo «Año · Mes · Mes · Año» (H6-03).
   - Arriba dice «Cerrar» y abajo «Cancelar», y los dos hacen lo mismo (H6-04).
2. **Texto cortado o solapado:** no hay. Con el relleno menor, los grupos de flechas se ven un poco más apretados, pero siguen legibles.
3. **¿Terminado o prototipo?** Terminado. La cabecera sigue unos 44 px más alta que en la referencia: la distancia del título a los días pasa de 112 a unos 156 px.
4. **Coherencia con el producto:** en el mismo diálogo conviven botones con ícono y nombre, y botones de sólo texto (H6-09).
5. **Tema oscuro:** se lee todo, y «Confirmar» va en aqua con texto oscuro.
6. **¿El estado orienta?** No aplica. No hay captura de las flechas deshabilitadas.
7. **Jerarquía:** «Confirmar» es el primario.
8. **Datos:** fecha de nacimiento sintética.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** sólo MENOR.

##### G5 · Calendario, días, a 390 (claro y oscuro)

1. **Lo primero que se ve mal:** en el centro, «‹ Mes» y «Mes ›» quedan separados por unos 80 px. Se sigue leyendo «Mes Mes» (H6-03).
2. **Texto cortado o solapado:** no hay. Las cuatro flechas van en un renglón.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente con G4.
5. **Tema oscuro:** se lee.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** correcta.
8. **Datos:** igual que G4.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** sólo MENOR.

##### G6 · Calendario, días, a 360: `despues-calendario-dias-360-claro.png`

1. **Lo primero que se ve mal:** ya no hay escalera. Queda lo mismo que en G5 (H6-03).
2. **Texto cortado o solapado:**
   - «‹‹ Año» y «‹ Mes» a la izquierda, «Mes ›» y «Año ››» a la derecha, las cuatro en un renglón.
   - Entre los dos grupos quedan unos 50 px.
   - No hay desborde.
3. **¿Terminado o prototipo?** Terminado. La distancia del título a los días es de unos 157 px, igual que en los otros anchos. En la pasada anterior era de unos 199 px.
4. **Coherencia con el producto:** ahora es coherente con los otros siete anchos.
5. **Tema oscuro:** no aplica. No hay captura oscura a 360.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** «Confirmar» a la vista y la navegación en un renglón.
8. **Datos:** igual que G4.
9. **¿Muestra el requisito?** Sí. El README afirma que las flechas entran en un renglón «hasta 320 px», y no hay captura ni celda del guion por debajo de 360 (H6-E7).
10. **Motivo de rechazo:** nada MAYOR. **H6-01 queda cerrado.**

##### G7 · Calendario, años (las ocho celdas)

1. **Lo primero que se ve mal:** «30 años» sigue igual a los dos lados (H6-03).
2. **Texto cortado o solapado:** no hay.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente con el panel de días.
5. **Tema oscuro:** se lee, y 1990 va en aqua.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** correcta.
8. **Datos:** igual que G4.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** sólo MENOR.

##### G8 · Vitrina en modo fecha y hora: `despues-vitrina-fecha-y-hora-{1440,390}-claro.png` (nuevas)

1. **Lo primero que se ve mal:** lo mismo que G4, con «Mes Mes» y «Cerrar» junto a «Cancelar».
2. **Texto cortado o solapado:**
   - No hay a 1440 ni a 390. La fila «Hora» entra debajo de la grilla.
   - A 390, el título «Seleccionar fecha y hora» y «× Cerrar» ocupan casi todo el renglón. Quedan unos 14 px libres.
   - A 360, con unos 30 px menos de ancho útil, la estimación es que no entran en un renglón (H6-E8, no observado).
3. **¿Terminado o prototipo?** Terminado. El panel pasa de unos 545 px de alto a unos 590.
4. **Coherencia con el producto:** es coherente con el calendario del editor. Confirma que la barra no depende del consumidor. Según el código, ningún otro archivo de estilos toca `.calendar-nav` ni `.nav-controls`.
5. **Tema oscuro:** no aplica. No hay captura oscura de este modo.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** correcta.
8. **Datos:** sin datos de personas.
9. **¿Muestra el requisito?** Sí en los dos anchos.
10. **Motivo de rechazo:** nada MAYOR. H6-E1 baja a MENOR.

##### G9 · Mapa del editor: `despues-mapa-quitar-{1440,390}-claro.png` (nuevas)

1. **Lo primero que se ve mal:**
   - En el mismo renglón, «Volver a ubicarme» va sin ícono y «⊖ Quitar» va con ícono y nombre. Son dos botones fantasma vecinos con tratamientos distintos (H6-09).
   - «Volver a ubicarme» sigue unos 14 px corrido respecto de la columna (heredado de H5).
2. **Texto cortado o solapado:**
   - No hay en el renglón.
   - La captura corta el borde superior del mapa y deja fuera el campo del domicilio. La imagen sola no dice de qué dirección es ese «Quitar»: lo dice el nombre accesible, que no se ve (H6-E6).
   - A 390, la barra fija «Cancelar / Guardar cambios» tapa la ayuda del correo (heredado).
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente con «Editar» y el calendario: ícono a la izquierda y nombre.
5. **Tema oscuro:** no aplica. No hay captura oscura del mapa.
6. **¿El estado orienta?** Las dos ayudas bajo el mapa orientan.
7. **Jerarquía:** los dos botones son secundarios y ninguno compite.
8. **Datos:** la dirección de trabajo «Av. Cañoto esq. Landívar, piso 3» y el correo `ana-perez@correo.mock` son sintéticos.
9. **¿Muestra el requisito?** Sí, en el estado de punto guardado. De los tres estados del botón, las capturas cubren uno.
10. **Motivo de rechazo:**
    - H6-E6: falta el estado más cargado, el de sin confirmar con tres botones, y faltan los otros cinco consumidores.
    - H6-02 en el alta del paciente.

##### G10 · Las 18 referencias `antes-*`

1. **Lo primero que se ve mal:** es el estado previo: el lápiz solo, la cruz sola, las flechas de sólo ícono y el ⊖ solo junto a «Volver a ubicarme».
2. **Texto cortado o solapado:** `antes-editar-360-claro` confirma que el desborde de 4 px es heredado.
3. a 7. No aplican. Son referencia y coinciden con lo que describe el README.
8. **Datos:** sintéticos.
9. **¿Muestra el requisito?** Sirven para comparar. La vitrina de referencia (panel de unos 545 px) permite medir el crecimiento del modo fecha y hora.
10. **Motivo de rechazo:** no aplica.

#### Estado de los hallazgos anteriores de H6

| ID | Estado | Severidad | Detalle |
|---|---|---|---|
| H6-01 | **CERRADO** | — | La escalera a 360 desapareció: las cuatro flechas van en un renglón y la cabecera mide lo mismo que en los otros anchos. Prueba: `despues-calendario-dias-360-claro.png`. Corrección en `date-picker.css:244` (`.nav-controls > [app-button]`) |
| H6-02 | **CAMBIA** | **MAYOR** | Cerrado en el componente `ubicacion-picker` (tres estados, `ubicacion-picker.html:36`, `:80` y `:122`), con prueba en `despues-mapa-quitar-{1440,390}-claro.png`. **Sigue abierto en el alta del paciente**, que tiene sus propias seis copias del mismo botón. Siguen de sólo ícono, con el mismo ⊖ y la justificación «quitar un elemento»: `register-patient.html:333`, `:378`, `:426`, `:612`, `:653` y `:699`. El README (líneas 13 a 15) explica por qué ese botón no califica como excepción: no hay lista y se lee como «alejar». El mismo razonamiento vale sin cambios para el alta, que en la pasada de H5 se vio con el mismo mapa y el mismo zoom. Además el README (línea 16) dice que las excepciones que quedan son de «quitar un elemento de una lista», y esas seis no lo son. El mismo paciente ve «⊖ Quitar» en su editor y «⊖» solo al darse de alta |
| H6-03 | SIGUE | MENOR | «Año · Mes · Mes · Año» y «30 años» a los dos lados. Afecta también la vitrina |
| H6-04 | SIGUE | MENOR | «Cerrar» y «Cancelar» hacen lo mismo, también en modo fecha y hora |
| H6-05 | SIGUE | MENOR | A 360 «Editar» baja alineado con el avatar |
| H6-06 | SIGUE | MENOR | El README ya cita `mi-perfil-paciente.mjs:93-94` y `:99`, pero sigue sin decir con quién quedó acordada su actualización |
| H6-07 | SIGUE | MENOR | «Siguiente» de sólo ícono en las altas, registrado como Q-I11 y abierto |
| H6-08 | SIGUE (heredado) | MAYOR | El globo queda debajo del `<dialog>` modal |
| H6-09 | SIGUE (heredado, a confirmar) | MAYOR | Los botones de sólo texto. Ahora también se ve en el mapa: «Volver a ubicarme», «Usar mi ubicación» y «Marcar mi trabajo en el mapa» van sin ícono al lado de «⊖ Quitar». Según el código, en el estado sin confirmar se suma «Confirmar dirección actual» (`ubicacion-picker.html:106-114`) |
| H6-10 | SIGUE (heredado) | MENOR | Los detalles de la cabecera, «Demo», las píldoras de la maqueta y la miga «Panel» en oscuro |
| H6-E1 | **CAMBIA** | MAYOR → **MENOR** | La vitrina muestra el organismo en su otro modo, a 1440 y 390. Según el código, ningún consumidor le pone estilos a la barra. Queda sin ver el calendario dentro de otro diálogo (`dependent-form-dialog.html:62`) y el modo fecha y hora a 1024×768. Con un panel de unos 590 px en un alto útil de 736, el riesgo es bajo |
| H6-E2 | SIGUE | MENOR | Ninguna captura muestra una de las 20 excepciones con su globo. Ahora el README lo declara (línea 152) |
| H6-E3 | SIGUE | MENOR | Oscuro sólo a 1440 y 390, y ningún estado de las flechas: deshabilitadas, con foco o con el puntero encima. Declarado en el README |
| H6-E4 | SIGUE | MENOR | Tres puntos: <br>• `pasada-antes.txt` (línea 2) sigue guardando una ruta absoluta del equipo donde se corrió, y las dos salidas siguen nombrando el entorno en que se sirvió la app; <br>• `PLAN.md` (H6.S1.M5) y `REPORTE.md` (líneas 16, 67 y 118) siguen en «92/92» y «23 capturas»; <br>• H6.S1.M7 y H6.S1.M8 siguen en `TODO` aunque sus capturas ya existen |
| H6-E5 | **CAMBIA** | MENOR | Cerrado lo de `:99` (README, línea 138). La observación 2 sigue sin nombrar `register-practitioner.html:57`, que también enciende `[iconOnlyNav]` |

#### Hallazgos nuevos de H6

| ID | Severidad | Tipo | Hallazgo |
|---|---|---|---|
| H6-11 | MENOR | Del cambio | El rótulo visible es «Quitar» a secas. En la pestaña «Contacto» hay dos mapas, casa y trabajo, y los dos pueden mostrar un «Quitar» igual. El nombre accesible los distingue («…de tu casa» y «…de tu trabajo»), pero a la vista sólo los separa la cercanía. Junto a un bloque que también tiene el campo de dirección escrita, «Quitar» se puede leer como «quitar la dirección». «Quitar ubicación» diría lo mismo sin ambigüedad |
| H6-E6 | **MAYOR** | De la evidencia | La corrección de H6-02 cambió un componente que montan seis plantillas: los editores del paciente y del médico, y las altas de profesional, organización, laboratorio y centro de imagen. Lo cambió en sus tres estados. Las capturas cubren un solo estado, el del punto guardado, de un solo consumidor y sólo en claro. Falta el estado sin confirmar, que es el más cargado: según el código, pone «Confirmar dirección actual», «Volver a ubicarme» y «⊖ Quitar» en una fila con salto de línea (`ubicacion-picker.html:105-137`, `ubicacion-picker.css:33-38`). A 390, esa fila no entra en un renglón, y es justo la que la pasada de H5 no llegó a ver en el teléfono. Las celdas vecinas del mismo componente se vuelven a capturar después de una corrección |
| H6-E7 | MENOR | De la evidencia | El README (líneas 11 a 12 y 113) afirma que las cuatro flechas entran en un renglón «hasta 320 px», y el criterio de H6.S1.M7 en `PLAN.md` fija el rango en 320 a 1920. La celda más angosta del guion y de las capturas es 360. El límite de 320 no está demostrado |
| H6-E8 | MENOR | De la evidencia | El modo fecha y hora se vio a 1440 y 390, y no a 360. A 390, el título «Seleccionar fecha y hora» y «× Cerrar» dejan unos 14 px libres. A 360 el ancho útil baja unos 30 px, así que la estimación sobre la imagen es que el título se parte en dos renglones o el botón se aprieta. No se observó. Lo causa el nombre que se agregó a «Cerrar» |

#### Notas por pantalla de H6

| Pantalla | Nota | Por qué |
|---|---|---|
| «Mi perfil»: ficha con «Editar» | ACEPTABLE CON RESERVAS | H6-05 y H6-06, MENOR. H6-09 (MAYOR heredado) pendiente de confirmar |
| Calendario: días | ACEPTABLE CON RESERVAS | H6-01 cerrado. Quedan H6-03 y H6-04, MENOR |
| Calendario: años | ACEPTABLE CON RESERVAS | H6-03 y H6-04 |
| Calendario en la vitrina, modo fecha y hora | ACEPTABLE CON RESERVAS | H6-03, H6-04 y H6-E8 |
| Mapa del editor, punto guardado | ACEPTABLE CON RESERVAS | H6-11, MENOR |
| Mapa: estado sin confirmar y los otros cinco consumidores (sin captura) | **RECHAZADA** | H6-E6: no hay imagen del estado ni de los consumidores que el cambio tocó |
| Alta del paciente: quitar la ubicación (sin captura) | **RECHAZADA** | H6-02 sigue abierto ahí: seis botones de sólo ícono con una justificación que el propio README descarta |
| Formulario por páginas | ACEPTABLE CON RESERVAS | DOM idéntico. Queda H6-07 (Q-I11) |

---

### H7: «Mis puntos» como quinta pestaña (N-03), segunda recaptura

Criterio del cliente (N-03, 22/09): la billetera de puntos deja de ser una pantalla aparte con su propia cabecera y pasa a ser la quinta pestaña de «Mi perfil», dentro de la misma tarjeta. En el editor, la pestaña aparece apagada.

#### Capturas

Son de la página entera, según el README.

| Archivo | Tamaño de la imagen | Tema | Estado |
|---|---|---|---|
| `despues-ficha-{1440-claro, 1440-oscuro, 1920-claro, 1024-claro, 768-claro}.png` | Viewport completo | claro, y oscuro a 1440 | Ficha en «Datos personales», cinco pestañas |
| `despues-ficha-390-{claro,oscuro}.png` | 390×994 | los dos | Igual. La tira muestra dos pestañas |
| `despues-puntos-{1440-claro, 1440-oscuro, 1920-claro, 1024-claro, 768-claro}.png` | Viewport completo | claro, y oscuro a 1440 | «Mis puntos» con un clic, vacío S3, sin el puntero encima |
| `despues-puntos-390-{claro,oscuro}.png` | 390×844 | los dos | La tira se corrió hasta la pestaña |
| `despues-url-directa-1440-claro.png` | 1440×900 | claro | Entrada por `?pestana=puntos` |
| `despues-url-directa-390-claro.png` | 390×844 | claro | Igual. La pestaña activa no está a la vista |
| `despues-ruta-vieja-1440-claro.png` | 1440×900 | claro | Entrada por `/my-account/loyalty`. Termina en «Datos personales» |
| `despues-editor-{1440-claro, 1440-oscuro, 1920-claro, 1024-claro, 768-claro}.png` | De 1067 a 1605 de alto | claro, y oscuro a 1440 | Edición, «Mis puntos» apagada |
| `despues-editor-390-{claro,oscuro}.png` | 390×1648 | los dos | La pestaña apagada queda fuera de la tira visible |

#### Las diez preguntas, por grupo

##### P1 · Ficha a 1440 (claro y oscuro), 1920, 1024 y 768

1. **Lo primero que se ve mal:** nada del cambio.
2. **Texto cortado o solapado:** no hay. A 1024 las píldoras de la maqueta tocan el borde inferior de la tarjeta, y a 768 «Demo» pisa el encabezado (heredados).
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** las cinco pestañas tienen el mismo tratamiento.
5. **Tema oscuro:** se lee. La miga «Panel» está apagada (heredado).
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** «Datos personales» activa, con subrayado y rótulo de marca.
8. **Datos:** sintéticos de maqueta.
9. **¿Muestra el requisito?** Sí: cinco pestañas y «Mis puntos» al final.
10. **Motivo de rechazo:** nada del cambio.

##### P2 · Ficha a 390 (claro y oscuro)

1. **Lo primero que se ve mal:** «Mis puntos» no se ve, porque queda a tres toques de flecha (heredado, H7R-05).
2. **Texto cortado o solapado:** no hay.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es el comportamiento de la tira en todo el producto.
5. **Tema oscuro:** se lee.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** correcta.
8. **Datos:** igual que P1.
9. **¿Muestra el requisito?** La pestaña existe. Se ve en P4.
10. **Motivo de rechazo:** sólo heredado.

##### P3 · «Mis puntos» con un clic, a 1440 (claro y oscuro), 1920, 1024 y 768

1. **Lo primero que se ve mal:** «Editar» sigue en la cabecera de la tarjeta sobre una billetera que no se edita (H7R-03). **El gris de puntero encima desapareció:** la pestaña activa tiene sólo subrayado y rótulo de marca, igual que al entrar por la URL. H7R-E1 queda cerrado.
2. **Texto cortado o solapado:** no hay.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** ahora el estado activo es el mismo en las siete capturas y en la entrada por URL.
5. **Tema oscuro:** «Ver mis pedidos» sigue más apagado que el cuerpo del texto (heredado).
6. **¿El estado orienta?** Sí: el vacío S3 explica por qué está vacío y ofrece una salida. El título es genérico (heredado).
7. **Jerarquía:** correcta. En oscuro, la salida pesa menos que el texto.
8. **Datos:** no se ven datos de la billetera.
9. **¿Muestra el requisito?** Sí: la billetera está dentro de la tarjeta y hay una sola cabecera.
10. **Motivo de rechazo:** nada MAYOR.

##### P4 · «Mis puntos» con un clic, a 390 (claro y oscuro)

1. **Lo primero que se ve mal:** nada nuevo. La pestaña activa se ve limpia, sin el gris.
2. **Texto cortado o solapado:** no hay. La tira muestra «Seguros y tutores | Mis puntos».
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente con los anchos mayores.
5. **Tema oscuro:** el enlace se ve apagado (heredado).
6. **¿El estado orienta?** Sí.
7. **Jerarquía:** correcta.
8. **Datos:** no se ven.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** nada MAYOR.

##### P5 · `despues-url-directa-1440-claro.png`

1. **Lo primero que se ve mal:** nada roto.
2. **Texto cortado o solapado:** no hay.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es idéntica a P3 a 1440.
5. **Tema oscuro:** no aplica. No hay captura oscura de esta entrada.
6. **¿El estado orienta?** Sí.
7. **Jerarquía:** correcta.
8. **Datos:** no se ven.
9. **¿Muestra el requisito?** Muestra la billetera abierta. La URL no se ve en la imagen (H7R-E2).
10. **Motivo de rechazo:** nada propio de esta celda.

##### P6 · `despues-url-directa-390-claro.png`

1. **Lo primero que se ve mal:** la captura no cambió. La tira muestra «Datos personales | Contacto | F…» sin marca, y el panel dice «Todavía no hay nada acá» sin nombrar la sección (H7R-02).
2. **Texto cortado o solapado:** el comienzo de «Facturación» asoma cortado junto a la flecha.
3. **¿Terminado o prototipo?** Está a medio resolver: hay un contenido abierto que no corresponde a ninguna pestaña visible.
4. **Coherencia con el producto:** es incoherente con P4.
5. **Tema oscuro:** no aplica.
6. **¿El estado orienta?** No dice dónde está la persona.
7. **Jerarquía:** la vista cae en un vacío sin título de sección.
8. **Datos:** no se ven.
9. **¿Muestra el requisito?** No. La entrada por `?pestana=` es de este cambio (plan, H7.S1.M6). El README (líneas 8 y 9) la llama ahora «medición que no es criterio de este cambio». Discrepo por la misma razón que en la pasada anterior.
10. **Motivo de rechazo:** H7R-02.

##### P7 · `despues-ruta-vieja-1440-claro.png`

1. **Lo primero que se ve mal:** la dirección que era «Mis puntos» sigue abriendo «Datos personales» (H7R-01).
2. **Texto cortado o solapado:** no hay.
3. **¿Terminado o prototipo?** La pantalla sí.
4. **Coherencia con el producto:** ahora la cabecera muestra 4 y 2, igual que las demás. La diferencia de contadores de la pasada anterior desapareció.
5. **Tema oscuro:** no aplica.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** correcta para una ficha.
8. **Datos:** sintéticos.
9. **¿Muestra el requisito?** No, para quien entra por la dirección vieja. Según el código, la redirección sigue en `app.routes.ts:1072` sin cambios.
10. **Motivo de rechazo:** H7R-01.

##### P8 · Editor a 1440 (claro y oscuro), 1920, 1024 y 768

1. **Lo primero que se ve mal:** «Mis puntos» aparece apagada sin explicar por qué (H7R-04).
2. **Texto cortado o solapado:** no hay. La barra lateral sale entera. «+ Agregar otro nombre» flota en una columna vacía (heredado).
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** la pestaña apagada usa el gris de deshabilitado del sistema.
5. **Tema oscuro:** la pestaña apagada se distingue sin desaparecer.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** «Guardar cambios» es el primario.
8. **Datos:** el ejemplo «María» se confunde con un valor (heredado).
9. **¿Muestra el requisito?** Sí. Que «pulsarla no abre nada» no se observa en una imagen.
10. **Motivo de rechazo:** H7R-04, MENOR.

##### P9 · Editor a 390 (claro y oscuro)

1. **Lo primero que se ve mal:** la pestaña apagada no aparece, porque queda detrás de la flecha (H7R-E3).
2. **Texto cortado o solapado:** no hay.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente.
5. **Tema oscuro:** se lee.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** correcta.
8. **Datos:** igual que P8.
9. **¿Muestra el requisito?** No muestra la pestaña apagada en el teléfono.
10. **Motivo de rechazo:** evidencia insuficiente. No hay un defecto visible.

#### Estado de los hallazgos anteriores de H7

| ID | Estado | Severidad | Detalle |
|---|---|---|---|
| H7R-01 | SIGUE | **MAYOR** | `/my-account/loyalty` sigue terminando en «Datos personales» (`despues-ruta-vieja-1440-claro.png`). Según el código, «Tus accesos» del Panel sigue ofreciendo esa dirección. Ninguna puerta fuera de la tira lleva a la billetera |
| H7R-02 | SIGUE | **MAYOR** | Al entrar por `?pestana=puntos` a 390, la pestaña activa sigue fuera de la vista (`despues-url-directa-390-claro.png`) |
| H7R-03 | SIGUE | MENOR | «Editar» sigue visible y activo sobre la billetera |
| H7R-04 | SIGUE | MENOR | La pestaña apagada sigue sin explicar por qué |
| H7R-05 | SIGUE (heredado) | MENOR | La quinta pestaña queda escondida a 390, el vacío tiene un título genérico, hay poco contraste en oscuro, y «Demo» y las píldoras de la maqueta tapan contenido |
| H7R-E1 | **CERRADO** | — | Ninguna pestaña sale con el fondo de puntero encima. Prueba: `despues-puntos-1440-claro.png`, `-1440-oscuro`, `-1920-claro`, `-1024-claro`, `-768-claro` y `-390-{claro,oscuro}` |
| H7R-E2 | **CAMBIA** | MENOR | Cerrada la mitad de los contadores: la ruta vieja ahora muestra 4 y 2, como el resto. Sigue la otra mitad: la URL no se ve en `despues-url-directa-*` ni en `despues-ruta-vieja-*`, y lo sostiene sólo el guion |
| H7R-E3 | SIGUE | MENOR | A 390 el editor no muestra la pestaña apagada |
| H7R-E4 | **CERRADO** | — | El README (líneas 8 y 9) declara que las dos mediciones informativas dan negativo y remite a los hallazgos 1 y 2. Discrepo de que no sean criterio del cambio (ver H7R-02) |
| H7R-E5 | SIGUE | MENOR | Sólo el vacío S3, y oscuro sólo a 1440 y 390 |

#### Hallazgos nuevos de H7

| ID | Severidad | Tipo | Hallazgo |
|---|---|---|---|
| H7R-E6 | MENOR | De la evidencia | El README (líneas 15 a 17) dice que cada foto se toma «después de esperar a que no quede ninguna animación en curso». Pero la línea decorativa de la barra lateral aparece en posiciones distintas en capturas del mismo tamaño: `despues-ficha-1440-claro`, `despues-puntos-1440-claro` y `despues-editor-1440-claro`. Hay una animación continua que la espera no cubre. No arruina ninguna captura, pero la afirmación es más fuerte que lo que se ve. Queda sin confirmar si esa animación respeta la preferencia de movimiento reducido |

#### Notas por pantalla de H7

| Pantalla | Nota | Por qué |
|---|---|---|
| Ficha con cinco pestañas (P1 y P2) | ACEPTABLE CON RESERVAS | Sin hallazgos del cambio. Quedan los heredados de H7R-05 y la evidencia de H7R-E5 |
| Pestaña «Mis puntos», con un clic (P3 y P4) | ACEPTABLE CON RESERVAS | H7R-03, MENOR. H7R-E1 cerrado |
| Entrada por `?pestana=puntos` (P5 y P6) | **RECHAZADA** | H7R-02 |
| Dirección vieja `/my-account/loyalty` (P7) | **RECHAZADA** | H7R-01 |
| Editor con «Mis puntos» apagada (P8 y P9) | ACEPTABLE CON RESERVAS | H7R-04, MENOR. A 390 la evidencia no alcanza (H7R-E3) |

---

### No cubierto

La matriz del repo tiene cinco viewports (390×844, 768×1024, 1024×768, 1440×900 y 1920×1080) y dos temas.

#### H6

| Pantalla | Celdas presentes | Celdas que faltan |
|---|---|---|
| «Mi perfil» con «Editar» | Claro: los cinco, más 360. Oscuro: 1440 y 390 | Oscuro a 1920, 1024 y 768. Un nombre largo a 390 |
| Calendario en el editor, días y años | Igual | Igual. Flechas deshabilitadas, foco y puntero encima. Por debajo de 360 (H6-E7) |
| Calendario en modo fecha y hora | Claro: 1440 y 390 | 360 (H6-E8), 1024×768, 768, 1920 y oscuro. El calendario dentro de otro diálogo |
| Mapa, botón «Quitar» | Estado de punto guardado, claro, 1440 y 390, en el editor del paciente | Estado inicial y estado sin confirmar. Los otros cinco consumidores: editor del médico y altas de profesional, organización, laboratorio y centro de imagen. El oscuro. Todo esto es H6-E6 |
| Alta del paciente, quitar la ubicación | Ninguna | Todo. Es donde H6-02 sigue abierto |
| Las 20 excepciones con su globo | Ninguna | Al menos una por tipo, con el globo a la vista (H6-E2) |

**Por qué importa cada ausencia:**

- **Estado sin confirmar del mapa, a 390:** tres botones en una fila con salto de línea. Es la fila que la persona ve apenas toca el mapa, y ninguna pasada la mostró en el teléfono.
- **Sucursales del laboratorio y de imagenología:** en la pasada de H5 esa tarjeta tenía dos ⊖ con funciones distintas. Con «Quitar» al lado de uno, la confusión puede resolverse o no. No se vio.
- **Modo fecha y hora a 360:** según la estimación sobre la captura de 390, la cabecera del diálogo no entra en un renglón.

#### H7

| Pantalla | Celdas presentes | Celdas que faltan |
|---|---|---|
| Ficha y pestaña | Claro: los cinco. Oscuro: 1440 y 390 | Oscuro a 1920, 1024 y 768 |
| Entrada por URL | Claro: 1440 y 390 | Oscuro, 768 y 1024 |
| Dirección vieja | Claro: 1440 | 390, donde se juntan H7R-01 y H7R-02, y el oscuro |
| Editor | Claro: los cinco. Oscuro: 1440 y 390 | Oscuro a 1920, 1024 y 768. A 390, la pestaña apagada a la vista |
| «Tus accesos» del Panel | Ninguna | La entrada «Mis puntos» y a dónde lleva (H7R-01) |

**Estados de la billetera y otras interacciones sin evidencia:**

- Estados de la billetera: saldo, canje, comprobante, carga y error.
- Pulsar «Editar» estando en «Mis puntos».
- Si cambiar de pestaña actualiza `?pestana=`.
- El recorrido de la tira con teclado.

Nada de esto se ve en las capturas.

---

<!-- Ronda 4 -->

## Segunda pasada visual, tercera vez: H6 (D-05) y H7 («Mis puntos»)

- Fecha: 2026-09-24
- Material revisado:
  - `docs/frontend/evidence/d05-iconos-2026-09-23/`: se volvieron a tomar todas las capturas.
    - 27 PNG `antes-*` y 37 PNG `despues-*`.
    - `README.md`.
    - `desborde-mi-perfil-antes.json` y `dom-formulario-por-paginas-{antes,despues}.json`. Los dos del formulario por páginas siguen idénticos.
  - `docs/frontend/evidence/mis-puntos-quinta-pestana-2026-09-23/README.md`, modificado en esta ronda.
    - Sus 24 capturas no cambiaron desde la ronda anterior (mismo código y mismo guion), así que se arrastra lo que se vio de ellas.
  - Salidas del guion:
    - `docs/trabajo/2026-09-23-perfil-medico-configurar-tu-perfil/evidencia/h6/pasada-antes.txt` (3/3).
    - `.../h6/pasada-despues.txt` (208/208).
    - `.../h6/iconos.md` (14 excepciones y 17 a texto).
- Se abrieron como imagen las 64 capturas de H6.
- Se leyó código para confirmar hallazgos, citado con `ruta:línea`. Leer código no cuenta como verificación: lo que sale sólo del código se marca «según el código, no observado».
- Postura: la misma de las pasadas anteriores. Se parte de que la entrega tiene defectos.
- Límite del método: sólo se miraron imágenes. El nombre accesible, el orden del teclado y el efecto de un clic no se observan en una imagen.
- Regla de nota, sin cambios:
  - `RECHAZADA`: queda algún BLOQUEANTE o MAYOR del cambio o del requisito.
  - `ACEPTABLE CON RESERVAS`: sólo quedan MENOR del cambio.
  - `APROBADA`: no queda ningún hallazgo abierto.
  - Los heredados no cuentan para la nota.
  - Un estado que el cambio toca y que no tiene ninguna captura recibe `RECHAZADA`, salvo que sea el mismo componente, sin estilos propios del consumidor, y que sus estados más cargados ya se hayan visto. Es el mismo criterio que se aplicó al calendario en la ronda anterior.
  - Ante la duda, va la nota más baja.
- Estados de los hallazgos anteriores:
  - `CERRADO`: con la captura que lo prueba.
  - `SIGUE`: el hallazgo no cambió.
  - `CAMBIA`: se resolvió en parte, o cambió su alcance o su severidad.
  - Los hallazgos nuevos llevan un ID nuevo.

### Resumen de notas

| Hito | Pantalla | Nota | Motivo |
|---|---|---|---|
| H6 | «Mi perfil»: ficha con «Editar» | ACEPTABLE CON RESERVAS | H6-05 y H6-06, MENOR |
| H6 | Calendario: días | ACEPTABLE CON RESERVAS | H6-03 y H6-04, MENOR |
| H6 | Calendario: años | ACEPTABLE CON RESERVAS | H6-03 y H6-04, MENOR |
| H6 | Calendario en la vitrina, modo fecha y hora (1440, 390 y 360) | ACEPTABLE CON RESERVAS | H6-03, H6-04 y H6-E8, MENOR. H6-E8 ahora está observado y declarado |
| H6 | Mapa compartido en el editor: punto guardado y sin confirmar | ACEPTABLE CON RESERVAS | Sin MENOR del cambio. Evidencia con reservas: H6-E6 y H6-E9 |
| H6 | Mapas, estado **sin punto**: alta del paciente (capturada) y mapa compartido (sin captura) | **RECHAZADA** | H6-12, MAYOR del cambio: dice «Quitar la ubicación» cuando todavía no hay ninguna |
| H6 | Alta del paciente, mapa: sin confirmar y confirmada | ACEPTABLE CON RESERVAS | Sin MENOR del cambio. Evidencia con reservas: H6-E6 |
| H6 | Mapa compartido en los otros cinco consumidores (sin captura) | ACEPTABLE CON RESERVAS | Mismo componente y ningún consumidor le pone estilos a la fila. H6-E6 es MENOR |
| H6 | Formulario por páginas (sin captura, DOM idéntico) | ACEPTABLE CON RESERVAS | H6-07, MENOR |
| H7 | Ficha con cinco pestañas | ACEPTABLE CON RESERVAS | Sin cambios respecto de la ronda anterior |
| H7 | Pestaña «Mis puntos», elegida con un clic | ACEPTABLE CON RESERVAS | H7R-03, MENOR |
| H7 | Entrada por `?pestana=puntos` | **RECHAZADA** | H7R-02 sigue, MAYOR |
| H7 | Dirección vieja `/my-account/loyalty` | **RECHAZADA** | H7R-01 sigue, MAYOR |
| H7 | Editor con «Mis puntos» apagada | ACEPTABLE CON RESERVAS | H7R-04, MENOR |

---

### H6: «Editar», el calendario y los mapas con ícono y nombre (D-05)

#### Capturas

Todas son de la ventana y todas están en tema claro, salvo las oscuras que se nombran.

**Después (37):**

| Archivo | Viewport | Tema | Estado |
|---|---|---|---|
| `despues-editar-{1440-claro, 1440-oscuro, 1920-claro, 1024-claro, 768-claro, 390-claro, 390-oscuro, 360-claro}.png` | Los cinco del repo, más 360 | claro, y oscuro a 1440 y 390 | «Editar» en la ficha |
| `despues-calendario-dias-{mismas ocho celdas}.png` | Igual | Igual | Días de junio de 1990 |
| `despues-calendario-anios-{mismas ocho celdas}.png` | Igual | Igual | Años 1970–1999 |
| `despues-vitrina-fecha-y-hora-{1440,390,360}-claro.png` | 1440, 390 y 360 | claro | Modo fecha y hora, septiembre de 2026 |
| `despues-mapa-quitar-{1440,390}-claro.png` | 1440 y 390 | claro | Mapa compartido, editor › Contacto, punto guardado |
| `despues-mapa-sin-confirmar-{1440,390}-claro.png` | 1440 y 390 | claro | Mapa compartido, pin corrido sin confirmar (tres botones) |
| `despues-alta-mapa-sin-punto-{1440,390}-claro.png` | 1440 y 390 | claro | Copia del alta del paciente, mapa abierto sin pin |
| `despues-alta-mapa-sin-confirmar-{1440,390}-claro.png` | 1440 y 390 | claro | Copia del alta, pin sin confirmar |
| `despues-alta-mapa-confirmada-{1440,390}-claro.png` | 1440 y 390 | claro | Copia del alta, punto confirmado |

**Antes, referencia (27):** los mismos estados, con el lápiz solo, la cruz sola, las flechas de sólo ícono y el ⊖ solo junto a los botones del mapa.

#### Las diez preguntas, por grupo

Los grupos G1 a G7 tienen el mismo contenido que en la ronda anterior. Se revisaron otra vez, con la misma lista, sobre las capturas nuevas. Se declara así, y las respuestas se resumen.

##### G1 · «Editar» a 1440 (claro y oscuro), 1920, 1024 y 768

1. **Lo primero que se ve mal:** nada del cambio. «Cambiar contraseña» sigue de sólo texto (H6-09).
2. **Texto cortado o solapado:** no hay. «Demo» pisa el encabezado a 768 (heredado).
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente.
5. **Tema oscuro:** se lee.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** correcta.
8. **Datos:** sintéticos de maqueta.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** ninguno del cambio.

##### G2 · «Editar» a 390 (claro y oscuro)

Igual que G1. «Editar» queda a unos 18 px del final del nombre, y no hay captura con un nombre largo. Nada MAYOR.

##### G3 · «Editar» a 360

1. **Lo primero que se ve mal:** «Editar» baja alineado con el avatar (H6-05).
2. **Texto cortado o solapado:** el desborde de 4 px es heredado.
3. **¿Terminado o prototipo?** La posición se ve improvisada.
4. **Coherencia con el producto:** en los otros anchos el botón va a la derecha.
5. **Tema oscuro:** no aplica. No hay captura oscura a 360.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** el botón empuja la tira de pestañas.
8. **Datos:** sintéticos.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** H6-05, MENOR.

##### G4 · Calendario, días, a 1440 (claro y oscuro), 1920, 1024 y 768

1. **Lo primero que se ve mal:** «Año · Mes · Mes · Año» (H6-03), y «Cerrar» junto a «Cancelar» (H6-04).
2. **Texto cortado o solapado:** no hay.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** hay una mezcla de botones con ícono y botones de sólo texto (H6-09).
5. **Tema oscuro:** se lee.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** «Confirmar» es el primario.
8. **Datos:** sintéticos.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** sólo MENOR.

##### G5 · Calendario, días, a 390 (claro y oscuro)

Igual que G4. En el centro se lee «‹ Mes   Mes ›» (H6-03). Nada MAYOR.

##### G6 · Calendario, días, a 360: `despues-calendario-dias-360-claro.png`

1. **Lo primero que se ve mal:** nada nuevo. Las cuatro flechas van en un renglón y la cabecera mide lo mismo que en los otros anchos.
2. **Texto cortado o solapado:** no hay.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** es coherente con los otros siete anchos.
5. **Tema oscuro:** no aplica.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** correcta.
8. **Datos:** sintéticos.
9. **¿Muestra el requisito?** Sí. Ahora el README y el `PLAN.md` dicen «360», que es lo que se midió.
10. **Motivo de rechazo:** ninguno del cambio.

##### G7 · Calendario, años (las ocho celdas)

Igual que la ronda anterior: «30 años» aparece a los dos lados (H6-03). Nada MAYOR.

##### G8 · Vitrina en modo fecha y hora, a 1440, 390 y 360

Capturas: `despues-vitrina-fecha-y-hora-{1440,390,360}-claro.png`. La de 360 es nueva.

1. **Lo primero que se ve mal:** a 360, el título se parte en dos renglones («Seleccionar fecha y / hora») al lado de «× Cerrar». En la referencia de 360, con la cruz sola, entraba en uno. Es la estimación de H6-E8, ahora observada.
2. **Texto cortado o solapado:** no hay.
   - A 360 el título partido no se corta y «Cerrar» no se superpone.
   - En la referencia de 360 era el mes («Septiembre / 2026») el que se partía entre las flechas. Ahora el mes entra en un renglón. El README lo declara en «Lo que este cambio sí mueve y se deja así».
3. **¿Terminado o prototipo?** A 360 la cabecera se ve apretada. A 1440 y 390, terminada.
4. **Coherencia con el producto:** es coherente con el calendario del editor.
5. **Tema oscuro:** no aplica. No hay captura oscura de este modo.
6. **¿El estado orienta?** No aplica.
7. **Jerarquía:** «Confirmar» es el primario en los tres anchos. La fila «Hora» entra debajo de la grilla.
8. **Datos:** sin datos de personas.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** nada MAYOR. H6-E8 pasa a ser un MENOR del cambio, declarado.

##### G9 · Mapa compartido en el editor: `despues-mapa-quitar-{1440,390}-claro.png` y `despues-mapa-sin-confirmar-{1440,390}-claro.png`

1. **Lo primero que se ve mal:** en `despues-mapa-quitar-1440-claro.png` el plano sale desvaído, a medio pintar. La referencia del mismo estado sale con el plano nítido, y la captura de 390 también (H6-E9).
2. **Texto cortado o solapado:**
   - No hay.
   - A 390, sin confirmar: «Confirmar dirección actual» va en su renglón, y «Volver a ubicarme» con «⊖ Quitar la ubicación» en el siguiente, sin desborde.
   - A 1440, sin confirmar: los tres botones van en un renglón.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:**
   - «⊖ Quitar la ubicación» sigue el mismo patrón de «Editar» y del calendario.
   - En el mismo renglón, «Volver a ubicarme» va sin ícono (H6-09, heredado).
   - «Volver a ubicarme» sigue corrido unos 14 px respecto de la columna (heredado de H5).
5. **Tema oscuro:** no aplica. No hay captura oscura del mapa.
6. **¿El estado orienta?** Sí. Las ayudas bajo el mapa siguen iguales.
7. **Jerarquía:** en el estado sin confirmar, «Confirmar dirección actual» es el único primario. Es correcto.
8. **Datos:** la dirección de trabajo y el correo `.mock` son sintéticos.
9. **¿Muestra el requisito?** Sí, en los dos estados capturados. «Quitar la ubicación» ya no se puede leer como «quitar la dirección».
10. **Motivo de rechazo:** nada MAYOR en estos dos estados. El tercer estado del componente, sin punto, no tiene captura: ver G10 y H6-12.

##### G10 · Copia del mapa en el alta del paciente: `despues-alta-mapa-{sin-punto,sin-confirmar,confirmada}-{1440,390}-claro.png`

1. **Lo primero que se ve mal:** en el estado **sin punto**, el texto dice «Tocá el mapa en el lugar donde vivís para poner el pin». El plano no tiene pin. Al lado aparece «⊖ Quitar la ubicación», que es una ubicación que todavía no existe (H6-12).
2. **Texto cortado o solapado:** no hay en ningún estado ni ancho. A 390, en el estado sin confirmar, «Confirmar dirección actual» baja a su propio renglón.
3. **¿Terminado o prototipo?**
   - Sin confirmar y confirmada se ven terminados.
   - Sin punto se ve sin resolver: el rótulo describe otro estado.
4. **Coherencia con el producto:** es coherente con el mapa compartido del editor, tanto en el rótulo como en el ícono. Ahora el mismo paciente ve el mismo botón al darse de alta y al editar, y con eso queda cerrada la incoherencia de la ronda anterior.
5. **Tema oscuro:** no aplica. No hay captura oscura del alta.
6. **¿El estado orienta?**
   - Sin punto: la ayuda orienta («Tocá el mapa…»), y el botón la contradice.
   - Confirmada: la ayuda «Volvé a escribir la dirección para este punto» sigue arriba, como en H5.
7. **Jerarquía:** las flechas del formulario siguen siendo las acciones principales. «Confirmar dirección actual» es el único primario del bloque.
8. **Datos:** sin datos de personas. Las calles del plano son públicas.
9. **¿Muestra el requisito?** Sí: los seis botones tienen ícono y nombre. Las capturas cubren la copia de domicilio («¿Dónde vivís?»). Los tres botones de la copia de trabajo (`register-patient.html:612`, `:653` y `:699`) están cambiados en el código de la misma forma, pero no tienen captura (H6-E6).
10. **Motivo de rechazo:** H6-12. Según el código, en el estado sin punto el botón no quita nada: cierra el mapa. Pasa en la copia del alta (`register-patient.ts:2081-2085` junto con `:891-893`) y en el componente compartido (`ubicacion-picker.ts:403-407` junto con `:287`).

##### G11 · Las 27 referencias `antes-*`

1. **Lo primero que se ve mal:** es el estado previo: el lápiz solo, la cruz sola, las flechas de sólo ícono y el ⊖ solo junto a los botones del mapa, en los cinco estados.
2. **Texto cortado o solapado:** `antes-editar-360-claro` confirma que el desborde de 4 px es heredado. `antes-vitrina-fecha-y-hora-360-claro` muestra el mes partido en dos renglones.
3. a 7. No aplican. Son referencia y coinciden con lo que describe el README.
8. **Datos:** sintéticos.
9. **¿Muestra el requisito?** Sirven para comparar. El ⊖ del alta sin punto ya tenía el nombre accesible «Quitar la ubicación de tu domicilio» (según el código, no observado): el significado equivocado del estado sin punto es heredado, y el cambio lo hizo visible.
10. **Motivo de rechazo:** no aplica.

#### Estado de los hallazgos anteriores de H6

| ID | Estado | Severidad | Detalle |
|---|---|---|---|
| H6-01 | CERRADO (ronda anterior) | — | Sigue cerrado: `despues-calendario-dias-360-claro.png` |
| H6-02 | **CERRADO** | — | Los seis ⊖ del alta del paciente tienen ícono y «Quitar la ubicación». Prueba: `despues-alta-mapa-{sin-punto,sin-confirmar,confirmada}-{1440,390}-claro.png`. Según el código, en `register-patient.html` sólo quedan de sólo ícono la navegación del formulario (`:61` y `:68`) y «Quitar el nombre» (`:171` y `:177`), que es una excepción válida (quita un elemento de una lista). La copia de trabajo no tiene captura: queda en H6-E6 |
| H6-03 | SIGUE | MENOR | «Año · Mes · Mes · Año» y «30 años» a los dos lados, también en la vitrina |
| H6-04 | SIGUE | MENOR | «Cerrar» y «Cancelar» hacen lo mismo |
| H6-05 | SIGUE | MENOR | A 360 «Editar» baja alineado con el avatar |
| H6-06 | SIGUE | MENOR | El README cita `mi-perfil-paciente.mjs:93-94` y `:99`, pero no dice con quién quedó acordada su actualización |
| H6-07 | SIGUE | MENOR | «Siguiente» de sólo ícono en las altas (Q-I11 abierta) |
| H6-08 | SIGUE (heredado) | MAYOR | El globo queda debajo del `<dialog>` modal |
| H6-09 | SIGUE (heredado, a confirmar) | MAYOR | Los botones de sólo texto. En el mapa: «Volver a ubicarme», «Usar mi ubicación» y «Confirmar dirección actual» van sin ícono al lado de «⊖ Quitar la ubicación» |
| H6-10 | SIGUE (heredado) | MENOR | Los detalles de la cabecera, «Demo», las píldoras de la maqueta y «Panel» en oscuro |
| H6-11 | **CERRADO** | — | Ahora dice «Quitar la ubicación», que no se confunde con «quitar la dirección». Prueba: `despues-mapa-quitar-{1440,390}-claro.png` y `despues-mapa-sin-confirmar-{1440,390}-claro.png`. Los dos mapas de «Contacto» muestran el mismo rótulo, pero cada uno queda pegado a su plano y el nombre accesible los distingue |
| H6-E1 | SIGUE | MENOR | Suma la vitrina a 360. Falta el calendario dentro de otro diálogo y el modo fecha y hora a 1024×768. El README lo declara |
| H6-E2 | SIGUE | MENOR | Ninguna de las 14 excepciones se ve con su globo. El README lo declara |
| H6-E3 | SIGUE | MENOR | Oscuro sólo a 1440 y 390. El mapa y la vitrina, sólo en claro. Las flechas sin estados. El README lo declara |
| H6-E4 | **CAMBIA** | MENOR | Cerrado: `pasada-antes.txt` ya imprime una ruta del repo. Siguen dos cosas: <br>• las dos salidas nombran el entorno en que se sirvió la app: «excluidos por la CSP del servidor de desarrollo», en la última comprobación de consola de `pasada-antes.txt` y de `pasada-despues.txt`; <br>• `PLAN.md` y `REPORTE.md` siguen atrás. H6.S1.M5 dice «92/92» y «23 capturas», `REPORTE.md` repite «92/92» en las líneas 16, 67 y 118, y H6.S1.M7, M8 y M9 siguen en `TODO` aunque sus capturas y sus comprobaciones ya existen (208/208) |
| H6-E5 | **CERRADO** | — | El README (líneas 156 a 160) nombra `register-practitioner.html:57` |
| H6-E6 | **CAMBIA** | MAYOR → **MENOR** | Ya se vio el estado más cargado, el de tres botones, en los dos anchos (`despues-mapa-sin-confirmar-{1440,390}-claro.png`), y los tres estados de la copia del alta. Según el código, ningún consumidor le pone estilos a la fila de botones: sólo `ubicacion-picker.css:33` y la copia propia del alta en `register-patient.css:116`. Quedan sin captura: <br>• el estado sin punto del componente compartido, que es donde está H6-12; <br>• la copia de trabajo del alta; <br>• los otros cinco consumidores del componente; <br>• el oscuro. <br>Además, el README (línea 64) dice «en cada estado donde aparece», y del componente compartido se capturaron dos de sus tres estados |
| H6-E7 | **CERRADO** | — | El README (líneas 11 a 12 y 129 a 130), el CA de H6.S1.M7 en `PLAN.md` y el comentario de `date-picker.css` dicen 360, que es lo que se midió |
| H6-E8 | **CAMBIA** | MENOR (del cambio, declarado) | Observado en `despues-vitrina-fecha-y-hora-360-claro.png`: el título se parte en dos renglones. El README lo declara y explica el intercambio: antes se partía el mes y ahora se parte el título. Se acepta con reserva. «× Cerrar» podría ser la excepción de «cerrar un diálogo» si el globo funcionara dentro de un modal (H6-08) |

#### Hallazgos nuevos de H6

| ID | Severidad | Tipo | Hallazgo |
|---|---|---|---|
| H6-12 | **MAYOR** | Del cambio | En el estado **sin punto** del mapa, el botón dice «⊖ Quitar la ubicación», pero todavía no hay ninguna ubicación. La ayuda de arriba dice «Tocá el mapa en el lugar donde vivís para poner el pin», y el plano no tiene pin. Según el código, en ese estado el botón cierra el mapa: pone el punto en nulo y apaga la marcación, y el mapa se abre sólo con punto o marcando (`ubicacion-picker.ts:287` y `:403-407`; en el alta, `register-patient.ts:891-893` y `:2081-2085`). El nombre accesible ya tenía ese sentido antes, pero sólo lo oía quien usa lector de pantalla. El cambio lo volvió visible para todos. Una persona puede entender que hay una ubicación puesta sin que ella la haya marcado. Se ve en `despues-alta-mapa-sin-punto-{1440,390}-claro.png`. El componente compartido tiene el mismo texto en ese estado (`ubicacion-picker.html:21-49`), sin captura. Arreglarlo es barato: un rótulo propio para ese estado, como «Cerrar el mapa», o no mostrar el botón mientras no haya punto |
| H6-E9 | MENOR | De la evidencia | `despues-mapa-quitar-1440-claro.png` salió con el plano desvaído, a medio pintar. La referencia del mismo estado (`antes-mapa-quitar-1440-claro.png`) y la captura de 390 salen nítidas. El botón que se quiere probar se lee igual, pero el README dice que las capturas se toman «después de esperar las fuentes y las animaciones», y ésta no cumple |

#### Notas por pantalla de H6

| Pantalla | Nota | Por qué |
|---|---|---|
| «Mi perfil»: ficha con «Editar» | ACEPTABLE CON RESERVAS | H6-05 y H6-06 |
| Calendario: días | ACEPTABLE CON RESERVAS | H6-03 y H6-04 |
| Calendario: años | ACEPTABLE CON RESERVAS | H6-03 y H6-04 |
| Calendario en la vitrina, modo fecha y hora | ACEPTABLE CON RESERVAS | H6-03, H6-04 y H6-E8, todos MENOR |
| Mapa compartido en el editor: guardado y sin confirmar | ACEPTABLE CON RESERVAS | Ningún defecto del cambio en estos estados. Evidencia: H6-E6 y H6-E9 |
| Mapas, estado sin punto (alta y componente compartido) | **RECHAZADA** | H6-12 |
| Alta del paciente, mapa: sin confirmar y confirmada | ACEPTABLE CON RESERVAS | Ningún defecto del cambio. Evidencia: H6-E6, por la copia de trabajo |
| Mapa compartido en los otros cinco consumidores | ACEPTABLE CON RESERVAS | Se aplica el criterio declarado arriba. Su estado sin punto cae en la fila anterior |
| Formulario por páginas | ACEPTABLE CON RESERVAS | H6-07 |

---

### H7: «Mis puntos» como quinta pestaña (N-03)

Las 24 capturas no cambiaron desde la ronda anterior, y las diez preguntas por grupo (P1 a P9) se mantienen como están en esa pasada. Sólo cambió el README: las líneas 15 a 19 declaran que la línea decorativa de la barra lateral es una animación continua y que su posición distinta en cada captura es lo esperado.

#### Estado de los hallazgos de H7

| ID | Estado | Severidad | Detalle |
|---|---|---|---|
| H7R-01 | SIGUE | **MAYOR** | `/my-account/loyalty` termina en «Datos personales» (`despues-ruta-vieja-1440-claro.png`). Según el código, «Tus accesos» del Panel sigue ofreciendo esa dirección |
| H7R-02 | SIGUE | **MAYOR** | Al entrar por `?pestana=puntos` a 390, la pestaña activa queda fuera de la vista (`despues-url-directa-390-claro.png`) |
| H7R-03 | SIGUE | MENOR | «Editar» sigue visible sobre la billetera |
| H7R-04 | SIGUE | MENOR | La pestaña apagada no explica por qué |
| H7R-05 | SIGUE (heredado) | MENOR | Se suma lo que deja H7R-E6: sin confirmar si la animación continua de la barra lateral respeta el movimiento reducido |
| H7R-E1 | CERRADO (ronda anterior) | — | Sigue cerrado |
| H7R-E2 | SIGUE | MENOR | La URL no se ve en las capturas de entrada |
| H7R-E3 | SIGUE | MENOR | A 390 el editor no muestra la pestaña apagada |
| H7R-E4 | CERRADO (ronda anterior) | — | Sigue cerrado. El README mantiene la discrepancia sobre si es criterio del cambio (ver H7R-02) |
| H7R-E5 | SIGUE | MENOR | Sólo el vacío S3, y oscuro sólo a 1440 y 390 |
| H7R-E6 | **CERRADO** | — | El README ya no afirma más de lo que se ve: distingue las animaciones con fin, que se esperan, de la línea decorativa continua. El único punto abierto, si respeta el movimiento reducido, pasa a H7R-05 como heredado |

#### Notas por pantalla de H7

| Pantalla | Nota | Por qué |
|---|---|---|
| Ficha con cinco pestañas | ACEPTABLE CON RESERVAS | Sólo heredados y H7R-E5 |
| Pestaña «Mis puntos», con un clic | ACEPTABLE CON RESERVAS | H7R-03 |
| Entrada por `?pestana=puntos` | **RECHAZADA** | H7R-02 |
| Dirección vieja `/my-account/loyalty` | **RECHAZADA** | H7R-01 |
| Editor con «Mis puntos» apagada | ACEPTABLE CON RESERVAS | H7R-04. H7R-E3 |

---

### No cubierto

#### H6

| Pantalla | Celdas presentes | Celdas que faltan |
|---|---|---|
| «Mi perfil» con «Editar» y el calendario del editor | Claro: los cinco, más 360. Oscuro: 1440 y 390 | Oscuro a 1920, 1024 y 768. Un nombre largo a 390. Las flechas deshabilitadas, con foco y con el puntero encima |
| Calendario en modo fecha y hora | Claro: 1440, 390 y 360 | 1024×768, 768, 1920 y el oscuro. El calendario dentro de otro diálogo |
| Mapa compartido | Editor del paciente, domicilio: guardado y sin confirmar, claro, 1440 y 390 | El estado sin punto, que es el de H6-12. Los otros cinco consumidores. El oscuro |
| Copia del mapa en el alta | Domicilio: los tres estados, claro, 1440 y 390 | La copia de trabajo (`register-patient.html:612`, `:653` y `:699`). El oscuro |
| Las 14 excepciones | Ninguna | Al menos una por tipo, con el globo a la vista |

Además, no se observó qué hace un clic en «Quitar la ubicación» en ningún estado. Lo que se dice de su efecto sale del código.

#### H7

Sin cambios respecto de la ronda anterior:

- **Faltan celdas:**
  - oscuro a 1920, 1024 y 768;
  - la dirección vieja a 390;
  - «Tus accesos» del Panel.
- **Falta ver estados de la billetera:**
  - el saldo, el canje y el comprobante;
  - la carga y el error.
- **Faltan interacciones:**
  - pulsar «Editar» estando en «Mis puntos»;
  - si cambiar de pestaña actualiza `?pestana=`;
  - el recorrido de la tira con teclado.

---

<!-- Ronda 5 -->

## Segunda pasada visual, cuarta vez: H6 (D-05) y H7 («Mis puntos»)

- Fecha: 2026-09-24
- Material revisado:
  - `docs/frontend/evidence/d05-iconos-2026-09-23/`: se volvieron a tomar todas las capturas (29 `antes-*` y 39 `despues-*`), y se leyó de nuevo el `README.md` completo.
  - Se abrieron como imagen las 22 capturas de mapas, antes y después:
    - `*-mapa-quitar-*`, `*-mapa-sin-confirmar-*` y `*-mapa-sin-punto-*`;
    - `*-alta-mapa-{sin-punto,sin-confirmar,confirmada}-*`.
  - Del resto de la carpeta se abrió una captura por grupo para confirmar que no cambió: `despues-editar-1440-claro`, `despues-calendario-dias-360-claro`, `despues-calendario-anios-1440-oscuro` y `despues-vitrina-fecha-y-hora-360-claro`. Las cuatro coinciden con lo que se vio en la tercera pasada.
  - Salidas del guion: `docs/trabajo/2026-09-23-perfil-medico-configurar-tu-perfil/evidencia/h6/pasada-antes.txt` (3/3) y `.../h6/pasada-despues.txt` (216/216).
  - `evidencia/h6/iconos.md`, filas 3, 6 y 27.
  - H7: las capturas no cambiaron. Se arrastran las notas de la tercera pasada.
- Se leyó código para confirmar hallazgos, citado con `ruta:línea`. Lo que sale sólo del código se marca «según el código, no observado».
- Postura, regla de nota y estados de los hallazgos: los mismos de las pasadas anteriores. Ante la duda, va la nota más baja.

### Resumen de notas

| Hito | Pantalla | Nota | Motivo |
|---|---|---|---|
| H6 | «Mi perfil»: ficha con «Editar» | ACEPTABLE CON RESERVAS | H6-05 y H6-06, MENOR |
| H6 | Calendario: días y años | ACEPTABLE CON RESERVAS | H6-03 y H6-04, MENOR |
| H6 | Calendario en la vitrina, modo fecha y hora | ACEPTABLE CON RESERVAS | H6-03, H6-04 y H6-E8, MENOR |
| H6 | Mapa compartido en el editor: guardado y sin confirmar | ACEPTABLE CON RESERVAS | Sin MENOR del cambio. Evidencia: H6-E6 |
| H6 | Mapas, estado sin punto: editor (mapa compartido) y alta | ACEPTABLE CON RESERVAS | H6-12 cerrado. Queda H6-13, MENOR |
| H6 | Alta del paciente, mapa: sin confirmar y confirmada | ACEPTABLE CON RESERVAS | Sin MENOR del cambio. Evidencia: H6-E6 |
| H6 | Mapa compartido en los otros cinco consumidores (sin captura) | ACEPTABLE CON RESERVAS | Mismo componente, y ningún consumidor le pone estilos a la fila. H6-E6 |
| H6 | Formulario por páginas (sin captura, DOM idéntico) | ACEPTABLE CON RESERVAS | H6-07, MENOR |
| H7 | Ficha, pestaña elegida con un clic y editor | ACEPTABLE CON RESERVAS | Sin cambios: H7R-03 y H7R-04, MENOR |
| H7 | Entrada por `?pestana=puntos` | **RECHAZADA** | H7R-02, MAYOR |
| H7 | Dirección vieja `/my-account/loyalty` | **RECHAZADA** | H7R-01, MAYOR |

---

### H6: los mapas, repetidos

#### Capturas de mapas

Todas son de la ventana, en tema claro.

| Archivo | Viewport | Estado | Botón del mapa (después) |
|---|---|---|---|
| `despues-mapa-quitar-{1440,390}-claro.png` | 1440 y 390 | Editor, domicilio con el punto guardado | «Volver a ubicarme» y «⊖ Quitar la ubicación» |
| `despues-mapa-sin-confirmar-{1440,390}-claro.png` | 1440 y 390 | Editor, domicilio con el pin corrido | «Confirmar dirección actual», «Volver a ubicarme» y «⊖ Quitar la ubicación» |
| `despues-mapa-sin-punto-{1440,390}-claro.png` (nuevas) | 1440 y 390 | Editor, trabajo con el mapa abierto y vacío | «Usar mi ubicación» y «× Cerrar el mapa» |
| `despues-alta-mapa-sin-punto-{1440,390}-claro.png` | 1440 y 390 | Alta, mapa abierto sin pin | «Usar mi ubicación» y «× Cerrar el mapa» |
| `despues-alta-mapa-sin-confirmar-{1440,390}-claro.png` | 1440 y 390 | Alta, pin sin confirmar | Tres botones, con «⊖ Quitar la ubicación» |
| `despues-alta-mapa-confirmada-{1440,390}-claro.png` | 1440 y 390 | Alta, punto confirmado | «Volver a ubicarme» y «⊖ Quitar la ubicación» |

En cada caso, las `antes-*` del mismo estado muestran el ⊖ solo, sin rótulo.

#### Las diez preguntas, por grupo

Los grupos que no cambiaron (G1 a G8 de la tercera pasada: «Editar», el calendario y la vitrina) se confirmaron con una captura por grupo, y sus respuestas siguen valiendo. Se declara así.

##### M1 · Estado sin punto: `despues-mapa-sin-punto-{1440,390}-claro.png` y `despues-alta-mapa-sin-punto-{1440,390}-claro.png`

1. **Lo primero que se ve mal:** nada del cambio. La ayuda dice «Tocá el mapa…» y el botón dice «× Cerrar el mapa», que es lo que hace. La contradicción de H6-12 desapareció.
2. **Texto cortado o solapado:**
   - No hay.
   - A 390 los dos botones entran en un renglón, en el editor y en el alta.
   - En el editor, a 390, la barra fija «Cancelar / Guardar cambios» queda por debajo del botón y no lo tapa.
3. **¿Terminado o prototipo?** Terminado. La cruz tiene el mismo trazo fino que el «× Cerrar» del calendario.
4. **Coherencia con el producto:**
   - Es coherente con el calendario: la cruz con el nombre cierra algo.
   - El editor y el alta muestran lo mismo en este estado.
   - «Usar mi ubicación», al lado, sigue sin ícono (H6-09, heredado).
5. **Tema oscuro:** no aplica. No hay captura oscura de los mapas (H6-E3).
6. **¿El estado orienta?** Sí. La ayuda dice qué hacer y el botón dice cómo salir.
7. **Jerarquía:** los dos botones son secundarios y ninguno compite. En el alta, las flechas del formulario siguen siendo las acciones principales.
8. **Datos:** la dirección de trabajo «Av. Cañoto esq. Landívar, piso 3» y el correo `.mock` son sintéticos. Las calles del plano son públicas.
9. **¿Muestra el requisito?** Sí: ícono y nombre, y un nombre que dice lo que el botón hace. La comprobación de que en el editor el nombre accesible empieza por el texto visible sale del guion, no de la imagen.
10. **Motivo de rechazo:** ninguno MAYOR. Queda H6-13, MENOR.

##### M2 · Estados con punto: `despues-mapa-quitar-*`, `despues-mapa-sin-confirmar-*`, `despues-alta-mapa-sin-confirmar-*` y `despues-alta-mapa-confirmada-*`

1. **Lo primero que se ve mal:** nada nuevo. `despues-mapa-quitar-1440-claro.png` sale con el plano nítido, igual que su referencia. H6-E9 queda cerrado.
2. **Texto cortado o solapado:**
   - No hay.
   - A 390, en el estado sin confirmar, «Confirmar dirección actual» va en su renglón y los otros dos debajo, en el editor y en el alta.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:**
   - «⊖ Quitar la ubicación» es igual en el editor y en el alta.
   - «Volver a ubicarme» sigue sin ícono y corrido unos 14 px respecto de la columna (heredado).
5. **Tema oscuro:** no aplica.
6. **¿El estado orienta?** Sí. Las ayudas bajo el mapa siguen iguales a las de H5.
7. **Jerarquía:** «Confirmar dirección actual» es el único primario del bloque.
8. **Datos:** igual que M1.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** ninguno.

#### Estado de los hallazgos de H6

| ID | Estado | Severidad | Detalle |
|---|---|---|---|
| H6-01 | CERRADO | — | Sigue cerrado (`despues-calendario-dias-360-claro.png`) |
| H6-02 | CERRADO | — | Sigue cerrado (`despues-alta-mapa-*`) |
| H6-03 | SIGUE | MENOR | «Año · Mes · Mes · Año» y «30 años» a los dos lados |
| H6-04 | SIGUE | MENOR | «Cerrar» y «Cancelar» hacen lo mismo |
| H6-05 | SIGUE | MENOR | A 360 «Editar» baja alineado con el avatar |
| H6-06 | SIGUE | MENOR | `mi-perfil-paciente.mjs:93`, `:94` y `:99` quedan viejas, sin acuerdo declarado con su dueño |
| H6-07 | SIGUE | MENOR | «Siguiente» de sólo ícono en las altas (Q-I11 abierta) |
| H6-08 | SIGUE (heredado) | MAYOR | El globo queda debajo del `<dialog>` modal |
| H6-09 | SIGUE (heredado, a confirmar) | MAYOR | Los botones de sólo texto («Usar mi ubicación», «Volver a ubicarme», «Confirmar dirección actual») al lado de los que tienen ícono |
| H6-10 | SIGUE (heredado) | MENOR | La cabecera, «Demo», las píldoras de la maqueta y «Panel» apagado en oscuro |
| H6-11 | CERRADO | — | Sigue cerrado |
| H6-12 | **CERRADO** | — | Sin punto, el botón dice «× Cerrar el mapa», que es lo que hace. Prueba: `despues-mapa-sin-punto-{1440,390}-claro.png` y `despues-alta-mapa-sin-punto-{1440,390}-claro.png`. Con punto sigue diciendo «Quitar la ubicación» (`despues-mapa-quitar-*` y `despues-alta-mapa-{sin-confirmar,confirmada}-*`). Según el código: `ubicacion-picker.html:20-49`; `register-patient.html:339` y `:623` |
| H6-E1 | SIGUE | MENOR | Falta el calendario dentro de otro diálogo y el modo fecha y hora a 1024×768. Declarado |
| H6-E2 | SIGUE | MENOR | Ninguna de las 14 excepciones se ve con su globo. Declarado |
| H6-E3 | SIGUE | MENOR | Oscuro sólo a 1440 y 390. El mapa y la vitrina, sólo en claro. Declarado |
| H6-E4 | **CAMBIA** | MENOR | Cerrada la mención del entorno: la línea de consola de las dos salidas ya no lo nombra. Siguen sin actualizarse: <br>• H6.S1.M5 en `PLAN.md` («92/92», «23 capturas»); <br>• H6.S1.M8, en `TODO` aunque su DoD (capturas de los estados del mapa en el editor y en el alta) ya tiene evidencia; <br>• `REPORTE.md`, líneas 16, 67 y 118 («92/92») |
| H6-E5 | CERRADO | — | Sigue cerrado |
| H6-E6 | **CAMBIA** | MENOR | Ya se ven los tres estados del mapa compartido en el editor, incluido el sin punto (`despues-mapa-sin-punto-*`), y los tres estados de la copia del alta. Quedan sin captura: <br>• la copia de trabajo del alta (`register-patient.html:611-699`); <br>• los otros cinco consumidores del componente; <br>• el oscuro. <br>El README lo declara en «No cubierto», líneas 193 a 195 |
| H6-E7 | CERRADO | — | Sigue cerrado |
| H6-E8 | SIGUE | MENOR (del cambio, declarado) | A 360, en modo fecha y hora, el título se parte en dos renglones |
| H6-E9 | **CERRADO** | — | Las teselas del plano terminan de bajar antes de la foto. Prueba: `despues-mapa-quitar-1440-claro.png`, nítida como su referencia. Las otras 21 capturas de mapas también salen nítidas |

#### Hallazgo nuevo de H6

| ID | Severidad | Tipo | Hallazgo |
|---|---|---|---|
| H6-13 | MENOR | Del cambio | En el mapa compartido, «× Cerrar el mapa» no tiene `aria-label`: su nombre accesible es el texto a secas (`ubicacion-picker.html:36-47`). En el estado sin punto se pierde el nombre que distinguía un mapa del otro. Antes era `etiquetaQuitar()`, por ejemplo «Quitar la ubicación de tu casa». En la pestaña «Contacto» del editor hay dos mapas, casa y trabajo. Si los dos están abiertos sin punto, quien usa lector de pantalla oye dos botones iguales, «Cerrar el mapa». Las dos copias del alta sí lo resuelven, con «Cerrar el mapa de tu domicilio» y «… de tu lugar de trabajo» (`register-patient.html:339` y `:623`). Quedan incoherentes entre sí y con el estado con punto del mismo componente. El guion lo registra como «el del texto» en `pasada-despues.txt`. Se resuelve con un nombre por mapa, como los que ya tiene la copia del alta |

#### Notas por pantalla de H6

| Pantalla | Nota | Por qué |
|---|---|---|
| «Mi perfil»: ficha con «Editar» | ACEPTABLE CON RESERVAS | H6-05 y H6-06 |
| Calendario: días y años | ACEPTABLE CON RESERVAS | H6-03 y H6-04 |
| Calendario en la vitrina, modo fecha y hora | ACEPTABLE CON RESERVAS | H6-03, H6-04 y H6-E8 |
| Mapa compartido en el editor: guardado y sin confirmar | ACEPTABLE CON RESERVAS | Evidencia: H6-E6 |
| Mapas, estado sin punto: editor y alta | ACEPTABLE CON RESERVAS | H6-13 |
| Alta del paciente, mapa: sin confirmar y confirmada | ACEPTABLE CON RESERVAS | Evidencia: H6-E6, por la copia de trabajo |
| Mapa compartido en los otros cinco consumidores | ACEPTABLE CON RESERVAS | H6-E6 y H6-13, que viaja con el componente |
| Formulario por páginas | ACEPTABLE CON RESERVAS | H6-07 |

---

### H7: «Mis puntos» como quinta pestaña (N-03)

Las capturas, el código y el guion no cambiaron desde la tercera pasada. Todos los hallazgos quedan como estaban:

| ID | Estado | Severidad |
|---|---|---|
| H7R-01 | SIGUE | **MAYOR**. La dirección vieja termina en «Datos personales» |
| H7R-02 | SIGUE | **MAYOR**. Al entrar por URL a 390, la pestaña activa queda fuera de la vista |
| H7R-03 | SIGUE | MENOR |
| H7R-04 | SIGUE | MENOR |
| H7R-05 | SIGUE (heredado) | MENOR |
| H7R-E1 | CERRADO | — |
| H7R-E2 | SIGUE | MENOR |
| H7R-E3 | SIGUE | MENOR |
| H7R-E4 | CERRADO | — |
| H7R-E5 | SIGUE | MENOR |
| H7R-E6 | CERRADO | — |

| Pantalla | Nota | Por qué |
|---|---|---|
| Ficha, pestaña con un clic y editor | ACEPTABLE CON RESERVAS | H7R-03 y H7R-04 |
| Entrada por `?pestana=puntos` | **RECHAZADA** | H7R-02 |
| Dirección vieja `/my-account/loyalty` | **RECHAZADA** | H7R-01 |

---

### No cubierto

#### H6

- **Mapas:**
  - la copia de trabajo del alta;
  - los otros cinco consumidores del componente compartido;
  - el tema oscuro en todos;
  - los dos mapas de «Contacto» abiertos a la vez sin punto, que es el caso de H6-13.
- **Efecto de los botones:** no se observó qué hacen «Cerrar el mapa» ni «Quitar la ubicación» al pulsarlos. Lo que se dice sale del código.
- **Resto sin cambios respecto de la tercera pasada:**
  - el calendario dentro de otro diálogo;
  - el modo fecha y hora a 1024×768;
  - un nombre largo a 390;
  - los estados de las flechas;
  - las 14 excepciones con su globo.

#### H7

Sin cambios respecto de la tercera pasada.

---

<!-- Ronda 6 -->

## Segunda pasada visual: H5.S2.M6 (direcciones obligatorias sin rojo al vaciar, aviso junto al campo)

- Fecha: 2026-09-24
- Material revisado:
  - `docs/frontend/evidence/mapa-vacia-direccion-2026-09-23/`: las 48 capturas `corregida-*.png` y, como referencia de antes, `despues-aseguradora-{1,2}-*`, `despues-laboratorio-central-{1,2}-*` y `despues-imagenologia-central-{1,2}-*` (6). Se abrieron como imagen las 54.
  - `docs/frontend/evidence/mapa-vacia-direccion-2026-09-23/README.md`, completo.
  - `docs/trabajo/2026-09-23-perfil-medico-configurar-tu-perfil/evidencia/h5/navegador-h5s2m6-{1440-claro,390-claro,1440-oscuro}.txt`, `specs-h5s2m6-rojo-sin-arreglo.txt` y `specs-h5s2m6-verde.txt`.
  - El diff de `playwright/mapa-vacia-direccion.mjs`, de los tres componentes (`src/app/features/auth/register-organization/register-organization.ts`, `register-laboratory/register-laboratory.ts`, `register-imaging-center/register-imaging-center.ts`) y de sus tres `*.spec.ts`.
  - Como contexto: la sección «Segunda pasada visual: H5 (el mapa vacía la dirección) y H7» de `evidencia/doble-revision.md` y el criterio de aceptación de H5.S2.M6 en `PLAN.md`.
- Criterio contra el que se juzga (literal del plan): «Dado un alta con dirección obligatoria, cuando se toca el mapa, entonces el campo vacío no se marca en error hasta que la persona lo toque o intente avanzar, y el aviso se lee junto al campo.»
- Método: segunda pasada adversarial. Se parte de que la entrega tiene defectos y se buscan motivos para rechazarla. Se responden las diez preguntas por grupo de capturas equivalentes (el agrupamiento se declara en cada grupo) y cada hallazgo lleva severidad. La primera pasada es la tabla del implementador en el README; sus afirmaciones se contrastan contra las imágenes en «Afirmaciones del README que no se sostienen».
- Límite del método: solo se miraron imágenes y se leyeron archivos; no se ejecutó nada. No son observables en una imagen: `aria-invalid`, la región viva y su anuncio, a qué campo describe cada texto (`aria-describedby`), el foco tras pulsar «Siguiente», el orden de tabulación y que la página no avance (en 1440 el título queda fuera del encuadre en algunas capturas). Lo que solo sale del código se marca «según el código, no observado». Las distancias en píxeles que se citan medidas sobre la imagen son aproximadas (±3 px).
- Regla de nota:
  - `RECHAZADA`: queda algún BLOQUEANTE o MAYOR del cambio o del requisito.
  - `ACEPTABLE CON RESERVAS`: solo quedan MENOR del cambio.
  - `APROBADA`: no quedan hallazgos abiertos.
  - Los heredados (ya estaban antes del cambio, o viven en código que el cambio no toca) se listan aparte y no cuentan para la nota. Los defectos de la evidencia tampoco cuentan para la nota, pero se listan con lo que hay que hacer antes del PR. Ante la duda, la nota más baja.

### Resumen de notas

| Pantalla | Nota | Motivo |
|---|---|---|
| Alta de la aseguradora: casa matriz («Datos de la aseguradora») | ACEPTABLE CON RESERVAS | H5-01 y H5-02 cerrados en las tres celdas. Quedan solo MENOR: H5C-01 (el rótulo del mapa entre el campo y el aviso), H5C-02 («Nombre comercial» queda debajo del mapa), H5C-03 (zona horaria obligatoria debajo del mapa en países multizona, según el código, no observado), y H5-04 y H5-05 de la ronda anterior |
| Alta del laboratorio: paso de la central | ACEPTABLE CON RESERVAS | H5-01 cerrado en las tres celdas. Quedan MENOR: H5C-01 (misma disposición), H5-04, H5-05 y H5-06 |
| Alta de imagenología: paso de la central | ACEPTABLE CON RESERVAS | Igual que el laboratorio: H5-01 cerrado; quedan H5C-01, H5-04, H5-05 y H5-06, todos MENOR |
| Sucursales de laboratorio e imagenología (regresión) | ACEPTABLE CON RESERVAS | Sin regresión: la dirección opcional se vacía sin rojo y el aviso sigue dentro de su tarjeta, en las tres celdas. Quedan H5-04, H5-05 y H5-06, MENOR, de la ronda anterior |

Ninguna pantalla queda `APROBADA` porque siguen abiertos MENOR de H5. Ninguna queda `RECHAZADA`: no se encontró ningún BLOQUEANTE ni MAYOR del cambio. El MAYOR que sí se ve en estas capturas (contraste del mensaje de error en tema oscuro, H5C-H1) es heredado.

### Estado de H5-01 y H5-02

| ID | Estado | Qué lo sostiene |
|---|---|---|
| H5-01 (el vaciado pone el campo en rojo y sigue en rojo tras confirmar) | **CERRADO** | En las `-1-vaciada` y `-2-confirmada` de las tres altas y las tres celdas (18 capturas), el campo vacío tiene borde neutro y muestra su ayuda, no el mensaje de error: «La de la casa matriz. Las de cada sucursal se cargan después.» en la aseguradora y «Calle, número y zona. Es la que figura en tus papeles.» en las centrales. Contraste directo: `despues-aseguradora-1-vaciada-1440-claro.png` (borde y mensaje rojos) frente a `corregida-aseguradora-1-vaciada-1440-claro.png` (sin rojo), y `despues-laboratorio-central-2-confirmada-1440-claro.png` frente a `corregida-laboratorio-central-2-confirmada-1440-claro.png`. El rojo aparece solo en `-3-tocada` y `-4-al-avanzar`, como pide la decisión |
| H5-02 (en la aseguradora el aviso queda a unos 200 px, con «Nombre comercial» en medio) | **CERRADO** | `corregida-aseguradora-1-vaciada-1440-claro.png` y `corregida-aseguradora-1-vaciada-390-claro.png`: entre «Dirección» y el aviso ya no hay ningún control, y el aviso queda a 41 px del pie del campo a 1440 y a 58 px a 390 (salidas del guion; coincide con lo medido sobre la imagen). «Nombre comercial (opcional)» pasa debajo del mapa (`corregida-aseguradora-2-confirmada-1440-claro.png`). La disposición queda igual a la de las centrales. Residual: el rótulo del mapa sigue entre el campo y el aviso (H5C-01, MENOR, compartido con las centrales) |

### Capturas

| Alta | Estados | Celdas | Archivos |
|---|---|---|---|
| Aseguradora («Datos de la aseguradora», paso 2 de 8) | 1-vaciada · 2-confirmada · 3-tocada · 4-al-avanzar | 1440×1000 claro · 390×844 claro · 1440×1000 oscuro | `corregida-aseguradora-{1..4}-*-{1440-claro,390-claro,1440-oscuro}.png` (12) |
| Laboratorio, central (paso 4 de 10) | los mismos cuatro | las mismas tres | `corregida-laboratorio-central-*` (12) |
| Laboratorio, sucursal (paso 5 de 10) | 1-vaciada · 2-confirmada | las mismas tres | `corregida-laboratorio-sucursal-*` (6) |
| Imagenología, central (paso 5 de 11) | los mismos cuatro | las mismas tres | `corregida-imagenologia-central-*` (12) |
| Imagenología, sucursal (paso 6 de 11) | 1-vaciada · 2-confirmada | las mismas tres | `corregida-imagenologia-sucursal-*` (6) |

A 1440 cada captura muestra la ventana (1000 px de alto), no la página entera; a 390 muestran la página entera. La celda de escritorio del repo es 1440×900 (la matriz de viewports del repo); estas usan 1000 de alto (ver H5C-E1).

### Las diez preguntas, por grupo

#### G1 · Aseguradora, vaciada y confirmada, en claro

Capturas: `corregida-aseguradora-1-vaciada-1440-claro.png`, `corregida-aseguradora-2-confirmada-1440-claro.png`, `corregida-aseguradora-1-vaciada-390-claro.png` y `corregida-aseguradora-2-confirmada-390-claro.png`.

1. **Lo primero que se ve mal:** el pin, un círculo blanco sobre el plano claro, casi no se ve (H5-07, heredado). En lo que toca al cambio: el aviso cuelga del rótulo «Ubicación de la casa matriz en el mapa (opcional)» y no del campo; se lee como el encabezado del bloque del mapa (H5C-01).
2. **Texto cortado o solapado:** a 1440, en `-1`, la botonera flotante de la maqueta tapa «¿Es acá donde está la casa…» y la línea «Todavía no confirmaste…» queda cortada por el borde inferior; en `-2` el rótulo «NIT» sale cortado por el borde superior (encuadre). A 390 no hay cortes ni desborde horizontal; el rótulo del mapa ocupa dos renglones.
3. **¿Terminado o prototipo?** Terminado. El campo vacío con su ayuda en gris y el aviso informativo debajo forman un estado limpio, sin mezcla de tonos. La fila «Volver a ubicarme / ⊖ Quitar la ubicación» sigue sangrada unos 14 px respecto de la columna cuando no hay botón de confirmar (H5-09, heredado).
4. **Coherencia con el producto:** ahora sí es coherente con las centrales: campo → ayuda → rótulo del mapa → aviso → mapa. «Nombre comercial» pasa al final de la página, después del bloque del mapa (H5C-02).
5. **Tema oscuro:** no aplica en este grupo (el oscuro está en G3).
6. **¿El estado orienta?** Sí. El campo no acusa y el aviso dice qué hacer. En `-2` se suman «El punto del mapa se guarda tal cual… escribila vos arriba», «Si el pin no cayó justo…» y «Usá tu GPS o tocá el plano…»: cuatro textos de ayuda alrededor del mapa (H5-04, sigue).
7. **Jerarquía:** en `-1` la vista va al aviso; «Confirmar dirección actual» queda debajo del pliegue a 1440 y visible a 390. En `-2` la acción principal pasa a «Siguiente». Correcto.
8. **Datos:** NIT «1023456789», sintético. «Dirección» vacía. El plano muestra lugares públicos. No hay datos personales.
9. **¿Muestra el requisito?** Sí: el campo vacío no está en error ni al vaciarse ni tras confirmar, y el aviso queda a 41 px (1440) y 58 px (390) del campo, sin controles en medio.
10. **Motivo de rechazo:** ninguno MAYOR. Reservas: H5C-01 y H5C-02.

#### G2 · Aseguradora, tocada y al avanzar, en claro

Capturas: `corregida-aseguradora-3-tocada-1440-claro.png`, `corregida-aseguradora-4-al-avanzar-1440-claro.png`, `corregida-aseguradora-3-tocada-390-claro.png` y `corregida-aseguradora-4-al-avanzar-390-claro.png`. Las `-3` y `-4` de cada ancho tienen el mismo contenido salvo el encuadre del plano.

1. **Lo primero que se ve mal:** dos mensajes para un mismo hecho: el rojo «Escribí la dirección (hasta 300 caracteres).» y, debajo del rótulo del mapa, el aviso «Volvé a escribir la dirección para este punto.». Ahora el rojo llega después de una acción de la persona, que es lo que la decisión pide, y el aviso sigue al lado como pide el criterio. No se registra como defecto.
2. **Texto cortado o solapado:** a 1440 la botonera de la maqueta queda junto a «Atrás», sin taparlo. A 1440 el título de la página y «Paso 2 de 8» quedan fuera del encuadre; se ve el subtítulo «Lo que la plataforma necesita para facturarle y ubicarla.» (H5C-E5). A 390 no hay cortes.
3. **¿Terminado o prototipo?** Terminado. El error usa la molécula de campo del sistema.
4. **Coherencia con el producto:** el borde y el mensaje de error son los mismos que en las centrales (G5).
5. **Tema oscuro:** no aplica (G3).
6. **¿El estado orienta?** Sí. El error dice qué falta y el aviso dice por qué quedó vacío.
7. **Jerarquía:** la vista va al campo en rojo, que es lo que hay que resolver. Correcto.
8. **Datos:** igual que G1.
9. **¿Muestra el requisito?** Sí: tocar el campo lo marca (`-3`) e intentar avanzar lo marca sin dejar pasar (`-4`; a 390 se ve «Paso 2 de 8»). El NIT lleno sigue sin rojo, así que el único rojo es la dirección.
10. **Motivo de rechazo:** ninguno del cambio.

#### G3 · Aseguradora en oscuro

Capturas: `corregida-aseguradora-{1-vaciada,2-confirmada,3-tocada,4-al-avanzar}-1440-oscuro.png`.

1. **Lo primero que se ve mal:** en `-3` y `-4` el mensaje de error se lee muy tenue sobre la tarjeta oscura; el README lo mide en 2,99:1 (H5C-H1, heredado, MAYOR). El plano sigue en colores claros y encandila (H5-08, heredado).
2. **Texto cortado o solapado:** la atribución del mapa es ilegible y «Iniciá sesión» casi no se lee (H5-08). La botonera de la maqueta tapa «¿Es acá donde está la casa…» en `-1`.
3. **¿Terminado o prototipo?** Lo propio del cambio se ve terminado: el campo vacío sin rojo y el aviso con los tokens oscuros.
4. **Coherencia con el producto:** coherente con las centrales en oscuro (G6).
5. **Tema oscuro:** el aviso se lee bien (fondo verde azulado, texto claro). El borde rojo se distingue en `-3` y `-4`, pero su mensaje no (H5C-H1). El asterisco de «Dirección *» también queda tenue (heredado). El pin oscuro se ve mejor que en claro.
6. **¿El estado orienta?** En `-1` y `-2` sí. En `-3` y `-4` la orientación depende de un mensaje de bajo contraste (heredado).
7. **Jerarquía:** «Confirmar dirección actual» y «Siguiente» en aguamarina destacan. Correcto.
8. **Datos:** igual que G1.
9. **¿Muestra el requisito?** Sí, en las cuatro: sin rojo al vaciar y al confirmar; rojo al tocar y al avanzar; aviso junto al campo.
10. **Motivo de rechazo:** solo heredados (H5C-H1, H5-08).

#### G4 · Centrales de laboratorio e imagenología, vaciada y confirmada, en claro

Capturas: `corregida-laboratorio-central-{1-vaciada,2-confirmada}-{1440-claro,390-claro}.png` y `corregida-imagenologia-central-{1-vaciada,2-confirmada}-{1440-claro,390-claro}.png`. Las de laboratorio e imagenología son iguales salvo el título, el número de paso y «tu laboratorio» / «tu centro».

1. **Lo primero que se ve mal:** el campo vacío muestra en gris «Av. Cañoto esq. Ballivián 234, Zona Central», que de un vistazo parece escrito (H5-06, sigue). El pin casi no se ve (H5-07).
2. **Texto cortado o solapado:** a 390 el ejemplo se corta («Zona C…»), como antes del cambio. A 1440 la botonera de la maqueta tapa «Sin el punto, tu laboratorio/centro…» y el botón circular de volver.
3. **¿Terminado o prototipo?** Terminado. Sin el rojo, el estado deja de verse «sin resolver», que era la queja de H5-01.
4. **Coherencia con el producto:** coherente con la aseguradora corregida y con las sucursales: el mismo gesto ya no produce error en un paso y no en otro.
5. **Tema oscuro:** no aplica (G6).
6. **¿El estado orienta?** Sí. Siguen varias ayudas alrededor del mapa (H5-04). A 390 debajo de la tarjeta aparece «Tus datos están a salvo» con «Tu información clínica la ve el profesional que te atiende, nadie más.», un texto de paciente en el alta de una empresa (H5C-H2, heredado).
7. **Jerarquía:** en `-1` la acción es «Confirmar dirección actual»; en `-2`, la flecha de avanzar. Correcto.
8. **Datos:** ejemplos de calle pública. No hay datos personales.
9. **¿Muestra el requisito?** Sí: vacío sin rojo, al vaciar y al confirmar, en los dos anchos.
10. **Motivo de rechazo:** ninguno MAYOR. Reservas H5-04, H5-05, H5-06 y H5C-01.

#### G5 · Centrales, tocada y al avanzar, en claro

Capturas: `corregida-laboratorio-central-{3-tocada,4-al-avanzar}-{1440-claro,390-claro}.png` y `corregida-imagenologia-central-{3-tocada,4-al-avanzar}-{1440-claro,390-claro}.png`.

1. **Lo primero que se ve mal:** nada nuevo. El borde y el mensaje rojos conviven con el ejemplo en gris dentro del campo; en rojo, el ejemplo con forma de dirección confunde algo más (H5-06).
2. **Texto cortado o solapado:** a 1440, en `-4`, la página se desplazó unos 29 px; título y paso siguen visibles. La botonera de la maqueta tapa el botón circular de volver.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** coherente con la aseguradora (G2).
5. **Tema oscuro:** no aplica (G6).
6. **¿El estado orienta?** Sí: «Escribí la dirección legal de la central.» y el aviso al lado.
7. **Jerarquía:** la vista va al campo en rojo.
8. **Datos:** igual que G4.
9. **¿Muestra el requisito?** Sí: rojo solo tras tocar el campo o pulsar avanzar; en `-4` se ve que sigue en «Dónde está la central» («Paso 4 de 10» y «Paso 5 de 11»).
10. **Motivo de rechazo:** ninguno del cambio.

#### G6 · Centrales en oscuro

Capturas: `corregida-laboratorio-central-{1..4}-*-1440-oscuro.png` y `corregida-imagenologia-central-{1..4}-*-1440-oscuro.png`.

1. **Lo primero que se ve mal:** el mensaje de error tenue en `-3` y `-4` (H5C-H1) y el plano claro que encandila (H5-08). La atribución del mapa es ilegible en las centrales pero legible en las sucursales en oscuro (G7), con el mismo componente (heredado).
2. **Texto cortado o solapado:** la botonera de la maqueta tapa «Sin el punto…» y el botón de volver.
3. **¿Terminado o prototipo?** Terminado en lo propio del cambio.
4. **Coherencia con el producto:** idéntico a la aseguradora en oscuro.
5. **Tema oscuro:** el aviso y el campo vacío se leen bien; el mensaje de error, no (heredado).
6. **¿El estado orienta?** Igual que G3.
7. **Jerarquía:** correcta.
8. **Datos:** igual que G4.
9. **¿Muestra el requisito?** Sí en las ocho.
10. **Motivo de rechazo:** solo heredados.

#### G7 · Sucursales de laboratorio e imagenología (regresión)

Capturas: `corregida-laboratorio-sucursal-{1-vaciada,2-confirmada}-{1440-claro,390-claro,1440-oscuro}.png` y `corregida-imagenologia-sucursal-{1-vaciada,2-confirmada}-{1440-claro,390-claro,1440-oscuro}.png`.

1. **Lo primero que se ve mal:** en la tarjeta «Sucursal 1» conviven dos ⊖ con funciones distintas: el de quitar la sucursal (arriba a la derecha, sin rótulo) y «⊖ Quitar la ubicación» (ahora con rótulo). El pin casi no se ve en claro.
2. **Texto cortado o solapado:** a 390 la atribución del mapa se parte en dos renglones y «contributors» cae sobre el borde inferior del plano; «Volver a ubicarme» y «Quitar la ubicación» quedan cada uno en su renglón con mucho aire (H5C-H3, heredado). A 1440, en `-2`, el campo de la dirección queda fuera del encuadre y la botonera de la maqueta tapa «Tus datos están a salvo».
3. **¿Terminado o prototipo?** A 1440, terminado. A 390, la pila de tres botones con separación desigual se ve menos acabada (heredado).
4. **Coherencia con el producto:** el aviso sigue dentro de la tarjeta, pegado a su campo. Coherente.
5. **Tema oscuro:** el aviso y la tarjeta usan bien los tokens oscuros; aquí la atribución sí se lee.
6. **¿El estado orienta?** Sí. Como el campo es opcional, no hay rojo, igual que antes del cambio.
7. **Jerarquía:** correcta.
8. **Datos:** «Sucursal Equipetrol» y «Av. San Martín 456» son ejemplos del campo; el nombre de la sucursal también está vacío porque el recorrido no lo escribe.
9. **¿Muestra el requisito?** Para la regresión, sí: la sucursal se vacía sin rojo y con su aviso, en las tres celdas. A 390 la `-2` sí muestra el campo vacío tras confirmar, lo que cierra en ese ancho lo que H5-E2 señalaba.
10. **Motivo de rechazo:** ninguno del cambio. Las `-2` de 1440 de laboratorio e imagenología son idénticas byte a byte (H5C-E2).

### Hallazgos

#### Defectos del cambio

| ID | Severidad | Origen | Descripción | Captura o `ruta:línea` |
|---|---|---|---|---|
| H5C-01 | MENOR | Del cambio (en la aseguradora); en las centrales viene de H5, misma familia que H5-12 | Entre el campo y el aviso quedan la ayuda del campo y el rótulo del mapa: «Ubicación de la casa matriz en el mapa (opcional)», que a 390 ocupa dos renglones, o «Ubicación en el mapa (opcional)». El aviso se lee como encabezado del bloque del mapa más que como nota del campo. Cumple el criterio («se lee junto al campo»: 41 px a 1440, 37–58 px a 390, sin controles en medio), pero no está «pegado» como dice el README. La comprobación del guion solo cuenta `input`, `select` y `textarea`, así que no ve el rótulo (`playwright/mapa-vacia-direccion.mjs:156`) | `corregida-aseguradora-1-vaciada-390-claro.png`, `corregida-*-central-1-vaciada-*` |
| H5C-02 | MENOR | Del cambio | Al mover el mapa, «Nombre comercial (opcional)» queda al final de la página, separado del NIT por todo el bloque de ubicación (unos 700 px a 1440) y fuera del primer pliegue en `-1`. Es opcional y el orden nuevo agrupa bien la ubicación, pero es un campo de identidad, no de ubicación. Conviene que producto lo confirme | `corregida-aseguradora-1-vaciada-1440-claro.png` (no se ve), `corregida-aseguradora-2-confirmada-1440-claro.png`; `src/app/features/auth/register-organization/register-organization.ts:575` y `:599` |
| H5C-03 | MENOR | Del cambio. Según el código, no observado | En países con varias zonas horarias, «Zona horaria de la casa matriz», que es obligatoria, pasa a ir después del mapa. Un rechazo por zona vacía queda debajo de un plano de unos 320 px. Ninguna captura ni ningún spec recorre un país multizona; el README lo declara no cubierto | `src/app/features/auth/register-organization/register-organization.ts:584-597` |

#### Heredados (no cuentan para la nota)

| ID | Severidad | Hallazgo | Capturas o `ruta:línea` |
|---|---|---|---|
| H5C-H1 | MAYOR | En tema oscuro el mensaje de error del campo se lee muy tenue. El README lo mide en 2,99:1, por debajo del 4,5:1 de AA; en la imagen se confirma que se ve apagado. El color es un tono fijo de la rampa y no el token de estado que cambia con el tema. Importa más ahora: en oscuro, el rojo que aparece al tocar o al avanzar es la señal principal, y es la que menos se lee. La molécula es compartida y este cambio no la toca | Las seis `-3-tocada` y `-4-al-avanzar` en `1440-oscuro`; `src/app/shared/components/molecules/form-field/form-field.css:149` |
| H5C-H2 | MENOR | «Tus datos están a salvo» dice «Tu información clínica la ve el profesional que te atiende, nadie más.» en el alta de un laboratorio o de un centro de imagenología, donde quien se registra es una empresa, no un paciente | Todas las capturas a 390 de laboratorio e imagenología y las `-sucursal-2` a 1440; `src/app/shared/components/organisms/registro-ayuda/registro-ayuda.html:31` |
| H5C-H3 | MENOR | A 390, dentro de la tarjeta de la sucursal, la atribución del mapa se parte en dos renglones y los botones «Volver a ubicarme» y «Quitar la ubicación» quedan apilados con mucho aire, alineados unos 14 px más adentro que la columna | `corregida-*-sucursal-{1,2}-390-claro.png` |
| H5C-H4 | MENOR | Según el código, no observado: el aviso no forma parte de la descripción accesible del campo. `describedBy` solo junta el error, la ayuda y la descripción del propio campo, y el aviso vive en el campo del mapa. Quien vuelve con lector de pantalla al campo vacío oye su rótulo y su ayuda, no el aviso; el aviso se anunció una sola vez, al aparecer. Viene de H5, no de esta microtarea | `src/app/shared/components/molecules/form-field/form-field.ts:104-113`; `src/app/features/auth/register-organization/register-organization.html:67-79` |

Estado de los hallazgos abiertos de la ronda anterior, visto en estas capturas:

| ID | Estado | Nota |
|---|---|---|
| H5-04 (varias ayudas alrededor del mapa) | SIGUE | Todas las `-2` y `-1` |
| H5-05 (la confirmación solo se percibe porque desaparece el botón) | SIGUE | Todas las `-2`; el pin no cambia de aspecto visible entre `-1` y `-2` |
| H5-06 (el ejemplo en gris parece una dirección escrita) | SIGUE en las centrales y sucursales; no aplica en la aseguradora, cuyo campo no tiene ejemplo | `corregida-*-central-*`, `corregida-*-sucursal-*` |
| H5-07 (pin casi invisible en claro) | SIGUE (heredado) | Todas las claras |
| H5-08 (plano claro en oscuro, atribución e «Iniciá sesión» ilegibles) | SIGUE (heredado) | Todas las oscuras de la aseguradora y las centrales |
| H5-09 (fila «Volver a ubicarme ⊖» sangrada, ⊖ sin rótulo) | CAMBIA (heredado) | El ⊖ ahora dice «Quitar la ubicación». Viene de otro cambio del carril (los botones del mapa con ícono y nombre), no de H5.S2.M6. Siguen el sangrado de unos 14 px y, en las sucursales, el ⊖ sin rótulo de la tarjeta junto al que ahora tiene nombre |
| H5-11 (botonera flotante de la maqueta tapa contenido) | SIGUE a 1440 (heredado); no aparece a 390 | Casi todas las de 1440 |
| H5-E2 (confirmadas con el campo fuera del encuadre) | CAMBIA | Resuelto a 390 (página entera). Sigue a 1440 en las `-sucursal-2` |

#### Defectos de la evidencia

| ID | Severidad | Hallazgo | Qué hace falta |
|---|---|---|---|
| H5C-E1 | MENOR | El orden de la página de la aseguradora cambió y solo hay 1440 y 390. La norma del repo pide cinco viewports para páginas y admite uno solo con justificación escrita (la regla de evidencia visual del repo). El README lista 768, 1024 y 1920 como no mirados, pero no da la justificación. Según el código, la página es de una columna en todos los anchos (sin `disposicion` y con campos que ocupan la fila entera, `src/app/shared/components/organisms/paginated-form/paginated-form.css:71-84`), así que el riesgo de responsive es bajo. Además, la celda de escritorio se tomó a 1440×1000 y no a 1440×900 | Escribir esa justificación en el README y en el reporte, o sumar las capturas de 768, 1024 y 1920 de la aseguradora, antes del PR |
| H5C-E2 | MENOR | `corregida-laboratorio-sucursal-2-confirmada-1440-claro.png` y `corregida-imagenologia-sucursal-2-confirmada-1440-claro.png` son idénticas byte a byte (mismo hash), y lo mismo pasa con sus versiones `1440-oscuro`. La imagen no permite saber de qué alta sale cada una, y el campo queda fuera del encuadre | Encuadrar la `-2` de 1440 con el título, el paso y el campo, como a 390 |
| H5C-E3 | MENOR | Las capturas de antes (`despues-*`) son anteriores al cambio que puso nombre a los botones del mapa. Entre el antes y el después hay diferencias que no son de H5.S2.M6, como «⊖» frente a «⊖ Quitar la ubicación». El README no lo aclara y dice «igual que antes del cambio» para las sucursales | Una línea en el README que diga que la base de las `despues-*` es anterior |
| H5C-E4 | MENOR | Las tres salidas del guion no registran ni el ancho ni el tema. `navegador-h5s2m6-1440-oscuro.txt` tiene el mismo texto que `navegador-h5s2m6-1440-claro.txt`, y solo el nombre del archivo lo liga al oscuro; las imágenes lo corroboran | Que el guion imprima la celda (`CELDA`, `playwright/mapa-vacia-direccion.mjs:37`) en su salida |
| H5C-E5 | MENOR | En `corregida-aseguradora-4-al-avanzar-1440-{claro,oscuro}.png` el título «Datos de la aseguradora» y «Paso 2 de 8» quedan fuera del encuadre. Que la página no avanzó se sostiene con la comprobación «y no deja pasar de página» y con la captura de 390, no con la de 1440 | Encuadre que incluya el título |

### Afirmaciones del README que no se sostienen

1. Línea 99–100: «a 390, 58 px en la aseguradora (su ayuda ocupa dos renglones)». La causa no es esa. El pie que mide el guion es el del `app-form-field` e incluye la ayuda del campo (`playwright/mapa-vacia-direccion.mjs:162`). Los 21 px de diferencia con las centrales son el segundo renglón del rótulo del mapa, «Ubicación de la casa matriz en el mapa (opcional)», que a 390 se parte y el de las centrales no. Medido sobre `corregida-aseguradora-1-vaciada-390-claro.png`: la ayuda termina cerca de y=606, el rótulo ocupa y≈620–660 y el aviso empieza cerca de y=665. En `corregida-laboratorio-central-1-vaciada-390-claro.png`, rótulo de un renglón y 37 px.
2. Línea 126: «el aviso en dos renglones justo después de la ayuda del campo». Entre la ayuda y el aviso está el rótulo del mapa, en dos renglones (misma captura).
3. Línea 110: «el aviso en la línea siguiente, sobre el mapa». A 1440 entre el campo y el aviso están la ayuda y el rótulo del mapa (`corregida-aseguradora-1-vaciada-1440-claro.png`). Es «cerca y sin controles en medio», no «la línea siguiente».
4. Línea 118: «igual que antes del cambio» (sucursal). Se sostiene para el comportamiento (sin rojo, aviso debajo). No se sostiene para la imagen: los botones del mapa cambiaron por otro cambio del carril (H5C-E3).
5. Línea 113: «sigue en «Datos de la aseguradora»». La captura de 1440 no lo muestra (H5C-E5). Lo sostienen el guion y la captura de 390.

Se sostienen contra las imágenes y las salidas: sin rojo al vaciar ni al confirmar; rojo al tocar y al avanzar; «Nombre comercial» debajo del mapa; «0 controles en medio»; 41 px a 1440 en las tres altas; 85/85 por celda (3 × 21 comprobaciones de las direcciones obligatorias + 2 × 10 de las sucursales + 2 globales; coincide por aritmética con el 85 de la corrida original, que era otro recorrido); consola y red sin errores con 0 avisos de CSP excluidos; y la reserva del mensaje tenue en oscuro.

Fuera del material pedido, pero se encontró al verificar el criterio: `PLAN.md:322` sigue en `EN CURSO` con «sin correr todavía», y el `REPORTE.md` (sección H5.S2.M6) dice «nada verificado todavía». Las salidas de specs y guion ya existen. Hay que actualizarlos antes de cerrar.

### Specs y guion: qué prueban y qué no

- Specs, rojo sin el arreglo y verde con él (`specs-h5s2m6-rojo-sin-arreglo.txt`: 4 fallidas de 113; `specs-h5s2m6-verde.txt`: 113/113). Discriminan el arreglo las tres «la deja vacía sin marcarla en rojo, aunque la persona ya la hubiera tocado» (`register-organization.spec.ts:646`, `register-laboratory.spec.ts:322`, `register-imaging-center.spec.ts:368`) y «el aviso queda junto a «Dirección»: el mapa es el campo siguiente» (`register-organization.spec.ts:657`). Las de «tocarla después» y «intentar avanzar» pasan con y sin el arreglo: vigilan que el arreglo no apague de más, y es correcto que no discriminen. Los specs emiten `puntoElegido` directo sobre el selector de ubicación; no ejercitan un toque real sobre el plano.
- Guion: las comprobaciones nuevas (`playwright/mapa-vacia-direccion.mjs:196-205`, `:221-223`, `:235-267`) miden «rojo» como `aria-invalid="true"` o la presencia de `.form-field-error` (`:143-149`). Con eso el «sin rojo» cubre el borde y el mensaje de la molécula. «Único rojo de la página» solo cuenta `.form-field-error` (`:258-261`). «Sin otro control en medio» no ve rótulos ni botones (H5C-01). La espera de teselas se traga su propio vencimiento (`:106-113`, `.catch(() => {})`); en estas 48 imágenes el plano está completo.

### No cubierto

- 768×1024, 1024×768 y 1920×1080 en las tres altas, y el tema oscuro a 390 (H5C-E1).
- La aseguradora en un país con varias zonas horarias, donde la zona queda debajo del mapa (H5C-03).
- Lo que una imagen no muestra: `aria-invalid`, el anuncio de la región viva, la descripción accesible del campo (H5C-H4), a dónde va el foco tras pulsar «Siguiente» sin reescribir, y el orden de tabulación nuevo en la aseguradora (Dirección → controles del mapa → Nombre comercial).
- Volver a la página después de haber pasado de ella, y el vaciado por «Volver a ubicarme» (GPS) en lugar de un toque sobre el plano.
- No se revisaron las salidas de tipos, lint ni compilación de este cambio.

---

<!-- Ronda 7 -->

## Segunda pasada visual, repetida: H5.S2.M6

- Fecha: 2026-09-24
- Qué se repite: la segunda pasada de H5.S2.M6 («Direcciones obligatorias sin rojo al vaciar, aviso junto al campo»), sobre las capturas que se volvieron a tomar después de la primera ronda. El código de producto de las tres altas no cambió: el diff de `register-organization.ts`, `register-laboratory.ts` y `register-imaging-center.ts` tiene el mismo texto que en la ronda 1. Cambiaron el guion, las capturas, un spec y el README.
- Material revisado:
  - Las 60 capturas `corregida-*.png` de `docs/frontend/evidence/mapa-vacia-direccion-2026-09-23/`. Se abrieron como imagen las 60; las 12 de 1920, 1024 y 768 son nuevas.
  - `docs/frontend/evidence/mapa-vacia-direccion-2026-09-23/README.md`, secciones «Direcciones obligatorias: corrección del 24/09» y «No cubierto», completas.
  - En `docs/trabajo/2026-09-23-perfil-medico-configurar-tu-perfil/evidencia/h5/`: las siete salidas `navegador-h5s2m6-*.txt` (incluida `-1440-oscuro-laboratorio-repetido`), `capturas-h5s2m6-sin-blancos.txt`, `specs-h5s2m6-rojo-multizona.txt` y `specs-h5s2m6-verde.txt`.
  - El guion `playwright/mapa-vacia-direccion.mjs` en su estado actual (función `capturar`, `playwright/mapa-vacia-direccion.mjs:102-126`) y el spec nuevo de `src/app/features/auth/register-organization/register-organization.spec.ts:665-679`.
- Método: segunda pasada adversarial, con las diez preguntas de `critical-double-review` §3 por grupo de capturas equivalentes (el agrupamiento se declara en cada grupo) y severidad por hallazgo. Se arrastra cada hallazgo de la ronda 1 con `CERRADO`, `SIGUE` o `CAMBIA`.
- Límite del método: solo se miraron imágenes y se leyeron archivos; no se ejecutó nada. En una imagen no se ven `aria-invalid`, el anuncio de la región viva, la descripción accesible, el foco ni la posición en la que queda la página tras pulsar «Siguiente». Lo que solo sale del código o de las fechas de los archivos se marca así («según el código» o «según las fechas de los archivos»). Las medidas en píxeles son de las salidas del guion; las que se estiman sobre la imagen se dan con ±3 px.
- Regla de nota:
  - `RECHAZADA`: queda algún BLOQUEANTE o MAYOR del cambio o del requisito.
  - `ACEPTABLE CON RESERVAS`: solo quedan MENOR del cambio.
  - `APROBADA`: no quedan hallazgos abiertos.
  - Los heredados y los defectos de la evidencia se listan aparte y no cuentan para la nota; los de evidencia se resuelven antes del PR. Ante la duda, la nota más baja.

### Resumen de notas

| Pantalla | Nota | Motivo |
|---|---|---|
| Alta de la aseguradora (casa matriz, «Datos de la aseguradora») | ACEPTABLE CON RESERVAS | H5-01 y H5-02 siguen cerrados, ahora en seis celdas (1920, 1440, 1024, 768 y 390 en claro; 1440 en oscuro). Quedan MENOR del cambio: H5C-01, H5C-02, H5C-03 y H5C-04 (nuevo, según el código), más H5-04 y H5-05 |
| Alta del laboratorio: paso de la central | ACEPTABLE CON RESERVAS | Sin rojo al vaciar ni al confirmar; rojo al tocar y al avanzar, en las tres celdas. Quedan MENOR: H5C-01, H5-04, H5-05 y H5-06 |
| Alta de imagenología: paso de la central | ACEPTABLE CON RESERVAS | Igual que el laboratorio |
| Sucursales de laboratorio e imagenología (regresión) | ACEPTABLE CON RESERVAS | Sin regresión en las tres celdas. Siguen H5-04, H5-05 y H5-06 |

Ninguna pantalla queda `RECHAZADA`: no aparece ningún BLOQUEANTE ni MAYOR del cambio. El MAYOR heredado H5C-H1 sigue visible en las capturas oscuras «tocada» y «al avanzar», y se suma un posible MAYOR heredado, H5C-H5, según el código y no observado. Ninguno cuenta para la nota. Antes del PR quedan dos defectos de evidencia por corregir: dos filas del README contradicen sus imágenes (H5C-E6) y los gates no corrieron sobre el árbol final (H5C-E8).

### Estado de los hallazgos anteriores

| ID | Sev. | Estado | Qué lo sostiene |
|---|---|---|---|
| H5-01 (el vaciado pone el campo en rojo) | MAYOR | **CERRADO** (sigue cerrado) | Las 30 capturas «vaciada» y «confirmada» de las direcciones obligatorias, en las seis celdas, muestran el campo con borde neutro y su ayuda. Las cuatro nuevas de 1920/1024/768 lo confirman: `corregida-aseguradora-{1,2}-{1920,1024,768}-claro.png` |
| H5-02 (aviso a ~200 px con «Nombre comercial» en medio) | MAYOR | **CERRADO** (sigue cerrado) | Sin controles en medio, a 37–58 px según la celda (salidas del guion: 37 a 1440 y 1024, 41 a 1920 y 768, 58 a 390). Se ve en `corregida-aseguradora-1-vaciada-{1920,1440,1024,768,390}-claro.png` |
| H5C-01 (ayuda y rótulo del mapa entre el campo y el aviso) | MENOR | **SIGUE** | Declarado en el README como MENOR aceptado. En todas las «vaciada» |
| H5C-02 («Nombre comercial» al final, lejos del NIT) | MENOR | **SIGUE** | Declarado «a confirmar con producto». A 1920 se ve la página entera, con «Nombre comercial» debajo del mapa (`corregida-aseguradora-1-vaciada-1920-claro.png`). Ver también H5C-04 |
| H5C-03 (zona horaria obligatoria debajo del mapa en países multizona) | MENOR | **CAMBIA** | El spec nuevo cubre la otra mitad del problema: que el mapa quede pegado a «Dirección» también en un país multizona (`register-organization.spec.ts:665-679`). Que la zona obligatoria quede debajo del mapa sigue igual y sin captura. Además, el spec no prueba que haya recorrido el caso multizona (H5C-E7) |
| H5C-H1 (contraste del mensaje de error en oscuro) | MAYOR, heredado | **SIGUE** | `corregida-*-{3-tocada,4-al-avanzar}-1440-oscuro.png`. Ahora el README lo declara |
| H5C-H2 (texto de paciente en el alta de empresas) | MENOR, heredado | **SIGUE** | Capturas de 390 y las de sucursal «confirmada» a 1440. Ahora el README lo declara |
| H5C-H3 (a 390, atribución en dos renglones y botones apilados en la sucursal) | MENOR, heredado | **SIGUE** | `corregida-*-sucursal-{1,2}-390-claro.png`. El README lo describe como observación, no como hallazgo |
| H5C-H4 (el aviso no forma parte de la descripción accesible del campo) | MENOR, heredado | **SIGUE** (según el código) | Ahora el README lo declara |
| H5C-E1 (faltaban 768/1024/1920 y su justificación) | MENOR | **CERRADO** | Hay 12 capturas nuevas de la aseguradora a 1920, 1024 y 768, y una justificación escrita para no tomarlas en las centrales (README, «No cubierto»). Las celdas usan los altos del repo (`playwright/mapa-vacia-direccion.mjs:37`) |
| H5C-E2 (las «confirmada» de sucursal a 1440, idénticas) | MENOR | **CAMBIA** | Siguen idénticas byte a byte, en claro y en oscuro (hashes iguales), y el campo sigue fuera del encuadre. Ahora el README lo declara y lo explica. Queda como residuo MENOR: esas dos imágenes no prueban por sí mismas de qué alta salen; a 390 sí se ve |
| H5C-E3 (las capturas de antes son previas al cambio de los botones) | MENOR | **CERRADO** | Declarado en el README |
| H5C-E4 (la salida del guion no decía la celda) | MENOR | **CERRADO** | Las siete salidas empiezan con `celda: <ancho>×<alto> · tema … · recorridos …` |
| H5C-E5 («al avanzar» a 1440 sin título) | MENOR | **CERRADO** | «Datos de la aseguradora» y «Dónde está la central» a la vista en todas las «tocada» y «al avanzar» de escritorio. El contador de pasos no se ve a 1440/1920/1024 (declarado); a 768 y 390 sí. Ver H5C-E9, que sale de cómo se resolvió |
| Afirmación del README sobre los 58 px | — | **CERRADO** | Corregida: se debe al rótulo del mapa partido en dos renglones |
| Afirmaciones «justo después de la ayuda» y «la línea siguiente» | — | **CERRADO** | Corregidas: la tabla dice que debajo del campo van su ayuda, el rótulo del mapa y el aviso |
| Afirmación «igual que antes del cambio» (sucursales) | — | **CERRADO** | Ya no se dice de las sucursales. Sigue en la línea 145 para el ejemplo cortado a 390, sin una captura de antes a 390 (ver H5C-E6) |
| Afirmación «sigue en Datos de la aseguradora» sin la imagen | — | **CERRADO** | El título se ve en `corregida-aseguradora-4-al-avanzar-1440-claro.png` |
| Estado viejo en `PLAN.md`/`REPORTE.md` (fuera del material pedido) | — | **SIGUE** | `REPORTE.md:92` sigue diciendo «nada verificado todavía» y `REPORTE.md:98` «nada de esto corrió». Además, `PLAN.md:322` dice «sin correr todavía» |
| H5-04, H5-05, H5-06 | MENOR | **SIGUE** | Todas las «confirmada» (H5-04 y H5-05); el ejemplo en gris de las centrales y las sucursales (H5-06) |
| H5-07, H5-08, H5-11 | heredados | **SIGUE** | El pin claro casi no se ve; en oscuro, el plano encandila y la atribución e «Iniciá sesión» no se leen; la botonera de la maqueta tapa texto y, a 1024, el pie del bloque del mapa |
| H5-09 | MENOR, heredado | **SIGUE** | El sangrado de «Volver a ubicarme» sin el botón de confirmar |
| H5-E2 | MENOR | **CAMBIA** | Resuelto a 390 y en las centrales (con título y campo a la vista). Sigue en las «confirmada» de sucursal a 1440 (H5C-E2) |

### Capturas

| Alta | Estados | Celdas | Archivos |
|---|---|---|---|
| Aseguradora («Datos de la aseguradora», paso 2 de 8) | 1-vaciada · 2-confirmada · 3-tocada · 4-al-avanzar | 1920×1080, 1440×900, 1024×768, 768×1024 y 390×844 en claro; 1440×900 en oscuro | `corregida-aseguradora-*` (24) |
| Laboratorio, central (paso 4 de 10) | los mismos cuatro | 1440×900 claro · 390×844 claro · 1440×900 oscuro | `corregida-laboratorio-central-*` (12; las seis oscuras salen de la repetición) |
| Imagenología, central (paso 5 de 11) | los mismos cuatro | las mismas tres | `corregida-imagenologia-central-*` (12) |
| Laboratorio, sucursal (paso 5 de 10) | 1-vaciada · 2-confirmada | las mismas tres | `corregida-laboratorio-sucursal-*` (6) |
| Imagenología, sucursal (paso 6 de 11) | 1-vaciada · 2-confirmada | las mismas tres | `corregida-imagenologia-sucursal-*` (6) |

A 1920, 1440 y 1024 las capturas son la ventana. En las de direcciones obligatorias, el guion lleva el título del paso al borde superior antes de capturar (`playwright/mapa-vacia-direccion.mjs:109-113`). A 768 y 390 son la página entera. Ninguna de las 60 salió en blanco: se abrieron todas y coincide con `capturas-h5s2m6-sin-blancos.txt`, donde el mínimo es 3,76 %.

### Las diez preguntas, por grupo

#### G1 · Aseguradora a 1920×1080, claro (nuevas)

Capturas: `corregida-aseguradora-{1-vaciada,2-confirmada,3-tocada,4-al-avanzar}-1920-claro.png`.

1. **Lo primero que se ve mal:** el pin, un círculo blanco sobre el plano claro, casi no se ve (H5-07, heredado). Los campos se estiran a unos 1700 px: un NIT de diez dígitos en una caja de ese ancho. Es la regla del cliente de ir «a lo ancho» (regla del cliente del 09/09), no un defecto.
2. **Texto cortado o solapado:** no hay cortes. La botonera de la maqueta queda sobre el pie, junto a «¿Ya tenés cuenta?», sin taparlo.
3. **¿Terminado o prototipo?** Terminado. A este ancho la página entera entra en la ventana: título, NIT, «Dirección», aviso, mapa, «Nombre comercial» y la botonera.
4. **Coherencia con el producto:** es el mismo orden que a 1440, 768 y 390.
5. **Tema oscuro:** no aplica (no hay oscuro a 1920; declarado).
6. **¿El estado orienta?** Sí. En «confirmada» se juntan cuatro textos de ayuda alrededor del mapa (H5-04).
7. **Jerarquía:** en «vaciada» destacan «Confirmar dirección actual» y «Siguiente», ambos en petróleo lleno; están separados por unos 200 px y un campo, y el primero pertenece al bloque del mapa. Es aceptable.
8. **Datos:** NIT sintético. No se ven datos personales.
9. **¿Muestra el requisito?** Sí: sin rojo en 1 y 2; rojo con «Escribí la dirección (hasta 300 caracteres).» en 3 y 4; el aviso a 41 px, sin controles en medio. En 4, el título sigue siendo «Datos de la aseguradora».
10. **Motivo de rechazo:** ninguno del cambio. La afirmación del README sobre esta celda no se sostiene (H5C-E6).

#### G2 · Aseguradora a 1024×768, claro (nuevas)

Capturas: `corregida-aseguradora-{1-vaciada,2-confirmada,3-tocada,4-al-avanzar}-1024-claro.png`.

1. **Lo primero que se ve mal:** la botonera de la maqueta tapa «Si el pin no cayó justo, tocá el mapa…» en 1, 3 y 4, y «Quitar la ubicación» en 2. «Confirmar dirección actual» queda cortado por el borde inferior de la ventana (H5-11 y encuadre).
2. **Texto cortado o solapado:** además de lo anterior, a este alto no entran «Nombre comercial» ni «Siguiente». Es el tamaño de la ventana, no un defecto.
3. **¿Terminado o prototipo?** Terminado. El aviso ocupa un renglón.
4. **Coherencia con el producto:** es el mismo orden que en los demás anchos.
5. **Tema oscuro:** no aplica.
6. **¿El estado orienta?** Sí, en lo que entra en la ventana.
7. **Jerarquía:** la vista va al campo y al aviso. «Siguiente» queda unos 250 px por debajo de la ventana, así que tras pulsarlo el campo en rojo queda arriba, fuera de la vista (H5C-H5, según el código).
8. **Datos:** igual que G1.
9. **¿Muestra el requisito?** Sí. En 2, a diferencia de lo que dice el README, «Dirección» sí se ve: vacía y sin rojo, con el título arriba (H5C-E6).
10. **Motivo de rechazo:** ninguno del cambio.

#### G3 · Aseguradora a 768×1024, claro (nuevas)

Capturas: `corregida-aseguradora-{1-vaciada,2-confirmada,3-tocada,4-al-avanzar}-768-claro.png`, de página entera.

1. **Lo primero que se ve mal:** nada propio del cambio. El pin claro casi no se ve (H5-07).
2. **Texto cortado o solapado:** no hay cortes ni desborde horizontal. La etiqueta «Demo» cuelga bajo el conmutador de tema, igual que a 390.
3. **¿Terminado o prototipo?** Terminado. Es la celda más limpia: la página entera, con «Paso 2 de 8».
4. **Coherencia con el producto:** mismo orden y mismos componentes.
5. **Tema oscuro:** no aplica.
6. **¿El estado orienta?** Sí. En 2 siguen los textos redundantes (H5-04).
7. **Jerarquía:** correcta. «Siguiente» queda a unos 800 px del campo (H5C-H5).
8. **Datos:** igual que G1.
9. **¿Muestra el requisito?** Sí, los cuatro estados. El aviso está a 41 px.
10. **Motivo de rechazo:** ninguno del cambio.

#### G4 · Aseguradora a 1440×900 y 390×844, claro (re-capturadas)

Capturas: `corregida-aseguradora-{1..4}-*-1440-claro.png` y `corregida-aseguradora-{1..4}-*-390-claro.png`.

1. **Lo primero que se ve mal:** a 1440, la botonera de la maqueta tapa el campo «Nombre comercial», al pie de la ventana. A 390 no hay nada nuevo.
2. **Texto cortado o solapado:** a 1440 el pie queda cortado por la ventana: se ve el rótulo de «Nombre comercial» y el borde de su caja. A 390 no hay cortes: el rótulo del mapa y el aviso ocupan dos renglones cada uno.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** igual que G1–G3.
5. **Tema oscuro:** no aplica (G5).
6. **¿El estado orienta?** Sí (H5-04 en 2).
7. **Jerarquía:** correcta.
8. **Datos:** igual que G1.
9. **¿Muestra el requisito?** Sí. El aviso a 37 px (1440) y 58 px (390).
10. **Motivo de rechazo:** ninguno del cambio. Reservas H5C-01 y H5C-02.

#### G5 · Aseguradora en oscuro, 1440×900 (re-capturadas)

Capturas: `corregida-aseguradora-{1..4}-*-1440-oscuro.png`.

1. **Lo primero que se ve mal:** en 3 y 4 el mensaje de error se lee tenue (H5C-H1, heredado); el asterisco de «NIT» y el de «Dirección», también. El plano claro encandila y la atribución no se lee (H5-08).
2. **Texto cortado o solapado:** la botonera de la maqueta tapa «Nombre comercial», como en G4.
3. **¿Terminado o prototipo?** Lo del cambio, sí: el campo vacío sin rojo y el aviso con los tokens oscuros.
4. **Coherencia con el producto:** igual que las centrales en oscuro.
5. **Tema oscuro:** el aviso y el campo se leen; el mensaje de error, no (heredado).
6. **¿El estado orienta?** En 1 y 2, sí. En 3 y 4 depende de un mensaje de bajo contraste (heredado).
7. **Jerarquía:** «Confirmar dirección actual» en aguamarina destaca.
8. **Datos:** igual que G1.
9. **¿Muestra el requisito?** Sí, en las cuatro.
10. **Motivo de rechazo:** solo heredados.

#### G6 · Centrales de laboratorio e imagenología en claro, 1440×900 y 390×844 (re-capturadas)

Capturas: `corregida-{laboratorio,imagenologia}-central-{1..4}-*-{1440,390}-claro.png` (16). Laboratorio e imagenología son iguales salvo el título, el paso y «tu laboratorio» / «tu centro».

1. **Lo primero que se ve mal:** el ejemplo en gris «Av. Cañoto esq. Ballivián 234, Zona Central» parece escrito (H5-06).
2. **Texto cortado o solapado:** a 1440 el título del paso queda pegado al borde superior de la ventana, sin recorte visible. La botonera de la maqueta tapa «El punto es lo que te hace aparecer». A 390 el ejemplo se corta («Zona C…»).
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** la misma disposición que la aseguradora.
5. **Tema oscuro:** no aplica (G7).
6. **¿El estado orienta?** Sí (H5-04 en 2). A 390, «Tus datos están a salvo» con el texto de paciente (H5C-H2).
7. **Jerarquía:** correcta. A 390, la flecha de avanzar queda a unos 800 px del campo (H5C-H5).
8. **Datos:** ejemplos. No se ven datos personales.
9. **¿Muestra el requisito?** Sí: sin rojo en 1 y 2, rojo en 3 y 4, el aviso a 37 px. En 4 sigue «Dónde está la central».
10. **Motivo de rechazo:** ninguno del cambio.

#### G7 · Centrales en oscuro, 1440×900 (re-capturadas; las del laboratorio salen de la repetición)

Capturas: `corregida-{laboratorio,imagenologia}-central-{1..4}-*-1440-oscuro.png` (8).

1. **Lo primero que se ve mal:** el mensaje de error tenue en 3 y 4 (H5C-H1); la atribución ilegible y el plano claro (H5-08).
2. **Texto cortado o solapado:** la botonera de la maqueta tapa el pie de la ventana.
3. **¿Terminado o prototipo?** Lo del cambio, terminado. La captura que había salido en blanco ya tiene la tarjeta completa (`corregida-laboratorio-central-1-vaciada-1440-oscuro.png`).
4. **Coherencia con el producto:** igual que la aseguradora en oscuro.
5. **Tema oscuro:** igual que G5.
6. **¿El estado orienta?** Igual que G5.
7. **Jerarquía:** correcta.
8. **Datos:** igual que G6.
9. **¿Muestra el requisito?** Sí, en las ocho.
10. **Motivo de rechazo:** solo heredados.

#### G8 · Sucursales (regresión), en las tres celdas

Capturas: `corregida-{laboratorio,imagenologia}-sucursal-{1-vaciada,2-confirmada}-{1440-claro,390-claro,1440-oscuro}.png` (12).

1. **Lo primero que se ve mal:** en la tarjeta de la sucursal hay dos ⊖: el de quitar la sucursal, sin rótulo, y el de «Quitar la ubicación» (H5-09).
2. **Texto cortado o solapado:** a 390, la atribución del mapa se parte y los botones quedan apilados con mucho aire (H5C-H3). A 1440, la botonera de la maqueta tapa «Tu información clínica…».
3. **¿Terminado o prototipo?** A 1440, terminado. A 390, la pila de botones se ve menos acabada (heredado).
4. **Coherencia con el producto:** el aviso sigue dentro de la tarjeta, pegado a su campo.
5. **Tema oscuro:** el aviso y la tarjeta se leen; aquí la atribución sí se lee.
6. **¿El estado orienta?** Sí. El campo es opcional y no hay rojo, igual que en la ronda 1.
7. **Jerarquía:** correcta.
8. **Datos:** ejemplos del campo.
9. **¿Muestra el requisito?** Para la regresión, sí. Las «confirmada» a 1440 no muestran el campo ni el alta, y las dos son idénticas (H5C-E2); a 390 sí se ven los dos.
10. **Motivo de rechazo:** ninguno del cambio.

### Hallazgos nuevos

| ID | Severidad | Origen | Descripción | Captura o `ruta:línea` |
|---|---|---|---|---|
| H5C-04 | MENOR | Del cambio. Según el código, no observado | En un país con varias zonas horarias, «Datos de la aseguradora» tiene cinco campos y el motor la parte en dos páginas de hasta cuatro (`src/app/shared/forms/paginated/paginar-campos.ts:51`, `MAX_CAMPOS_POR_PAGINA = 4`). Con el orden nuevo, la página «(2 de 2)» queda con un solo campo: «Nombre comercial (opcional)». Antes quedaba sola la del mapa, y el aviso caía en una página distinta que el campo que vaciaba. El cambio corrige eso y a cambio deja un paso entero para un campo opcional. A confirmar con producto junto con H5C-02 | `src/app/features/auth/register-organization/register-organization.ts:563-605` |
| H5C-H5 | MAYOR, a confirmar en navegador | Heredado. Según el código, no observado | Cuando «Siguiente» rechaza la página, el formulario por páginas marca los campos y no mueve el foco ni desplaza la página hasta el primer error (`src/app/shared/components/organisms/paginated-form/paginated-form.ts:548-549` y `:640-652`). En la aseguradora, «Siguiente» queda a unos 800 px de «Dirección» a 768 y a unos 1000 px a 390, y a 1024×768 queda fuera de la ventana junto con el campo. Quien pulsa «Siguiente» puede no ver que el campo quedó en rojo: solo nota que la página no avanza. El cambio no alarga esa distancia: el mapa ya estaba entre el campo y el botón. Pero es el camino que la decisión de producto usa para mostrar el error | `corregida-aseguradora-1-vaciada-390-claro.png` y `-768-claro.png` (distancias medidas sobre la imagen) |

### Defectos de la evidencia (nuevos)

| ID | Severidad | Hallazgo | Qué hace falta antes del PR |
|---|---|---|---|
| H5C-E6 | MENOR | Dos filas del README contradicen sus imágenes. **Línea 139:** «a 1920 … en la 1 y la 2 se ven también el nombre del alta y «Paso 2 de 8»». En `corregida-aseguradora-{1,2}-1920-claro.png` arriba solo está «Datos de la aseguradora»; tampoco se ven «Registrá tu aseguradora» ni el paso, y así lo dice el propio README en las líneas 120–122. **Línea 141:** «`aseguradora-2-confirmada-1024-claro` — sólo muestra el plano para abajo … «Dirección» no entra en la ventana» (con «OK con reserva»). La captura muestra el título, el NIT y «Dirección» vacía y sin rojo; el guion lleva la página arriba antes de cada captura (`playwright/mapa-vacia-direccion.mjs:105`). Las dos filas parecen escritas sobre una corrida anterior. Además, la **línea 145** («igual que antes del cambio», por el ejemplo cortado a 390) no tiene una captura de antes a 390 que la sostenga. Es verosímil, porque el diff no toca el ejemplo, pero no está mostrado | Corregir las líneas 139 y 141 contra las imágenes actuales. En la 145, decir «el ejemplo es el de antes; el diff no lo toca» en vez de «igual que antes» |
| H5C-E7 | MENOR | El spec nuevo «en un país con varias zonas horarias, el mapa también queda pegado a «Dirección»» (`src/app/features/auth/register-organization/register-organization.spec.ts:665-679`) no comprueba que la zona horaria esté en la página. Su rojo sin el arreglo (`specs-h5s2m6-rojo-multizona.txt`, `:678`) no prueba que haya recorrido el caso multizona: con el orden viejo, un país de zona única también falla, porque entre «Dirección» y el mapa estaba «Nombre comercial». Según el código sí lo recorre (Estados Unidos tiene varias zonas y el país se fija con `setValue`, que dispara `valueChanges`), pero el spec no lo afirma | Una aserción de que `registro-organizacion-zona` está en esa página. De paso, deja fijada la ubicación de la zona respecto del mapa (H5C-03) |
| H5C-E8 | MENOR | Según las fechas de los archivos, los gates de este cambio corrieron antes de las últimas ediciones. `cierre-h5s2m6-lint.txt` y `cierre-h5s2m6-tipos.txt` son de las 06:33, `cierre-h5s2m6-build.txt` de las 06:46 y `cierre-h5s2m6-suite-cobertura.txt` de las 06:47. Después se editaron `register-organization.spec.ts` (06:48, el spec nuevo) y `playwright/mapa-vacia-direccion.mjs` (06:56), que entra en el typecheck del repo. Además, `register-organization.ts` se reescribió a las 06:52:50 al volver del rojo multizona, después de `specs-h5s2m6-verde.txt` (06:50). Su diff es el mismo texto que en la ronda 1, y las corridas de navegador (06:56–07:00) son posteriores, así que el riesgo es bajo. Pero el verde de specs no es sobre el archivo final (regla 30.4) | Volver a correr lint, tipos y los tres specs sobre el árbol final antes del PR |
| H5C-E9 | MENOR | Para cerrar H5C-E5, las capturas «tocada» y «al avanzar» de escritorio se toman después de llevar el título al borde superior (`playwright/mapa-vacia-direccion.mjs:109-113`). Así se ve el paso, pero ninguna captura muestra qué ve la persona justo después de pulsar «Siguiente», que es lo que importa para H5C-H5 | Una captura «al avanzar» sin reencuadrar, a 390 o a 1024, tal como queda la página tras el clic. Sirve también como evidencia de H5C-H5 |

### Afirmaciones del README que no se sostienen

1. Línea 139 (1920): «en la 1 y la 2 se ven también el nombre del alta y «Paso 2 de 8»». Es falso en las imágenes y contradice las líneas 120–122 del mismo README (H5C-E6).
2. Línea 141 (1024, confirmada): «Sólo muestra el plano para abajo … «Dirección» no entra en la ventana». Es falso: la captura muestra «Dirección» vacía y sin rojo. La reserva que se anota ahí («la salida del guion lo dice, no esta captura») ya no hace falta (H5C-E6).
3. Línea 145: «igual que antes del cambio» (el ejemplo cortado a 390). No hay una captura de antes a 390; se sostiene por el código, no por una imagen.

Lo que sí se sostiene contra las imágenes y las salidas:

- La tabla de celdas: 85/85 en 1440 claro, 390 claro y 1440 oscuro, y 23/23 en 1920, 1024 y 768.
- La repetición del laboratorio en oscuro: 33/33, y sus seis capturas salen de ella.
- Consola y red sin errores, con 0 avisos de CSP excluidos, en las siete salidas.
- 37–41 px de distancia, y 58 px a 390 en la aseguradora por el rótulo del mapa partido en dos renglones.
- Que ninguna de las 60 capturas salió en blanco.
- Que las «confirmada» de sucursal a 1440 son idénticas.
- Que las capturas de antes son previas al cambio de los botones.
- Los tres MENOR del cambio y los hallazgos ajenos que el README ahora declara.
- Todas las demás filas de la tabla de capturas.

### No cubierto

- El tema oscuro solo a 1440. No hay oscuro a 390, 768, 1024 ni 1920 en ninguna alta.
- Las centrales de laboratorio e imagenología a 1920, 1024 y 768 no se capturaron; el README lo justifica.
- La aseguradora en un país con varias zonas horarias: sin captura. El spec cubre que el mapa quede pegado a «Dirección», pero no la posición de la zona ni que la sección se parta en dos páginas (H5C-03, H5C-04, H5C-E7).
- Lo que una imagen no muestra: `aria-invalid`, el anuncio de la región viva, la descripción accesible del campo (H5C-H4), el foco y la posición de la página tras pulsar «Siguiente» (H5C-H5, H5C-E9), y el orden de tabulación nuevo en la aseguradora.
- Volver a la página después de haber pasado de ella, y el vaciado por «Volver a ubicarme» en lugar de un toque sobre el plano.
- El contenido de las salidas de gates no se revisó; solo sus fechas (H5C-E8).

---

<!-- Ronda 8 -->

## Segunda pasada visual, tercera vez: H5.S2.M6

- Fecha: 2026-09-24
- Alcance: solo lo que cambió desde la ronda 2. Se revisan las 12 capturas nuevas `4b-tras-siguiente`, las 8 de la aseguradora a 1920 y 1024 que la ronda 2 había marcado, la sección «Direcciones obligatorias: corrección del 24/09» y «No cubierto» del README, y las salidas nombradas por la coordinación.
- El código de producto no cambió. El diff de `src/app/features/auth/register-organization/register-organization.ts` tiene el mismo hash que en la ronda 1, y el de laboratorio e imagenología tampoco cambió. `register-organization.ts` se reescribió a las 07:21:15, al volver del rojo, con el mismo contenido.
- Material revisado:
  - Las 20 capturas de arriba, abiertas como imagen.
  - `docs/frontend/evidence/mapa-vacia-direccion-2026-09-23/README.md`, líneas 82–185.
  - En `docs/trabajo/2026-09-23-perfil-medico-configurar-tu-perfil/evidencia/h5/`: `navegador-h5s2m6-*.txt` (seis celdas), `specs-h5s2m6-rojo-multizona.txt`, `specs-h5s2m6-verde.txt`, `cierre-h5s2m6-{lint,tipos,tipos-cypress}.txt` y `capturas-h5s2m6-sin-blancos.txt` (72 líneas).
  - `playwright/mapa-vacia-direccion.mjs:268-295`, el bloque que toma la vista tras «Siguiente».
  - `src/app/features/auth/register-organization/register-organization.spec.ts:665-683`.
- No se volvieron a mirar las otras 52 capturas: las marcas de tiempo muestran que se re-tomaron, pero el pedido acota la ronda. Queda en «No cubierto».
- Método y regla de nota: los mismos de las rondas 1 y 2. Diez preguntas por grupo, severidad por hallazgo, y estado `CERRADO` / `SIGUE` / `CAMBIA` para lo anterior. Los heredados y los defectos de evidencia no cuentan para la nota. Ante la duda, la nota más baja.
- Límite: solo se leyeron imágenes y archivos; no se ejecutó nada. Lo que sale del código o de las fechas de los archivos se marca así.

### Resumen de notas

| Pantalla | Nota | Motivo |
|---|---|---|
| Alta de la aseguradora (casa matriz) | ACEPTABLE CON RESERVAS | H5-01 y H5-02 siguen cerrados; las capturas de 1920 y 1024 lo confirman otra vez. Quedan los MENOR del cambio H5C-01, H5C-02, H5C-03 y H5C-04, declarados en el README, más H5-04 y H5-05 |
| Alta del laboratorio: paso de la central | ACEPTABLE CON RESERVAS | Sin cambios respecto de la ronda 2. Quedan H5C-01, H5-04, H5-05 y H5-06, todos MENOR |
| Alta de imagenología: paso de la central | ACEPTABLE CON RESERVAS | Igual que el laboratorio |
| Sucursales (regresión) | ACEPTABLE CON RESERVAS | No se volvieron a revisar en esta ronda; se mantiene la nota de la ronda 2 |

H5C-H5 queda observado y sigue como MAYOR **heredado**: el formulario por páginas no lleva la vista ni el foco al campo en rojo, y el cambio no toca ese código. No baja la nota con la regla acordada. Pero si producto decide que «intentar avanzar» tiene que *verse* como un error en todos los anchos, pasa a ser del requisito y las tres altas quedan `RECHAZADA` a 390 y 1024. Lo tiene que decidir producto, no esta revisión.

### Estado de los hallazgos anteriores

| ID | Estado | Qué lo sostiene |
|---|---|---|
| H5-01, H5-02 | **CERRADO** (siguen cerrados) | `corregida-aseguradora-{1,2}-{1920,1024}-claro.png`: «Dirección» vacía, sin rojo, y el aviso debajo, sin controles en medio. A 1920 y 768 hay 41 px; a 1024, 37 px (salidas del guion) |
| H5C-01 | **SIGUE** (MENOR, declarado) | La ayuda y el rótulo del mapa siguen entre el campo y el aviso (README:166-167) |
| H5C-02 | **SIGUE** (MENOR, declarado, «a confirmar con producto») | README:168-169. A 1920 se ve la página entera, con «Nombre comercial» abajo |
| H5C-03 | **SIGUE** (MENOR) | La zona obligatoria sigue debajo del mapa en los países multizona; ahora hay un spec, pero no hay captura |
| H5C-04 | **SIGUE** (MENOR, ahora declarado) | README:171: «la segunda queda con «Nombre comercial» solo». Sigue sin captura |
| H5C-H1 | **SIGUE** (MAYOR heredado) | README:183-189. Además, en `corregida-aseguradora-4b-tras-siguiente-1440-oscuro.png` el mensaje de error queda en el borde superior de la ventana y casi no se lee: es el primer, y a veces el único, indicio tras «Siguiente» en oscuro |
| H5C-H2, H5C-H4 | **SIGUE** (heredados, declarados) | README:190-195 |
| H5C-H3 | **SIGUE** (heredado) | No se volvió a mirar en esta ronda |
| H5C-H5 | **CAMBIA**: pasa de «según el código» a **observado**. MAYOR heredado | Salidas `ℹ`: a 390 y 1024, «el campo en rojo NO queda a la vista; el foco queda en paginated-form-continuar». Se ve en `corregida-aseguradora-4b-tras-siguiente-{390,1024}-claro.png` y en `corregida-{laboratorio,imagenologia}-central-4b-tras-siguiente-390-claro.png`: el plano, los botones, «Siguiente», y ni el campo ni el aviso. Lo único que cambia en la vista es el globo «Siguiente» sobre la flecha, en las centrales. El README lo declara como hallazgo ajeno con `ruta:línea` (README:176-182) |
| H5C-E2 | **SIGUE** (MENOR, declarado) | Las dos «confirmada» de sucursal a 1440 siguen idénticas byte a byte, en claro y en oscuro |
| H5C-E6 | **CERRADO** | README:146 (1920, «desde el título del paso») y README:147 (1024, la 1 y la 2 con «Dirección» vacía sin rojo) coinciden con las imágenes. README:156 ya no dice «igual que antes» |
| H5C-E7 | **CERRADO** | El spec comprueba que la zona está en la página (`register-organization.spec.ts:673-676`). Su rojo sin el arreglo cae en la aserción del orden (`:682`, `specs-h5s2m6-rojo-multizona.txt`), así que la de la zona pasó con el código viejo: el caso multizona sí se recorre. Verde 114/114 (`specs-h5s2m6-verde.txt`). Según las fechas, el rojo corrió con el archivo sin arreglo (compilado 07:21:02, restaurado 07:21:15) y el verde sobre el archivo final (inicio 07:22:41) |
| H5C-E8 | **CAMBIA**: queda un residuo MENOR | Lint, tipos de la app y tipos de Cypress salen con `exit=0` sobre el árbol final (07:28–07:29). La parte de Playwright de `yarn typecheck` no corrió, pero su `tsconfig` solo incluye `**/*.ts` con `allowJs: false`, así que no mira el guion `.mjs`. Los tres specs de las altas dan 114/114 sobre el árbol final. La suite completa y el build siguen siendo de las 06:46–06:47, anteriores al último spec. El código de producto que compiló el build es el mismo byte a byte (mismo hash del diff), y el build no compila specs. Queda solo que la suite completa no corrió con el spec final, que ya corrió aparte |
| H5C-E9 | **CERRADO** | Existen las 12 capturas `4b-tras-siguiente`, tomadas sin volver a encuadrar (`playwright/mapa-vacia-direccion.mjs:285`, sin `capturar`), y las líneas `ℹ` informan la vista y el foco |
| Estado viejo en `PLAN.md`/`REPORTE.md` | **SIGUE** | `REPORTE.md:92` («nada verificado todavía») y la fila H5.S2.M6 de `PLAN.md:322` («sin correr todavía», `EN CURSO`). Los dos archivos son de las 06:15, anteriores a toda esta evidencia |
| H5-04, H5-05, H5-06, H5-07, H5-08, H5-09, H5-11 | **SIGUE** | Sin cambio de producto. En las `4b` de 1440 y 1920, la botonera de la maqueta vuelve a tapar el pie (H5-11) |

### Las diez preguntas, por grupo

#### G1 · Aseguradora a 1920 y 1024, estados 1–4 (re-capturadas)

Capturas: `corregida-aseguradora-{1-vaciada,2-confirmada,3-tocada,4-al-avanzar}-{1920,1024}-claro.png`.

1. **Lo primero que se ve mal:** a 1024, la botonera de la maqueta tapa «Si el pin no cayó justo…» y, en 2, «Quitar la ubicación»; «Confirmar dirección actual» queda cortado por el pie de la ventana (H5-11). A 1920, nada propio del cambio.
2. **Texto cortado o solapado:** a 1024 no entran «Nombre comercial» ni «Siguiente»: es el alto de la ventana, no un defecto. A 1920 no hay recortes.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** la misma disposición que en 1440, 768 y 390.
5. **Tema oscuro:** no aplica; no hay oscuro en estos anchos (declarado).
6. **¿El estado orienta?** Sí: el aviso está a la vista en las cuatro.
7. **Jerarquía:** correcta.
8. **Datos:** el NIT es sintético; no hay datos de personas.
9. **¿Muestra el requisito?** Sí: sin rojo en 1 y 2, rojo con su mensaje en 3 y 4, y el aviso junto al campo. Las filas README:146-148 coinciden con las imágenes.
10. **Motivo de rechazo:** ninguno del cambio.

#### G2 · `4b` a 1440 y 1920 (aseguradora), claro y oscuro

Capturas: `corregida-aseguradora-4b-tras-siguiente-{1440-claro,1440-oscuro,1920-claro}.png`.

1. **Lo primero que se ve mal:** a 1440, el campo en rojo quedó pegado al borde superior de la ventana (su caja empieza a unos 8 px) y el rótulo «Dirección» queda afuera. Lo que se ve arriba es una caja vacía con borde rojo y el mensaje «Escribí la dirección…». Por eso el mensaje se entiende sin el rótulo.
2. **Texto cortado o solapado:** el rótulo «Dirección *» queda cortado arriba, a 1440. La botonera de la maqueta tapa el pie a 1440 y a 1920.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** coherente con las demás capturas.
5. **Tema oscuro:** a 1440 en oscuro, el mensaje de error en el borde superior se lee tenue (H5C-H1). El borde rojo se distingue.
6. **¿El estado orienta?** A 1920 sí: se ve toda la página. A 1440, apenas: el error está en el límite de la ventana (ver H5C-E10).
7. **Jerarquía:** correcta.
8. **Datos:** sin datos de personas.
9. **¿Muestra el requisito?** Sí: intentar avanzar marca el campo, y queda a la vista.
10. **Motivo de rechazo:** ninguno del cambio. La afirmación «a la vista» a 1440 es frágil (H5C-E10).

#### G3 · `4b` de las centrales a 1440, claro y oscuro

Capturas: `corregida-{laboratorio,imagenologia}-central-4b-tras-siguiente-1440-{claro,oscuro}.png`.

1. **Lo primero que se ve mal:** nada nuevo. El globo oscuro «Siguiente» sobre la flecha es el tooltip del botón de solo ícono.
2. **Texto cortado o solapado:** no. La botonera de la maqueta tapa el pie de la ventana.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** igual que las `4-al-avanzar`, más el globo.
5. **Tema oscuro:** el mensaje de error se lee tenue (H5C-H1).
6. **¿El estado orienta?** Sí: la tarjeta entera entra en 900 px, así que el campo en rojo queda a la vista.
7. **Jerarquía:** correcta.
8. **Datos:** son ejemplos.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** ninguno del cambio. README:152 atribuye el globo a que «el foco quedó ahí». En la captura el puntero también quedó sobre el botón: el guion captura sin moverlo (`playwright/mapa-vacia-direccion.mjs:285`). La causa no se ve en la imagen (H5C-E12).

#### G4 · `4b` a 390 y 1024 (aseguradora y centrales)

Capturas: `corregida-aseguradora-4b-tras-siguiente-{390,1024}-claro.png`, `corregida-{laboratorio,imagenologia}-central-4b-tras-siguiente-390-claro.png`.

1. **Lo primero que se ve mal:** la persona pulsó «Siguiente» y no pasa nada visible. La página no avanza, el campo en rojo y el aviso están fuera de la ventana, y la vista es la misma que antes del clic. En las centrales solo aparece el globo «Siguiente» (H5C-H5).
2. **Texto cortado o solapado:** a 1024, la botonera de la maqueta tapa «¿Ya tenés cuenta?».
3. **¿Terminado o prototipo?** Cada pieza está terminada. El comportamiento se siente roto.
4. **Coherencia con el producto:** es el comportamiento del formulario por páginas en todas las altas y para cualquier campo obligatorio (README:179-180). Por eso es heredado.
5. **Tema oscuro:** no hay `4b` oscuro a estos anchos.
6. **¿El estado orienta?** No: es un error mudo en la ventana visible.
7. **Jerarquía:** la vista queda en «Siguiente», que no hizo nada visible.
8. **Datos:** sin datos de personas.
9. **¿Muestra el requisito?** Solo en parte. El campo queda marcado: lo confirman las comprobaciones, y la `4-al-avanzar` encuadrada lo muestra. Pero la persona no lo ve sin subir por su cuenta.
10. **Motivo de rechazo:** H5C-H5 (MAYOR heredado). No cuenta para la nota; ver la condición en «Resumen de notas».

#### G5 · `4b` a 768 (aseguradora)

Captura: `corregida-aseguradora-4b-tras-siguiente-768-claro.png`.

1. **Lo primero que se ve mal:** nada. «Dirección *» con su rótulo, el borde rojo y el mensaje quedan a unos 60–120 px del borde superior; el aviso y «Siguiente» también se ven.
2. **Texto cortado o solapado:** la etiqueta «Demo» de la cabecera queda flotando sobre el rótulo del campo (heredado, de la maqueta).
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia con el producto:** coherente.
5. **Tema oscuro:** no aplica.
6. **¿El estado orienta?** Sí.
7. **Jerarquía:** correcta.
8. **Datos:** sin datos de personas.
9. **¿Muestra el requisito?** Sí.
10. **Motivo de rechazo:** ninguno.

### Hallazgos nuevos

No hay hallazgos nuevos del cambio. Los tres son defectos de evidencia, todos MENOR.

| ID | Severidad | Hallazgo | Qué hace falta |
|---|---|---|---|
| H5C-E10 | MENOR | «A 1440 el campo en rojo queda a la vista» es un resultado frágil. `aLaVista` cuenta como visible cualquier caja con una parte dentro de la ventana (`playwright/mapa-vacia-direccion.mjs:278`). La posición de la página tras el clic es la que deja la herramienta al desplazar lo justo para mostrar «Siguiente», después del encuadre previo del guion. En `corregida-aseguradora-4b-tras-siguiente-1440-claro.png` el campo quedó a unos 8 px del borde y su rótulo, afuera. Alguien que baje un poco más para llegar al botón lo pierde. README:149 dice «Dirección en rojo … dentro de la ventana», y el rótulo «Dirección» no está | Describir 1440 como «en el borde superior, con el rótulo fuera». También se puede medir la caja entera del campo con su rótulo (`app-form-field`) en lugar del `<input>` |
| H5C-E11 | MENOR | README:116 dice «se midieron las 60 capturas» y el paréntesis de la línea siguiente suma «las 60 de los cuatro estados y las 12 `4b`». La cuenta se contradice: el archivo `capturas-h5s2m6-sin-blancos.txt` tiene 72 líneas | Decir «las 72» |
| H5C-E12 | MENOR | README:152 atribuye el globo «Siguiente» de las centrales a que «el foco quedó ahí». La captura se toma con el puntero todavía sobre el botón, así que el globo puede venir del paso del puntero. La salida `ℹ` confirma el foco, pero no qué disparó el globo | «porque el foco y el puntero quedaron ahí», o mover el puntero antes de la `4b` |

### Afirmaciones del README que no se sostienen

1. README:149. «"Dirección" en rojo, con su mensaje, dentro de la ventana», para la celda 1440. En esa celda el rótulo «Dirección» queda fuera, y la caja está en el borde (H5C-E10).
2. README:116. «las 60 capturas», en vez de 72 (H5C-E11).
3. README:152. «porque el foco quedó ahí», que la imagen no permite distinguir del paso del puntero (H5C-E12).

Lo que sí se sostiene contra las imágenes y las salidas:

- Las filas de 1920 y 1024 (README:146-148).
- Las filas de las `4b` de 1920, 768, 1024 y 390 (README:149-153).
- La lectura de H5C-H5 (README:122-125 y 176-182).
- La declaración de H5C-04 junto a H5C-03 (README:170-173).
- La tabla de celdas: 85/85 en tres celdas y 23/23 en otras tres, que coincide con las seis salidas.
- Los `exit=0` de lint y tipos.

### No cubierto

- En esta ronda no se volvieron a abrir las 52 capturas re-tomadas de los estados 1–4 fuera de 1920 y 1024, ni las 12 de sucursal. Según las marcas de tiempo son de la corrida de las 07:23–07:25. No se sabe si difieren de las que se revisaron en la ronda 2.
- No hay `4b` en oscuro a 390 ni a 1024, ni en las centrales a 1024, 768 o 1920.
- La vista tras «Siguiente» depende de cómo se llegó al botón. El guion la mide con un solo camino (encuadre del título y después desplazamiento automático hasta el botón); otros recorridos pueden dar otra vista.
- La suite completa no corrió con el spec final (H5C-E8, residuo).
- Sigue sin cubrir lo que una imagen no muestra: `aria-invalid`, los anuncios y el orden de tabulación.
