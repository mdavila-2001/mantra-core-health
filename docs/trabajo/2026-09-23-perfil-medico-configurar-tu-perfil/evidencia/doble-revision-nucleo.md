# Doble revisión de capturas (regla 35) — rama núcleo: H2, H3 y H4

Cada captura de navegador de la rama `itzan/perfil-medico-nucleo` se revisa dos veces:

- **Primera pasada — verificación:** quien implementó abre cada captura y la contrasta con el
  criterio de aceptación, una fila por captura. Vive en el `INSPECCION.md` de cada carpeta de
  capturas.
- **Segunda pasada — adversarial:** la hace un revisor que no implementó el cambio, después de
  cerrada la primera, con la postura de quien tiene que rechazar la entrega. Cada hallazgo lleva
  severidad (`BLOQUEANTE` / `MAYOR` / `MENOR`) y clase (del cambio o ajeno), y cada pantalla una
  nota (`RECHAZADA` / `ACEPTABLE CON RESERVAS` / `APROBADA`). Ante la duda, la más baja. Entre
  rondas el revisor recibe qué cambió y marca cada hallazgo suyo `CERRADO`, `SIGUE` o `CAMBIA`.

| Hito | Primera pasada | Segunda pasada |
|---|---|---|
| H2 · datos personales, contacto e insignias | `evidencia/h2/capturas/INSPECCION.md` (las mismas capturas viajan en `docs/frontend/evidence/perfil-medico-datos-y-contacto-2026-09-23/`) | sección «Segunda pasada: H2 y H3», abajo |
| H3 · trayectoria, títulos y barra de filtros | `evidencia/h3/capturas/INSPECCION.md` | sección «Segunda pasada: H2 y H3», abajo |
| H4 · especialidades, matrículas y las tres tablas | `evidencia/h4/capturas/INSPECCION.md` | sección «Segunda pasada: H4», abajo |

La segunda pasada del resto del carril (H5, H6 y H7) está en `evidencia/doble-revision.md`.

## Las rondas

1. **Ronda 1**, sobre las capturas del árbol que integró `mockup` @ `22dc1f36`. Rechazó, entre
   otras cosas, la insignia de especialidad con la marca de «certificada» (N2-01), el corte de la
   institución en el desplegable (N3-01), las tablas sin el estado a la vista en el teléfono
   (N4-01) y la separación entre la nota, la barra y el historial (N4-03, N4-04).
2. **Ronda 2**, sobre la recaptura con esas correcciones. Quedó un `MAYOR` del cambio: lo
   verificado de especialidades y matrículas se seguía corrigiendo (N4-02). Itzan decidió el 24/09
   tratarlo como los títulos.
3. **Ronda 3**, sobre la recaptura después de integrar `mockup` @ `fae0efc2` (las especialidades
   pasan a «Datos personales», la dirección del trabajo queda en «Contacto», hasta cuatro
   especialidades) y de aplicar la decisión sobre lo verificado. En H2 y H3 cerró sin `RECHAZADA`
   y sin `MAYOR` del cambio abierto. En H4 rechazó las especialidades por N4-36: el pie «Guardar
   cambios» cerraba una sección que se guarda sola.
4. **Ronda 4, sólo H4**, sobre la recaptura con la nota de la sección corregida («Cada una se
   guarda al agregarla, sin pasar por «Guardar cambios»»). N4-36 bajó a `MENOR`; cerró sin
   `RECHAZADA` y sin `MAYOR` del cambio abierto.

Las rondas citan las capturas con el nombre que tenían en cada recaptura. La recaptura final las
reemplazó por la serie de cinco viewports y dos temas del gate visual del repo, con otros nombres.

## Ronda final: pendiente

Después de la ronda 4 la rama integró dos veces `mockup` (@ `467ff940`, con el #644: los títulos
pasan a «Credenciales»; y @ `d6becdd0`, con el #645: el correo de trabajo vuelve a «Contacto» y se
corrige ahí) y todas las capturas se rehicieron en los cinco viewports del repo (390×844,
768×1024, 1024×768, 1440×900 y 1920×1080), en claro y en oscuro. Esa recaptura tiene su primera
pasada (los tres `INSPECCION.md`), pero **todavía no tiene su segunda pasada**. Hasta que la
tenga, la regla 35 queda a medias en este PR, y las notas de abajo valen para las capturas
anteriores, no para la serie final.

Los hallazgos ajenos no bajan la nota de una microtarea de este carril: se registran con
`ruta:línea` en «Riesgos residuales» del reporte.

## Segunda pasada: H2 y H3

Se abrieron una por una las 51 capturas: 23 de H2 y 28 de H3. `h3-barra-centros-medicos.png` también se abrió, pero no se juzga: queda pendiente de recaptura.

**Cómo se atribuye cada hallazgo.** Se comparó la rama contra su base de integración. En `src/app` modifica exactamente lo que nombra el encargo: editor, ficha, historial laboral, pestañas del médico, alta del médico, detalle de la guía, cliente de perfiles, insignias y, en la barra de filtros, sólo `filter-bar.ts` (la clave de búsqueda). Un defecto que vive en un archivo de esa lista cuenta como **del cambio** aunque ya existiera antes; en ese caso se marca *preexistente*. Un defecto que vive en `data-table`, `row-actions`, `pagination`, `tabs`, el mapa, las migas, el encabezado o el perfil público es **ajeno**. Además, la maquetación y el foco de la barra son ajenos. Los contrastes se estimaron sobre los píxeles de la captura. Con el suavizado de bordes, son aproximados.

### Capturas

H2: escritorio 1440 × 1000, tableta 768 × 1024, móvil 390 × 844. H3: 1440 × 1000 y 375 × 812. Si la imagen es más alta que la ventana, es una captura de página completa.

| # | Pantalla | Viewport (px) | Tema | Estado | Archivo |
|---|---|---|---|---|---|
| 1 | Ficha · Datos personales | 1440 | claro | con datos | `h2/capturas/h2-ficha-datos-personales-escritorio-claro.png` |
| 2 | Ficha · Datos personales | 1440 | oscuro | con datos | `h2-ficha-datos-personales-escritorio-oscuro.png` |
| 3 | Ficha · Datos personales | 768 | claro | con datos | `h2-ficha-datos-personales-tableta-claro.png` |
| 4 | Ficha · Datos personales | 768 | oscuro | con datos | `h2-ficha-datos-personales-tableta-oscuro.png` |
| 5 | Ficha · Datos personales | 390 | claro | con datos | `h2-ficha-datos-personales-movil-claro.png` |
| 6 | Ficha · Datos personales | 390 | oscuro | con datos | `h2-ficha-datos-personales-movil-oscuro.png` |
| 7 | Ficha · Datos personales | 1440 | claro | aviso «Credenciales» abierto | `h2-insignias-ficha.png` |
| 8 | Ficha · Contacto | 1440 | claro | con datos | `h2-ficha-contacto-escritorio-claro.png` |
| 9 | Ficha · Contacto | 1440 | oscuro | con datos | `h2-ficha-contacto-escritorio-oscuro.png` |
| 10 | Ficha · Contacto | 768 | claro | con datos | `h2-ficha-contacto-tableta-claro.png` |
| 11 | Ficha · Contacto | 768 | oscuro | con datos | `h2-ficha-contacto-tableta-oscuro.png` |
| 12 | Ficha · Contacto | 390 | claro | con datos | `h2-ficha-contacto-movil-claro.png` |
| 13 | Ficha · Contacto | 390 | oscuro | con datos | `h2-ficha-contacto-movil-oscuro.png` |
| 14 | Editor · Datos personales | 1440 | claro | sin editar | `h2-editor-datos-personales-escritorio-claro.png` |
| 15 | Editor · Datos personales | 390 | oscuro | sin editar | `h2-editor-datos-personales-movil-oscuro.png` |
| 16 | Editor · Contacto | 1440 | claro | sin editar | `h2-editor-contacto-escritorio-claro.png` |
| 17 | Editor · Contacto | 1440 | claro | celular editado, antes de guardar | `h2-patch-antes-de-guardar.png` |
| 18 | Editor · Contacto | 390 | oscuro | sin editar | `h2-editor-contacto-movil-oscuro.png` |
| 19 | Editor · Credenciales | 1440 | claro | con datos | `h2-insignias-editor.png` |
| 20 | Perfil público `/p/valeria-rojas` | 1440 | claro | con datos; opiniones en error | `h2-insignias-perfil-publico.png` |
| 21 | Guía · detalle del médico (paciente) | 1440 | claro | con datos | `h2-insignias-directorio-detalle-paciente.png` |
| 22 | Guía · portada `/directory` (paciente) | 1440 | claro | con datos | `h2-insignias-directorio-lista-paciente.png` |
| 23 | Alta del médico · «Tus especialidades» (12 de 13) | 1440 | claro | vacío | `h2-alta-especialidades.png` |
| 24 | Trayectoria · alta de título | 1440 | claro | modal vacío | `h3/capturas/h3-alta-titulo-modal.png` |
| 25 | Trayectoria · alta de título | 1440 | claro | confirmación | `h3-alta-titulo-confirmacion.png` |
| 26 | Trayectoria · alta de título | 1440 | claro | descarte | `h3-alta-titulo-descarte.png` |
| 27 | Trayectoria · tablas | 1440 | claro | tras agregar y recargar | `h3-alta-titulo-tras-recargar.png` |
| 28 | Trayectoria · corregir título | 1440 | claro | sin cambios | `h3-corregir-titulo-sin-cambios.png` |
| 29 | Trayectoria · corregir título | 1440 | claro | confirmación | `h3-corregir-titulo-confirmacion.png` |
| 30 | Trayectoria · corregir título | 1440 | claro | descarte | `h3-corregir-titulo-descarte.png` |
| 31 | Trayectoria · búsqueda | 1440 | claro | títulos sin resultados | `h3-busqueda-titulos.png` |
| 32 | Trayectoria · búsqueda | 1440 | claro | historial sin resultados | `h3-busqueda-historial.png` |
| 33 | Historial · corregir vínculo | 1440 | claro | modal sin cambios | `h3-historial-corregir.png` |
| 34 | Historial · retirar vínculo | 1440 | claro | confirmación | `h3-historial-retirar-confirmacion.png` |
| 35 | Trayectoria · tablas | 1440 | claro | cargo corregido tras recargar | `h3-historial-tras-recargar-cargo.png` |
| 36 | Trayectoria · tablas | 1440 | claro | con datos | `h3-trayectoria-escritorio-claro.png` |
| 37 | Trayectoria · tablas | 375 | oscuro | con datos | `h3-trayectoria-movil-oscuro.png` |
| 38 | Trayectoria · detalle de fila | 375 | oscuro | fila expandida | `h3-institucion-detalle-movil-oscuro.png` |
| 39 | Barra · Administración › Pacientes | 1440 | claro | búsqueda «a» | `h3-barra-pacientes.png` |
| 40 | Barra · Administración › Formularios clínicos | 1440 | claro | búsqueda «a» | `h3-barra-formularios-clinicos.png` |
| 41 | Barra · Administración › Importar del arancel | 1440 | claro | búsqueda «a» | `h3-barra-importar-arancel.png` |
| 42 | Barra · Constructor de formularios | 1440 | claro | búsqueda «a» | `h3-barra-constructor-formularios.png` |
| 43 | Barra · Directorios | 1440 | claro | búsqueda «a» | `h3-barra-directorios.png` |
| 44 | Barra · Evoluciones | 1440 | claro | búsqueda «a» | `h3-barra-evoluciones.png` |
| 45 | Barra · Directorio de farmacias | 1440 | claro | búsqueda «a» | `h3-barra-farmacias.png` |
| 46 | Barra · Glosario médico | 1440 | claro | búsqueda «a» | `h3-barra-glosario.png` |
| 47 | Barra · Directorio de médicos (una especialidad) | 1440 | claro | búsqueda «a» | `h3-barra-guia-medicos.png` |
| 48 | Barra · Directorio de laboratorios | 1440 | claro | búsqueda «a» | `h3-barra-laboratorios.png` |
| 49 | Barra · Mis servicios | 1440 | claro | búsqueda «a» | `h3-barra-mis-servicios.png` |
| 50 | Barra · Vitrina de diseño | 1440 | claro | búsqueda «a» | `h3-barra-vitrina.png` |
| 51 | Barra · Directorio de clínicas | 1440 | claro | **pendiente de recaptura** | `h3-barra-centros-medicos.png` |

### Resumen de notas

| Pantalla | Capturas | Nota | Motivo principal |
|---|---|---|---|
| P1 · Ficha · Datos personales | 1–7 | **RECHAZADA** | N2-01: la insignia de Cardiología se distingue de la otra |
| P2 · Ficha · Contacto | 8–13 | ACEPTABLE CON RESERVAS | sólo MENOR |
| P3 · Editor · Datos personales | 14–15 | ACEPTABLE CON RESERVAS | sólo MENOR |
| P4 · Editor · Contacto | 16–18 | **RECHAZADA** | N2-12: la pista de «Dirección» habla del trabajo |
| P5 · Editor · Credenciales | 19 | **RECHAZADA** | N2-15: la columna Acciones cambia de forma según la fila |
| P6 · Perfil público | 20 | APROBADA (sólo hallazgos ajenos) | D-01 cumplido; N2-16 a N2-18 son ajenos |
| P7 · Guía · detalle del médico | 21 | **RECHAZADA** | N2-01 y N2-19 |
| P8 · Guía · portada | 22 | APROBADA | no es la pantalla que pide el DoD (ver «No cubierto») |
| P9 · Alta · especialidades | 23 | ACEPTABLE CON RESERVAS | sólo MENOR |
| P10 · Trayectoria · alta de título | 24–26 | **RECHAZADA** | N3-01: la sigla queda cortada en el desplegable |
| P11 · Trayectoria · corregir título | 28–30 | **RECHAZADA** | N3-01 |
| P12 · Trayectoria · títulos + historial | 27, 35–38 | **RECHAZADA** | N3-04, N3-05, N3-06, N3-07 |
| P13 · Trayectoria · búsqueda | 31–32 | **RECHAZADA** | N3-04 visible también aquí |
| P14 · Historial · corregir y retirar | 33–34 | **RECHAZADA** | N3-15, N3-16 |
| P15 · Barra › Pacientes | 39 | APROBADA (sólo hallazgos ajenos) | N3-18 ajeno |
| P16 · Barra › Formularios clínicos | 40 | APROBADA (sólo hallazgos ajenos) | N3-19 ajeno |
| P17 · Barra › Importar del arancel | 41 | APROBADA (sólo hallazgos ajenos) | N3-20 ajeno |
| P18 · Barra › Constructor de formularios | 42 | APROBADA | — |
| P19 · Barra › Directorios | 43 | APROBADA | — |
| P20 · Barra › Evoluciones | 44 | APROBADA | — |
| P21 · Barra › Farmacias | 45 | APROBADA | — |
| P22 · Barra › Glosario | 46 | APROBADA | — |
| P23 · Barra › Médicos de una especialidad | 47 | APROBADA (sólo hallazgos ajenos) | N3-21 ajeno |
| P24 · Barra › Laboratorios | 48 | APROBADA | — |
| P25 · Barra › Mis servicios | 49 | APROBADA | — |
| P26 · Barra › Vitrina | 50 | APROBADA (sólo hallazgos ajenos) | N3-22 ajeno |
| P27 · Barra › Clínicas | 51 | **PENDIENTE DE RECAPTURA** | no se juzga |

**Lo que la primera pasada dio por bueno y no lo es:**

- No vio la tilde de «Certificada» que sólo tiene Cardiología (N2-01), en las nueve capturas donde aparece.
- No vio que en tema claro el punto del mapa de calles es casi invisible (N2-14). Además, a 390 en oscuro describió «teselas que no cargaron», pero esa captura muestra el plano completo.
- Afirmó «paginadores alineados a la derecha en ambas tablas», y en el historial no es así (N3-05).
- Tomó la sigla cortada en el desplegable de Institución como «límite propio de un `<select>`», pero el CA de H3.S1.M3 pide leer la sigla justamente en el desplegable (N3-01).
- No registró el botón «Retirar» azul del historial (N3-16), el modal del historial fuera de patrón (N3-15) ni el historial sin orden por fecha (N3-07).
- Describió `h3-barra-centros-medicos.png` en estado de carga. El archivo abierto en esta pasada muestra resultados («500 clínicas encontradas»). Antes de cerrar hay que confirmar cuál versión es la definitiva.

---

### P1 · Ficha «Mi perfil» → Datos personales

Capturas 1–7. Se agrupan porque el contenido es el mismo en los tres viewports y los dos temas; lo que cambia por viewport o tema se dice en cada respuesta. La 7 es la 1 con el aviso «Credenciales» abierto.

1. **Lo primero que se ve mal:** la tarjeta de Cardiología lleva una tilde (✓) arriba a la derecha que la de Medicina Interna no tiene. Está en el mismo lugar donde antes decía «✓ PRINCIPAL» (`antes/capturas/01-ficha-datos-personales-escritorio.png`). A 390 queda pegada al sello «✓ Verificado»: dos tildes en la misma fila.
2. **Texto cortado, solapado, desalineado o pegado al borde:** a 390, la nota «Se cambia por su propio trámite» comparte renglón con el correo y se parte en «Se cambia por su / propio trámite». El segundo renglón arranca debajo del correo y se lee como continuación del valor. A 768 y 390, la tira de pestañas corta la etiqueta siguiente contra la flecha. No hay texto solapado.
3. **¿Terminado o prototipo?** Terminado en general. La tilde sin rótulo y el aviso «Credenciales», que sigue abierto al volver a Datos personales (captura 7), parecen restos de otro estado.
4. **Coherencia con las pantallas vecinas:** el «Correo de acceso» es coherente con el editor. En cambio, el perfil público muestra las dos especialidades sin tilde y la pestaña Credenciales dice «Certificada por el consejo» en texto (`credentials-panel.ts:83`). La misma persona aparece con las iniciales «VM» en la ficha, «VR» en el perfil público y «DV» en el encabezado.
5. **Tema oscuro:** todo se lee. Las tarjetas de especialidad pasan a un gris verdoso con borde claro, más pesado que el resto de la superficie, sin perder lectura. «Panel», en las migas, queda cerca de 2,6:1 (ajeno).
6. **Vacío, error y carga:** no aplica. Todas las capturas tienen datos y ninguna muestra esos estados.
7. **Jerarquía:** la única acción, editar, es un lápiz chico de sólo ícono arriba a la derecha. Para una ficha de lectura es aceptable.
8. **Datos inventados, reales o sensibles:** cuenta sintética. El documento y la fecha de nacimiento los ve sólo el propio médico.
9. **¿Muestra lo que pide el requisito?** Sí: no hay «Estado de la práctica» y el correo de acceso está en sólo lectura. No: el CA dice «todas las insignias se ven iguales» y aquí una se distingue.
10. **Por qué rechazar:** por N2-01. El kill-test del encargo dice que si en Datos personales una insignia se ve distinta de las otras, H2 no está hecho, y las siete capturas lo muestran.

Hallazgos: N2-01 (BLOQUEANTE, del cambio) · N2-02, N2-08 (MENOR, del cambio) · N2-03, N2-05 (MENOR, ajenos) · N2-04 (MAYOR, ajeno).
**Nota: RECHAZADA.**

### P2 · Ficha → Contacto

Capturas 8–13, agrupadas por la misma razón que en P1.

1. **Lo primero que se ve mal:** nada roto. Lo que primero llama la atención es el celular, «+591 71000000» sin agrupar, cuando el editor lo muestra «7100 0000».
2. **Texto cortado o pegado:** no hay. La pestaña «Contacto» tiene un fondo de resaltado que la activa de P1 no tiene: el puntero quedó encima al capturar. Es un problema de la evidencia, no de la pantalla.
3. **¿Terminado o prototipo?** Terminado. A 1440 queda mucha superficie vacía debajo de cuatro datos, algo esperable en esta pestaña.
4. **Coherencia:** coherente con Datos personales. El «Domicilio» que aquí aparece como dato personal es el mismo valor que el perfil público publica como «Dirección» (N2-16) y que el editor describe como lugar de atención (N2-12).
5. **Tema oscuro:** legible. «Ver en el mapa» queda en verde agua con buen contraste. Las migas tienen el contraste bajo de N2-04.
6. **Vacío, error y carga:** no aplica. Hay datos y no se capturó cómo queda la pestaña sin datos de contacto.
7. **Jerarquía:** la única acción es «Ver en el mapa» y está junto al dato al que corresponde.
8. **Datos:** sintéticos (`@gmail.mock`, «Av. Banzer N.º 120»). El domicilio es el dato sensible de la pantalla; aquí lo ve sólo el médico.
9. **¿Muestra lo que pide el requisito?** Sí: no hay correo, celular ni fijo del trabajo.
10. **Por qué rechazar:** no se rechazaría por esta pantalla; son detalles.

Hallazgos: N2-06 (MENOR, del cambio, preexistente) · N2-07 (MENOR, evidencia).
**Nota: ACEPTABLE CON RESERVAS.**

### P3 · Editor → Datos personales

Capturas 14 (1440 claro) y 15 (390 oscuro).

