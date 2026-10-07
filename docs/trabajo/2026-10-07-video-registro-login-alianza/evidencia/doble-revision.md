# Doble revisión crítica: registro, login y «Mi perfil» en el video

- **Video:** `artifacts/video-aseguradora/alianza-aseguradora-1080p.mp4`. Es h264, 1920×1080, de 188,56 s y en una sola toma continua.
- **Capturas:** son de la misma corrida que el video (la final, sin reintentos: «registro-aseguradora» marca 6,3 s).
- **Alcance de esta revisión:** las pantallas nuevas (registro, confirmación, login y «Mi perfil» con lo registrado). Las del recorrido que ya existía se revisaron en [la doble revisión anterior](../../2026-10-05-video-aprobar-rechazar/evidencia/doble-revision.md) y no cambiaron de contenido.

| Viewport | Tema | Estado | Captura |
|---|---|---|---|
| 1920×1080 | claro | Inicio de sesión, antes del registro | `01-inicio-de-sesion.png` |
| 1920×1080 | claro | Paso 1 de 8, la empresa | `02-alta-1-la-empresa.png` |
| 1920×1080 | claro | Paso 3 de 8, cuatro documentos subidos | `04-alta-3-documentos-legales.png` |
| 1920×1080 | claro | Paso 4 de 8, el documento del SEDES | `05-alta-4-documento-sedes.png` |
| 1920×1080 | claro | Paso 6 de 8, el poder notariado | `07-alta-6-poder-notariado.png` |
| 1920×1080 | claro | Paso 7 de 8, las tres gerencias | `08-alta-7-directorio-ejecutivo.png` |
| 1920×1080 | claro | «Tu cuenta está lista» | `10-alta-9-confirmada.png` |
| 1920×1080 | claro | Login con el correo y la contraseña del alta | `11-login.png` |
| 1920×1080 | claro | «Mi perfil» con lo registrado | `12-mi-perfil.png` |

## Pasada 1: verificación

- **P1, `01`: OK.** Se ve «Iniciar sesión» con los dos accesos de alta y el cursor del video. No aparecen «Datos de prueba» ni «Ver componentes».
- **P1, `02`: OK.** «Alianza Seguros y Reaseguros S.A.», sigla `ALIANZA`, país Bolivia y tipo societario «S.A. · Sociedad Anónima». La lista nativa del desplegable ya no queda abierta.
- **P1, `04`: OK.** «Escritura de constitución», «Certificado de NIT», «Matrícula de comercio (SEPREC)» y «Licencia de funcionamiento municipal» muestran cada uno su PDF, su peso (431,5 / 101,2 / 239,2 / 150,3 KB) y la marca de verificación.
- **P1, `05`: OK.** «Certificado del SEDES» con su PDF de 196,3 KB.
- **P1, `07`: OK.** «Poder del representante legal» con su PDF de 289,4 KB. Paso 6 de 8.
- **P1, `08`: OK.** Las tres gerencias con nombre, celular (+591) y correo `@mail.com`.
- **P1, `10`: OK.** «Tu cuenta está lista» y «Ir a iniciar sesión».
- **P1, `11`: OK.** `aseguradora@mail.com` y la contraseña escritos (la contraseña va en puntos).
- **P1, `12`: OK.** «Mi perfil» muestra la razón social, el nombre comercial, la sigla `ALIANZA`, el NIT `1020347028`, la dirección y, en la ficha, el código `ALIANZA` y el mismo valor como registro ante el regulador. Todo coincide con lo escrito en el registro.

## Pasada 2: adversarial

**Pasos del alta (`02`, `04`, `05`, `07`)**

1. Lo primero que se ve mal: en `02`, la barra de pasos apenas se distingue en el paso 1 (es el componente real).
2. Texto cortado: no hay. El nombre más largo («Licencia-funcionamiento-municipal-Alianza.pdf») cabe.
3. Terminado: sí.
4. Coherencia: son los componentes reales (`app-paginated-form`, `app-dropzone-pdf`).
5. Tema oscuro: no aplica, el video es claro.
6. Estados: el alta no muestra errores de validación ni la barra de subida. La subida simulada tarda 0,6 s y la barra no llega a verse en una captura. No hace falta para la demo.
7. Jerarquía: una acción primaria por paso («Siguiente»).
8. Datos: todos ficticios, y los PDF dicen «DOCUMENTO DE EJEMPLO».
9. Muestra lo pedido: sí, el alta con la subida de archivos.
10. Por qué lo rechazaría: no encontré motivo.

**Nota: APROBADA** (`02`, `04`, `05`, `07`).

**Gerencias (`08`)**

1. Lo primero que se ve mal: la captura sale con la página desplazada y el encabezado «1. Gerente General» queda fuera de cuadro. En el video se ve el desplazamiento mientras se escribe, así que el espectador sí lo ve. **MENOR**, registrado.
2. Texto cortado: el panel 1 aparece cortado arriba, por lo anterior.
3. Terminado: sí.
4–10. Sin hallazgos adicionales: coherente, datos ficticios y muestra lo pedido.

**Nota: ACEPTABLE CON RESERVAS.**

**Confirmación, login y perfil (`01`, `10`, `11`, `12`)**

1. Lo primero que se ve mal: en `10`, la tarjeta de confirmación queda en el centro con mucho blanco alrededor. Es el diseño real de esa pantalla. **MENOR**, no se toca.
2. Texto cortado: no hay.
3. Terminado: sí.
4. Coherencia: «Mi perfil» repite exactamente lo registrado. En el login real, el simulador reconoce `aseguradora@…` como la cuenta de prueba; eso se explica en el README.
5. Tema oscuro: no aplica.
6. Estados: «Mi perfil» muestra «Sin logo», porque no se usa la marca real.
7. Jerarquía: correcta.
8. Datos: ficticios. El NIT `1020347028` no es el de ninguna empresa real conocida; es inventado.
9. Muestra lo pedido: sí.
10. Por qué lo rechazaría: «Registro ante el regulador» repite el NIT. Es lo que hace la pantalla con el mismo campo; **MENOR**.

**Nota: APROBADA** (`01`, `11`, `12`). **ACEPTABLE CON RESERVAS** (`10`, por el punto 1).

## Notas finales

| Pantalla | Nota |
|---|---|
| Inicio de sesión | APROBADA |
| Paso 1, la empresa | APROBADA |
| Paso 3, documentos legales | APROBADA |
| Paso 4, documento del SEDES | APROBADA |
| Paso 6, poder notariado | APROBADA |
| Paso 7, gerencias | ACEPTABLE CON RESERVAS |
| Cuenta lista | ACEPTABLE CON RESERVAS |
| Login | APROBADA |
| Mi perfil | APROBADA |

## Hallazgos que llevaron a una corrección y re-captura

- **Lista nativa del desplegable abierta y desplazada** (captura `02` de una corrida anterior, severidad MAYOR): Chromium headless la dibujaba corrida y encima de otros campos. Se corrigió apuntando al desplegable sin abrirlo; se volvió a capturar y a revisar.
- **Pesos de 735 bytes** en los PDF (captura `04` de una corrida anterior, severidad MENOR): parecían falsos. Los PDF ahora pesan entre 100 y 430 KB.

## No cubierto

- La barra de avance de la subida y los errores de validación del alta no aparecen en el video.
- El mapa de la casa matriz (es opcional) y el selector de país multizona.
- La verificación del correo y la aprobación de la organización.
- El tema oscuro y otros tamaños de ventana.
