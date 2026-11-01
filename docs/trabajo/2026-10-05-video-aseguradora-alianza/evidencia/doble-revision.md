# Doble revisión crítica — video de la aseguradora (Alianza Seguros)

## Material revisado

- **Video:** `artifacts/video-aseguradora/alianza-aseguradora-1080p.mp4`. Git lo ignora, así que no viaja en el PR.
  - Formato: H.264, 1920×1080, 78,96 s.
  - Es una sola toma continua de la interacción, sin cortes salvo el recorte del login al inicio.
- **Capturas:** las de Playwright tomadas en la misma corrida que el video, en el momento en que el script revisa cada pantalla. Están en esta carpeta.
- **Marcas de tiempo:** en `marcas.json`.

| Viewport | Tema | Estado | Captura |
|---|---|---|---|
| 1920×1080 | claro | Mi perfil cargado | `01-mi-perfil.png` |
| 1920×1080 | claro | Mis productos, plan 7 de 7 | `02-mis-productos.png` |
| 1920×1080 | claro | Detalle de una solicitud recibida | `03-solicitud-detalle.png` |
| 1920×1080 | claro | Siniestralidad «Por persona», informe generado | `04-siniestralidad-por-persona.png` |
| 1920×1080 | claro | Directorio con la búsqueda «Mamani» | `05-directorio.png` |
| 1440×900 | claro | Directorio en `mockup` **sin** el script (datos de la maqueta) | `h1-directorio-mockup-sin-script.png` |

## Pasada 1 — verificación contra el criterio de aceptación

**Primera corrida completa (16:0x):**
- P1 — `05-directorio`: **DEFECTO.** «Enviar Mensaje» aparece desactivado en todas las filas, con «Este paciente no tiene mensajería disponible». Las personas del video no tienen perfil de mensajería en la maqueta.
- **Corrección:** `tools/video-aseguradora/grabar.mjs`. La capa de respuesta marca `messaging.available` para las personas del video. Se volvió a grabar.

**Corrida final (las capturas de arriba):**
- P1 — `01-mi-perfil` — **OK.**
  - Razón social «Alianza Seguros y Reaseguros S.A.», nombre comercial «Alianza Seguros», sigla ASR, NIT APS-0015.
  - Ficha con código ALIANZA y correo `siniestros@mail.com`.
  - Avatar «AS». No aparecen los botones «Datos de prueba» ni «Ver componentes».
- P1 — `02-mis-productos` — **OK.**
  - Llega a la página 7 de 7. En la primera corrida un clic en «Siguiente» no avanzó; se corrigió con clics explícitos en «Página N».
  - El cuadro de la página 2 muestra el Plan 2 de Emisión Rápida: Bs 120, Bs 5.000, Bs 6.000, copago 0 y copago 20, iguales a la fuente.
- P1 — `03-solicitud-detalle` — **OK.** El detalle muestra paciente, médico y prestador ficticios, el plan «Alianza Seguros · Salud Mundial Plus» y el estado «En revisión».
- P1 — `04-siniestralidad-por-persona` — **OK.** Muestra 77 solicitudes y 18 personas, con el semáforo en sus tres colores: Crítica (> 85 %), Atención (75–85 %) y Saludable (< 75 %).
- P1 — `05-directorio` (re-captura) — **OK.**
  - La búsqueda «Mamani» devuelve 2 resultados.
  - Correos `@mail.com`, sexo «Femenino», seguro «Alianza Seguros», «Enviar Mensaje» activo.

## Pasada 2 — adversarial (postura: rechazar la entrega)

Se aplica a las capturas finales. Las preguntas son las de `critical-double-review` §3.

### Mi perfil (`01`)

1. **Lo primero que se ve mal:** el recuadro «Sin logo». Una demo para una aseguradora sin su logo se ve incompleta.
2. **Texto cortado:** no hay. La ficha queda cortada abajo, pero en el video se ve completa durante el desplazamiento.
3. **¿Se ve terminado?** Sí.
4. **Coherencia con el resto:** es el componente real, así que sí.
5. **Tema oscuro:** no aplica. El video se graba solo en tema claro, que es el valor por omisión.
6. **Estados:** no aplica; la pantalla está cargada.
7. **Jerarquía:** correcta.
8. **Datos:** NIT, dirección, WhatsApp y call center son ficticios, pero se muestran junto al nombre real de la aseguradora. Queda registrado en el reporte y en el README.
9. **¿Muestra lo pedido?** Sí: entrar como Alianza.
10. **Motivo para rechazar:** el logo vacío. Usar la marca real de Alianza no corresponde. **MENOR**, registrado.