1. **Lo primero que se ve mal:** «Guardar cambios» aparece habilitado con el formulario intacto. En los modales del mismo editor, el botón está apagado hasta que algo cambia.
2. **Texto cortado o solapado:** no hay, en ninguna de las dos.
3. **¿Terminado o prototipo?** Terminado, salvo «Volver a tu perfil»: lleva el color de enlace del navegador, azul puro en claro y lila en oscuro, y se ve sin estilo.
4. **Coherencia:** la sección «Tu correo de acceso» repite la nota de la ficha. Las migas dicen «Panel / Mi perfil» sobre el título «Configurar tu perfil». El subtítulo, «Tu presentación, tus especialidades y tus matrículas.», no describe siete pestañas.
5. **Tema oscuro:** el lila de «Volver a tu perfil» desentona. El resto se lee bien, y «Guardar cambios» en verde agua con texto oscuro es legible.
6. **Vacío, error y carga:** el aviso «Tu título figura como «Cardióloga», que no está en la lista…» orienta bien sobre un dato que no coincide con el catálogo. No hay carga ni error capturados.
7. **Jerarquía:** el botón primario cierra el formulario, debajo de una línea divisoria.
8. **Datos:** sintéticos. El documento se muestra en sólo lectura al propio médico.
9. **¿Muestra lo que pide el requisito?** Sí: el correo de acceso está en sólo lectura y no hay campo para editarlo.
10. **Por qué rechazar:** no se rechazaría sólo por esta pantalla. Sí se pediría que el botón siga la misma regla que los modales.

Hallazgos: N2-09, N2-10, N2-11 (MENOR, del cambio).
**Nota: ACEPTABLE CON RESERVAS.**

### P4 · Editor → Contacto

Capturas 16 y 17 (1440 claro, sin editar y con el celular editado) y 18 (390 oscuro).

1. **Lo primero que se ve mal:** en claro, el punto del mapa de calles casi no se ve: es un círculo casi blanco sobre el plano beige. En oscuro es azul marino y se ve. Después viene la pista de «Dirección», «Dónde atendés o dónde te ubican tus pacientes.», en una pestaña que desde D-03 es sólo personal.
2. **Texto cortado o solapado:** los textos del formulario no se cortan. En oscuro, la atribución del mapa («Leaflet · © OpenStreetMap contributors») casi no se lee sobre el plano.
3. **¿Terminado o prototipo?** El «⊖» sin texto junto a «Volver a ubicarme» parece un ícono suelto (ajeno; pendiente del veredicto D-05 de estos archivos).
4. **Coherencia:** el celular y el correo dicen «No se publica en tu ficha», mientras «Mi perfil → Contacto» muestra los dos: la palabra «ficha» nombra dos cosas distintas. Además, la ficha llama «Domicilio» a lo que aquí se describe como lugar de atención.
5. **Tema oscuro:** el mapa de departamentos se invierte bien, con Santa Cruz en verde agua. La atribución del mapa casi no se lee y «Volver a tu perfil» sale en lila.
6. **Vacío, error y carga:** la nota del mapa orienta («no podemos convertirlo en el nombre de la calle: escribila vos arriba»). No se capturó cómo queda la pantalla después de guardar ni ante un error.
7. **Jerarquía:** celular y correo, los datos de contacto propiamente dichos, quedan al fondo, debajo de dos mapas. «Guardar cambios» se ve igual antes y después de editar (capturas 16 y 17): nada avisa que hay algo por guardar.
8. **Datos:** sintéticos. El domicilio es el dato sensible (ver N2-16).
9. **¿Muestra lo que pide el requisito?** Sí para D-03: no hay celular, fijo ni correo del trabajo. La captura 17 muestra el campo editado, no la petición; la evidencia de la petición está en texto.
10. **Por qué rechazar:** por N2-12. La pista invita a cargar un dato del trabajo en la pestaña que el médico pidió sólo personal, y la ficha lo presenta como «Domicilio».

Hallazgos: N2-12 (MAYOR, del cambio) · N2-13, N2-09, N2-10 (MENOR, del cambio) · N2-14 (BLOQUEANTE, ajeno) · N2-25 (MENOR, ajeno).
**Nota: RECHAZADA.**

### P5 · Editor → Credenciales

Captura 19 (1440 claro).

1. **Lo primero que se ve mal:** en la columna «Acciones» de matrículas, la primera fila tiene un solo botón «Acciones» y la segunda tiene «Editar» y «Retirar» sueltos.
2. **Texto desalineado o pegado:** los botones de acción quedan unos 9 px más abajo que el texto de su fila. La nota de cada tabla está a unos 2 px del buscador.
3. **¿Terminado o prototipo?** Terminado. Aun así, un paginador completo («Anterior», «1», «Siguiente», «Página 1», «1–2 de 2», «10 por página») pesa más que una tabla de dos filas.
4. **Coherencia:** las especialidades «Verificada» ofrecen «Editar» y «Retirar», mientras que en Trayectoria un título verificado dice «Verificado: ya no se corrige». Son dos reglas distintas dentro del mismo editor.
5. **Tema oscuro:** no se capturó.
6. **Vacío, error y carga:** no aparecen en la captura.
7. **Jerarquía:** sí. «+ Agregar especialidad» y «+ Agregar matrícula» son primarios y están a la derecha de su barra.
8. **Datos:** sintéticos (MP-2400, SEDES-MP-2400).
9. **¿Muestra lo que pide el requisito?** Sí para D-01: no hay columna «Tipo» ni «Marcar como principal», y las filas van en orden de entrada.
10. **Por qué rechazar:** por N2-15. La misma columna cambia de forma según la fila, y en la primera no se encuentra «Descargar» sin abrir un menú.

Hallazgos: N2-15 (MAYOR, del cambio) · N2-22, N3-08 (MENOR, del cambio) · N2-23 (MENOR, ajeno).
**Nota: RECHAZADA.**

### P6 · Perfil público `/p/valeria-rojas`

Captura 20 (1440 claro, página completa).

1. **Lo primero que se ve mal:** «En resumen» publica «Dirección: Av. Banzer N.º 120», que es el valor que la ficha llama «Domicilio».
2. **Texto cortado:** no hay.
3. **¿Terminado o prototipo?** Terminado. Las opiniones en error deslucen el cierre de la página.
4. **Coherencia:** las especialidades son pastillas iguales, sin tilde, lo que es coherente con D-01 pero no con la ficha (N2-01). La trayectoria va 2023, 2018, 2025, cuando el detalle de la guía sí la ordena. Las iniciales son «VR»; en la ficha, «VM».
5. **Tema oscuro:** no se capturó.
6. **Vacío, error y carga:** «No pudimos traer las opiniones» con «Reintentar» orienta. Pero el encabezado y «En resumen» dicen «4,9 · 8 opiniones» y el bloque dice «Sin calificaciones».
7. **Jerarquía:** «Enviar mensaje» es primario y está bajo el nombre. Correcto.
8. **Datos:** el domicilio publicado es el dato sensible de la pantalla. La cuenta es sintética, pero con una cuenta real sería una dirección particular a la vista de cualquiera.
9. **¿Muestra lo que pide el requisito?** Sí para D-01: dos pastillas del mismo tono y ninguna marcada como principal.
10. **Por qué rechazar:** no por el cambio. Todo lo observado vive en el perfil público.

Hallazgos: N2-16, N2-17, N2-18 (MAYOR, ajenos) · N2-03 (MENOR, ajeno).
**Nota: APROBADA en lo que toca al cambio; hallazgos sólo ajenos.**

### P7 · Guía → detalle del médico, visto por el paciente

Captura 21 (1440 claro).

1. **Lo primero que se ve mal:** en la franja de la portada, «Atiende por telemedicina», «Español · interpreta en consulta» e «Inglés» se estiran como óvalos de unos 110 px de alto para igualar las dos insignias apiladas.
2. **Texto cortado:** no hay, pero las pastillas están deformadas.
3. **¿Terminado o prototipo?** Esa franja se ve de prototipo. Ya estaba así antes del cambio (`antes/capturas/07-principal-directorio-detalle-paciente.png`), justo en la fila que el cambio modificó.
4. **Coherencia:** sólo Cardiología tiene la tilde (N2-01). Bajo el sello «Verificado» se lee «Activo» sin rótulo: es el dato de «Estado de la práctica» (Q-I7). En «Formación», «Universidad Mayor de San Andrés» va sin «(UMSA)», cuando el editor la muestra con sigla.
5. **Tema oscuro:** no se capturó.
6. **Vacío, error y carga:** «Semana anterior» aparece deshabilitado en la agenda; no hay estados vacíos a la vista.
7. **Jerarquía:** los horarios son botones de contorno y ninguno se destaca como acción principal. Es ajeno al cambio.
8. **Datos:** cifras de actividad sintéticas y verosímiles (312 encuentros, 208 recetas).
9. **¿Muestra lo que pide el requisito?** En parte: las insignias ya no dicen «principal», pero no son iguales.
10. **Por qué rechazar:** por N2-01 y por N2-19, que están en la franja que el cambio tocó.

Hallazgos: N2-01 (BLOQUEANTE, del cambio) · N2-19 (MAYOR, del cambio, preexistente) · N2-20, N2-21 (MENOR, del cambio) · N2-03 (MENOR, ajeno).
**Nota: RECHAZADA.**

### P8 · Guía → portada `/directory`

Captura 22 (1440 claro).

1. **Lo primero que se ve mal:** nada roto. Muchas especialidades comparten el mismo ícono de estetoscopio.
2. **Texto cortado:** no.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia:** coherente con el resto del directorio.
5. **Tema oscuro:** no se capturó.
6. **Vacío, error y carga:** no aplica; hay datos.
7. **Jerarquía:** un índice de tarjetas iguales, correcto para esta pantalla.
8. **Datos:** conteos sintéticos.
9. **¿Muestra lo que pide el requisito?** No es la pantalla del DoD, que pide `/directory` con una especialidad. Esa lista aparece de rebote en la captura 47, con la búsqueda «a», y no menciona «principal».
10. **Por qué rechazar:** no por la pantalla. La evidencia no es la pedida (ver «No cubierto»).

Hallazgos: ninguno.
**Nota: APROBADA.**

### P9 · Alta del médico → «Tus especialidades»

Captura 23 (1440 claro, página 12 de 13).

1. **Lo primero que se ve mal:** dos filas «Sin especificar» por omisión, cada una con un «⊖» gris diminuto a la derecha y sin texto.
2. **Texto pegado:** el rótulo «Especialidad 2» queda a unos 10 px del primer desplegable, más cerca de él que de su propio campo.
3. **¿Terminado o prototipo?** Terminado en lo general.
4. **Coherencia:** en el modal del editor, el mismo gesto se resolvió con ícono y texto «Quitar» (desvío declarado). Aquí sigue siendo sólo un ícono con globo de ayuda.
5. **Tema oscuro:** no se capturó.
6. **Vacío, error y carga:** «Sin especificar» cumple la función de marcador, pero se lee como un valor elegido.
7. **Jerarquía:** la flecha de avance, que es la acción principal, es sólo un ícono: excepción declarada (Q-I11).
8. **Datos:** no aplica; no hay datos cargados.
9. **¿Muestra lo que pide el requisito?** Sí: el alta no pregunta cuál es la principal.
10. **Por qué rechazar:** no por sí sola; son detalles.

Hallazgos: N2-24 (MENOR, del cambio).
**Nota: ACEPTABLE CON RESERVAS.**

### P10 · Trayectoria → alta de título en modal

Capturas 24, 25 y 26 (1440 claro).

