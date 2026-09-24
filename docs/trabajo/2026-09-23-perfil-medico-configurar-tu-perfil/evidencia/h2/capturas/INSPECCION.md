# Capturas de H2, miradas una por una — 2026-09-23

Recorrido: `evidencia/h2/capturas-h2.mjs` (salida en `evidencia/h2/comportamiento-h2.txt`). Cuentas sintéticas `medica@alovida.mock` y `paciente@alovida.mock`. `escritorio` = 1440×1000, `tableta` = 768×1024, `movil` = 390×844. Tema por `prefers-color-scheme`.

Las de página completa se toman con la ventana estirada a la altura del documento, después de esperar a que no quede ninguna transición. La captura de página completa de Playwright estira la ventana en el acto, y la barra lateral anima su ancho a mitad de la foto (medido: en reposo, barra de 240 px y contenido desde x=240; justo después de la captura, transiciones `width` en `app-side-nav` y `padding-left` en `app-shell` en curso). Es un efecto de la captura, no de la pantalla.

Las pastillas «Datos de prueba» y «Ver componentes» son el aviso de la maqueta y aparecen en todas.

## Ficha «Mi perfil» — H2.S1.M4 · H2.S3.M4 · H2.S3.M8

| Captura | Qué se ve | Juicio |
|---|---|---|
| `h2-ficha-datos-personales-escritorio-claro.png` | Nombre, código, documento, fecha de nacimiento, edad, «Correo de acceso» `valeria-rojas@alovida.mock` con «Se cambia por su propio trámite», título, dos especialidades en tarjetas iguales (Cardiología y Medicina Interna, ambas Verificado, ninguna PRINCIPAL), habilitación, presentación. Sin «Estado de la práctica». | OK: D-01, D-02 y D-03 |
| `h2-ficha-datos-personales-tableta-claro.png` | Lo mismo a una columna; pestañas con flechas. | OK |
| `h2-ficha-datos-personales-movil-claro.png` | Una columna; el correo de acceso y su nota parten en dos líneas sin desbordar; tarjetas de especialidad apiladas, iguales. | OK |
| `h2-ficha-datos-personales-escritorio-oscuro.png` | Igual que en claro; tarjetas legibles sobre la superficie oscura. | OK |
| `h2-ficha-datos-personales-tableta-oscuro.png` | Igual que en tableta clara. | OK |
| `h2-ficha-datos-personales-movil-oscuro.png` | Igual que en móvil claro. | OK |
| `h2-ficha-contacto-escritorio-claro.png` | Correo personal, celular personal, municipio de residencia, domicilio con «Ver en el mapa», «En la plataforma desde mayo 2025». Nada del trabajo. | OK: D-03 |
| `h2-ficha-contacto-tableta-claro.png` | Lo mismo a una columna. | OK |
| `h2-ficha-contacto-movil-claro.png` | Lo mismo a una columna. | OK |
| `h2-ficha-contacto-escritorio-oscuro.png` | Igual que en claro. | OK |
| `h2-ficha-contacto-tableta-oscuro.png` | Igual que en tableta clara. | OK |
| `h2-ficha-contacto-movil-oscuro.png` | Igual que en móvil claro. | OK |

## Editor «Configurar tu perfil» — H2.S3.M3 · H2.S3.M4

| Captura | Qué se ve | Juicio |
|---|---|---|
| `h2-editor-datos-personales-escritorio-claro.png` | Nombres, apellidos, fecha, título, biografía, telemedicina, «Tu documento» y la sección nueva «Tu correo de acceso» en sólo lectura («Es con el que entrás. Se cambia por su propio trámite, no desde acá.»). | OK: D-03 |
| `h2-editor-datos-personales-movil-oscuro.png` | Lo mismo a una columna, en oscuro. | OK |
| `h2-editor-contacto-escritorio-claro.png` | Departamento, localidad, dirección con mapa, celular personal y correo personal («Distinto del correo de acceso. No se publica en tu ficha.»). Sin celular, fijo ni correo del trabajo. | OK: D-03 · ver hallazgo de la pista de «Dirección» |
| `h2-editor-contacto-movil-oscuro.png` | Lo mismo a una columna, en oscuro. | OK |

## Insignias de especialidad — H2.S2.M8 (y H2.S2.M4 en el editor)

| Captura | Qué se ve | Juicio |
|---|---|---|
| `h2-insignias-ficha.png` | Ficha, Datos personales: dos insignias con el mismo tono (`tone--secondary`), ninguna marca de principal. La marca «✓» de Cardiología es el dato `certificada` de esa especialidad (`specialty-badge.html:5`), no «principal». El aviso «Credenciales» abajo a la derecha es el de la pestaña recorrida antes. | OK: D-01 |
| `h2-insignias-editor.png` | Editor, Credenciales: tabla «Tus especialidades cargadas» con columnas Especialidad · Desde · Estado · Acciones; acciones «Editar» y «Retirar», sin «Marcar como principal». | OK: D-01 |
| `h2-insignias-perfil-publico.png` | Perfil público: «Especialidades» con Cardiología y Medicina Interna como dos pastillas iguales. «No pudimos traer las opiniones» es la sección de opiniones de la maqueta, ajena a H2. | OK: D-01 |
| `h2-insignias-directorio-detalle-paciente.png` | Como paciente, detalle del médico: las dos insignias iguales, cada una con «Verificado». | OK: D-01 |
| `h2-insignias-directorio-lista-paciente.png` | Como paciente, portada del directorio: la grilla de especialidades con su recuento. No dibuja insignias. | OK |

**No cubierto por captura:** el listado de una especialidad (`/directory?especialidad=…`). No dibuja insignias y no tiene ninguna mención de «principal» (0 coincidencias en `practitioners-directory.ts`, `practitioners-directory.html` y `directory-page.*`). Agrupa al profesional bajo cada una de sus especialidades (`practitioners-directory.ts:508`).

## Alta — H2.S2.M5

| Captura | Qué se ve | Juicio |
|---|---|---|
| `h2-alta-especialidades.png` | «Crear cuenta de profesional», paso 12 de 13, «Tus especialidades»: «Especialidad 1» y «Especialidad 2» como dos campos iguales con su botón de quitar y «+ Agregar otra especialidad». No pregunta cuál es la principal. Se llegó a esa página poniendo el formulario paginado en ella, sin llenar las anteriores. | OK: D-01 |

## El PATCH en la Red — H2.S3.M6

| Captura | Qué se ve | Juicio |
|---|---|---|
| `h2-patch-antes-de-guardar.png` | Editor, Contacto, con el celular personal cambiado a «7123 4567», justo antes de «Guardar cambios». | OK |

Petición retenida en la red (`evidencia/h2/red-patch.txt`): `PATCH /profiles/practitioners/me`, `content-type: application/json`, cuerpo `{"mobilePhone":"+591 71234567"}`. Sólo viaja lo editado; ninguna clave del trabajo. La petición se cortó en la red después de leerla.

## Consola y red (`evidencia/h2/consola-red-h2.txt`)

- Consola: un solo error, el `net::ERR_FAILED` del PATCH que el propio recorrido cortó a propósito.
- Red: seis teselas del mapa abortadas al salir de la página (`ERR_ABORTED`), más el mismo PATCH cortado. Nada de la app en 4xx/5xx.
