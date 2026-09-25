# Capturas de H2, miradas una por una — 2026-09-24 (evidencia final)

Recorrido: `evidencia/h2/capturas-h2.mjs`, con salida en `evidencia/h2/comportamiento-h2.txt` y `evidencia/h2/consola-red-h2.txt`. Cuentas sintéticas `medica@alovida.mock` (Valeria Rojas Mendoza, cardióloga) y `paciente@alovida.mock`. Las mismas 68 capturas viajan en `docs/frontend/evidence/perfil-medico-datos-y-contacto-2026-09-23/`.

Es la evidencia final del carril, tomada una sola vez sobre el código final (la rama con `mockup` integrado, #644 y #645 incluidos), en los cinco viewports del gate visual del repo (390×844, 768×1024, 1024×768, 1440×900 y 1920×1080), en claro y en oscuro. Lo que cambió respecto de las recapturas anteriores:

- El correo de trabajo se corrige en «Contacto» del editor y la ficha lo muestra en «Contacto» (#645). D-03 queda para el celular y el fijo del trabajo.
- Ya no hay «Correo de acceso» en «Datos personales», ni en la ficha ni en el editor.
- La ficha suma «Trayectoria» (sólo cargos, #644) y «Credenciales» (por tipo) en las cinco medidas.

El registro confirma lo que no siempre se lee en la imagen: en las 40 tomas de la ficha y las 20 del editor, «Datos personales» no trae «Correo de acceso» y «Contacto» trae «Correo de trabajo» y ningún teléfono del trabajo (L1–L60); el editor tiene el campo `edicion-correo-trabajo` y no los de celular ni fijo del trabajo (L42–L60).

## Ficha «Mi perfil», pestaña Datos personales — H2.S1.M4 · D-01 · D-02 · #645

| Captura | Qué se ve | Juicio |
|---|---|---|
| `h2-ficha-datos-personales-escritorio-claro.png` | 1440×900 claro. Pestaña «Datos personales» de la ficha: nombre «Valeria Rojas Mendoza», código MED-1000, documento «3000000 Santa Cruz», 17/04/1982, 44 años, título «Cardióloga»; «Especialidades» con Cardiología y Medicina Interna en tarjetas iguales con «Verificado»; «Estado de habilitación» Verificado; presentación; «Cambiar contraseña» y «Mis artículos». Sin «Estado de la práctica» ni «Correo de acceso». Datos a dos columnas. | OK: D-01, D-02, H2.S1.M4, #645 |
| `h2-ficha-datos-personales-escritorio-grande-claro.png` | 1920×1080 claro. El mismo contenido. Datos a dos columnas. | OK: D-01, D-02, H2.S1.M4, #645 |
| `h2-ficha-datos-personales-tableta-horizontal-claro.png` | 1024×768 claro. El mismo contenido. Datos a dos columnas. | OK: D-01, D-02, H2.S1.M4, #645 |
| `h2-ficha-datos-personales-tableta-claro.png` | 768×1024 claro. El mismo contenido. Una columna; tira de pestañas con flechas. | OK: D-01, D-02, H2.S1.M4, #645 |
| `h2-ficha-datos-personales-movil-claro.png` | 390×844 claro. El mismo contenido. Una columna; las especialidades como filas iguales con el sello a la derecha. | OK: D-01, D-02, H2.S1.M4, #645 |
| `h2-ficha-datos-personales-escritorio-oscuro.png` | 1440×900 oscuro. El mismo contenido. Datos a dos columnas. Legible; «Panel» tenue en las migas (N4-08, ajeno). | OK: D-01, D-02, H2.S1.M4, #645 |
| `h2-ficha-datos-personales-escritorio-grande-oscuro.png` | 1920×1080 oscuro. El mismo contenido. Datos a dos columnas. Legible; «Panel» tenue en las migas (N4-08, ajeno). | OK: D-01, D-02, H2.S1.M4, #645 |
| `h2-ficha-datos-personales-tableta-horizontal-oscuro.png` | 1024×768 oscuro. El mismo contenido. Datos a dos columnas. Legible; «Panel» tenue en las migas (N4-08, ajeno). | OK: D-01, D-02, H2.S1.M4, #645 |
| `h2-ficha-datos-personales-tableta-oscuro.png` | 768×1024 oscuro. El mismo contenido. Una columna; tira de pestañas con flechas. Legible; «Panel» tenue en las migas (N4-08, ajeno). | OK: D-01, D-02, H2.S1.M4, #645 |
| `h2-ficha-datos-personales-movil-oscuro.png` | 390×844 oscuro. El mismo contenido. Una columna; las especialidades como filas iguales con el sello a la derecha. Legible; «Panel» tenue en las migas (N4-08, ajeno). | OK: D-01, D-02, H2.S1.M4, #645 |

## Ficha «Mi perfil», pestaña Contacto — H2.S3.M2 · D-03 · #645

| Captura | Qué se ve | Juicio |
|---|---|---|
| `h2-ficha-contacto-escritorio-claro.png` | 1440×900 claro. Pestaña «Contacto»: Correo personal · **Correo de trabajo** valeria-rojas@alovida.mock · Celular personal · Municipio de residencia · Domicilio con «Ver en el mapa». Ningún teléfono del trabajo. | OK: D-03, #645, H2.S3.M2 |
| `h2-ficha-contacto-escritorio-grande-claro.png` | 1920×1080 claro. Los mismos cinco renglones; ningún teléfono del trabajo. | OK: D-03, #645, H2.S3.M2 |
| `h2-ficha-contacto-tableta-horizontal-claro.png` | 1024×768 claro. Los mismos cinco renglones; ningún teléfono del trabajo. | OK: D-03, #645, H2.S3.M2 |
| `h2-ficha-contacto-tableta-claro.png` | 768×1024 claro. Los mismos cinco renglones; ningún teléfono del trabajo. | OK: D-03, #645, H2.S3.M2 |
| `h2-ficha-contacto-movil-claro.png` | 390×844 claro. Los mismos cinco renglones; ningún teléfono del trabajo. Una columna. | OK: D-03, #645, H2.S3.M2 |
| `h2-ficha-contacto-escritorio-oscuro.png` | 1440×900 oscuro. Pestaña «Contacto»: Correo personal · **Correo de trabajo** valeria-rojas@alovida.mock · Celular personal · Municipio de residencia · Domicilio con «Ver en el mapa». Ningún teléfono del trabajo. | OK: D-03, #645, H2.S3.M2 |
| `h2-ficha-contacto-escritorio-grande-oscuro.png` | 1920×1080 oscuro. Los mismos cinco renglones; ningún teléfono del trabajo. | OK: D-03, #645, H2.S3.M2 |
| `h2-ficha-contacto-tableta-horizontal-oscuro.png` | 1024×768 oscuro. Los mismos cinco renglones; ningún teléfono del trabajo. | OK: D-03, #645, H2.S3.M2 |
| `h2-ficha-contacto-tableta-oscuro.png` | 768×1024 oscuro. Los mismos cinco renglones; ningún teléfono del trabajo. | OK: D-03, #645, H2.S3.M2 |
| `h2-ficha-contacto-movil-oscuro.png` | 390×844 oscuro. Los mismos cinco renglones; ningún teléfono del trabajo. Una columna. | OK: D-03, #645, H2.S3.M2 |

## Ficha «Mi perfil», pestaña Trayectoria — #644 · #650

| Captura | Qué se ve | Juicio |
|---|---|---|
| `h2-ficha-trayectoria-escritorio-claro.png` | 1440×900 claro. «Trayectoria»: Actividad actual (Consultorio Rojas y Clínica Los Olivos «En curso»), Experiencia histórica (Hospital Japonés) y «Corregir o retirar» con Editar/Retirar; «Añadir elemento a tu historial». Sin los títulos (viven en Credenciales). El aviso de 3 s de la pestaña ya se fue. | OK: #644, #650 |
| `h2-ficha-trayectoria-escritorio-grande-claro.png` | 1920×1080 claro. Igual; sin aviso encima. | OK: #644, #650 |
| `h2-ficha-trayectoria-tableta-horizontal-claro.png` | 1024×768 claro. Igual; sin aviso encima. | OK: #644, #650 |
| `h2-ficha-trayectoria-tableta-claro.png` | 768×1024 claro. Igual; sin aviso encima. | OK: #644, #650 |
| `h2-ficha-trayectoria-movil-claro.png` | 390×844 claro. Igual; sin aviso encima. Editar y Retirar bajan debajo de cada fila. | OK: #644, #650 |
| `h2-ficha-trayectoria-escritorio-oscuro.png` | 1440×900 oscuro. «Trayectoria»: Actividad actual (Consultorio Rojas y Clínica Los Olivos «En curso»), Experiencia histórica (Hospital Japonés) y «Corregir o retirar» con Editar/Retirar; «Añadir elemento a tu historial». Sin los títulos (viven en Credenciales). El aviso de 3 s de la pestaña ya se fue. | OK: #644, #650 |
| `h2-ficha-trayectoria-escritorio-grande-oscuro.png` | 1920×1080 oscuro. Igual; sin aviso encima. | OK: #644, #650 |
| `h2-ficha-trayectoria-tableta-horizontal-oscuro.png` | 1024×768 oscuro. Igual; sin aviso encima. | OK: #644, #650 |
| `h2-ficha-trayectoria-tableta-oscuro.png` | 768×1024 oscuro. Igual; sin aviso encima. | OK: #644, #650 |
| `h2-ficha-trayectoria-movil-oscuro.png` | 390×844 oscuro. Igual; sin aviso encima. Editar y Retirar bajan debajo de cada fila. | OK: #644, #650 |

## Ficha «Mi perfil», pestaña Credenciales — #644

| Captura | Qué se ve | Juicio |
|---|---|---|
| `h2-ficha-credenciales-escritorio-claro.png` | 1440×900 claro. «Credenciales» por tipo: chips Todas (6) / Verificadas (3) / Declaradas (3); Matrículas 2 (MP-2400 y SEDES-MP-2400, Activo); Títulos y formación 2 (ESP-1000, TIT-1000 «Verificada contra …»); Idiomas 2. Sin aviso encima. Las tarjetas no usan el ancho: ocupan menos de la mitad y el resto queda vacío (panel del #644, ajeno, observación 1). | OK |
| `h2-ficha-credenciales-escritorio-grande-claro.png` | 1920×1080 claro. Los mismos bloques. Las tarjetas no usan el ancho: ocupan menos de la mitad y el resto queda vacío (panel del #644, ajeno, observación 1). | OK |
| `h2-ficha-credenciales-tableta-horizontal-claro.png` | 1024×768 claro. Los mismos bloques. Dos columnas que llenan el ancho. | OK |
| `h2-ficha-credenciales-tableta-claro.png` | 768×1024 claro. Los mismos bloques. Dos columnas que llenan el ancho. | OK |
| `h2-ficha-credenciales-movil-claro.png` | 390×844 claro. Los mismos bloques. Una columna. | OK |
| `h2-ficha-credenciales-escritorio-oscuro.png` | 1440×900 oscuro. «Credenciales» por tipo: chips Todas (6) / Verificadas (3) / Declaradas (3); Matrículas 2 (MP-2400 y SEDES-MP-2400, Activo); Títulos y formación 2 (ESP-1000, TIT-1000 «Verificada contra …»); Idiomas 2. Sin aviso encima. Las tarjetas no usan el ancho: ocupan menos de la mitad y el resto queda vacío (panel del #644, ajeno, observación 1). | OK |
| `h2-ficha-credenciales-escritorio-grande-oscuro.png` | 1920×1080 oscuro. Los mismos bloques. Las tarjetas no usan el ancho: ocupan menos de la mitad y el resto queda vacío (panel del #644, ajeno, observación 1). | OK |
| `h2-ficha-credenciales-tableta-horizontal-oscuro.png` | 1024×768 oscuro. Los mismos bloques. Dos columnas que llenan el ancho. | OK |
| `h2-ficha-credenciales-tableta-oscuro.png` | 768×1024 oscuro. Los mismos bloques. Dos columnas que llenan el ancho. | OK |
| `h2-ficha-credenciales-movil-oscuro.png` | 390×844 oscuro. Los mismos bloques. Una columna. | OK |

## Editor «Configurar tu perfil», pestaña Datos personales — #645 · N4-36

| Captura | Qué se ve | Juicio |
|---|---|---|
| `h2-editor-datos-personales-escritorio-claro.png` | 1440×900 claro. Editor, «Datos personales»: tres nombres, apellidos, fecha, título profesional con su aviso, Biografía con su texto entero (244/4000), telemedicina, «Tu documento», la línea de corte y «Tus especialidades cargadas» con la nota «Cada una se guarda al agregarla, sin pasar por «Guardar cambios»…»; barra (Especialidad · Estado · Agregar especialidad); Cardiología y Medicina Interna con «Verificada: ya no se corrige»; paginador; pie «Cancelar edición / Guardar cambios». **Sin «Correo de acceso».** | OK: #645, N4-36, N4-02 |
| `h2-editor-datos-personales-escritorio-grande-claro.png` | 1920×1080 claro. El mismo contenido; sin «Correo de acceso». | OK: #645, N4-36, N4-02 |
| `h2-editor-datos-personales-tableta-horizontal-claro.png` | 1024×768 claro. El mismo contenido; sin «Correo de acceso». | OK: #645, N4-36, N4-02 |
| `h2-editor-datos-personales-tableta-claro.png` | 768×1024 claro. El mismo contenido; sin «Correo de acceso». Barra apilada; estado debajo del nombre con ▼. | OK: #645, N4-36, N4-02 |
| `h2-editor-datos-personales-movil-claro.png` | 390×844 claro. El mismo contenido; sin «Correo de acceso». Barra apilada; estado debajo del nombre con ▼. | OK: #645, N4-36, N4-02 |
| `h2-editor-datos-personales-escritorio-oscuro.png` | 1440×900 oscuro. Editor, «Datos personales»: tres nombres, apellidos, fecha, título profesional con su aviso, Biografía con su texto entero (244/4000), telemedicina, «Tu documento», la línea de corte y «Tus especialidades cargadas» con la nota «Cada una se guarda al agregarla, sin pasar por «Guardar cambios»…»; barra (Especialidad · Estado · Agregar especialidad); Cardiología y Medicina Interna con «Verificada: ya no se corrige»; paginador; pie «Cancelar edición / Guardar cambios». **Sin «Correo de acceso».** | OK: #645, N4-36, N4-02 |
| `h2-editor-datos-personales-escritorio-grande-oscuro.png` | 1920×1080 oscuro. El mismo contenido; sin «Correo de acceso». | OK: #645, N4-36, N4-02 |
| `h2-editor-datos-personales-tableta-horizontal-oscuro.png` | 1024×768 oscuro. El mismo contenido; sin «Correo de acceso». | OK: #645, N4-36, N4-02 |
| `h2-editor-datos-personales-tableta-oscuro.png` | 768×1024 oscuro. El mismo contenido; sin «Correo de acceso». Barra apilada; estado debajo del nombre con ▼. | OK: #645, N4-36, N4-02 |
| `h2-editor-datos-personales-movil-oscuro.png` | 390×844 oscuro. El mismo contenido; sin «Correo de acceso». Barra apilada; estado debajo del nombre con ▼. | OK: #645, N4-36, N4-02 |

## Editor «Configurar tu perfil», pestaña Contacto — D-03 · #645

| Captura | Qué se ve | Juicio |
|---|---|---|
| `h2-editor-contacto-escritorio-claro.png` | 1440×900 claro. Editor, «Contacto»: mapa de departamentos con límites de provincia, Localidad, Dirección («Tu domicilio particular.»), mapa con «Provincia Andrés Ibáñez · Santa Cruz» y aviso de calle, Dirección del trabajo con «Usar mi ubicación» / «Marcar tu lugar de trabajo», Celular personal, Correo personal y **Correo de trabajo** editable («El que se muestra en tu perfil. No cambia el correo con el que entrás.»). Sin celular ni fijo del trabajo. En claro el punto del mapa es un círculo blanco casi invisible sobre el plano (N2-14, ajeno). | OK: #645, D-03 |
| `h2-editor-contacto-escritorio-grande-claro.png` | 1920×1080 claro. El mismo contenido; correo de trabajo editable; sin teléfonos del trabajo. En claro el punto del mapa es un círculo blanco casi invisible sobre el plano (N2-14, ajeno). | OK: #645, D-03 |
| `h2-editor-contacto-tableta-horizontal-claro.png` | 1024×768 claro. El mismo contenido; correo de trabajo editable; sin teléfonos del trabajo. En claro el punto del mapa es un círculo blanco casi invisible sobre el plano (N2-14, ajeno). El correo de trabajo va en su propio renglón. | OK: #645, D-03 |
| `h2-editor-contacto-tableta-claro.png` | 768×1024 claro. El mismo contenido; correo de trabajo editable; sin teléfonos del trabajo. En claro el punto del mapa es un círculo blanco casi invisible sobre el plano (N2-14, ajeno). | OK: #645, D-03 |
| `h2-editor-contacto-movil-claro.png` | 390×844 claro. El mismo contenido; correo de trabajo editable; sin teléfonos del trabajo. En claro el punto del mapa es un círculo blanco casi invisible sobre el plano (N2-14, ajeno). | OK: #645, D-03 |
| `h2-editor-contacto-escritorio-oscuro.png` | 1440×900 oscuro. Editor, «Contacto»: mapa de departamentos con límites de provincia, Localidad, Dirección («Tu domicilio particular.»), mapa con «Provincia Andrés Ibáñez · Santa Cruz» y aviso de calle, Dirección del trabajo con «Usar mi ubicación» / «Marcar tu lugar de trabajo», Celular personal, Correo personal y **Correo de trabajo** editable («El que se muestra en tu perfil. No cambia el correo con el que entrás.»). Sin celular ni fijo del trabajo. | OK: #645, D-03 |
| `h2-editor-contacto-escritorio-grande-oscuro.png` | 1920×1080 oscuro. El mismo contenido; correo de trabajo editable; sin teléfonos del trabajo. | OK: #645, D-03 |
| `h2-editor-contacto-tableta-horizontal-oscuro.png` | 1024×768 oscuro. El mismo contenido; correo de trabajo editable; sin teléfonos del trabajo. El correo de trabajo va en su propio renglón. | OK: #645, D-03 |
| `h2-editor-contacto-tableta-oscuro.png` | 768×1024 oscuro. El mismo contenido; correo de trabajo editable; sin teléfonos del trabajo. | OK: #645, D-03 |
| `h2-editor-contacto-movil-oscuro.png` | 390×844 oscuro. El mismo contenido; correo de trabajo editable; sin teléfonos del trabajo. | OK: #645, D-03 |

## Insignias, Credenciales del editor, alta y PATCH — D-01 · N4-02 · H2.S3.M6

| Captura | Qué se ve | Juicio |
|---|---|---|
| `h2-insignias-ficha.png` | 1440 claro, ficha en «Datos personales»: las dos especialidades en tarjetas iguales, sin marca de principal ni de certificada; sin avisos encima (rehecha: la primera toma salió con los avisos de las pestañas recorridas). | OK: D-01, N2-01 |
| `h2-insignias-editor.png` | Recorte de «Tus especialidades cargadas» del editor: Cardiología y Medicina Interna «Verificada», con la nota; sin «principal» (registro L68). | OK: D-01, N4-02 |
| `h2-editor-credenciales-escritorio-claro.png` | Editor, «Credenciales»: matrículas (MP-2400 con «Descargar» con ícono y «Activo: ya no se corrige»; SEDES-MP-2400 con la nota) y, debajo, «Tus títulos cargados» (ESP-1000 con la nota; TIT-1000 con «Descargar» con ícono y la nota en dos renglones, N2-34). | OK: #644, N4-02, H4.S3.M7 |
| `h2-insignias-perfil-publico.png` | /p/valeria-rojas: chips Cardiología y Medicina Interna sin marca; trayectoria, dónde atiende con mapa; «No pudimos traer las opiniones» (simulador). | OK: D-01 |
| `h2-insignias-directorio-detalle-paciente.png` | Guía, detalle de la médica (paciente): las dos especialidades con «Verificado», iguales, apiladas en columna (N2-30); sin «principal». | OK: D-01 |
| `h2-insignias-directorio-lista-paciente.png` | Guía, lista (paciente): rejilla de especialidades con su cantidad de médicos. | OK |
| `h2-alta-especialidades.png` | Alta del médico, paso 13 de 14: «Hasta cuatro…», dos casillas de especialidad, sin «principal». | OK: D-01, L0174 |
| `h2-patch-antes-de-guardar.png` | Editor, «Contacto», con el celular personal cambiado antes de guardar; el PATCH lleva sólo `mobilePhone` (registro L80). | OK: H2.S3.M6 |

## Observaciones (no son defecto de este cambio)

1. A 1440 y 1920, «Credenciales» de la ficha deja las tarjetas en menos de la mitad del ancho (panel de credenciales del #644). MENOR, ajeno.
2. En claro, el punto del mapa de «Contacto» casi no se ve (N2-14, mapa compartido). Ajeno, ya registrado.
3. «Panel» se lee tenue en las migas en oscuro (N4-08). Ajeno, ya registrado.
4. La pastilla «Demo» asoma sobre el encabezado a 390 y 768: es de la maqueta.

## Resumen

68 capturas abiertas y juzgadas: **68 OK** y **0 con DEFECTO** del cambio. Consola: 1 error y red: 7 fallos, los mismos de siempre (el PATCH contra la API real, que falla a propósito, y seis teselas del mapa abortadas; `consola-red-h2.txt`).