**Nota: ACEPTABLE CON RESERVAS.**

### Mis productos (`02`)

1. **Lo primero que se ve mal:** «Prima mensual · 65.00» aparece sin moneda. Es como el componente pinta la prima en `mockup`, fuera de alcance. **MENOR**, registrado.
2. **Texto cortado:** no hay.
3. **¿Se ve terminado?** Sí.
4. **Coherencia:** sí.
5. **Tema oscuro:** no aplica.
6. **Estados:** no aplica.
7. **Jerarquía:** el botón rojo «Eliminar producto seguro» llama la atención en una demo. Es el componente real con permiso de administración.
8. **Datos:** tres de los siete planes tienen cuota **referencial, inventada**. En pantalla no se distingue cuál es oficial y cuál no, y un espectador externo podría tomarlas por precios reales. Se registra como riesgo en el reporte.
9. **¿Muestra lo pedido?** Sí: los planes y cuotas de la fuente.
10. **Motivo para rechazar:** el punto 8, si el video se muestra fuera del equipo sin aclarar que es una maqueta.

**Nota: ACEPTABLE CON RESERVAS.**

### Solicitudes recibidas y detalle (`03`)

1. **Lo primero que se ve mal:** nada. La tarjeta del paciente al pasar el mouse y el diálogo se leen bien.
2. **Texto cortado:** no hay.
3. **¿Se ve terminado?** Sí.
4. **Coherencia:** sí.
5. **Tema oscuro:** no aplica.
6. **Estados:** muestra «Todavía sin dictamen» y las acciones Aprobar, Aprobar parcialmente y Rechazar.
7. **Jerarquía:** correcta.
8. **Datos:** todo es ficticio y no hay PHI real.
9. **¿Muestra lo pedido?** Sí.
10. **Motivo para rechazar:** ninguno.

**Nota: APROBADA.**

### Siniestralidad «Por persona» (`04`)

1. **Lo primero que se ve mal:** la línea «Período…» queda pegada al borde superior después del desplazamiento. Es transitorio dentro del video.
2. **Texto cortado:** no hay.
3. **¿Se ve terminado?** Sí.
4. **Coherencia:** sí.
5. **Tema oscuro:** no aplica.
6. **Estados:** el informe está generado. El video pasa por «Generar informe».
7. **Jerarquía:** el semáforo guía la lectura.
8. **Datos:** la siniestralidad de los planes con cuota referencial también es ilustrativa. Registrado.
9. **¿Muestra lo pedido?** Sí: solo la pestaña «Por persona».
10. **Motivo para rechazar:** ninguno bloqueante.

**Nota: APROBADA.**

### Directorio de pacientes (`05`)

1. **Lo primero que se ve mal:** el título dice «Directorio de Pacientes» y el pedido decía «Directorio de clientes». Es el componente real; queda registrado como ambigüedad.
2. **Texto cortado:** no hay.
3. **¿Se ve terminado?** Sí.
4. **Coherencia:** sí.
5. **Tema oscuro:** no aplica.
6. **Estados:** el filtro activo se ve como chip «Búsqueda: Mamani», y está «Limpiar filtros».
7. **Jerarquía:** correcta.
8. **Datos:** «Enviar Mensaje» se ve activo, pero si se pulsara, el simulador respondería 412, porque esas personas no tienen perfil de mensajería. El video no lo pulsa. Registrado.
9. **¿Muestra lo pedido?** Sí.
10. **Motivo para rechazar:** el botón promete algo que la maqueta no hace. **MENOR**, porque es solo para el video y está documentado.

**Nota: ACEPTABLE CON RESERVAS.**

### El video como pieza

- **Compresión:** el WebM de Playwright sale en VP8 con una tasa de bits modesta, que en el MP4 queda en 0,94 Mbps. Se nota un leve fantasma alrededor del texto en los movimientos; en reposo se lee bien. **MENOR**, registrado. Si hiciera falta más nitidez, la alternativa es capturar con `Page.startScreencast`.

## Notas finales

| Pantalla | Nota |
|---|---|
| Mi perfil | ACEPTABLE CON RESERVAS |
| Mis productos | ACEPTABLE CON RESERVAS |
| Solicitudes recibidas | APROBADA |
| Siniestralidad «Por persona» | APROBADA |
| Directorio | ACEPTABLE CON RESERVAS |

## No cubierto

- Tema oscuro y viewports móviles: el pedido es un video de escritorio.
- El video completo cuadro por cuadro. Se revisaron las capturas de la misma corrida en cada pantalla, no todos los segundos del MP4.