1. **Lo primero que se ve mal:** con la institución elegida, el desplegable muestra «Universidad Mayor de San Andrés (UN». La sigla, que es justo lo que pide H3.S1.M3, queda cortada.
2. **Texto cortado:** la sigla. Además, con el diploma adjunto, la fila del archivo y su «×» quedan cortadas por el pie del modal (captura 25).
3. **¿Terminado o prototipo?** El modal se ve terminado. La vista previa del PDF, de unos 290 px, lo lleva a ocupar casi toda la altura de la ventana.
4. **Coherencia:** coherente con los modales de especialidad y matrícula: mismo encabezado, «Cerrar» y pie.
5. **Tema oscuro:** no se capturó.
6. **Vacío, error y carga:** la confirmación y el descarte son claros; en el descarte, el foco queda en «Seguir editando». «Agregar título» está apagado sin decir por qué, aunque los asteriscos marcan qué falta.
7. **Jerarquía:** sí. El primario está en el pie y «Descartar» es rojo.
8. **Datos:** sintéticos («TIT-B-35421»).
9. **¿Muestra lo que pide el requisito?** El modal y la confirmación, sí. La sigla en el desplegable, no.
10. **Por qué rechazar:** por N3-01.

Hallazgos: N3-01 (BLOQUEANTE, del cambio) · N3-02, N3-03 (MENOR, del cambio).
**Nota: RECHAZADA.**

### P11 · Trayectoria → corregir título

Capturas 28, 29 y 30 (1440 claro).

1. **Lo primero que se ve mal:** el mismo corte de la sigla. Después, el título «Editar Título universitario», con una mayúscula a mitad de frase.
2. **Texto cortado:** la sigla.
3. **¿Terminado o prototipo?** Terminado.
4. **Coherencia:** en el alta los campos dicen «Institución (opcional)» y «Fecha de emisión (opcional)»; aquí dicen «Institución» y «Fecha de emisión», para el mismo registro.
5. **Tema oscuro:** no se capturó.
6. **Vacío, error y carga:** «Guardar cambios» está apagado sin cambios, y la confirmación y el descarte son correctos. El texto de confirmación («Se guardan y quedan visibles para quien corresponda.») no dice que el título sigue pendiente de verificación.
7. **Jerarquía:** sí.
8. **Datos:** sintéticos.
9. **¿Muestra lo que pide el requisito?** Sí en guardar por cambios, confirmación y descarte. El «archivo actual indicado» se reduce a «Ya hay uno cargado», sin nombre y sin forma de verlo desde el modal.
10. **Por qué rechazar:** por N3-01.

Hallazgos: N3-01 (BLOQUEANTE, del cambio) · N3-03, N3-12, N3-13 (MENOR, del cambio) · N3-14 (MENOR, ajeno).
**Nota: RECHAZADA.**

### P12 · Trayectoria → tabla de títulos + historial laboral

Capturas 27, 35 y 36 (1440 claro) y 37 y 38 (375 oscuro). Se agrupan por tema: las tres de 1440 claro tienen la misma composición y sólo cambian los datos; las dos de 375 oscuro se tratan juntas.

1. **Lo primero que se ve mal:** la tarjeta del historial está metida dentro de la de Trayectoria y pegada al paginador de títulos. A 1440 no hay aire entre los dos; a 375, el «10 por página» toca el borde de la tarjeta.
2. **Texto cortado o desalineado:** a 375, las pestañas cortan «atiendo» y «Credenc», y «NÚMERO / TÍTULO» se parte en dos renglones. La sombra de desplazamiento del historial avisa que hay contenido fuera de la vista. En títulos, «Descargar» queda más abajo que el texto de su fila.
3. **¿Terminado o prototipo?** Parecen dos piezas pegadas. En títulos, el alta está a la derecha de la barra; en el historial, es un botón suelto abajo a la izquierda. El paginador de títulos va a la derecha y el del historial está partido. «ACCIONES» va a la derecha en una tabla y al medio en la otra.
4. **Coherencia:** la columna Acciones de títulos tiene tres formas: sólo la nota, «Descargar» más la nota, o el menú «Acciones». El historial va 2023, 2018, 2025, aunque el subtítulo de títulos promete «del más reciente al más antiguo» y el detalle de la guía ordena la misma trayectoria.
5. **Tema oscuro (375):** el texto se lee. La sombra de desplazamiento aparece como una franja clara, y los desplegadores de fila son los caracteres «▼/▲» en blanco, sin el estilo del sistema. El detalle de fila (captura 38) se lee bien, con la sigla.
6. **Vacío, error y carga:** no aplica aquí; los estados vacíos están en P13.
7. **Jerarquía:** hay dos primarios en la pestaña con pesos distintos: «+ Agregar título» en la barra y «Añadir elemento a tu historial» suelto al pie.
8. **Datos:** «Cargo B 35421» es un valor de prueba que se lee como un código; es sintético.
9. **¿Muestra lo que pide el requisito?** Sí: el historial está debajo de los títulos, como tabla, y la columna muestra la sigla. No están resueltos el orden ni la integración visual.
10. **Por qué rechazar:** por N3-04, N3-05, N3-06 y N3-07.

Hallazgos: N3-04, N3-05, N3-06, N3-07 (MAYOR, del cambio) · N3-11 (MENOR, del cambio) · N2-05, N3-10 (MENOR, ajenos) · N2-07 (MENOR, evidencia).
**Nota: RECHAZADA.**

### P13 · Trayectoria → búsqueda en títulos y en el historial

Capturas 31 y 32 (1440 claro).

1. **Lo primero que se ve mal:** al buscar en títulos, el anillo de foco del buscador pisa los trazos descendentes de la nota de arriba.
2. **Texto solapado o pegado:** el anillo sobre la nota. El mensaje de «sin resultados» de títulos queda pegado a la tarjeta del historial.
3. **¿Terminado o prototipo?** Los estados vacíos se ven poco trabajados: en títulos, una línea gris y sin encabezado de tabla; en el historial, un encabezado cuyas columnas cambian de lugar (PERÍODO pasa de 624 a 736 px).
4. **Coherencia:** dos formas de vacío distintas para el mismo gesto en la misma pestaña.
5. **Tema oscuro:** no se capturó.
6. **Vacío, error y carga:** el texto orienta y hay «Limpiar todo», pero visualmente son vacíos mudos, y «Limpiar todo» queda arriba, lejos del mensaje.
7. **Jerarquía:** la salida, «Limpiar todo», tiene menos peso que el resto y está separada del mensaje.
8. **Datos:** sintéticos.
9. **¿Muestra lo que pide el requisito?** Sí: cada búsqueda filtra sólo su tabla.
10. **Por qué rechazar:** por N3-04, que también se ve aquí; lo demás son detalles.

Hallazgos: N3-04 (MAYOR, del cambio) · N3-08, N3-09 (MENOR, del cambio).
**Nota: RECHAZADA.**

### P14 · Historial → corregir y retirar un vínculo

Capturas 33 y 34 (1440 claro).

1. **Lo primero que se ve mal:** en «Retirar del historial», el botón «Retirar» es azul primario, mientras que retirar un título en la misma pestaña se confirma con un botón rojo.
2. **Texto cortado:** no hay.
3. **¿Terminado o prototipo?** El modal «Corregir el vínculo» no se parece a los de títulos: la cruz dice «Cancelar» (en los otros, «Cerrar»), el pie no tiene «Cancelar» y el botón dice «Guardar los cambios» (en los otros, «Guardar cambios»).
4. **Coherencia:** no es coherente con los modales ni con las confirmaciones del mismo editor, por lo descrito arriba.
5. **Tema oscuro:** no se capturó.
6. **Vacío, error y carga:** «Guardar los cambios» está apagado sin cambios, y la confirmación explica bien la consecuencia («Deja de figurar en tu ficha y en tu perfil público»).
7. **Jerarquía:** en la confirmación del retiro, una acción que no se deshace tiene el peso de un primario común.
8. **Datos:** sintéticos.
9. **¿Muestra lo que pide el requisito?** Sí en la confirmación; la persistencia está verificada en texto. No hay captura del retiro ya aplicado (3 → 2).
10. **Por qué rechazar:** por N3-15 y N3-16.

Hallazgos: N3-15, N3-16 (MAYOR, del cambio).
**Nota: RECHAZADA.**

### P15 a P27 · La barra de filtros en sus consumidores

Lo común a las trece: el cambio sólo toca la clave con que la barra lee y escribe la búsqueda. Todas las capturas son de 1440 en claro y muestran «a» escrita, la «×» en el campo y «Limpiar todo». En `consumidores-barra.txt` se lee `q=a` en la dirección. Ninguna tiene captura en oscuro.

**P15 · Administración › Pacientes (captura 39).**
1. Lo primero que se ve mal: el buscador mide unos 110 px y los tres desplegables se leen «Grup», «Factc» e «Idiom».
2. Texto cortado: las etiquetas de los filtros. Además, los códigos («PAC- / 20000») y los teléfonos se parten en dos renglones.
3. ¿Terminado o prototipo? En esta pantalla la barra se ve inacabada.
4. Coherencia: en los otros doce consumidores el buscador ocupa el ancho disponible.
5. Tema oscuro: no se capturó.
6. Vacío, error y carga: con «a» no se ve ningún estado vacío.
7. Jerarquía: «Nuevo paciente» es primario, arriba a la derecha. Correcto.
8. Datos: series sintéticas (5000000, 62000000…).
9. Requisito: sí; la barra busca con `q`.
10. Por qué rechazar: no por el cambio; el problema ya está declarado en «Riesgos residuales».

Hallazgos: N3-18 (MAYOR, ajeno). **Nota: APROBADA (sólo hallazgos ajenos).**

**P16 · Administración › Formularios clínicos (captura 40).**
1. Lo primero que se ve mal: la captura se tomó con la página desplazada, y la fila de arriba queda cortada bajo el encabezado fijo.
2. Texto cortado: esa fila, por el recorte de la captura.
3. ¿Terminado o prototipo? Terminado.
4. Coherencia: coherente con los otros consumidores.
5. Tema oscuro: no se capturó.
6. Vacío, error y carga: no aparecen.
7. Jerarquía: en el recorte no se ve una acción principal.
8. Datos: el origen dice «Ministerio de Salud del Perú (MINSA)» en un producto boliviano; es dato de catálogo.
9. Requisito: sí.
10. Por qué rechazar: no.

Hallazgos: N3-19 (MENOR, ajeno). **Nota: APROBADA (sólo hallazgos ajenos).**

**P17 · Administración › Importar del arancel (captura 41).**
1. Lo primero que se ve mal: el título de la primera tarjeta es ilegible («Los Médicos Anestesiblogos cobraran el 40% de Ins honorarios de!…»).
2. Texto cortado: no hay.
3. ¿Terminado o prototipo? «Volver al catálogo» lleva el color de enlace del navegador.
4. Coherencia: la barra es igual a la de los demás.
5. Tema oscuro: no se capturó.
6. Vacío, error y carga: «Sin precio en el arancel» y la marca «Revisar» orientan.
7. Jerarquía: «Importar» por tarjeta. Correcto.
8. Datos: texto leído mal de un documento externo; no es sensible.
9. Requisito: sí.
10. Por qué rechazar: no.

Hallazgos: N3-20 (MENOR, ajeno). **Nota: APROBADA (sólo hallazgos ajenos).**

**P18 · Constructor de formularios (captura 42).**
1. Lo primero que se ve mal: nada.
2. Texto cortado: no.
3. ¿Terminado o prototipo? Terminado.
4. Coherencia: coherente con los otros consumidores.
5. Tema oscuro: no se capturó.
6. Vacío, error y carga: «43 formularios» con «a» no permite distinguir si la búsqueda filtró algo, porque todos los títulos contienen «a».
7. Jerarquía: correcta.
8. Datos: sintéticos.
9. Requisito: sí.
10. Por qué rechazar: no.

Hallazgos: ninguno. **Nota: APROBADA.**

**P19 · Directorios (captura 43).**
1. Lo primero que se ve mal: nada.
2. Texto cortado: no.
3. ¿Terminado o prototipo? Terminado.
4. Coherencia: coherente.
5. Tema oscuro: no se capturó.
6. Vacío, error y carga: «124 resultados encontrados» orienta.
7. Jerarquía: correcta.
8. Datos: sintéticos.
9. Requisito: sí.
10. Por qué rechazar: no.

Hallazgos: ninguno. **Nota: APROBADA.**

**P20 · Evoluciones (captura 44).**
1. Lo primero que se ve mal: nada roto. «89 atenciones en los últimos 30 días» no permite saber si el conteo refleja la búsqueda.
2. Texto cortado: no.
3. ¿Terminado o prototipo? Terminado.
4. Coherencia: coherente.
5. Tema oscuro: no se capturó.
6. Vacío, error y carga: no aparecen.
7. Jerarquía: «Ver evolución» por fila y «Exportar a PDF» arriba. Correcto.
8. Datos: nombres de pacientes sintéticos.
9. Requisito: sí.
10. Por qué rechazar: no.

Hallazgos: ninguno. **Nota: APROBADA.**

**P21 · Directorio de farmacias (captura 45).**
1. Lo primero que se ve mal: nada.
2. Texto cortado: no.
3. ¿Terminado o prototipo? Terminado.
4. Coherencia: coherente.
5. Tema oscuro: no se capturó.
6. Vacío, error y carga: «Todavía no elegiste departamento» y «65 farmacias encontradas» orientan.
7. Jerarquía: correcta.
8. Datos: nombres de cadenas comerciales reales en datos de ejemplo. No son sensibles.
9. Requisito: sí.
10. Por qué rechazar: no.

Hallazgos: ninguno. **Nota: APROBADA.**

**P22 · Glosario médico (captura 46).**
1. Lo primero que se ve mal: con «a» escrita, las categorías siguen mostrando sus conteos totales («3715 términos»), y no se ve qué filtró la búsqueda.
2. Texto cortado: no.
3. ¿Terminado o prototipo? Terminado.
4. Coherencia: coherente.
5. Tema oscuro: no se capturó.
6. Vacío, error y carga: no aparecen.
7. Jerarquía: correcta.
8. Datos: sintéticos.
9. Requisito: sí.
10. Por qué rechazar: no.

Hallazgos: ninguno. **Nota: APROBADA.**

**P23 · Directorio de médicos de una especialidad (captura 47).**
1. Lo primero que se ve mal: dice «57 médicos», pero el grupo visible dice «Cardiología 51», y los demás grupos no entran en la captura.
2. Texto cortado: las direcciones se cortan con puntos suspensivos, de forma intencional.
3. ¿Terminado o prototipo? Terminado.
4. Coherencia: coherente, y sin ninguna marca de «principal». Es la lista de una especialidad que pide el DoD de H2.S2.M8.
5. Tema oscuro: no se capturó.
6. Vacío, error y carga: no aparecen.
7. Jerarquía: «Revisar disponibilidad» por tarjeta. Correcto.
8. Datos: los nombres y las direcciones de consultorio tienen aspecto de datos reales de redes de aseguradoras.
9. Requisito: sí.
10. Por qué rechazar: no.

Hallazgos: N3-21 (MENOR, ajeno). **Nota: APROBADA (sólo hallazgos ajenos).**

**P24 · Directorio de laboratorios (captura 48).**
1. Lo primero que se ve mal: nada.
2. Texto cortado: no.
3. ¿Terminado o prototipo? Terminado.
4. Coherencia: coherente.
5. Tema oscuro: no se capturó.
6. Vacío, error y carga: «24 centros encontrados» orienta.
7. Jerarquía: correcta.
8. Datos: sintéticos.
9. Requisito: sí.
10. Por qué rechazar: no.

Hallazgos: ninguno. **Nota: APROBADA.**

**P25 · Mis servicios (captura 49).**
1. Lo primero que se ve mal: nada.
2. Texto cortado: no.
3. ¿Terminado o prototipo? Terminado.
4. Coherencia: coherente.
5. Tema oscuro: no se capturó.
6. Vacío, error y carga: la marca «Inactivo» se entiende.
7. Jerarquía: «Editar precio» por tarjeta. Correcto.
8. Datos: sintéticos.
9. Requisito: sí.
10. Por qué rechazar: no.

Hallazgos: ninguno. **Nota: APROBADA.**

**P26 · Vitrina de diseño (captura 50).**
1. Lo primero que se ve mal: el anillo de foco del buscador pisa el segundo renglón de la descripción («value set no está disponible…»), como en N3-08.
2. Texto solapado: ese renglón.
3. ¿Terminado o prototipo? Es una vitrina, y se ve como tal.
4. Coherencia: coherente, y confirma `q=a` en su propio texto.
5. Tema oscuro: no se capturó.
6. Vacío, error y carga: el filtro «Diagnóstico» deshabilitado explica por qué.
7. Jerarquía: correcta.
8. Datos: de ejemplo.
9. Requisito: sí.
10. Por qué rechazar: no.

Hallazgos: N3-22 (MENOR, ajeno). **Nota: APROBADA (sólo hallazgos ajenos).**

**P27 · Directorio de clínicas (captura 51).** Pendiente de recaptura; no se juzga. Queda el registro de que el archivo abierto en esta pasada no muestra el estado de carga, sino resultados.

---

### Hallazgos

| ID | Severidad | Captura(s) | Qué y dónde | Atribución |
|---|---|---|---|---|
| N2-01 | **BLOQUEANTE** | 1–7, 21 | La insignia de Cardiología lleva una tilde de «Certificada» que la de Medicina Interna no tiene. Es sólo un glifo: el texto «Certificada» existe únicamente para el lector de pantalla (`shared/components/organisms/specialty-badge/specialty-badge.html:5-23`). Está donde antes decía «✓ PRINCIPAL», y a 390 queda junto al sello «✓ Verificado». Dispara el kill-test del encargo («una insignia se ve distinta de las otras»). Contradice el perfil público, sin tilde, y la pestaña Credenciales, que lo dice con texto. Salidas: texto visible «Certificada» (decisión del doctor, porque sigue siendo una diferencia) o quitar el glifo | del cambio |
| N2-02 | MENOR | 5, 6 | A 390, la nota del correo de acceso se parte y su segundo renglón se lee como parte del correo (`features/account/my-profile/practitioner-profile/practitioner-profile-view/practitioner-profile-view.html:188`) | del cambio |
| N2-03 | MENOR | 1, 20, 21 | La misma persona tiene tres monogramas: «VM» (ficha y detalle), «VR» (perfil público) y «DV» (encabezado) | ajeno (avatar, perfil público, encabezado) |
| N2-04 | MAYOR | 2, 4, 6, 9, 11, 13 | En oscuro, «Panel» en las migas queda cerca de 2,6:1 (`shared/components/molecules/breadcrumb/breadcrumb.html:6`, enlace en variante `subtle`) | ajeno |
| N2-05 | MENOR | 3–6, 10–13, 37, 38 | La tira de pestañas corta la etiqueta vecina contra la flecha («(», «atiendo», «Credenc») (`shared/components/molecules/tabs/`) | ajeno |
| N2-06 | MENOR | 8–13 | La ficha muestra el celular sin agrupar («+591 71000000») y el editor lo agrupa («7100 0000») (`practitioner-profile.ts:459`, `practitioner-profile-view.html:304`) | del cambio (preexistente) |
| N2-07 | MENOR | 8–13, 27 | Evidencia: el puntero quedó sobre la pestaña activa («Contacto», «Actividad») y la muestra con un fondo de resaltado que no es el del estado activo | del cambio (evidencia) |
| N2-08 | MENOR | 7 | El aviso «Credenciales» sigue abierto al volver a Datos personales y se superpone al borde de la tarjeta (`practitioner-profile.ts:343-347`) | del cambio (preexistente) |
| N2-09 | MENOR | 14–17 | En el formulario principal, «Guardar cambios» está habilitado sin cambios y se ve igual después de editar, mientras que en los modales del mismo editor se enciende sólo con cambios (`practitioner-profile-edit.html:651-657`). El kill-test lo exige sólo en el modal | del cambio (preexistente) |
| N2-10 | MENOR | 14–18 | «Volver a tu perfil» lleva el color de enlace del navegador: azul puro en claro, lila en oscuro (`practitioner-profile-edit.html:661-663`; `.edicion__volver` en `practitioner-profile-edit.css:119-121`, sin color) | del cambio (preexistente) |
| N2-11 | MENOR | 14, 15 | El subtítulo «Tu presentación, tus especialidades y tus matrículas» no describe las siete pestañas. Las migas dicen «Mi perfil» en «Configurar tu perfil»; eso último sale de la navegación (ajeno) | del cambio (subtítulo) |
| N2-12 | **MAYOR** | 16–18 | La pista de «Dirección» en Contacto dice «Dónde atendés o dónde te ubican tus pacientes.» (`practitioner-profile-edit.html:261`) en la pestaña que D-03 dejó sólo personal. La ficha llama «Domicilio» a ese dato y el perfil público lo publica (N2-16). Está declarado en el reporte, sin corregir | del cambio (preexistente) |
| N2-13 | MENOR | 16–18 | «No se publica en tu ficha» en celular y correo (`practitioner-profile-edit.html:296, 312`), aunque «Mi perfil → Contacto» los muestra: «ficha» nombra dos cosas | del cambio |
| N2-14 | **BLOQUEANTE** | 16, 17 | En tema claro, el punto del mapa de calles es un círculo casi blanco sobre el plano y no se distingue. El pin sin estado recibe la clase `mapa__pin--neutral`, que no tiene regla (`shared/components/organisms/map/map.ts:391`), y cae al fondo `--bg-inset` (`map.css:59-72`). En oscuro se ve | ajeno |
| N2-15 | **MAYOR** | 19 | En la columna Acciones de matrículas, una fila tiene el menú «Acciones» y la otra «Editar» y «Retirar» sueltos: una matrícula con archivo tiene tres acciones y el umbral de `row-actions` las agrupa (`practitioner-profile-edit.ts:1907-1914`; ADR-0012 §2). «Descargar» queda escondido en una fila y ausente en la otra. El umbral es ajeno, pero lo provoca la composición del cambio | del cambio |
| N2-16 | **MAYOR** | 20 | El perfil público publica «Dirección: Av. Banzer N.º 120», el valor que la ficha llama «Domicilio» (`features/public-profile/public-profile-card/public-profile-card.ts:157`). Hay que definir si ese campo es particular o de atención | ajeno |
| N2-17 | **MAYOR** | 20 | La trayectoria del perfil público sale en el orden del servidor: 2023, 2018, 2025 (`public-profile-card.html:315`) | ajeno |
| N2-18 | **MAYOR** | 20 | El encabezado y «En resumen» dicen «4,9 · 8 opiniones», y el bloque de opiniones dice «Sin calificaciones» y muestra un error (`features/public-profile/public-profile-reviews/public-profile-reviews.html:23`) | ajeno |
| N2-19 | **MAYOR** | 21 | En la portada del detalle, las pastillas de telemedicina e idiomas se estiran como óvalos de unos 110 px para igualar las insignias apiladas (`practitioner-profile-view.html:804-822`, `.profesional__disponibilidad`). Ya estaba así antes, en la fila que el cambio modificó | del cambio (preexistente) |
| N2-20 | MENOR | 21 | «Activo» sin rótulo bajo el sello «Verificado»: es el dato de «Estado de la práctica» (`practitioner-profile-view.html:782`). Está declarado como Q-I7 y lo decide el doctor | del cambio (declarado) |
| N2-21 | MENOR | 21 | En «Formación» del detalle, la institución va sin sigla («Universidad Mayor de San Andrés»), mientras que el editor la muestra con «(UMSA)» | del cambio |
| N2-22 | MENOR | 19, 27, 36 | Las especialidades «Verificada» ofrecen «Editar» y «Retirar», pero los títulos verificados dicen «ya no se corrige» (`practitioner-profile-edit.ts:1903-1905` frente a `:1889-1901`). Hay que confirmar con el contrato cuál es la regla | del cambio |
| N2-23 | MENOR | 19, 27, 36 | Los botones de acción de fila quedan unos 9 px más abajo que el texto de la celda, en las dos pestañas (`data-table` / `row-actions`) | ajeno |
| N2-24 | MENOR | 23 | En el alta, «Quitar» es un «⊖» gris sin texto (`features/auth/register-practitioner/register-practitioner.html:457-469`), mientras que el modal del editor dice «Quitar». El rótulo «Especialidad 2» queda pegado al desplegable anterior y hay dos filas vacías por omisión | del cambio |
| N2-25 | MENOR | 16–18 | Hay un «⊖» sin texto junto a «Volver a ubicarme» (`features/auth/registro-compartido/ubicacion-picker/ubicacion-picker.html:46`), y la atribución del mapa casi no se lee en oscuro | ajeno |
| N3-01 | **BLOQUEANTE** | 25, 28–30 | El desplegable de Institución corta la sigla: «Universidad Mayor de San Andrés (UN», al agregar y al corregir. El CA de H3.S1.M3 pide leer el código en el desplegable. La grilla de dos columnas del modal (`practitioner-profile-edit.css:92-94`) deja unos 300 px. Tampoco hay captura de la lista abierta que muestre la sigla | del cambio |
| N3-02 | MENOR | 25 | Con el diploma adjunto, la vista previa (unos 290 px) empuja la fila del archivo, y su «×», debajo del pie del modal | del cambio (lo provoca el modal; la vista previa es de `file-input`) |
| N3-03 | MENOR | 24–26, 28–30 | Formato y tamaño se dicen dos veces con palabras distintas: «PDF · JPEG · PNG · Máximo 5 MB» dentro del recuadro y «PDF, JPG o PNG. Hasta 5 MB» debajo (`practitioner-profile-edit.html:799, 856, 969`) | del cambio |
| N3-04 | **MAYOR** | 27, 31, 32, 35–37 | La tarjeta del historial va dentro de la tarjeta de Trayectoria y pegada al paginador de títulos: sin aire a 1440, y a 375 el «10 por página» toca su borde. `work-history.html:10-16` quita la tarjeta sólo en la línea de tiempo; el editor lo monta en `practitioner-profile-edit.html:467`. Está declarado, sin corregir | del cambio |
| N3-05 | **MAYOR** | 27, 35–37 | Las dos tablas de la misma pestaña siguen patrones distintos. El alta de títulos está a la derecha de la barra y la del historial es un botón suelto abajo (`work-history.html:570-581`). El paginador de títulos va a la derecha (`practitioner-profile-edit.css:178-186`) y el del historial está partido (`work-history.html:391-395`). «ACCIONES» va a la derecha en una y al medio en la otra. Los rótulos son «Agregar título» y «Añadir elemento a tu historial» | del cambio |
| N3-06 | **MAYOR** | 27, 35–37 | La columna Acciones de títulos tiene tres formas: sólo la nota, «Descargar» más la nota, o el menú «Acciones» (`practitioner-profile-edit.ts:1889-1901`, `.html:688-701`) | del cambio |
| N3-07 | **MAYOR** | 27, 35–37 | El historial no se ordena por fecha: va 2023, 2018, 2025 (`work-history.ts:1535-1545` devuelve el orden del servidor). En la misma pestaña, los títulos prometen «del más reciente al más antiguo», y el detalle de la guía sí ordena la trayectoria | del cambio |
| N3-08 | MENOR | 19, 27, 31, 36 | La nota de cada tabla queda a unos 2 px de su barra, y con foco el anillo pisa los trazos descendentes (bloques del editor sobre `app-filter-bar`) | del cambio |
| N3-09 | MENOR | 31, 32 | Los estados vacíos son distintos. En títulos, una línea gris sin encabezado, pegada a la tarjeta del historial. En el historial, el encabezado se mantiene y sus columnas se corren | del cambio |
| N3-10 | MENOR | 37, 38 | Los desplegadores de fila son los caracteres «▼/▲» (`shared/components/organisms/data-table/data-table.html:106`), y en oscuro la sombra de desplazamiento se ve como una franja clara (`data-table.css:38-44`) | ajeno |
| N3-11 | MENOR | 37 | A 375, la sombra de desplazamiento del historial indica contenido fuera de la vista. Hay que confirmar qué queda afuera (columnas de la tabla del historial) | del cambio |
| N3-12 | MENOR | 28–30 | «Reemplazar el diploma» no nombra el archivo actual ni permite verlo desde el modal; sólo dice «Ya hay uno cargado» (`practitioner-profile-edit.html:799, 856`) | del cambio |
| N3-13 | MENOR | 24, 28 | El alta y la corrección rotulan distinto el mismo registro: «(opcional)» en `:930, :958` y sin ese agregado en `:765, :784`. El título dice «Editar Título universitario» | del cambio |
| N3-14 | MENOR | 29 | La confirmación de la corrección no dice que el título sigue pendiente («quedan visibles para quien corresponda»); es el texto por omisión de `confirmarCambios` | ajeno |
| N3-15 | **MAYOR** | 33 | El modal «Corregir el vínculo» no sigue el patrón del editor: la cruz dice «Cancelar», el pie no tiene «Cancelar» y el botón dice «Guardar los cambios» (`work-history.html:152, 596, 723`) | del cambio |
| N3-16 | **MAYOR** | 34 | «Retirar» un vínculo se confirma con un botón azul primario, y retirar un título, con uno rojo destructivo. `work-history.ts:904-911` no pasa `destructive: true`, a diferencia de `practitioner-profile-edit.ts:2129-2135` | del cambio |
| N3-18 | **MAYOR** | 39 | Listado de pacientes: el buscador mide unos 110 px, los filtros se leen «Grup», «Factc» e «Idiom», y los códigos y teléfonos se parten. Está declarado en el reporte | ajeno |
| N3-19 | MENOR | 40 | La captura tiene una fila cortada bajo el encabezado fijo, y el origen del formulario es «Ministerio de Salud del Perú (MINSA)» | ajeno |
| N3-20 | MENOR | 41 | El título de una tarjeta es ilegible (dato del arancel) y «Volver al catálogo» lleva el color de enlace del navegador | ajeno |
| N3-21 | MENOR | 47 | «57 médicos» frente a «Cardiología 51» sin ver el resto de los grupos; los nombres y las direcciones tienen aspecto de datos reales | ajeno |
| N3-22 | MENOR | 50 | En la vitrina, el anillo de foco del buscador pisa la descripción: la barra no deja margen para su anillo, y cada consumidor tiene que dárselo | ajeno |

No hay N3-17: el número quedó libre al unir en N2-07 las dos notas sobre la evidencia.

### No cubierto

- **H2, editor:** el DoD de H2 pide tres viewports por dos temas. Sólo la ficha los tiene (12 capturas). Del editor hay 1440 claro y 390 oscuro; faltan 768 en los dos temas, 1440 en oscuro y 390 en claro.
- **H2, resto de pantallas:** Credenciales del editor, perfil público, detalle y portada de la guía y el alta sólo están en 1440 claro. No hay oscuro ni móvil de ninguna, y en particular no se vio la franja de insignias del detalle (N2-19) a 390.
- **H2.S2.M8:** la lista de una especialidad no tiene captura propia. Aparece de rebote en la captura 47, con la búsqueda «a», y confirma que no hay marca de «principal».
- **H2.S3.M6:** la captura 17 muestra el campo editado antes de guardar. No hay captura de lo que ve el médico después de guardar ni ante un error; la petición se retuvo a propósito.
- **H3, modales:** alta, corrección y vínculo sólo se capturaron a 1440 en claro. No hay modales en oscuro ni a 375 o 768, y en particular no hay imagen de las acciones del pie a 320 y 375, que el reporte da por corregidas.
- **H3.S1.M3:** no hay captura de la lista del desplegable abierta. Es la única forma de que la sigla se lea en el desplegable, dado el corte de N3-01.
- **H3, Trayectoria:** no hay captura a 768 ni a 1440 en oscuro.
- **H3.S4.M4:** el retiro persistido (3 → 2 filas tras recargar) sólo está en texto. La captura 35 es anterior al retiro.
- **H3.S4.M6:** el descarte con el texto común dentro del historial no tiene captura.
- **H3.S1.M2 / H3.S2.M2:** la descarga del diploma nuevo sólo está en texto.
- **Barra de filtros:** ninguno de los trece consumidores se capturó en oscuro ni fuera de 1440.
- **`h3-barra-centros-medicos.png`:** pendiente de recaptura, como pidió el encargo, y no juzgada. Al abrirla se ven resultados y no el estado de carga que describe la primera pasada; hay que confirmar cuál es la versión definitiva antes de recapturar o de dar la celda por cubierta.

---

## Ronda 2

Esta ronda mira la rama después de integrar `mockup` (`fae0efc2`) y de la corrección `2fb08351`.

**Qué se reabrió:**
- las 23 capturas de H2;
- las 17 de H3 que tienen fecha nueva: 15 rehechas y 2 nuevas, las de la institución. El aviso habla de 18, pero en la carpeta hay 17;
- `h3-barra-centros-medicos.png`, que en la ronda 1 quedó sin juzgar.

Las otras 12 `h3-barra-*` no cambiaron y conservan su nota.

**Criterio de atribución.** Es el mismo de la ronda 1. Una novedad: lo que llegó con la integración de `mockup` (el botón «Cancelar edición» y el traslado de las especialidades a «Datos personales», del commit `3622fbd6`, fusionado por #627) está en un archivo que la rama modifica. Por eso cuenta como **del cambio (preexistente)**, y se aclara que vino de `mockup`.

### Capturas nuevas o cambiadas de contenido

| # | Pantalla | Viewport (px) | Tema | Estado | Archivo |
|---|---|---|---|---|---|
| 14 | Editor · Datos personales, ahora con «Tus especialidades cargadas» | 1440 | claro | sin editar | `h2-editor-datos-personales-escritorio-claro.png` |
| 15 | Ídem | 390 | oscuro | sin editar | `h2-editor-datos-personales-movil-oscuro.png` |
| 16–18 | Editor · Contacto, ahora con «Dirección del trabajo» | 1440 / 390 | claro / oscuro | sin editar; celular editado (17) | `h2-editor-contacto-*.png`, `h2-patch-antes-de-guardar.png` |
| 19 | **Ya no es Credenciales**: es el mismo archivo que la 14, byte a byte | 1440 | claro | — | `h2-insignias-editor.png` |
| 23 | Alta del médico · «Tus especialidades», ahora paso 13 de 14 | 1440 | claro | vacío | `h2-alta-especialidades.png` |
| 52 | Trayectoria · alta de título | 1440 | claro | institución elegida | `h3/capturas/h3-alta-titulo-institucion.png` |
| 53 | Trayectoria · alta de título | 375 | oscuro | institución elegida | `h3-alta-titulo-institucion-movil-oscuro.png` |
| 51 | Barra · Directorio de clínicas | 1440 | claro | búsqueda «a», con resultados | `h3-barra-centros-medicos.png` (ahora se juzga) |

### Estado de los hallazgos de la ronda 1

| ID | Ronda 1 | Estado | Evidencia de la ronda 2 |
|---|---|---|---|
| N2-01 | BLOQUEANTE, del cambio | **CERRADO** | 1–7 y 21: las dos insignias son iguales, sin tilde; sólo llevan el sello de estado |
| N2-02 | MENOR, del cambio | SIGUE | 5, 6: a 390 la nota se parte en «Se cambia por su / propio trámite» |
| N2-03 | MENOR, ajeno | SIGUE | «VM» en la ficha, «VR» en el perfil público, «DV» en el encabezado |
| N2-04 | MAYOR, ajeno | SIGUE | 2, 4, 6, 9, 11, 13: «Panel» en las migas con bajo contraste en oscuro |
| N2-05 | MENOR, ajeno | SIGUE | 3–6, 10–13, 37, 38: la tira de pestañas corta la etiqueta vecina |
| N2-06 | MENOR, del cambio | SIGUE | 8–13: «+591 71000000» sin agrupar |
| N2-07 | MENOR, evidencia | SIGUE | la pestaña bajo el puntero aparece resaltada: «Datos personales» (7), «Contacto» (8–13), «Actividad» (27) |
| N2-08 | MENOR, del cambio | SIGUE | 7: el aviso «Credenciales» sigue abierto en Datos personales |
| N2-09 | MENOR, del cambio | SIGUE | 14–18: «Guardar cambios» habilitado sin cambios; ahora también «Cancelar edición» (N2-27) |
| N2-10 | MENOR, del cambio | SIGUE | 14–18: «Volver a tu perfil» con el color de enlace del navegador |
| N2-11 | MENOR, del cambio | SIGUE | el subtítulo sigue siendo «Tu presentación, tus especialidades y tus matrículas.», y ahora especialidades y matrículas viven en dos pestañas distintas de siete |
| N2-12 | MAYOR, del cambio | **CERRADO** | 16–18: la pista de «Dirección» dice «Tu domicilio particular.» |
| N2-13 | MENOR, del cambio | SIGUE | 16–18: «No se publica en tu ficha», pero la ficha los muestra |
| N2-14 | BLOQUEANTE, ajeno | SIGUE | 16, 17: en claro, el punto del mapa de calles sigue casi blanco sobre el plano |
| N2-15 | MAYOR, del cambio | **CAMBIA → MENOR, sin captura** | No hay captura de Credenciales (N2-31). Por código, una matrícula que ya no está pendiente sólo ofrece «Descargar»; una pendiente con archivo sigue con tres acciones y menú. La forma de la columna la fija la regla del producto (ADR-0012 §2), la misma en todas las tablas; queda como detalle |
| N2-16 | MAYOR, ajeno | SIGUE, con matiz | 20: «Dirección: Av. Banzer N.º 120». El dato sale de la ficha pública (`core/mock/handlers/public.handlers.ts:376`), no del domicilio; en los datos sembrados coinciden. Con la pista nueva («Tu domicilio particular.»), si en la API son el mismo dato, el editor llama privado a lo que el perfil público publica. Hay que confirmarlo con el contrato |
| N2-17 | MAYOR, ajeno | SIGUE | 20: la trayectoria sigue saliendo 2023, 2018, 2025 |
| N2-18 | MAYOR, ajeno | SIGUE | 20: «4,9 · 8 opiniones» arriba y «Sin calificaciones» con error abajo |
| N2-19 | MAYOR, del cambio | **CERRADO** | 21: las pastillas de telemedicina e idiomas alinean arriba y no se estiran. Queda N2-30 |
| N2-20 | MENOR, del cambio | SIGUE | 21: «Activo» sin rótulo bajo el sello (declarado, Q-I7) |
| N2-21 | MENOR, del cambio | SIGUE | 21: en «Formación», «Universidad Mayor de San Andrés» sin «(UMSA)» |
| N2-22 | MENOR, del cambio | **CERRADO** | 14, 15: las especialidades verificadas dicen «Verificada: ya no se corrige», como los títulos |
| N2-23 | MENOR, ajeno | SIGUE | 27, 35, 36: «Descargar» unos 10 px más abajo que el texto de su fila |
| N2-24 | MENOR, del cambio | SIGUE | 23: «⊖» sin texto; «Especialidad 2» a unos 11 px del desplegable anterior |
| N2-25 | MENOR, ajeno | SIGUE | 16–18: «⊖ Quitar la ubicación» ya tiene texto, pero en oscuro la atribución del mapa sigue sin leerse |
| N3-01 | BLOQUEANTE, del cambio | **CERRADO** | 52 y 28–30: «UMSA · Universidad Mayor de San Andrés — La Paz» se lee entero a 1440. 53: a 375 se corta el final del nombre y la sigla queda a la vista |
| N3-02 | MENOR, del cambio | SIGUE | 25: con el diploma adjunto, la vista previa sigue empujando la fila del archivo debajo del pie |
| N3-03 | MENOR, del cambio | SIGUE | 24–26, 28–30: formato y tamaño dichos dos veces con palabras distintas |
| N3-04 | MAYOR, del cambio | **CAMBIA → MENOR** | 27, 31, 32, 35–37: ya hay unos 20 px de aire entre el paginador de títulos y la tarjeta del historial, a 1440 y a 375. Queda la tarjeta dentro de la tarjeta |
| N3-05 | MAYOR, del cambio | SIGUE | 27, 35–37: el alta del historial sigue suelta abajo, el paginador partido, «ACCIONES» al medio |
| N3-06 | MAYOR, del cambio | **CAMBIA → MENOR** | 27, 35, 36: siguen las tres formas (sólo la nota · «Descargar» más la nota · menú «Acciones»), pero responden a la regla del producto (ADR-0012 §2) y a la decisión de no corregir lo verificado. Queda la forma: «Descargar» se ve unos 10 px más abajo que el texto y 14 px más adentro que la nota |
| N3-07 | MAYOR, del cambio | SIGUE | 27, 31, 35–37: el historial sigue en 2023, 2018, 2025 |
| N3-08 | MENOR, del cambio | **CERRADO** | 14, 31, 36: hay aire entre la nota y la barra, y el anillo de foco ya no pisa el texto |
| N3-09 | MENOR, del cambio | SIGUE | 31, 32: dos formas de vacío distintas; PERÍODO se corre de 624 a 736 px |
| N3-10 | MENOR, ajeno | SIGUE | 37, 38: desplegadores «▼/▲» y la franja clara de desplazamiento |
| N3-11 | MENOR, del cambio | SIGUE | 37: la sombra de desplazamiento del historial sigue indicando contenido fuera de la vista |
| N3-12 | MENOR, del cambio | SIGUE | 28–30: «Ya hay uno cargado», sin nombre ni forma de verlo |
| N3-13 | MENOR, del cambio | SIGUE | 24 y 28: «Institución (opcional)» frente a «Institución»; «Editar Título universitario» |
| N3-14 | MENOR, ajeno | SIGUE | 29: «quedan visibles para quien corresponda» |
| N3-15 | MAYOR, del cambio | SIGUE | 33: la cruz dice «Cancelar», el pie no tiene «Cancelar», el botón dice «Guardar los cambios» |
| N3-16 | MAYOR, del cambio | SIGUE | 34: «Retirar» sigue en azul primario |
| N3-18 a N3-22 | ajenos | SIGUE | capturas sin cambios |

**Sobre N3-05, N3-07, N3-15 y N3-16.** La razón que se da para no corregirlos es que el historial (`work-history`) tiene otro dueño y que este carril sólo tenía encargadas tres correcciones. Es una razón de alcance, no de atribución. Con el criterio de las dos rondas siguen siendo **del cambio (preexistentes)**, por tres motivos:
- la rama modifica `work-history.ts` y `.html` (H3.S4);
- la rama monta el historial en el editor (H3.S3.M1);
- en N3-16, la confirmación azul aparece por el camino que la rama conectó: la tabla reusa `retirarVinculo` (H3.S4.M4). Ya era así antes, con `retirarAfiliacionLocal`.

Si Itzan decide clasificarlos como hallazgos para su dueño, las notas cambian así: P12 pasa a ACEPTABLE CON RESERVAS y P14 a APROBADA (sólo hallazgos ajenos). La decisión es suya; esta ronda aplica el criterio sin cambiarlo.

### Hallazgos nuevos

| ID | Severidad | Captura(s) | Qué y dónde | Atribución |
|---|---|---|---|---|
| N2-26 | **MAYOR** | 14, 15 | «Cancelar edición · Guardar cambios» quedan debajo de «Tus especialidades cargadas», una sección que se guarda sola desde su modal. El pie se lee como el botón que guarda también las especialidades, y a 390 hay que pasar por la tabla y su paginador para llegar al botón que guarda el nombre. El propio archivo desaconseja esa disposición: `practitioner-profile-edit.html:690-696` («Un "Guardar cambios" presente mientras se carga una matrícula prometería guardar algo que no guarda»). Salidas: la sección de especialidades debajo del pie, o el pie pegado a los campos que guarda | del cambio (preexistente, llegó con `mockup`) |
| N2-27 | MENOR | 14–18 | «Cancelar edición» está habilitado sin cambios y descarta sin preguntar, mientras que los modales del mismo editor preguntan «¿Descartás lo que escribiste?». Con nada cambiado, igual avisa «Descartamos los cambios sin guardar.» (`practitioner-profile-edit.ts:1403-1411`). Se vio el botón habilitado; el aviso no está capturado | del cambio (preexistente, llegó con `mockup`) |
| N2-28 | MENOR | 15, 18 | A 390, «Cancelar edición» queda arriba de «Guardar cambios», y su texto arranca unos 20 px más a la derecha que el borde del botón primario | del cambio |
| N2-29 | MENOR | 23 | La pista del alta, «Hasta cuatro. La lista completa está disponible para cualquier profesión.», explica una decisión interna con su segunda frase y no le dice nada útil a quien se registra | del cambio |
| N2-30 | MENOR | 21 | En la portada del detalle, las dos insignias se apilan en una columna en medio de la fila de pastillas. Ya no estiran nada, pero dejan un hueco y la fila se lee despareja (`practitioner-profile-view.html:804-822`) | del cambio |
| N2-31 | MENOR | 19 | Evidencia: `h2-insignias-editor.png` es el mismo archivo que la captura 14. H2 ya no tiene captura de «Credenciales» (matrículas), que es donde vivía N2-15 | del cambio (evidencia) |
| N2-32 | MENOR | 16–18 | «Usar mi ubicación» y «Marcar tu lugar de trabajo en el mapa» van uno al lado del otro con estilos distintos (borde y texto de acento frente a neutro), sin que ninguno sea la acción principal. El ejemplo del campo, «Calle Warnes 45, lugar de trabajo», mezcla un ejemplo con una explicación | del cambio |
| N2-33 | MENOR | 16–18 | «Dirección del trabajo», en Contacto, convive con la pestaña «Dónde atiendo»: el médico tiene dos lugares para decir dónde atiende. En las capturas el campo está vacío, así que no se ve si la ficha lo mostraría. Es una decisión tomada; se registra para confirmarla con producto | del cambio |
| N3-23 | MENOR | 37, 38 | A 375, el estado ya se lee debajo del identificador y el detalle de la fila lo repite («Estado: Verificado») | del cambio |
| N3-24 | MENOR | 51 | Directorio de clínicas: «500 clínicas encontradas» es el tope de la lista presentado como total, junto a «Se muestran los primeros resultados». Además hay nombres del catálogo sin tilde («Ascencion», «Andrez») | ajeno |

### Pantallas cuyo contenido cambió: las diez preguntas

**P3 · Editor → Datos personales** (14, 15)
1. Lo primero que se ve mal: el pie «Cancelar edición · Guardar cambios» queda debajo de la tabla de especialidades y se lee como su botón de guardar.
2. Texto cortado o desalineado: a 1440, nada. A 390, «Cancelar edición» queda desalineado respecto del primario (N2-28).
3. ¿Terminado o prototipo? Terminado. «Volver a tu perfil» sigue con el color de enlace del navegador.
4. Coherencia: la tabla de especialidades repite el patrón de Trayectoria (barra con alta a la derecha, paginador a la derecha, «Verificada: ya no se corrige»). El subtítulo de la página no acompañó el traslado (N2-11).
5. Tema oscuro (390): se lee. «Guardar cambios» va en verde agua con texto oscuro; «Volver a tu perfil» sale en lila.
6. Vacío, error y carga: no se capturaron. El aviso del título que no está en la lista orienta.
7. Jerarquía: la pestaña tiene dos primarios, «Agregar especialidad», que guarda en el acto, y «Guardar cambios», que guarda después. Nada dice cuál guarda qué.
8. Datos: sintéticos. Las dos especialidades tienen la misma fecha («Desde 24/09/2021»).
9. Requisito: sí. Correo de acceso en sólo lectura, especialidades sin «principal», lo verificado no se corrige.
10. Por qué rechazar: por N2-26.

**Nota: RECHAZADA.**

**P4 · Editor → Contacto** (16–18)
1. Lo primero que se ve mal: en claro, el punto del mapa sigue casi invisible (N2-14, ajeno). En lo que toca el cambio no hay nada roto.
2. Texto cortado: los textos del formulario no se cortan. En oscuro, la atribución del mapa sigue sin leerse (ajeno).
3. ¿Terminado o prototipo? Terminado. Los dos botones de ubicación tienen estilos distintos (N2-32).
4. Coherencia: «Dirección del trabajo» y la pestaña «Dónde atiendo» dicen lo mismo (N2-33), y «No se publica en tu ficha» sigue en celular y correo (N2-13).
5. Tema oscuro: el pin se ve; la atribución no.
6. Vacío, error y carga: «Dirección del trabajo» está vacía, con un ejemplo. No se capturó con su mapa abierto ni con un error.
7. Jerarquía: celular y correo, que son los datos de contacto, quedan últimos, después de dos direcciones y un mapa.
8. Datos: sintéticos. El ejemplo «Calle Warnes 45» es verosímil, pero va en gris de ejemplo.
9. Requisito: sí. D-03, limitado a teléfonos y correo del trabajo, se cumple, y «Tu domicilio particular.» corrige N2-12.
10. Por qué rechazar: no por el cambio. Sí pediría confirmar N2-33 con producto.

**Nota: ACEPTABLE CON RESERVAS.**

### Resto de las pantallas: qué cambió y nota

| Pantalla | Qué se vio en la ronda 2 | Hallazgos vigentes | Nota ronda 1 → ronda 2 |
|---|---|---|---|
| P1 · Ficha · Datos personales | Insignias iguales en los tres viewports y los dos temas | N2-02, N2-08 (MENOR, del cambio); N2-03, N2-04, N2-05 (ajenos) | RECHAZADA → **ACEPTABLE CON RESERVAS** |
| P2 · Ficha · Contacto | Sin cambios de contenido | N2-06, N2-07 (MENOR) | ACEPTABLE CON RESERVAS → **ACEPTABLE CON RESERVAS** |
| P3 · Editor · Datos personales | Ver arriba | N2-26 (MAYOR); N2-09, N2-10, N2-11, N2-27, N2-28 (MENOR) | ACEPTABLE CON RESERVAS → **RECHAZADA** |
| P4 · Editor · Contacto | Ver arriba | N2-09, N2-10, N2-13, N2-28, N2-32, N2-33 (MENOR); N2-14, N2-25 (ajenos) | RECHAZADA → **ACEPTABLE CON RESERVAS** |
| P5 · Editor · Credenciales | Sin captura: la 19 ahora muestra Datos personales | N2-15 (MENOR por código, sin ver) | RECHAZADA → **SIN NOTA (sin captura)** |
| P6 · Perfil público | Sin cambios | N2-16 a N2-18 y N2-03 (ajenos) | APROBADA → **APROBADA (sólo hallazgos ajenos)** |
| P7 · Guía · detalle del médico | Insignias iguales; las pastillas ya no se estiran | N2-20, N2-21, N2-30 (MENOR); N2-03 (ajeno) | RECHAZADA → **ACEPTABLE CON RESERVAS** |
| P8 · Guía · portada | Sin cambios | — | APROBADA → **APROBADA** |
| P9 · Alta · especialidades | Paso 13 de 14, pista nueva, hasta cuatro especialidades | N2-24, N2-29 (MENOR) | ACEPTABLE CON RESERVAS → **ACEPTABLE CON RESERVAS** |
| P10 · Trayectoria · alta de título | Sigla adelante y a todo el ancho (52, 53) | N3-02, N3-03, N3-13 (MENOR) | RECHAZADA → **ACEPTABLE CON RESERVAS** |
| P11 · Trayectoria · corregir título | Sigla entera | N3-03, N3-12, N3-13 (MENOR); N3-14 (ajeno) | RECHAZADA → **ACEPTABLE CON RESERVAS** |
| P12 · Trayectoria · títulos + historial | Aire sobre el historial; estado bajo el identificador a 375 | N3-05, N3-07 (MAYOR); N3-04, N3-06, N3-11, N3-23 (MENOR); N2-05, N2-23, N3-10 (ajenos) | RECHAZADA → **RECHAZADA** |
| P13 · Trayectoria · búsqueda | Aire entre la nota y la barra, y encima del historial | N3-04, N3-09 (MENOR). El historial que se ve de fondo arrastra N3-05 y N3-07, ya calificados en P12 | RECHAZADA → **ACEPTABLE CON RESERVAS** |
| P14 · Historial · corregir y retirar | Sin cambios de diseño | N3-15, N3-16 (MAYOR) | RECHAZADA → **RECHAZADA** |
| P15–P26 · Barra en sus consumidores | Capturas sin cambios | los mismos de la ronda 1 | **sin cambio** (P15, P16, P17, P23 y P26 APROBADA con sólo hallazgos ajenos; P18–P22, P24 y P25 APROBADA) |
| P27 · Barra › Directorio de clínicas | Con resultados, ya no en carga | N3-24 (ajeno) | PENDIENTE → **APROBADA (sólo hallazgos ajenos)** |

### Resumen de notas, ronda 2

- **RECHAZADA (3):** P3 Editor · Datos personales (N2-26), P12 Trayectoria · títulos + historial (N3-05, N3-07) y P14 Historial · corregir y retirar (N3-15, N3-16).
- **ACEPTABLE CON RESERVAS (8):** P1, P2, P4, P7, P9, P10, P11, P13.
- **APROBADA (15):** P6, P8 y P15–P27; en P6, P15, P16, P17, P23, P26 y P27 hay sólo hallazgos ajenos.
- **SIN NOTA (1):** P5 Editor · Credenciales, porque no tiene captura en esta ronda.

**MAYOR o BLOQUEANTE del cambio que siguen:** N3-05, N3-07, N3-15 y N3-16 (historial laboral, preexistentes; ver la nota sobre su atribución) y el nuevo N2-26. **Ajenos que siguen:** N2-14 (BLOQUEANTE) y N2-04, N2-16, N2-17, N2-18 y N3-18 (MAYOR).

### No cubierto, ronda 2

- **Credenciales (matrículas):** ni H2 ni H3 tienen captura después de la integración. No se puede ver si N2-15 cambió ni cómo quedaron las matrículas activas sin «Editar» ni «Retirar».
- **«Cancelar edición»:** no hay captura de lo que pasa al pulsarlo, ni con cambios ni sin ellos (N2-27).
- **«Dirección del trabajo»:** sólo se ve el campo vacío. No hay captura con el mapa del trabajo abierto, con un punto marcado ni de cómo se ve el dato en la ficha.
- **Alta:** no hay captura del tope de cuatro especialidades alcanzado ni del catálogo completo abierto.
- **Especialidades en Datos personales:** el alta y la corrección en modal no se capturaron en esta ubicación.
- **Oscuro y viewports:** siguen faltando las mismas celdas de la ronda 1 (editor a 768 y 1440 en oscuro, modales fuera de 1440 claro salvo la 53, consumidores de la barra en oscuro).

---

## Ronda 3

Recaptura del 24/09, sobre un build nuevo. Los identificadores de la maqueta pasaron de 40995 a 83026.

**Reabiertas en esta ronda (11):**
- H2: `h2-editor-credenciales-escritorio-claro.png` (nueva), `h2-insignias-editor.png`, `h2-editor-datos-personales-escritorio-claro.png`, `h2-editor-datos-personales-movil-oscuro.png`, `h2-editor-contacto-escritorio-claro.png`, `h2-alta-especialidades.png`, `h2-insignias-directorio-detalle-paciente.png`;
- H3: `h3-alta-titulo-institucion.png`, `h3-alta-titulo-tras-recargar.png`, `h3-historial-retirar-confirmacion.png`, `h3-trayectoria-movil-oscuro.png`.

**No reabiertas en esta ronda:** las demás recapturas de H2 y de H3. Ver «No cubierto, ronda 3».

### Capturas nuevas o cambiadas de contenido

| # | Pantalla | Viewport (px) | Tema | Estado | Archivo |
|---|---|---|---|---|---|
| 19 | Editor · Datos personales, recorte de «Tus especialidades cargadas» | 1440 | claro | con datos | `h2-insignias-editor.png` (ya no repite la 14) |
| 54 | Editor · Credenciales, sólo matrículas | 1440 | claro | con datos | `h2-editor-credenciales-escritorio-claro.png` |

### Estado de los hallazgos que se movieron

| ID | Ronda 2 | Estado en ronda 3 | Evidencia |
|---|---|---|---|
| N2-26 | MAYOR, del cambio | **CAMBIA → MENOR** | 14, 15, 19: la nota de la sección ahora dice que cada especialidad «se guarda al agregarla, sin pasar por «Guardar cambios»» (`practitioner-profile-edit.html:223-227`). Eso resuelve la ambigüedad que hacía MAYOR al hallazgo. Queda de forma: el pie sigue debajo de la tabla, y a 390 hay que pasarla para guardar el nombre |
| N2-15 | MENOR, sin captura | **CERRADO** | 54: las dos matrículas activas siguen la misma regla. MP-2400 lleva «Descargar» y la nota «Activo: ya no se corrige»; SEDES-MP-2400, sólo la nota. Ya no hay menú en una fila y botones sueltos en la otra |
| N2-31 | MENOR, evidencia | **CERRADO** | 19 es un recorte propio y 54 cubre Credenciales |
| N3-05, N3-07, N3-15, N3-16 | MAYOR, del cambio (preexistentes) | **Reasignados a su dueño; pasan a ajenos** | Decisión de Itzan del 24/09. Ya existían antes de la rama, este carril no toca `work-history` fuera de lo encargado y quedan registrados en «Riesgos residuales» con su ruta:línea. Se aplica lo previsto en la ronda 2. Las capturas 35–37 y 34 los siguen mostrando igual |

El resto de los hallazgos de la ronda 2 queda como estaba. En las capturas reabiertas no hubo cambios: N2-23 sigue visible en la 54 («Descargar» unos 10 px más abajo que el texto de su fila) y N2-14 sigue en la contacto de escritorio.

### Hallazgos nuevos

| ID | Severidad | Captura(s) | Qué y dónde | Atribución |
|---|---|---|---|---|
| N2-34 | MENOR | 54 frente a 27 y 36 | La misma regla se dibuja distinto en dos tablas del editor. En matrículas, «Descargar» y la nota van en un renglón («Descargar   Activo: ya no se corrige»). En títulos, «Descargar» va arriba y la nota abajo, en dos renglones, porque la columna es más angosta. Mirando las dos pestañas, la columna Acciones parece de dos diseños | del cambio |

### Nota por pantalla, ronda 3

| Pantalla | Hallazgos del cambio vigentes | Nota |
|---|---|---|
| P1 · Ficha · Datos personales | N2-02, N2-08 (MENOR) | ACEPTABLE CON RESERVAS |
| P2 · Ficha · Contacto | N2-06, N2-07 (MENOR) | ACEPTABLE CON RESERVAS |
| P3 · Editor · Datos personales | N2-09, N2-10, N2-11, N2-26, N2-27, N2-28 (MENOR) | RECHAZADA → **ACEPTABLE CON RESERVAS** |
| P4 · Editor · Contacto | N2-09, N2-10, N2-13, N2-28, N2-32, N2-33 (MENOR) | ACEPTABLE CON RESERVAS |
| P5 · Editor · Credenciales | N2-11, N2-34 (MENOR); N2-23 (ajeno) | SIN NOTA → **ACEPTABLE CON RESERVAS** |
| P6 · Perfil público | — (N2-03, N2-16, N2-17, N2-18, ajenos) | APROBADA (sólo hallazgos ajenos) |
| P7 · Guía · detalle del médico | N2-20, N2-21, N2-30 (MENOR) | ACEPTABLE CON RESERVAS |
| P8 · Guía · portada | — | APROBADA |
| P9 · Alta · especialidades | N2-24, N2-29 (MENOR) | ACEPTABLE CON RESERVAS |
| P10 · Trayectoria · alta de título | N3-02, N3-03, N3-13 (MENOR) | ACEPTABLE CON RESERVAS |
| P11 · Trayectoria · corregir título | N3-03, N3-12, N3-13 (MENOR) | ACEPTABLE CON RESERVAS |
| P12 · Trayectoria · títulos + historial | N3-04, N3-06, N3-11, N3-23, N2-34 (MENOR); N3-05 y N3-07 pasan a ajenos | RECHAZADA → **ACEPTABLE CON RESERVAS** |
| P13 · Trayectoria · búsqueda | N3-04, N3-09 (MENOR) | ACEPTABLE CON RESERVAS |
| P14 · Historial · corregir y retirar | — (N3-15, N3-16, ahora ajenos) | RECHAZADA → **APROBADA (sólo hallazgos ajenos)** |
| P15–P27 · Barra en sus consumidores | sin cambios | APROBADA (P15, P16, P17, P23, P26 y P27 con sólo hallazgos ajenos) |

**Resumen:**
- **RECHAZADA:** 0.
- **ACEPTABLE CON RESERVAS:** 11 (P1, P2, P3, P4, P5, P7, P9, P10, P11, P12, P13).
- **APROBADA:** 16 (P6, P8, P14 y P15–P27).

**MAYOR o BLOQUEANTE del cambio abiertos:** ninguno.

**Ajenos abiertos:**
- N2-14, BLOQUEANTE: el punto del mapa en claro.
- MAYOR: N2-04, N2-16, N2-17, N2-18 y N3-18.
- MAYOR, reasignados a Pablo: N3-05, N3-07, N3-15 y N3-16.

### No cubierto, ronda 3

- **Capturas no reabiertas.** Estas son del mismo recorrido, sobre el build nuevo; su juicio es el de la ronda 2 más la primera pasada rehecha, no una mirada nueva en esta ronda:
  - de H2: las 12 de la ficha, `h2-insignias-ficha.png`, `h2-insignias-perfil-publico.png`, `h2-insignias-directorio-lista-paciente.png`, `h2-patch-antes-de-guardar.png` y `h2-editor-contacto-movil-oscuro.png`;
  - de H3: `h3-alta-titulo-modal.png`, `-confirmacion`, `-descarte`, `-institucion-movil-oscuro`, `h3-busqueda-*`, `h3-corregir-titulo-*`, `h3-historial-corregir.png`, `h3-historial-tras-recargar-cargo.png` y `h3-trayectoria-escritorio-claro.png`.
- **Credenciales:** sólo hay 1440 en claro. No hay oscuro, móvil ni una matrícula pendiente, que es la que mostraría el menú de tres acciones.
- **Lo que ya faltaba:** siguen sin cubrir «Cancelar edición» en acción, «Dirección del trabajo» con su mapa y el tope de cuatro especialidades en el alta.

## Segunda pasada: H4

Revisión adversarial de las 34 capturas de `evidencia/h4/capturas/`, recapturadas el 24/09 sobre el árbol final de la rama. Se abrió cada una como imagen. Las pastillas «Datos de prueba» y «Ver componentes», y la ficha «Demo» del encabezado, son el aviso de la maqueta y no se cuentan como defecto. En los recortes de 375 px, la ficha «Demo» tapa el final de la nota de cada sección; en producción no existe.

Las distancias y los contrastes que se citan se midieron sobre la propia imagen. El contraste se tomó sobre el píxel más intenso del texto, así que es una cota aproximada y no un valor exacto de token.

Los dos defectos de la primera pasada se reevaluaron:

- «Descargar» sin ícono se parte en dos hallazgos: el defecto visual (N4-06, MAYOR, ajeno) y el CA de H4.S3.M7 marcado como HECHO pese a que su propia captura lo desmiente (N4-05, MAYOR, del cambio).
- Las dos acciones apiladas a 375 px quedan como N4-07 (MAYOR, ajeno). El ▼ no queda en el primer renglón, como decía la primera pasada: queda centrado a media altura de la fila, suelto a la derecha.

### Capturas

| Viewport (px) | Tema | Estado | Archivo |
|---|---|---|---|
| 1440 | claro | Alta de especialidades vacía; primario apagado | `h4-alta-especialidad-modal.png` |
| 1440 | claro | Alta con dos casillas («Medicina General», «Medicina Familiar») y respaldo elegido | `h4-alta-especialidad-casillas.png` |
| 1440 | claro | Alta de especialidades: confirmación superpuesta | `h4-alta-especialidad-confirmacion.png` |
| 375 | oscuro | Alta de especialidades con la segunda casilla vacía | `h4-alta-especialidad-movil-oscuro.png` |
| 1440 | claro | Corrección de «Medicina General», sin cambios | `h4-corregir-especialidad.png` |
| 1440 | claro | Alta de matrícula vacía | `h4-alta-matricula-modal.png` |
| 1440 | claro | Alta de matrícula con archivo: confirmación superpuesta | `h4-alta-matricula-confirmacion.png` |
| 375 | oscuro | Alta de matrícula vacía | `h4-alta-matricula-movil-oscuro.png` |
| 1440 | claro | Corrección de MP-B-35421 con respaldo nuevo elegido | `h4-corregir-matricula-con-archivo.png` |
| 1440 | claro | Credenciales: 2 especialidades y 2 matrículas (pestaña con el puntero encima) | `h4-credenciales-escritorio-claro.png` |
| 1440 | claro | Credenciales: búsqueda «MP-B-35421» en matrículas | `h4-busqueda-matriculas.png` |
| 1440 | claro | Credenciales tras recargar: 4 especialidades y 3 matrículas | `h4-matricula-tras-recargar.png` |
| 375 | oscuro | Credenciales, página completa | `h4-credenciales-movil-oscuro.png` |
| 1440 | claro | Tabla de especialidades, 3 filas | `h4s3-especialidades-1440-claro.png` |
| 1440 | oscuro | Tabla de especialidades, 3 filas | `h4s3-especialidades-1440-oscuro.png` |
| 768 | claro | Tabla de especialidades, 3 filas | `h4s3-especialidades-768-claro.png` |
| 768 | oscuro | Tabla de especialidades, 3 filas | `h4s3-especialidades-768-oscuro.png` |
| 375 | claro | Tabla de especialidades, 3 filas | `h4s3-especialidades-375-claro.png` |
| 375 | oscuro | Tabla de especialidades, 3 filas | `h4s3-especialidades-375-oscuro.png` |
| 1440 | claro | Tabla de matrículas, 3 filas | `h4s3-matriculas-1440-claro.png` |
| 1440 | oscuro | Tabla de matrículas, 3 filas | `h4s3-matriculas-1440-oscuro.png` |
| 768 | claro | Tabla de matrículas, 3 filas | `h4s3-matriculas-768-claro.png` |
| 768 | oscuro | Tabla de matrículas, 3 filas | `h4s3-matriculas-768-oscuro.png` |
| 375 | claro | Tabla de matrículas, 3 filas | `h4s3-matriculas-375-claro.png` |
| 375 | oscuro | Tabla de matrículas, 3 filas | `h4s3-matriculas-375-oscuro.png` |
| 1440 | claro | Tabla de matrículas con filtro «Estado: Pendiente» | `h4s3-matriculas-filtro-estado.png` |
| 1440 | claro | Tabla de títulos, página 1 de 2 | `h4s3-titulos-1440-claro.png` |
| 1440 | oscuro | Tabla de títulos, página 1 de 2 | `h4s3-titulos-1440-oscuro.png` |
| 1440 | claro | Tabla de títulos, página 2 | `h4s3-titulos-pagina-2.png` |
| 1440 | claro | Trayectoria completa: menú «Acciones» abierto en PAG-41090-01 | `h4s3-titulos-menu-acciones.png` |
| 768 | claro | Tabla de títulos, página 1 | `h4s3-titulos-768-claro.png` |
| 768 | oscuro | Tabla de títulos, página 1 | `h4s3-titulos-768-oscuro.png` |
| 375 | claro | Tabla de títulos, página 1 | `h4s3-titulos-375-claro.png` |
| 375 | oscuro | Tabla de títulos, página 1 | `h4s3-titulos-375-oscuro.png` |

### Resumen de notas

| Pantalla | Capturas | Nota | Qué la decide |
|---|---|---|---|
| P1 · Modal «Agregar especialidades» | 4 | ACEPTABLE CON RESERVAS | Sólo hallazgos MENOR: N4-12, N4-13, N4-14 |
| P2 · Modal «Editar especialidad» | 1 | ACEPTABLE CON RESERVAS | Sólo hallazgos MENOR: N4-15 |
| P3 · Modal «Agregar matrícula» | 3 | ACEPTABLE CON RESERVAS | Hallazgos MENOR del cambio (N4-13, N4-16, N4-17, N4-22) y MENOR ajeno (N4-31) |
| P4 · Modal «Editar matrícula» | 1 | ACEPTABLE CON RESERVAS | Sólo hallazgos MENOR: N4-16, N4-17, N4-18, N4-19 |
| P5 · Credenciales a 1440 (claro y oscuro, búsqueda, filtro, tras recargar) | 8 | RECHAZADA | N4-02 y N4-03, ambos MAYOR del cambio |
| P6 · Credenciales a 768 (claro y oscuro) | 4 | RECHAZADA | N4-01 y N4-03, ambos MAYOR del cambio |
| P7 · Credenciales a 375 (página completa y tablas, claro y oscuro) | 5 | RECHAZADA | N4-01 y N4-03, ambos MAYOR del cambio. Además, MAYOR ajenos: N4-07 y N4-08 |
| P8 · Títulos a 1440 (claro, oscuro, página 2) | 3 | RECHAZADA | N4-03, MAYOR del cambio. Además, MAYOR ajeno: N4-06 |
| P9 · Trayectoria a 1440 con el menú «Acciones» abierto | 1 | RECHAZADA | N4-04 y N4-05, ambos MAYOR del cambio. Además, MAYOR ajeno: N4-06 |
| P10 · Títulos a 768 (claro y oscuro) | 2 | RECHAZADA | N4-01 y N4-03, ambos MAYOR del cambio |
| P11 · Títulos a 375 (claro y oscuro) | 2 | RECHAZADA | N4-01 y N4-03, ambos MAYOR del cambio. Además, MAYOR ajeno: N4-07 |

### P1 · Modal «Agregar especialidades»

Agrupa las cuatro capturas del mismo modal. Tres son a 1440 en tema claro: vacío, con dos casillas y confirmación. La cuarta es a 375 en oscuro.

1. **Lo primero que se vería mal.** En la confirmación, el título «¿Confirmás estos datos?» no repite los datos, y el diálogo tapa justo los dos selectores: sólo asoma «Medicina…». La persona confirma sin ver qué confirma (N4-13). En el modal vacío, el título dice «Agregar especialidades», en plural, mientras el botón de la barra y el primario dicen «Agregar especialidad» (N4-12).
2. **Píxeles.**
   - A 1440 no hay texto cortado. «+ Agregar otra especialidad» empieza 13 px a la derecha del borde de los campos, por la sangría del botón fantasma; es leve.
   - A 375, el título se parte en dos renglones y queda bien. El pie, en cambio, deja «Cancelar» solo en un renglón, alineado a la izquierda, y el primario ocupa todo el ancho debajo (N4-14).
3. **¿Terminado?** Sí a 1440: cabecera con filete, descripción y pie con dos botones, con el primario apagado mientras falta la especialidad. A 375, el pie se ve a medio resolver (N4-14).
4. **Coherencia.** La estructura es la misma que en el modal de matrícula (cabecera, «× Cerrar» con texto, pie). Se aparta en tres cosas:
   - el título en plural fijo;
   - la numeración: «Especialidad» sin número y luego «Especialidad 2»;
   - el pie a 375, que en el modal de matrícula cabe en un renglón.
5. **Tema oscuro (375).** La superficie es petróleo, los textos claros contrastan bien y el filete aqua de la cabecera se ve. El primario apagado se lee como apagado. Nada desaparece.
6. **Estados.** El primario apagado y la pista del respaldo («Uno de tus títulos ya verificados…») orientan. No hay captura del aviso para quien no tiene títulos verificados, ni de un error del alta, ni de la carga (ver «No cubierto»).
7. **Jerarquía.** Guía bien: el primario en petróleo va a la derecha del pie y «Cancelar» va como texto. En la confirmación domina «Confirmar».
8. **Datos.** Son sintéticos. «ESP-1000 · Colegio Médico de Bolivia» combina una institución real del catálogo con un código inventado. No hay nada sensible.
9. **¿Muestra el requisito?** Sí para H4.S1.M1: las casillas sumables viven en el modal y «Quitar» lleva texto. También para H4.S1.M2: el respaldo es un título verificado. La confirmación se ve; que el alta ocurra después sólo consta en el registro.
10. **¿Por qué la rechazaría?** No la rechazaría por esta pantalla. Pediría que la confirmación nombre las especialidades (N4-13).

### P2 · Modal «Editar especialidad»

Una captura: 1440, tema claro, sin cambios.

1. **Lo primero que se vería mal.** El modal tiene un solo campo a media anchura, con medio modal vacío a la derecha. Tampoco dice si la especialidad está verificada ni qué pasa con la verificación al corregirla (N4-15).
2. **Píxeles.** No hay texto cortado. «× Cerrar» queda unos 7 px más abajo que el título, igual que en los demás modales.
3. **¿Terminado?** Está terminado, pero pobre: no tiene la línea de descripción que sí tienen las altas.
4. **Coherencia.** Cabecera y pie son iguales a los de los demás modales. Le falta la descripción.
5. **Tema oscuro.** No aplica: sólo hay captura en claro (ver «No cubierto»).
6. **Estados.** «Guardar cambios» apagado sin cambios orienta. No hay captura de error ni de carga.
7. **Jerarquía.** Es correcta: un control y el primario.
8. **Datos.** Son sintéticos.
9. **¿Muestra el requisito?** Sí para H4.S1.M3: el campo viene lleno y guardar está apagado sin cambios. El interruptor «Certificada por el colegio o consejo» no aparece, que es lo correcto. La confirmación de cambios y la de descarte no se ven en ninguna captura de H4.
10. **¿Por qué la rechazaría?** No la rechazaría por esta captura. La fila corregida es una especialidad pendiente; el problema de ofrecer «Editar» en las verificadas está en la tabla (N4-02, P5).

### P3 · Modal «Agregar matrícula»

Agrupa tres capturas: vacío y con confirmación a 1440 en claro, y vacío a 375 en oscuro.

1. **Lo primero que se vería mal.** «Autoridad que la emitió» no dice si es obligatoria: no lleva asterisco ni «(opcional)», y los otros dos campos opcionales sí lo dicen. En el código es opcional (N4-16).
2. **Píxeles.**
   - Los formatos admitidos se repiten dos veces y con nombres distintos: «PDF · JPEG · PNG · Máximo 5 MB» dentro de la zona de arrastre y «PDF, JPG o PNG. Hasta 5 MB.» debajo (N4-17).
   - En la confirmación, el modal ocupa de los 16 a los 983 px de los 1000 de la ventana. La zona de arrastre sigue a la vista con el archivo ya elegido, y la vista previa mide unos 280 px para un PDF de una línea (N4-31, ajeno).
   - A 375, «Adjuntar archivo» queda a medias bajo el pie fijo. Es el cuerpo que desplaza, pero nada lo anuncia.
3. **¿Terminado?** Sí en vacío. En la confirmación, la vista previa desproporcionada hace que el modal parezca una hoja entera.
4. **Coherencia.** Es coherente con el alta de especialidades. A 375, su pie cabe en un renglón y el de especialidades no (N4-14).
5. **Tema oscuro (375).** Es correcto: «Adjuntar archivo» pasa a aqua con tinta oscura, el ícono de subida se ve y el primario apagado se distingue.
6. **Estados.** En vacío, el primario apagado orienta. No hay captura de los errores del adjunto (tamaño o formato), del número vacío ni de la carga.
7. **Jerarquía.** Guía bien hacia «Agregar matrícula», y en la confirmación hacia «Confirmar».
8. **Datos.** Son sintéticos: «MP-B-35421», «carnet-35421.pdf» y la vista previa «CARNET-ORIGINAL-35421». En el selector se elige «Ministerio de Salud», pero la tabla muestra después «Ministerio de Salud y Deportes» (N4-22).
9. **¿Muestra el requisito?** Sí para H4.S2.M1 (alta en modal) y H4.S2.M3 (confirmación antes del alta).
10. **¿Por qué la rechazaría?** No la rechazaría. Pediría marcar los opcionales de forma pareja (N4-16).

### P4 · Modal «Editar matrícula»

Una captura: 1440, tema claro, con el respaldo nuevo elegido.

1. **Lo primero que se vería mal.** El modal dice «Ya hay uno cargado. Elegí otro sólo si querés reemplazarlo.», pero no dice cuál es el que hay ni deja verlo. Se reemplaza a ciegas (N4-18).
2. **Píxeles.** No hay texto cortado. «Fecha de inscripción» aparece acá sin «(opcional)» y en el alta con «(opcional)» (N4-16). Los formatos se repiten dos veces (N4-17).
3. **¿Terminado?** Sí.
4. **Coherencia.** Coincide con el alta, salvo lo anterior. La zona de arrastre compacta, sin ícono, es la variante del componente de archivos.
5. **Tema oscuro.** No aplica: sólo hay captura en claro (ver «No cubierto»).
6. **Estados.** La vista previa del archivo nuevo orienta. No hay captura de error ni de carga.
7. **Jerarquía.** Es correcta: «Guardar cambios» está activo y es el único botón lleno.
8. **Datos.** Son sintéticos («carnet-nuevo-35421.pdf», 592 bytes).
9. **¿Muestra el requisito?** Sólo la primera mitad de H4.S2.M2: el reemplazo elegido. La segunda mitad del CA («recargar → Descargar baja el nuevo») no la muestra ninguna captura, y el registro del recorrido dice lo contrario (N4-19).
10. **¿Por qué la rechazaría?** No por la pantalla. Por la evidencia de H4.S2.M2 (N4-19, MENOR).

### P5 · Credenciales a 1440

Agrupa ocho capturas del mismo contenido a 1440:

- página completa en claro: `h4-credenciales-escritorio-claro.png`, `h4-busqueda-matriculas.png` y `h4-matricula-tras-recargar.png`;
- recortes de las dos tablas en claro y oscuro;
- el filtro de matrículas.

1. **Lo primero que se vería mal.** Las especialidades «Verificada» ofrecen «Editar» y «Retirar» igual que las pendientes, y lo mismo pasa con las matrículas «Activo». En la pestaña vecina, un título verificado dice «Verificado: ya no se corrige» (N4-02).
2. **Píxeles.**
   - La nota de cada sección queda pegada a su buscador: las descendentes de «Lo que agregás queda pendiente…» quedan a 1 px del borde (N4-03).
   - En cada fila, el texto va arriba y «Editar», «Retirar» o «Acciones» van 9 o 10 px más abajo (N4-25).
   - Con sólo una búsqueda escrita, «Limpiar todo» queda solo en su propio renglón, a la izquierda y sin ficha al lado (N4-32).
3. **¿Terminado?** En general sí. La nota pegada y el desalineado vertical le quitan acabado.
4. **Coherencia.**
   - Las barras y los paginadores son iguales en las dos tablas y en Trayectoria.
   - La regla de qué se corrige no es coherente entre tablas (N4-02).
   - Los rótulos de estado tampoco: la tabla dice «Verificada» y «Pendiente», y su filtro, «Verificado» y «Pendiente de verificación» (N4-11).
   - «Activo» y «Pendiente» en matrículas están declarados como desvío.
   - En `h4-credenciales-escritorio-claro.png` la pestaña «Credenciales» lleva fondo porque el puntero quedó encima; en `h4-matricula-tras-recargar.png` no lo lleva. Es un artefacto de la captura, no del producto.
5. **Tema oscuro.** Los recortes a 1440 contrastan bien. «Anterior» y «Siguiente» apagados quedan en unos 2,7:1, lo que se admite por estar deshabilitados. Nada desaparece.
6. **Estados.** Con el filtro activo, la ficha «Estado: Pendiente ×» y «Limpiar todo» orientan. No hay captura del vacío («Todavía no cargaste…»), de «sin coincidencias», de la carga ni del error (ver «No cubierto»).
7. **Jerarquía.** Guía bien: «Agregar especialidad» y «Agregar matrícula» son los únicos botones llenos y van a la derecha de su barra.
8. **Datos.** Son sintéticos, con dos rarezas:
   - «Desde 23/09/2026» en las especialidades recién cargadas es la fecha de carga que pone el simulador, no desde cuándo se ejerce (N4-28);
   - la autoridad aparece con dos nombres (N4-22).
9. **¿Muestra el requisito?** Sí para H4.S3.M1 (búsqueda, y filtro con su ficha), H4.S3.M2 (botón a la derecha) y H4.S3.M3 (paginador abajo a la derecha). La captura «tras recargar» muestra la fila, no la descarga que pide H4.S2.M2 (N4-19).
10. **¿Por qué la rechazaría?** Por N4-02 (se ofrece corregir y retirar lo ya verificado, sin decisión escrita) y por N4-03 (la nota pegada al buscador).

### P6 · Credenciales a 768

Agrupa cuatro capturas: especialidades y matrículas, en claro y oscuro.

1. **Lo primero que se vería mal.** Cada fila muestra sólo el nombre o el número y dos acciones idénticas para las verificadas y para las pendientes. No se sabe cuál falta verificar sin abrir ▼ fila por fila, y en el medio quedan más de 350 px en blanco (N4-01).
2. **Píxeles.** La nota está pegada al buscador (N4-03). «1–3 de 3» termina en el borde derecho de la sección, que es lo buscado.
3. **¿Terminado?** Parece una lista de nombres sin información, con el paginador partido en dos renglones (N4-10).
4. **Coherencia.** No es coherente con la misma pantalla a 1440, que sí muestra el estado. Sí lo es con el historial laboral, que aplica el mismo criterio.
5. **Tema oscuro.** Es correcto; el ▼ blanco se ve.
6. **Estados.** No hay capturas del vacío, de la carga, del error ni del detalle abierto.
7. **Jerarquía.** «Agregar…» baja a la izquierda, debajo del filtro, porque la barra apila a este ancho; sigue siendo el único botón lleno.
8. **Datos.** Son sintéticos.
9. **¿Muestra el requisito?** Cumple la medición de H4.S3.M4: 678/678, sin desplazamiento lateral. Lo que no muestra es el estado, que es el dato por el que se entra a esta pestaña.
10. **¿Por qué la rechazaría?** Por N4-01 y N4-03.

### P7 · Credenciales a 375

Agrupa `h4-credenciales-movil-oscuro.png` (página completa) y los recortes de especialidades y matrículas en claro y oscuro.

1. **Lo primero que se vería mal.** En las filas con dos acciones, «Editar» va arriba y «Retirar» abajo, los dos pegados a la izquierda de la celda, y el ▼ queda suelto a la derecha, a media altura. Cada fila mide unos 105 px, contra 65 a 1440 (N4-07). Además, la fila no muestra el estado (N4-01).
2. **Píxeles.**
   - «SEDES-MP-2400» se parte en el guion y queda como «SEDES-MP-» / «2400» (N4-09).
   - Las pestañas «ectoria» y «Activid» salen cortadas (N4-29).
   - «Panel», en las migas, casi no se ve (N4-08).
   - El rótulo «ACCIONES» no coincide con el borde de sus botones.
   - La nota sigue pegada al buscador (N4-03).
3. **¿Terminado?** Se ve como un prototipo: paginador en escalera de tres renglones (N4-10) y acciones desordenadas.
4. **Coherencia.** No es coherente con 1440 y 768: allá la columna de acciones se alinea a la derecha y acá a la izquierda. Tampoco dentro de la misma columna: «Acciones» va a la derecha y «Editar» / «Retirar», a la izquierda.
5. **Tema oscuro.**
   - «Panel» queda en unos 2,4:1 (N4-08).
   - «Volver a tu perfil» sale en el lila del navegador (N4-24).
   - El resto contrasta bien, y los botones «Agregar…» son aqua con tinta oscura.
6. **Estados.** No hay capturas del vacío, de la carga ni del error.
7. **Jerarquía.** «Agregar…» se ve bien debajo del buscador y del filtro. El paginador, con tres renglones, pesa tanto como una tabla de dos filas.
8. **Datos.** Son sintéticos.
9. **¿Muestra el requisito?** Se ven H4.S3.M2 (botón debajo) y H4.S3.M4 (301/301). El PLAN dice que la página queda en 380/375, y la medición entregada, en 375/375 (N4-20).
10. **¿Por qué la rechazaría?** Por N4-01 y N4-03. N4-07 es el defecto más visible, pero es ajeno.

### P8 · Títulos a 1440

Agrupa tres capturas: página 1 en claro y en oscuro, y la página 2 en claro.

1. **Lo primero que se vería mal.** La nota está pegada al buscador (N4-03). En la columna de acciones, «Descargar» va sin ícono al lado de «Editar» y «Retirar», que sí lo llevan (N4-06).
2. **Píxeles.**
   - La última fila visible (PAG-41090-08) queda cortada a media altura justo encima del paginador, sin sombra ni barra que anuncie que la tabla desplaza (N4-21).
   - En las filas, el texto va arriba y los botones 10 px más abajo. La nota «Verificado: ya no se corrige», en cambio, va arriba, así que la columna de acciones tiene dos alineaciones (N4-25).
3. **¿Terminado?** Sí, salvo lo anterior.
4. **Coherencia.** Es coherente con las tablas de Credenciales. Al pasar a la página 2, las columnas se corren: «Número / título» pasa de x=180 a x=172 e «Institución», de 319 a 324 (N4-27).
5. **Tema oscuro.** La nota «Verificado…» sube a unos 6,4:1; en claro queda en unos 4,1:1 con letra chica (N4-23). Nada desaparece.
6. **Estados.** No hay capturas del vacío, de la carga ni del error.
7. **Jerarquía.** Guía bien hacia «Agregar título».
8. **Datos.** UMSS y UMSA son instituciones reales del catálogo; los códigos PAG-… son sintéticos. No hay nada sensible.
9. **¿Muestra el requisito?** Sí para H4.S3.M3: «1–10 de 12», y en la página 2 «11–12 de 12», con «Anterior» activo y «Siguiente» apagado. También para H4.S3.M4 (desplaza a lo alto) y para la institución con sigla (D-09).
10. **¿Por qué la rechazaría?** Por N4-03.

### P9 · Trayectoria a 1440 con el menú «Acciones» abierto

Una captura: 1440, tema claro, página completa.

1. **Lo primero que se vería mal.** En el menú, «Descargar» no tiene ícono y su texto empieza donde las otras dos opciones tienen el ícono: queda corrido unos 29 px a la izquierda de «Editar» y «Retirar» (N4-06). Justo debajo, los dos selects del paginador de títulos se apoyan sobre el borde superior de la tarjeta «Historial laboral», sin aire entre ellos (N4-04).
2. **Píxeles.**
   - Hay 0 px entre el paginador y la tarjeta siguiente (N4-04).
   - El menú sale de la tarjeta de la pestaña y termina a unos 2 px del borde de la ventana (N4-26).
   - El menú tapa la nota «Verifi…» de la fila de abajo, lo que es normal en un desplegable.
3. **¿Terminado?** El menú sí, salvo «Descargar». El remate de la sección, apoyado sobre la tarjeta siguiente, se ve sin terminar.
4. **Coherencia.** «Retirar» va en tinta de error dentro del menú y en reposo en la fila; es la decisión documentada del componente.
5. **Tema oscuro.** No aplica: sólo hay captura en claro (ver «No cubierto»).
6. **Estados.** No aplica: es el estado abierto de un menú.
7. **Jerarquía.** Es clara: disparador único y tres opciones, con la destructiva al final.
8. **Datos.** Son sintéticos.
9. **¿Muestra el requisito?** Muestra el disparador único con tres opciones de H4.S3.M7, pero no «cada opción con ícono y texto», que es lo que afirma el CA marcado como HECHO (N4-05).
10. **¿Por qué la rechazaría?** Por N4-04 y N4-05.

### P10 · Títulos a 768

Agrupa dos capturas: claro y oscuro.

1. **Lo primero que se vería mal.** Las filas son sólo códigos («ESP-1000», «PAG-41090-01»…), sin tipo, institución, emisión ni estado, con unos 390 px vacíos entre el código y las acciones (N4-01).
2. **Píxeles.**
   - La nota está pegada al buscador (N4-03).
   - En «TIT-1000», «Descargar» va sin ícono, en línea con la nota (N4-06).
   - La última fila, PAG-41090-07, queda cortada (N4-21).
3. **¿Terminado?** Parece un listado técnico, no el resumen de una trayectoria.
4. **Coherencia.** No es coherente con 1440: D-09 y Q-8 quieren la institución y la emisión a la vista.
5. **Tema oscuro.** Es correcto.
6. **Estados.** No hay capturas del vacío, de la carga ni del error.
7. **Jerarquía.** Guía hacia «Agregar título».
8. **Datos.** Son sintéticos.
9. **¿Muestra el requisito?** La medición sin desplazamiento lateral se cumple (678/678). Lo que D-09 y Q-8 pedían en la fila no está a este ancho.
10. **¿Por qué la rechazaría?** Por N4-01 y N4-03.

### P11 · Títulos a 375

Agrupa dos capturas: claro y oscuro.

1. **Lo primero que se vería mal.** Tres cosas: los códigos se parten en el guion («PAG-» / «41090-01», N4-09), las acciones van en dos renglones pegadas a la izquierda y el ▼ queda suelto (N4-07).
2. **Píxeles.** La nota está pegada al buscador (N4-03). La fila PAG-41090-09 queda cortada en sus dos renglones. La ficha «Demo» de la maqueta tapa «queda» en la nota; no se cuenta.
3. **¿Terminado?** Se ve como un prototipo.
4. **Coherencia.** No es coherente con 1440 (ver N4-07).
5. **Tema oscuro.** Es correcto.
6. **Estados.** No hay capturas del vacío, de la carga ni del error.
7. **Jerarquía.** «Agregar título» se ve. El paginador ocupa tres renglones.
8. **Datos.** Son sintéticos.
9. **¿Muestra el requisito?** Cumple 301/301 y desplaza a lo alto. Pero de las 10 filas por página se ven unas 4 dentro de los 420 px, así que en el teléfono hay que desplazar dentro de la tabla y además paginar (N4-21).
10. **¿Por qué la rechazaría?** Por N4-01 y N4-03.

### Hallazgos

| ID | Severidad | Origen | Captura(s) | Qué y dónde |
|---|---|---|---|---|
| N4-01 | MAYOR | del cambio | `h4s3-especialidades-768-*`, `-375-*`, `h4s3-matriculas-768-*`, `-375-*`, `h4-credenciales-movil-oscuro.png`, `h4s3-titulos-768-*`, `-375-*` | A 768 y 375, la fila sólo muestra el identificador y las acciones: el estado, el tipo, la autoridad, la institución y las fechas pasan al detalle. En especialidades y matrículas, las verificadas y las pendientes muestran las mismas acciones, así que el estado no se puede deducir sin abrir ▼ en cada fila. A 768 quedan más de 350 px en blanco. Está declarado en el REPORTE («Desvíos», «el costo está a 768») pero no corregido. La restricción de fondo es ajena (`data-table` tiene un solo corte, en 780 px), pero qué columna es prioridad 1 y qué dibuja la celda del identificador lo decide el editor (`practitioner-profile-edit.ts`, `columnas…`). Por ejemplo, podría mostrar el estado como ficha dentro de la celda del nombre o del número |
| N4-02 | MAYOR | del cambio (la lista de acciones por fila la escribe este cambio; el comportamiento viene del corte) | `h4s3-especialidades-1440-*`, `h4-credenciales-escritorio-claro.png`, `h4-matricula-tras-recargar.png`, `h4s3-matriculas-1440-*` | Las especialidades «Verificada» y las matrículas «Activo» ofrecen «Editar» y «Retirar». Los títulos verificados, en cambio, dicen «Verificado: ya no se corrige», con el motivo escrito en `practitioner-profile-edit.html:682-687`. `accionesDeEspecialidad` y `accionesDeMatricula` (`practitioner-profile-edit.ts:1903-1914`) no miran el estado. La corrección del simulador tampoco toca la verificación (`profiles.handlers.ts:1045-1052`, `:1069-1076`); esto se leyó en el código, no se observó. Ni el PLAN ni el REPORTE lo registran como decisión |
| N4-03 | MAYOR | del cambio | Todas las de tablas (P5 a P11) | La nota de cada sección queda a 1-3 px del borde del buscador en las tres tablas, en todos los anchos y los dos temas: las descendentes tocan la caja. `app-filter-bar` va justo después de `.edicion__nota` (`practitioner-profile-edit.html:404`, `:484` y la de matrículas) sin separación; `.edicion__nota` sólo tiene margen arriba (`practitioner-profile-edit.css:50-55`) |
| N4-04 | MAYOR | del cambio | `h4s3-titulos-menu-acciones.png` | En Trayectoria a 1440, los selects del paginador de títulos se apoyan sobre el borde superior de la tarjeta «Historial laboral»: 0 px medidos entre las dos líneas. El paginador cierra la sección (`practitioner-profile-edit.html:451-457`) y `app-work-history` se monta justo después (`:466-468`) sin separación |
| N4-05 | MAYOR | del cambio | `h4s3-titulos-menu-acciones.png` | H4.S3.M7 está en HECHO con el CA «cada opción con ícono y texto», que es también la regla del ADR-0012 (título y §2), y cita como evidencia esta captura, donde «Descargar» no tiene ícono. El REPORTE no lo declara en «Riesgos» ni en «Desvíos». Hay que declarar la excepción (el set cerrado no tiene un ícono de descarga) o reescribir el CA |
| N4-06 | MAYOR | ajeno | `h4s3-titulos-menu-acciones.png`, `h4s3-titulos-1440-*`, `-768-*`, `-375-*` | «Descargar» sin ícono. En el menú, su texto empieza en la columna de los íconos, unos 29 px a la izquierda de «Editar» y «Retirar». En la fila, va sin ícono al lado de acciones que lo llevan. El set cerrado no tiene un ícono de descarga (`atoms/nav-icon/nav-icon.types.ts`; la falta está documentada en `molecules/row-actions/row-actions.types.ts:18-22`), y el ítem del menú no reserva el lugar del ícono cuando falta (`molecules/row-actions/row-actions.html:28-31`, `molecules/menu/menu-item/menu-item.css:9`) |
| N4-07 | MAYOR | ajeno | `h4-credenciales-movil-oscuro.png`, `h4s3-especialidades-375-*`, `h4s3-matriculas-375-*`, `h4s3-titulos-375-*` | A 375, las filas con dos acciones las apilan en dos renglones, alineadas a la izquierda de la celda, mientras el disparador único y las notas van a la derecha. El ▼ del detalle queda suelto a media altura y la fila pasa de 65 a unos 105 px, contra la verificación 4 del ADR-0012 («la fila no creció»). El salto es del componente: `molecules/row-actions/row-actions.css:8-24` usa `flex-wrap` sin alinear al final, y el ▼ es la columna de detalle de `organisms/data-table`. No baja la nota: el editor usa el componente como está previsto |
| N4-08 | MAYOR | ajeno | `h4-credenciales-movil-oscuro.png` | En tema oscuro, el enlace «Panel» de las migas queda en unos 2,4:1 (azul petróleo sobre fondo petróleo). Está en `molecules/breadcrumb/breadcrumb.html:6` (`a app-link variant="subtle"`) y en los colores de `atoms/link/link.css:11-35`. Afecta a toda página con migas en oscuro |
| N4-09 | MENOR | del cambio | `h4s3-titulos-375-*`, `h4s3-matriculas-375-*`, `h4-credenciales-movil-oscuro.png` | A 375 los identificadores se parten en el guion: «PAG-» / «41090-01» y «SEDES-MP-» / «2400». El primer renglón se lee como un valor completo |
| N4-10 | MENOR | del cambio (el empuje de fondo es ajeno) | P6, P7, P10, P11 | A 768 y 375 el paginador no queda «abajo a la derecha». A 768, los botones «Anterior / Siguiente» quedan en el borde izquierdo y el tamaño de página baja solo a otro renglón. A 375 queda en escalera de tres renglones, más alto que una tabla de dos filas, con un select de página de una sola opción. El comentario de `.edicion__paginacion` (`practitioner-profile-edit.css:178-190`) dice que lo que baja de renglón va a la derecha; lo impide `margin-left: auto` de `molecules/pagination/pagination.css:47-52`. La medición entregada sólo mira el borde derecho |
| N4-11 | MENOR | del cambio | `h4-credenciales-escritorio-claro.png` + `comportamiento-h4s3.txt` | El filtro «Estado» de especialidades ofrece «Pendiente de verificación» y «Verificado» (`practitioner-profile-edit.logic.ts:39-40`), mientras la tabla dice «Pendiente» y «Verificada» (`practitioner-profile-edit.ts:967`) |
| N4-12 | MENOR | del cambio | `h4-alta-especialidad-modal.png`, `-casillas.png` | El título fijo «Agregar especialidades» convive con «Agregar especialidad» en la barra y en el primario. La primera casilla se llama «Especialidad» y la segunda «Especialidad 2» |
| N4-13 | MENOR | del cambio | `h4-alta-especialidad-confirmacion.png`, `h4-alta-matricula-confirmacion.png` | «¿Confirmás estos datos?» no repite los datos. En especialidades, el propio diálogo tapa los dos selectores, así que se confirma sin ver qué. El texto lo pasa el editor al abrir la confirmación |
| N4-14 | MENOR | del cambio | `h4-alta-especialidad-movil-oscuro.png` frente a `h4-alta-matricula-movil-oscuro.png` | A 375 el pie del alta de especialidades deja «Cancelar» solo en un renglón, a la izquierda, con el primario a todo el ancho debajo; el de matrícula cabe en uno. Lo provoca `flex-wrap` en `.edicion__acciones-modal` (`practitioner-profile-edit.css:103-110`) |
| N4-15 | MENOR | del cambio | `h4-corregir-especialidad.png` | La corrección de especialidad tiene un solo campo a media anchura y no lleva descripción. No dice el estado ni si corregir vuelve la especialidad a verificación |
| N4-16 | MENOR | del cambio (rótulos movidos tal cual del formulario en línea) | `h4-alta-matricula-modal.png`, `-movil-oscuro.png`, `h4-corregir-matricula-con-archivo.png` | «Autoridad que la emitió» es opcional y no lo dice, mientras los otros opcionales sí (`practitioner-profile-edit.html:833`, `:1033`). «Fecha de inscripción» lleva «(opcional)» en el alta (`:1046`) y no en la corrección (`:843`) |
| N4-17 | MENOR | del cambio | P3, P4 | Los formatos se repiten con nombres distintos: «PDF · JPEG · PNG · Máximo 5 MB» en la zona de arrastre y «PDF, JPG o PNG. Hasta 5 MB.» en la pista (`practitioner-profile-edit.html:856`, `:1059`) |
| N4-18 | MENOR | del cambio | `h4-corregir-matricula-con-archivo.png` | «Ya hay uno cargado» no identifica el archivo actual: no muestra su nombre ni ofrece verlo, así que se reemplaza a ciegas |
| N4-19 | MENOR | del cambio (evidencia; la causa es ajena y está declarada en «Riesgos») | `h4-matricula-tras-recargar.png` | El CA de H4.S2.M2 es «Corregir → recargar → Descargar baja el nuevo». `comportamiento-h3h4.txt`, línea 50, registra que tras recargar la descarga trae `{}`, de 2 bytes, que no es ni el nuevo ni el original. La captura citada muestra la tabla, no la descarga, y la fila del PLAN no remite al riesgo, como sí lo hace H3.S1.M2 |
| N4-20 | MENOR | del cambio (documentación) | `h4-credenciales-movil-oscuro.png` | El PLAN (H4.S3.M4) dice «la página a 375 sigue en 380/375» y el REPORTE, que «se pasa 5 px». `desborde-375.txt` y `comportamiento-h3h4.txt`, línea 53, miden 375/375 |
| N4-21 | MENOR | del cambio (la falta de señal de desplazamiento es de `data-table`) | P8, P10, P11 | 10 filas por página dentro de 420 px de alto. A 375 se ven unas 4, así que hay que desplazar dentro de la tabla y además paginar. La última fila queda cortada a ras del paginador, sin sombra ni barra visible |
| N4-22 | MENOR | del cambio (heredado del corte) | `h4-alta-matricula-confirmacion.png`, `h4-busqueda-matriculas.png` | Se elige «Ministerio de Salud» y la tabla muestra «Ministerio de Salud y Deportes»: la tabla pinta el valor guardado (`practitioner-profile-edit.ts:979`) y no la etiqueta del catálogo (`core/profesion/autoridades-reguladoras.ts:34`, `:86`) |
| N4-23 | MENOR | del cambio (heredado del corte) | `h4s3-titulos-1440-claro.png`, `-768-claro.png`, `-375-claro.png` | «Verificado: ya no se corrige» usa `--text-muted` (`practitioner-profile-edit.css:212-216`), cuyo tono claro es la excepción E1 «sólo terciario» (`src/styles.css:204`). Queda en unos 4,1:1 con letra chica, y es texto que explica por qué falta una acción |
| N4-24 | MENOR | del cambio (heredado del corte) | `h4-credenciales-escritorio-claro.png`, `h4-credenciales-movil-oscuro.png` | «Volver a tu perfil» es un enlace sin el estilo del sistema: azul del navegador en claro y lila en oscuro (`practitioner-profile-edit.html:661-662`) |
| N4-25 | MENOR | ajeno | P5, P8 | El texto de la fila va arriba y las acciones 9-10 px más abajo; la nota de lo verificado, en cambio, va arriba. Es la celda de `organisms/data-table` combinada con la altura de los botones de `molecules/row-actions` |
| N4-26 | MENOR | ajeno | `h4s3-titulos-menu-acciones.png` | El panel del menú desborda la tarjeta y termina a unos 2 px del borde derecho de la ventana (`molecules/menu`) |
| N4-27 | MENOR | ajeno | `h4s3-titulos-1440-claro.png` frente a `h4s3-titulos-pagina-2.png`; `h4s3-matriculas-1440-claro.png` frente a `-filtro-estado.png` | Las columnas se corren al paginar o filtrar, porque el ancho sale del contenido (`organisms/data-table`) |
| N4-28 | MENOR | ajeno | `h4-credenciales-escritorio-claro.png`, `h4-matricula-tras-recargar.png` | «Desde 23/09/2026» en las especialidades recién cargadas es la fecha de carga que pone el simulador (`core/mock/handlers/profiles.handlers.ts:1123`), no desde cuándo se ejerce |
| N4-29 | MENOR | ajeno | `h4-credenciales-movil-oscuro.png` | A 375 la tira de pestañas muestra «ectoria» y «Activid» cortadas contra las flechas (`molecules/tabs`) |
| N4-30 | MENOR | ajeno | P6, P7, P10, P11 | El disparador del detalle es un triángulo macizo sin rótulo visible, más pesado que los íconos de trazo del resto de la fila (`organisms/data-table`) |
| N4-31 | MENOR | ajeno | `h4-alta-matricula-confirmacion.png` | Con un archivo elegido, la zona de arrastre sigue a la vista y la vista previa ocupa unos 280 px, así que el modal llena la ventana a 1440 (`molecules/file-input`) |
| N4-32 | MENOR | ajeno | `h4-busqueda-matriculas.png` | Con sólo una búsqueda escrita, «Limpiar todo» queda solo en un renglón, a la izquierda y sin ficha que diga qué limpia (`organisms/filter-bar`) |

### No cubierto

- **Estados de las tres tablas sin captura:** el vacío («Todavía no cargaste…»), «sin coincidencias» (el registro de la búsqueda «zzz» lleva especialidades de 4 a 0, pero no hay imagen), la carga y el error.
- **El detalle de la fila (▼) abierto** en especialidades y matrículas, a 768 o 375: ninguna captura muestra dónde aparece el estado, que es justamente lo que N4-01 dice que falta en la fila.
- **Del alta de especialidades:**
  - el aviso para quien no tiene títulos verificados;
  - los errores de los modales (número de matrícula vacío, archivo de más de 5 MB o de formato no admitido);
  - la respuesta de error del servidor al agregar.
- **Confirmaciones sin captura en H4:** la de corrección (`confirmarCambios` al editar), la de descarte (`confirmarDescarte`) y la de retiro. Sólo constan en el registro.
- **Viewports y temas que faltan:**
  - los modales de corrección, a 375 y en oscuro;
  - los modales de alta, a 1440 en oscuro y a 768;
  - el menú «Acciones», en oscuro, a 375 y en la fila de una matrícula con carnet.
- **Estados de las acciones:** las acciones apagadas mientras hay una descarga o un retiro en curso («Descargando…», «Retirando…»).
- **Filtros:** el filtro «Estado» de especialidades abierto, con sus opciones, y el de matrículas a 768 y 375.
- **Paginador:** «20 por página» (consta en el registro, no hay captura).
- **Teclado y lector de pantalla:** el recorrido del menú sólo con teclado y la vuelta del foco (ADR-0012, verificación 3), y si la cabecera de la tabla queda fija al desplazar dentro del alto máximo. No se probó con lector de pantalla.

## Ronda 2

Se volvieron a abrir las 34 capturas, regeneradas el 24/09 sobre el build con las correcciones. Los datos de prueba cambiaron de código: PAG-02192-…, MAT-02192, MP-B-01969.

Además de las capturas se leyeron cuatro fuentes:

- las filas H4 del PLAN y las secciones «A medias» y «Riesgos residuales» del REPORTE;
- `comportamiento-h4s3.txt`: «estado en la fila» en 0 de N filas a 1440 y en N de N a 768 y 375;
- `desborde-375.txt`: 375/375 en las tres pestañas;
- el diff sin confirmar del editor (plantilla, estilos y lógica).

Las distancias y los contrastes se midieron sobre la imagen, con el mismo criterio que en la ronda 1.

Medidas nuevas:

- **Nota → buscador:** 13 px a 1440 y 15 px a 768 entre las descendentes y el borde de la caja. Eran 1-3 px.
- **Paginador de títulos → tarjeta «Historial laboral»:** 20 px. Eran 0 px.
- **Estado debajo del identificador:** unos 7,3:1 en claro y unos 12:1 en oscuro.

### Estado de los hallazgos de la ronda 1

| ID | Ronda 1 | Ronda 2 | Motivo |
|---|---|---|---|
| N4-01 | MAYOR · del cambio | **CAMBIA → MENOR · del cambio** | Por debajo de 780 px el estado va debajo del identificador en las tres tablas. Se ve en las 12 capturas de 768 y 375, en los dos temas: «Verificada», «Pendiente», «Activo», «Verificado». Lo pendiente ya se distingue de lo verificado sin abrir ▼. Queda un residuo menor: a 768, con más de 350 px en blanco en la fila, los títulos siguen sin tipo, institución ni emisión, y las matrículas sin autoridad ni inscripción. El corte único en 780 px es de `data-table` |
| N4-02 | MAYOR · del cambio | **SIGUE** | Las especialidades «Verificada» y las matrículas «Activo» siguen ofreciendo «Editar» y «Retirar» (`h4-credenciales-escritorio-claro.png`, `h4s3-especialidades-1440-*`, `h4s3-matriculas-1440-*`). Ahora se ve también a 768 y 375, porque el estado quedó al lado de las acciones: «Cardiología · Verificada · Editar · Retirar» (`h4s3-especialidades-768-*`, `-375-*`, `h4-credenciales-movil-oscuro.png`). Que el comportamiento venga del corte no cambia la clase: qué acciones ofrece cada fila lo decide este cambio, y esas listas son código nuevo de la rama (`accionesDeEspecialidad`, `accionesDeMatricula`), no plantilla heredada. Además, el REPORTE no lo registra en ninguna sección como decisión pendiente; sólo lo dice la observación 3 de la primera pasada |
| N4-03 | MAYOR · del cambio | **CERRADO** | Hay aire entre la nota y la barra en las tres tablas, en los tres anchos y los dos temas: 13-15 px medidos |
| N4-04 | MAYOR · del cambio | **CERRADO** | 20 px entre el paginador de títulos y la tarjeta «Historial laboral» (`h4s3-titulos-menu-acciones.png`) |
| N4-05 | MAYOR · del cambio | **CERRADO** | H4.S3.M7 está en `A MEDIAS` en el PLAN. En el REPORTE, «A medias» dice qué anda, qué no («Descargar» sólo con texto) y que la decisión es de Itzan. La cita a la segunda pasada apunta a un archivo que no está en la carpeta (N4-35) |
| N4-06 | MAYOR · ajeno | **SIGUE** | En el menú, «Descargar» sigue sin ícono y con el texto corrido a la columna de los íconos. En la fila (TIT-1000) va sin ícono en los tres anchos |
| N4-07 | MAYOR · ajeno | **SIGUE** | Se volvió a mirar: la primera pasada ahora describe lo mismo que la ronda 1 (el ▼ ya estaba centrado en su columna). A 375, «Editar» va sobre «Retirar», los dos pegados a la izquierda de la celda y por debajo del rótulo «ACCIONES», que está alineado a la derecha, mientras «Acciones» y las notas van a la derecha. Con el estado en la fila, las filas crecen un poco más: «Medicina» / «General» / «Pendiente» ocupa tres renglones y la fila sigue en unos 105 px. Sigue siendo ajeno (`row-actions.css:8-24`) y no baja la nota |
| N4-08 | MAYOR · ajeno | **SIGUE** | «Panel» en las migas, en oscuro, sin cambios (`h4-credenciales-movil-oscuro.png`) |
| N4-09 | MENOR · del cambio | **SIGUE** | «PAG-» / «02192-01» y «SEDES-MP-» / «2400» a 375 |
| N4-10 | MENOR · del cambio | **SIGUE** | El paginador sigue en dos renglones a 768 y en escalera de tres a 375 |
| N4-11 | MENOR · del cambio | **SIGUE (a medias)** | El filtro dice ahora «Verificada», como la tabla (`practitioner-profile-edit.logic.ts:44-47`). Pero la opción pendiente sigue siendo «Pendiente de verificación» y la tabla dice «Pendiente»; en títulos pasa lo mismo. Ninguna captura muestra el filtro abierto |
| N4-12 | MENOR · del cambio | **SIGUE** | Sin cambios en `h4-alta-especialidad-modal.png` / `-casillas.png` |
| N4-13 | MENOR · del cambio | **SIGUE** | La confirmación sigue sin nombrar los datos y tapa los selectores |
| N4-14 | MENOR · del cambio | **SIGUE** | A 375, en el pie del modal de especialidades, «Cancelar» sigue solo en su renglón |
| N4-15 | MENOR · del cambio | **SIGUE** | Sin cambios en `h4-corregir-especialidad.png` |
| N4-16 | MENOR · del cambio | **SIGUE** | «Autoridad que la emitió» sigue sin marca; «Fecha de inscripción» sigue sin «(opcional)» en la corrección. La primera pasada lo registra como observación 9 |
| N4-17 | MENOR · del cambio | **SIGUE** | Los formatos siguen repetidos (JPEG / JPG) |
| N4-18 | MENOR · del cambio | **SIGUE** | «Ya hay uno cargado» sigue sin identificar el archivo |
| N4-19 | MENOR · del cambio | **CERRADO** | La fila H4.S2.M2 del PLAN ya separa lo visto antes de recargar (baja el nuevo) de lo que pasa después (el simulador devuelve `{}`) y remite a «Riesgos residuales» |
| N4-20 | MENOR · del cambio | **SIGUE (a medias)** | El REPORTE ya lo da por resuelto y `desborde-375.txt` mide 375/375. Pero la fila H4.S3.M4 del PLAN, en estado HECHO, todavía dice «La página a 375 sigue en 380/375 por el encabezado de la app (heredado)» |
| N4-21 | MENOR · del cambio | **SIGUE** | Un poco peor a 375: con el estado en la fila, dentro de los 420 px de alto de títulos se ven unas 3,5 filas de las 10 de la página (`h4s3-titulos-375-*`) |
| N4-22 | MENOR · del cambio (heredado) | **SIGUE** | Se elige «Ministerio de Salud» y la tabla dice «Ministerio de Salud y Deportes» (`h4-alta-matricula-confirmacion.png` frente a `h4-busqueda-matriculas.png`) |
| N4-23 | MENOR · del cambio (heredado) | **SIGUE** | «Verificado: ya no se corrige» sin cambios |
| N4-24 | MENOR · del cambio (heredado) | **SIGUE** | «Volver a tu perfil» sigue con el color del navegador en los dos temas |
| N4-25 | MENOR · ajeno | **SIGUE** | Texto de la fila arriba y botones unos 9 px más abajo. La primera pasada lo atribuye a la alineación superior de la celda de `data-table` |
| N4-26 | MENOR · ajeno | **SIGUE** | El panel del menú llega al borde derecho de la ventana |
| N4-27 | MENOR · ajeno | **SIGUE** | Al pasar a la página 2, «Número / título» sigue corriéndose de x=180 a x=172 |
| N4-28 | MENOR · ajeno | **CAMBIA → MAYOR · heredado del corte (no lo toca este cambio)** | La causa no era el simulador, como decía la ronda 1: es `fechaLegible` (`practitioner-profile-edit.ts:190`), que lee con `new Date(…)` una fecha sin hora como medianoche UTC. En hora de Bolivia, cada fecha de las tres columnas (Emisión, Desde, Inscripción) se muestra un día antes de la guardada: una especialidad cargada el 24/09 dice «Desde 23/09/2026». Es un dato equivocado a la vista del médico, en un campo que él mismo cargó, y por eso sube a MAYOR. La función no cambió en esta rama (llegó con `43da6682`, 13/09) y está declarada en «Riesgos residuales», así que no baja la nota |
| N4-29 | MENOR · ajeno | **SIGUE** | Pestañas «ectoria» y «Activid» cortadas a 375 |
| N4-30 | MENOR · ajeno | **SIGUE** | El ▼ sigue igual |
| N4-31 | MENOR · ajeno | **SIGUE** | La zona de arrastre sigue a la vista y la vista previa sigue grande en `h4-alta-matricula-confirmacion.png` |
| N4-32 | MENOR · ajeno | **SIGUE** | «Limpiar todo» sigue solo, sin ficha, en `h4-busqueda-matriculas.png` |

### Hallazgos nuevos

| ID | Severidad | Origen | Captura(s) | Qué y dónde |
|---|---|---|---|---|
| N4-33 | MENOR | del cambio | `h4s3-titulos-768-*`, `h4s3-titulos-375-*` | En los títulos verificados, «Verificado» aparece dos veces en la misma fila a 768 y 375: debajo del identificador y en la nota «Verificado: ya no se corrige» de las acciones. Sobra una de las dos |
| N4-34 | MENOR | del cambio (código; no se ve en pantalla) | — | En `practitioner-profile-edit.css`, las reglas nuevas se insertaron entre el comentario del paginador (`:178-182`) y su regla. Ese comentario ahora encabeza `.edicion__nota + app-filter-bar` (`:185`) y `.edicion__paginacion` (`:215`) quedó sin él. Además, el corte `@media (min-width: 780px)` (`:209`) repite como número suelto el corte de `data-table`: si ese cambia, entre los dos valores el estado sale dos veces (en la fila y en la columna) o no sale en ningún lado |
| N4-35 | MENOR | del cambio (documentación) | — | La sección «A medias» del REPORTE (H4.S3.M7) cita `evidencia/doble-revision-nucleo.md`, que no existe en la carpeta del trabajo; la única que hay es `evidencia/doble-revision.md` |

### Nota por pantalla (ronda 2)

| Pantalla | Ronda 1 | Ronda 2 | Qué la decide |
|---|---|---|---|
| P1 · Modal «Agregar especialidades» | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | Sin cambios: N4-12, N4-13, N4-14 (MENOR) |
| P2 · Modal «Editar especialidad» | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | Sin cambios: N4-15 (MENOR) |
| P3 · Modal «Agregar matrícula» | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-13, N4-16, N4-17, N4-22 y, ajeno, N4-31 (todos MENOR) |
| P4 · Modal «Editar matrícula» | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-16, N4-17, N4-18 (MENOR); N4-19 cerrado |
| P5 · Credenciales a 1440 | RECHAZADA | **RECHAZADA** | N4-02 (MAYOR del cambio) sigue. N4-03 cerrado. N4-28 sube a MAYOR, pero es heredado |
| P6 · Credenciales a 768 | RECHAZADA | **RECHAZADA** | N4-01 bajó a MENOR y N4-03 se cerró. Ahora que el estado se ve al lado de las acciones, N4-02 (MAYOR del cambio) queda a la vista también a este ancho |
| P7 · Credenciales a 375 | RECHAZADA | **RECHAZADA** | N4-02 (MAYOR del cambio), igual que a 768. Siguen los MAYOR ajenos N4-07 y N4-08 |
| P8 · Títulos a 1440 | RECHAZADA | **ACEPTABLE CON RESERVAS** | N4-03 cerrado. Del cambio quedan sólo MENOR (N4-21, N4-23); en títulos lo verificado no se corrige, así que N4-02 no aplica. Ajenos: N4-06 (MAYOR), N4-25, N4-27 y el heredado N4-28 |
| P9 · Trayectoria a 1440 con el menú abierto | RECHAZADA | **ACEPTABLE CON RESERVAS** | N4-04 y N4-05 cerrados. Queda N4-06, MAYOR pero ajeno, con el CA declarado en `A MEDIAS`, y N4-26 (MENOR, ajeno) |
| P10 · Títulos a 768 | RECHAZADA | **ACEPTABLE CON RESERVAS** | N4-01 bajó a MENOR y N4-03 se cerró. Quedan N4-10, N4-21 y N4-33 (MENOR); ajeno, N4-06 |
| P11 · Títulos a 375 | RECHAZADA | **ACEPTABLE CON RESERVAS** | N4-01 bajó a MENOR y N4-03 se cerró. Quedan N4-09, N4-10, N4-21 y N4-33 (MENOR); ajenos, N4-06 y N4-07 |

Recuento: **3 RECHAZADA** (P5, P6, P7), **8 ACEPTABLE CON RESERVAS** y **0 APROBADA**. Las tres rechazadas lo son por un solo hallazgo, N4-02: si se decide cerrar la corrección y el retiro de lo verificado, o se registra por escrito que se acepta como está, las tres pasan a ACEPTABLE CON RESERVAS.

### No cubierto (ronda 2)

Sigue igual que en la ronda 1, con tres agregados:

- **El filtro «Estado» de especialidades abierto:** ninguna captura lo muestra. La corrección de N4-11 se juzgó por `comportamiento-h4s3.txt` (L12 y L14) y por el código, no por una imagen.
- **La insignia de especialidad (N2-01):** no aparece en ninguna pantalla de H4. En las tablas no hay ninguna marca de «certificada», que es todo lo que estas capturas permiten decir.
- **Anchos intermedios:** el estado debajo del identificador se vio a 768 y 375, pero no justo a los lados del corte, entre 779 y 781 px, que es donde se notaría la divergencia descripta en N4-34.

## Ronda 3

Se volvieron a abrir las 37 capturas, regeneradas el 24/09 sobre la rama con `mockup` integrado. Son las 34 de antes más tres nuevas: `h4-especialidades-escritorio-claro.png`, `h4-especialidades-movil-oscuro.png` y `h4-especialidades-tope.png`. Los datos de prueba volvieron a cambiar de código: PAG-46728-…, MAT-46728, MP-B-40995.

Qué cambió desde la ronda 2:

- las especialidades se mudaron a «Datos personales»;
- «Credenciales» quedó sólo con matrículas;
- lo verificado ya no se corrige (decisión de Itzan del 24/09);
- las especialidades tienen un tope de cuatro;
- «Cancelar edición» va junto a «Guardar cambios».

Se contrastó con cuatro fuentes:

- `comportamiento-h4s3.txt`: acciones por fila en L20-L23 y filtros en L12-L19;
- `comportamiento-h3h4.txt`: especialidades en «Datos personales» en L39-L41 y tope en L49;
- las filas H4 del PLAN y el REPORTE;
- el árbol de trabajo del editor.

Los hallazgos nuevos de esta ronda vienen casi todos de la mudanza. Ninguno viene de la decisión sobre lo verificado.

### Estado de los hallazgos

| ID | Ronda 2 | Ronda 3 | Motivo |
|---|---|---|---|
| N4-01 | MENOR · del cambio | **SIGUE** | El estado sigue debajo del identificador a 768 y 375. El residuo tampoco cambia: a 768 las matrículas siguen sin autoridad ni inscripción en la fila y los títulos sin institución ni emisión |
| N4-02 | MAYOR · del cambio | **CERRADO** | Ninguna especialidad «Verificada» ni matrícula «Activo» ofrece «Editar» ni «Retirar» en las 37 capturas. Llevan la nota «<estado>: ya no se corrige» y la matrícula con carnet conserva «Descargar» (`h4-credenciales-escritorio-claro.png`, `h4-especialidades-tope.png`, `h4s3-*-1440-*`, `-768-*`, `-375-*`). Las pendientes conservan las dos acciones. En el código, `accionesDeEspecialidad` y `accionesDeMatricula` devuelven `Editar` y `Retirar` sólo si la fila está pendiente (`practitioner-profile-edit.ts:2029-2047`) |
| N4-03 | CERRADO | CERRADO | Hay aire entre la nota y la barra también en la sección mudada de especialidades |
| N4-04 | CERRADO | CERRADO | Siguen 20 px entre el paginador de títulos y la tarjeta del historial (`h4s3-titulos-menu-acciones.png`) |
| N4-05 | CERRADO | CERRADO | H4.S3.M7 sigue en `A MEDIAS`, con la decisión del set de íconos en manos de Itzan |
| N4-06 | MAYOR · ajeno | **SIGUE** | «Descargar» sigue sin ícono en el menú (con el texto corrido), en TIT-1000 y ahora también en MP-2400 |
| N4-07 | MAYOR · ajeno | **SIGUE** | A 375, las filas pendientes con dos acciones siguen apilando «Editar» sobre «Retirar» a la izquierda de la celda: Medicina General, MAT-46728 y PAG-46728-10. Las filas verificadas ahora llevan la nota a la derecha, así que la columna mezcla dos alineaciones en una misma tabla |
| N4-08 | MAYOR · ajeno | **SIGUE** | «Panel», en las migas en oscuro, sin cambios (`h4-credenciales-movil-oscuro.png`) |
| N4-09 | MENOR · del cambio | **SIGUE** | «PAG-» / «46728-01» y «SEDES-MP-» / «2400» a 375 |
| N4-10 | MENOR · del cambio | **SIGUE** | El paginador sigue en dos renglones a 768 y en tres a 375 |
| N4-11 | MENOR · del cambio | **CERRADO** | Los filtros de títulos y especialidades ofrecen «Pendiente», como la columna (`practitioner-profile-edit.logic.ts:43` y `:69`; `comportamiento-h4s3.txt` L12-L15). Sigue sin haber una captura del filtro abierto |
| N4-12 | MENOR · del cambio | **SIGUE** | El título fijo «Agregar especialidades» convive con «Agregar especialidad» en la barra y en el primario |
| N4-13 | MENOR · del cambio | **SIGUE** | La confirmación sigue sin nombrar las especialidades y tapa los selectores |
| N4-14 | MENOR · del cambio | **SIGUE** | A 375, en el pie del modal de especialidades, «Cancelar» sigue solo en su renglón |
| N4-15 | MENOR · del cambio | **SIGUE** | Sin cambios en `h4-corregir-especialidad.png` |
| N4-16 | MENOR · del cambio | **SIGUE** | Sin cambios en los rótulos de la matrícula |
| N4-17 | MENOR · del cambio | **SIGUE** | Los formatos siguen repetidos |
| N4-18 | MENOR · del cambio | **SIGUE** | «Ya hay uno cargado» sigue sin identificar el archivo |
| N4-19 | CERRADO | CERRADO | — |
| N4-20 | MENOR · del cambio | **CERRADO** | La fila H4.S3.M4 del PLAN ya dice que la página «estaba en 380/375» y que, tras integrar `mockup`, da 375/375 |
| N4-21 | MENOR · del cambio | **SIGUE** | En títulos a 375, dentro de los 420 px se siguen viendo unas 3,5 filas de las 10 |
| N4-22 | MENOR · del cambio (heredado) | **SIGUE** | «Ministerio de Salud» en el alta y «Ministerio de Salud y Deportes» en la tabla. Ya está registrado |
| N4-23 | MENOR · del cambio (heredado) | **SIGUE** | La nota en `--text-muted` ahora aparece también en especialidades y matrículas («Verificada: ya no se corrige», «Activo: ya no se corrige»), con el mismo contraste de unos 4,1:1 en claro |
| N4-24 | MENOR · del cambio (heredado) | **SIGUE** | Sin cambios |
| N4-25 | MENOR · ajeno | **SIGUE** | Se suma un efecto de la nota nueva: en una misma tabla hay filas de dos alturas. A 1440 las verificadas miden unos 46 px (nota sola, alineada con el texto) y las pendientes unos 65 px (botones más bajos que el texto). Además, «Descargar» y la nota van en un renglón en matrículas y en dos en títulos. Es el ancho de cada columna de acciones con la altura del botón de `row-actions` |
| N4-26 | MENOR · ajeno | **SIGUE** | El menú sigue llegando al borde de la ventana |
| N4-27 | MENOR · ajeno | **SIGUE** | Al pasar a la página 2, «Número / título» se sigue corriendo de x=180 a x=172 |
| N4-28 | MAYOR · heredado | **SIGUE** | Las especialidades cargadas el 24/09 siguen diciendo «Desde 23/09/2026». Está registrado |
| N4-29 | MENOR · ajeno | **SIGUE** | Sin cambios |
| N4-30 | MENOR · ajeno | **SIGUE** | Sin cambios |
| N4-31 | MENOR · ajeno | **SIGUE** | Sin cambios |
| N4-32 | MENOR · ajeno | **SIGUE** | Sin cambios |
| N4-33 | MENOR · del cambio | **SIGUE (más amplio)** | Con la nota nueva, la repetición llega a las tres tablas a 768 y 375: «Verificada» debajo del nombre y «Verificada: ya no se corrige» en la misma fila, y lo mismo con «Activo» (`h4s3-especialidades-768-*`, `-375-*`, `h4s3-matriculas-768-*`, `-375-*`, `h4-credenciales-movil-oscuro.png`, `h4-especialidades-movil-oscuro.png`) |
| N4-34 | MENOR · del cambio | **CERRADO** | El comentario del paginador volvió encima de `.edicion__paginacion` (`practitioner-profile-edit.css:216-221`). El corte repetido de 780 px ahora dice de dónde sale y por qué no puede ser una variable |
| N4-35 | MENOR · del cambio | **SIGUE** | El REPORTE nombra `evidencia/doble-revision-nucleo.md` en las líneas 83, 166 y 214, y el archivo sigue sin estar en la carpeta: la única que hay es `evidencia/doble-revision.md` |

### Hallazgos nuevos

| ID | Severidad | Origen | Captura(s) | Qué y dónde |
|---|---|---|---|---|
| N4-36 | MAYOR | del cambio | `h4-especialidades-escritorio-claro.png`, `h4-especialidades-tope.png`, `h4-especialidades-movil-oscuro.png`, `h4s3-especialidades-375-*` | La sección de especialidades quedó entre los datos que se corrigen y el pie «Cancelar edición» / «Guardar cambios». A 1440 ese pie cierra la sección justo debajo del paginador, y a 375 queda fijo encima de la tabla. Pero las especialidades se guardan solas, con su modal, su confirmación y su alta, y el pie no las toca. «Cancelar edición» incluso avisa «Descartamos los cambios sin guardar.» (`practitioner-profile-edit.ts:1403-1410`) mientras las especialidades recién agregadas siguen ahí. El propio editor explica por qué ese pie no se muestra en Trayectoria ni en Credenciales: «Un "Guardar cambios" presente mientras se carga una matrícula prometería guardar algo que no guarda» (`practitioner-profile-edit.html:690-696`). La mudanza la decidió Itzan, pero dónde queda la sección respecto del pie, y qué dice, es de este cambio. Hay tres salidas posibles: que la nota de la sección diga que se guardan al agregarlas y que «Guardar cambios» no las toca; que el pie quede antes de la sección, tras los datos que se corrigen; o que la sección quede fuera del alcance visual del pie |
| N4-37 | MENOR | del cambio | `h4-especialidades-tope.png`, `h4s3-especialidades-*` | Con el tope de cuatro vigentes, la tabla de especialidades nunca pasa de una página. Aun así lleva «Anterior» y «Siguiente» apagados, un select «Página 1» de una sola opción, «10 por página» y un alto máximo de 420 px que nunca se alcanza. A 375 son tres renglones de paginador para dos o tres filas. Tiene sentido esconder el paginador cuando hay una sola página, o no paginar esta tabla |
| N4-38 | MENOR | del cambio | `h4-alta-especialidad-casillas.png`, `h4-alta-especialidad-movil-oscuro.png`, `h4-especialidades-tope.png` | El modal de alta no habla del tope: dice «Podés cargar varias de una vez», y cuando las cargadas más las nuevas llegan a cuatro, «+ Agregar otra especialidad» desaparece sin explicación. En la sección, con el tope alcanzado, el aviso «Ya alcanzaste el máximo de cuatro especialidades.» queda a la izquierda, debajo del buscador, lejos del botón apagado, que está a la derecha |
| N4-39 | MENOR | del cambio (la barra fija es de `organisms/form-actions`, `form-actions.css:13-15`) | `h4-especialidades-movil-oscuro.png`, `h4s3-especialidades-375-*` | A 375, mientras la sección está a la vista, el pie fijo tapa el final del paginador de especialidades: desde «Página 1» en los recortes y «10 por página» en la pantalla. Por cómo funciona un pie fijo, al llegar al final de la pestaña vuelve a su lugar y el paginador queda libre. Eso lo dice el código, no una captura (ver «No cubierto»). Lo provoca la ubicación de la sección, que es N4-36 |
| N4-40 | MENOR | heredado del corte (no lo introduce este cambio) | `h4-especialidades-escritorio-claro.png`, `h4-especialidades-movil-oscuro.png` | `.edicion__guardar { display: block }` (`practitioner-profile-edit.css:163-166`) anula el `flex` de `form-actions`. A 1440 los botones quedan a la izquierda, aunque el componente los alinea a la derecha desde 780 px (`form-actions.css`, bloque `@media (min-width: 780px)`). A 375 «Cancelar edición» y «Guardar cambios» se apilan y el primario no ocupa el ancho, cuando el componente lo estira en teléfono. Ahora se nota más, porque el pie queda justo debajo del paginador de especialidades, que va a la derecha |

### Nota por pantalla (ronda 3)

Las especialidades pasan a ser tres pantallas propias (P12 a P14), dentro de «Datos personales». P5 a P7 quedan sólo con matrículas.

| Pantalla | Capturas | Ronda 2 | Ronda 3 | Qué la decide |
|---|---|---|---|---|
| P1 · Modal «Agregar especialidades» | 4 | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-12, N4-13, N4-14 y N4-38 (todos MENOR) |
| P2 · Modal «Editar especialidad» | 1 | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-15 (MENOR) |
| P3 · Modal «Agregar matrícula» | 3 | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-13, N4-16, N4-17, N4-22 y, ajeno, N4-31 (todos MENOR) |
| P4 · Modal «Editar matrícula» | 1 | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-16, N4-17, N4-18 (MENOR) |
| P5 · Credenciales (matrículas) a 1440: vista general, búsqueda, tras recargar, recortes claro y oscuro, filtro | 6 | RECHAZADA | **ACEPTABLE CON RESERVAS** | N4-02 cerrado. Quedan MENOR del cambio (N4-22, N4-23, N4-24) y ajenos (N4-06, N4-25, N4-32) |
| P6 · Credenciales (matrículas) a 768 | 2 | RECHAZADA | **ACEPTABLE CON RESERVAS** | N4-02 cerrado. Quedan N4-01 (residuo), N4-10 y N4-33, todos MENOR |
| P7 · Credenciales (matrículas) a 375 | 3 | RECHAZADA | **ACEPTABLE CON RESERVAS** | N4-02 cerrado. Quedan N4-09, N4-10 y N4-33 (MENOR); ajenos, N4-07 y N4-08 (MAYOR) y N4-29 |
| P8 · Títulos a 1440 | 3 | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | Sin cambios de fondo: N4-21 y N4-23 (MENOR); ajenos, N4-06, N4-25 y N4-27 |
| P9 · Trayectoria a 1440 con el menú abierto | 1 | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-06 (MAYOR, ajeno) y N4-26 (MENOR, ajeno) |
| P10 · Títulos a 768 | 2 | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-01 (residuo), N4-10, N4-21 y N4-33 (MENOR) |
| P11 · Títulos a 375 | 2 | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-09, N4-10, N4-21 y N4-33 (MENOR); ajenos, N4-06 y N4-07 |
| P12 · Especialidades en «Datos personales» a 1440: vista general, tope y recortes claro y oscuro | 4 | — (nueva) | **RECHAZADA** | N4-36 (MAYOR del cambio). Además, N4-37 y N4-38 (MENOR) y N4-40 (heredado) |
| P13 · Especialidades a 768 (claro y oscuro) | 2 | — (nueva) | **RECHAZADA** | N4-36: es la misma pestaña, con el mismo pie, que a 768 también queda fijo (el corte de `form-actions` es 780 px). Los recortes no lo muestran, y ante la duda, la nota más baja. Además, N4-10, N4-33 y N4-37 |
| P14 · Especialidades a 375 (pantalla y recortes, claro y oscuro) | 3 | — (nueva) | **RECHAZADA** | N4-36, visible: el pie fijo de «Guardar cambios» queda encima de la tabla de especialidades. Además, N4-39 y los ajenos N4-07 y N4-33 |

Recuento: **3 RECHAZADA** (P12, P13, P14), **11 ACEPTABLE CON RESERVAS** y **0 APROBADA**. Las tres rechazadas lo son por un solo hallazgo, N4-36. Si se resuelve con cualquiera de sus tres salidas, pasan a ACEPTABLE CON RESERVAS.

### No cubierto (ronda 3)

Sigue lo de las rondas anteriores, con cuatro agregados:

- **El final de «Datos personales» a 375:** ninguna captura muestra la pestaña desplazada hasta el final, que es donde el pie fijo tendría que volver a su lugar y dejar libre el paginador de especialidades (N4-39).
- **Qué hace el pie después de agregar una especialidad:** «Cancelar edición» y «Guardar cambios» no se ejercitaron en ese estado. Lo que dice N4-36 sobre el aviso de «Cancelar edición» sale del código.
- **Matrículas en otros estados** (rechazada, vencida o suspendida): no hay ninguna en los datos de prueba. Por el código, cualquier estado que no sea «pendiente» queda sin «Editar» y sin «Retirar», así que una matrícula rechazada no se podría corregir ni retirar. No se vio en pantalla.
- **El tope con un filtro activo:** no hay captura del aviso de las cuatro especialidades junto a una ficha de filtro, que usan el mismo renglón debajo de la barra.

## Ronda 4

Se volvieron a abrir las 37 capturas de la recaptura del 24/09 a las 20:15. Los códigos de prueba ahora son MP-B-83026, MAT-80692 y PAG-80692-….

El único cambio visible es la nota de «Tus especialidades cargadas» (`practitioner-profile-edit.html:223-227`), que ahora dice «Cada una se guarda al agregarla, sin pasar por «Guardar cambios»». Se lee en las nueve capturas de especialidades:

- a 1440 ocupa dos renglones;
- a 768, dos;
- a 375, cinco.

Las otras 28 capturas muestran lo mismo que en la ronda 3, con los códigos nuevos.

### Estado de los hallazgos

| ID | Ronda 3 | Ronda 4 | Motivo |
|---|---|---|---|
| N4-36 | MAYOR · del cambio | **CAMBIA → MENOR · del cambio** | La nota dice ahora, donde se lee antes de agregar, que las especialidades no pasan por «Guardar cambios». Eso resuelve la promesa falsa, que era lo que hacía MAYOR el hallazgo. Quedan dos residuos menores. El pie sigue cerrando visualmente la sección, y a 375 queda fijo sobre la tabla (`h4-especialidades-movil-oscuro.png`, `h4s3-especialidades-375-*`). Y «Cancelar edición» sigue avisando «Descartamos los cambios sin guardar.» aunque haya especialidades recién agregadas (`practitioner-profile-edit.ts:1410`). Con la nota, las dos cosas se entienden, pero dependen de que se lea una leyenda chica |
| N4-35 | MENOR · del cambio | **SIGUE** | `evidencia/doble-revision-nucleo.md` todavía no existe. Queda comprometido para antes del commit; se cierra cuando esté en la carpeta |
| N4-37 | MENOR · del cambio | **SIGUE** | Sin cambios: con el tope de cuatro, el paginador completo y el alto máximo nunca se usan |
| N4-38 | MENOR · del cambio | **SIGUE (a medias)** | La sección ya menciona el tope. El modal todavía no: dice «Podés cargar varias de una vez», y «+ Agregar otra especialidad» desaparece sin explicación (`h4-alta-especialidad-casillas.png`). Registrado |
| N4-39 | MENOR · del cambio | **SIGUE** | A 375 el pie fijo tapa «Página 1» y «1–3 de 3» en los recortes de especialidades |
| N4-40 | MENOR · heredado | **SIGUE** | A 1440 el pie sigue a la izquierda, y a 375 apilado. Registrado |
| N4-01, N4-09, N4-10, N4-12 a N4-18, N4-21 a N4-24, N4-33 | MENOR · del cambio | **SIGUE** | Sin cambios en las capturas |
| N4-06, N4-07, N4-08 | MAYOR · ajeno | **SIGUE** | Sin cambios: «Descargar» sin ícono en el menú, en TIT-1000 y en MP-2400; las acciones apiladas a 375; «Panel» en las migas en oscuro |
| N4-28 | MAYOR · heredado | **SIGUE** | Sigue saliendo «Desde 23/09/2026». Registrado |
| N4-25 a N4-27, N4-29 a N4-32 | MENOR · ajeno | **SIGUE** | Sin cambios |
| N4-02, N4-03, N4-04, N4-05, N4-11, N4-19, N4-20, N4-34 | CERRADO | CERRADO | Siguen cerrados en la recaptura |

No hay hallazgos nuevos.

### Nota por pantalla (ronda 4)

| Pantalla | Ronda 3 | Ronda 4 | Qué la decide |
|---|---|---|---|
| P1 · Modal «Agregar especialidades» | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-12, N4-13, N4-14 y N4-38 (MENOR) |
| P2 · Modal «Editar especialidad» | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-15 (MENOR) |
| P3 · Modal «Agregar matrícula» | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-13, N4-16, N4-17 y N4-22 (MENOR); ajeno, N4-31 |
| P4 · Modal «Editar matrícula» | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-16, N4-17 y N4-18 (MENOR) |
| P5 · Credenciales (matrículas) a 1440 | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | Sólo MENOR del cambio; ajenos, N4-06, N4-25 y N4-32 |
| P6 · Credenciales (matrículas) a 768 | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-01, N4-10 y N4-33 (MENOR) |
| P7 · Credenciales (matrículas) a 375 | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-09, N4-10 y N4-33 (MENOR); ajenos, N4-07 y N4-08 |
| P8 · Títulos a 1440 | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-21 y N4-23 (MENOR); ajenos, N4-06, N4-25 y N4-27 |
| P9 · Trayectoria a 1440 con el menú abierto | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | Ajenos: N4-06 (MAYOR) y N4-26 |
| P10 · Títulos a 768 | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-01, N4-10, N4-21 y N4-33 (MENOR) |
| P11 · Títulos a 375 | ACEPTABLE CON RESERVAS | ACEPTABLE CON RESERVAS | N4-09, N4-10, N4-21 y N4-33 (MENOR); ajenos, N4-06 y N4-07 |
| P12 · Especialidades a 1440 | RECHAZADA | **ACEPTABLE CON RESERVAS** | N4-36 bajó a MENOR. Quedan N4-37 y N4-38 (MENOR) y N4-40 (heredado) |
| P13 · Especialidades a 768 | RECHAZADA | **ACEPTABLE CON RESERVAS** | N4-36 bajó a MENOR. Quedan N4-10, N4-33 y N4-37 (MENOR) |
| P14 · Especialidades a 375 | RECHAZADA | **ACEPTABLE CON RESERVAS** | N4-36 bajó a MENOR. Quedan N4-39 y N4-33 (MENOR); ajeno, N4-07 (MAYOR) |

Recuento: **0 RECHAZADA**, **14 ACEPTABLE CON RESERVAS** y **0 APROBADA**. No queda ningún BLOQUEANTE ni MAYOR del cambio abierto. Los MAYOR que quedan son ajenos o heredados y no bajan la nota:

- N4-06: «Descargar» sin ícono, pendiente de la decisión sobre el set de íconos;
- N4-07: las acciones apiladas a 375;
- N4-08: «Panel» en las migas en oscuro;
- N4-28: la fecha un día antes.

### No cubierto (ronda 4)

Sigue lo de la ronda 3. En particular, ninguna captura muestra «Datos personales» a 375 desplazada hasta el final, que es donde se vería si el pie fijo deja libre el paginador (N4-39). Tampoco hay ninguna del aviso de «Cancelar edición» después de agregar una especialidad.
