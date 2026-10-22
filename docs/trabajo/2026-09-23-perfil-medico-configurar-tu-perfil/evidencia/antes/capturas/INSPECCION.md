# Capturas previas (H1.S2.M1), miradas una por una — 2026-09-23

Tema claro. `escritorio` = 1440×1000, `movil` = 390×900, página completa. Artefacto común a las de página completa: el lateral fijo y la barra superior se repiten a media altura (es la captura, no la pantalla).

| Captura | Qué se ve | Juicio |
|---|---|---|
| `01-ficha-datos-personales-escritorio.png` | Ficha «Mi perfil», pestaña Datos personales: nombre, código, documento, edad, título profesional, dos especialidades en tarjetas (Cardiología marcada PRINCIPAL, ambas Verificado), habilitación, presentación, botones «Cambiar contraseña» y «Mis artículos». | OK — punto de partida de H2 (correo de acceso, sexo al nacer, etc.) |
| `01-ficha-datos-personales-movil.png` | Lo mismo a una columna; pestañas con flechas de desplazamiento; tarjetas de especialidad apiladas. | OK, sin desborde |
| `02-ficha-contacto-escritorio.png` | Pestaña Contacto: correo de trabajo y personal, tres teléfonos, municipio, domicilio con «Ver en el mapa». | OK |
| `02-ficha-contacto-movil.png` | Contacto a una columna. | OK |
| `03-editor-trayectoria-escritorio.png` | Editor, Trayectoria: formulario «Agregar formación» + tabla «Tu trayectoria cargada» con dos títulos verificados sin acciones («Verificado: ya no se corrige», uno con «Descargar»). | OK — estado de partida de H3 |
| `03-editor-trayectoria-movil.png` | Formulario a una columna; **«Agregar título» queda antes de la zona de adjuntar**; la tabla se corta a la derecha. | Observación previa (H4.S3 / paginated-form) |
| `04-editor-credenciales-escritorio.png` | Editor, Credenciales: especialidades (Cardiología «Principal», Medicina Interna «Marcar como principal», ambas con Editar/Retirar) y matrículas (dos, Activo, Editar/Descargar/Retirar). | OK — estado de partida de H4 |
| `04-editor-credenciales-movil.png` | Igual a una columna; **«Agregar matrícula» antes de «Autoridad que la emitió»**; tablas cortadas a la derecha. | Observación previa |
| `05-editar-titulo-sin-tocar.png` | Modal «Editar Título universitario» recién abierto; «Guardar cambios» primario y habilitado sin haber tocado nada. | Confirma M2 = SÍ |
| `05b-editar-especialidad-sin-tocar.png` | Modal «Editar Cardiología» (select + interruptor «Certificada por el colegio o consejo»); «Guardar cambios» habilitado. | Confirma M2 = SÍ |
| `05c-editar-matricula-sin-tocar.png` | Modal «Editar MP-2400» (número, autoridad, fecha); «Guardar cambios» habilitado. | Confirma M2 = SÍ |
| `06-retirar-titulo.png` | Diálogo «Retirar este título» con Cancelar/Retirar sobre la tabla con el título pendiente de prueba. | Confirma M3: confirma |
| `06-retirar-especialidad.png` | Diálogo «Retirar esta especialidad · ¿Retirar «Cardiología»?». | Confirma M3: confirma |
| `06-retirar-matricula.png` | Diálogo «Retirar esta matrícula · ¿Retirar «MP-2400»?». | Confirma M3: confirma |
| `07-principal-ficha.png` | Ficha con la insignia PRINCIPAL en Cardiología. | Insignia: sí |
| `07-principal-directorio-detalle.png` | **Panel del médico**: `/directory/<id>` redirigió por el guard de rol. | No vale para M4; ver `-paciente` |
| `07-principal-directorio-lista.png` | En blanco: el redirect del guard capturado a mitad de camino. | No vale; ver `-paciente` |
| `07-principal-directorio-lista-paciente.png` | «Directorio de médicos»: portada de especialidades con conteos; no lista médicos. | Insignia: no aplica |
| `07-principal-directorio-detalle-paciente.png` | Ficha de la guía de Valeria Rojas Mendoza: `Cardiología ✓ PRINCIPAL · Verificado`, Medicina Interna, actividad, trayectoria, formación, agenda. | Insignia: sí |
| `07-principal-perfil-publico.png` | `/p/valeria-rojas`: cabecera, «Especialidades» como chips sin marca, trayectoria, sedes, publicaciones; caja «Opiniones» en error «No pudimos traer las opiniones». | Insignia: **no** · error previo de opiniones |
