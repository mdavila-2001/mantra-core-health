# Comportamiento previo, ejercitado (H1.S2) — 2026-09-23

Corte `b7785e36`, sin ningún cambio de código. Cuenta sintética `medica@alovida.mock` (y `paciente@alovida.mock` para la guía, que está cerrada al rol médico por `seccionRolesGuard`, `app.routes.ts:617`). Salida literal en `capturas-antes.txt` y `capturas-antes-paciente.txt`; guiones `capturas-antes.mjs` y `capturas-antes-paciente.mjs`.

| Pregunta | Respuesta observada | Captura |
|---|---|---|
| ¿«Guardar cambios» del modal se habilita **sin** tocar nada? | **SÍ**, en los tres modales. «Editar» abre un modal («Editar Título universitario», «Editar Cardiología», «Editar MP-2400») con «Guardar cambios» como botón primario habilitado sin que se haya modificado ningún campo. | `capturas/05-editar-titulo-sin-tocar.png` · `05b-editar-especialidad-sin-tocar.png` · `05c-editar-matricula-sin-tocar.png` |
| ¿Los tres «Retirar» (título, especialidad, matrícula) confirman? | **SÍ, los tres.** Aparece un diálogo de confirmación con título y texto propios («Retirar este título · ¿Retirar «Título universitario · TIT-PRUEBA-H1»? No se puede deshacer desde acá.» / «Retirar esta especialidad · ¿Retirar «Cardiología»?…» / «Retirar esta matrícula · ¿Retirar «MP-2400»?…»), botones «Cancelar» y «Retirar» (danger). Cancelado en los tres casos: las filas no cambiaron. | `capturas/06-retirar-titulo.png` · `06-retirar-especialidad.png` · `06-retirar-matricula.png` |
| ¿Dónde se ve la insignia «principal» hoy? | **Ficha** (`/my-account`, pestaña Datos personales): sí, `Cardiología ✓ PRINCIPAL` en la rejilla de especialidades (`.specialty-badge__principal` = 1). **Editor** (`/my-account/edit`, Credenciales): sí, columna «Tipo» con un `app-badge` «Principal» y «Marcar como principal» en la otra fila. **Guía, detalle** (`/directory/<id>`, sesión paciente): sí, misma insignia (`.specialty-badge__principal` = 1). **Guía, lista** (`/directory`): es una portada por especialidad, no lista médicos; no aplica. **Perfil público** (`/p/valeria-rojas`): **no**, las especialidades son chips «Cardiología» «Medicina Interna» sin marca de principal (0). | `capturas/07-principal-ficha.png` · `04-editor-credenciales-escritorio.png` · `07-principal-directorio-detalle-paciente.png` · `07-principal-directorio-lista-paciente.png` · `07-principal-perfil-publico.png` |

## Lo que hizo falta para ejercitar

- Los dos títulos del mock están **verificados**, y en ese estado la tabla de Trayectoria no ofrece «Editar» ni «Retirar» (dice «Verificado: ya no se corrige»; `practitioner-profile-edit.html:842`). Para M2 y M3 se agregó un título pendiente desde el propio formulario («Título universitario · TIT-PRUEBA-H1»), que quedó con «Editar» y «Retirar». Vive sólo en el simulador de esa sesión del navegador.
- Especialidades y matrículas **sí** ofrecen «Editar» y «Retirar» aunque estén verificadas/activas. Asimetría previa entre las tres tablas; se anota, no se corrige acá.
- `/directory/<id>` con la sesión de la médica redirige al Panel (guard de rol): la captura `07-principal-directorio-detalle.png` muestra ese redirect, y la `-paciente` es la que vale.

## Otras observaciones previas (fuera de alcance salvo que un hito las nombre)

- Perfil público: la caja «Opiniones» muestra «No pudimos traer las opiniones · Reintentar» con la maqueta; sin respuesta ≥ 400 en red ni error en consola.
- Editor a 390 px: el botón «Agregar título» / «Agregar matrícula» se dibuja **antes** de la zona de adjuntar archivo (y antes de «Autoridad que la emitió» en matrícula), y las tres tablas se cortan a la derecha (scroll horizontal interno). Territorio de H4.S3 (tablas) y del `paginated-form`; queda registrado como estado de partida.
