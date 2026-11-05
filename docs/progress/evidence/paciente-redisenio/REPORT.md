# Rediseño del frontend del paciente — 22/10/2026

Pedido: experiencia sencilla, autoexplicativa y entretenida para personas a las que les
cuesta la tecnología y se aburren rápido. Sin quitar funciones y sin tocar el logo. Upgrade
estético que se note, con captura de antes y después de cada pantalla.

Base: `origin/mockup` (877ef4b68). Se revisó `origin/test` en los archivos tocados para no
introducir regresiones al integrar (ver «Compatibilidad con `test`»).

## Qué cambia

| # | Cambio | Dónde |
|---|---|---|
| 1 | **Portada del inicio**: saludo según la hora con el nombre de pila («Buenos días, Ana Lucía»), fecha en palabras, ilustración propia (corazón con latido, no el logo) y botón grande «Conozca AloVida en 1 minuto» mientras no se haya hecho el recorrido | `patient-home.html`, `styles/paciente.css` |
| 2 | **Recorrido guiado del paciente** (7 pasos: Emergencia, ¿Cómo se siente?, próxima cita, menú, atajos, Tutoriales) sobre el motor de tutoriales existente. El de `bienvenida` apuntaba a piezas de staff y se saltaba casi entero con sesión de paciente | `core/tutorials/definitions/index.ts` |
| 3 | **Primeros pasos**: lista de 6 con barra de avance, el siguiente resaltado y latiendo, medalla y chispas al completar, ocultable al final. Empieza con un paso hecho | `patient-home/first-steps/` |
| 4 | **«¿Sabía que…?»**: un consejo por día sobre cómo usar la app, con «Otro consejo». Sólo funciones que existen; ninguno es consejo médico | `patient-home/patient-tip/`, `patient-home.copy.ts` |
| 5 | **Atajos con nombre** en la cabecera: los 9 íconos mudos llevan su palabra debajo (≥1280 px); entre 641 y 1279 px se agrupan en «Más» con palabras | `styles/paciente.css` |
| 6 | **Capa visual del paciente en todas sus pantallas**: encabezado como cinta de color, tarjetas redondeadas con sombra suave, botones en píldora, pestañas más grandes, menú lateral un escalón más legible | `styles/paciente.css` |
| 7 | Próxima cita como banda con color propio y la fecha en tamaño titular; última receta y atención como tarjetas con ícono de color | `styles/paciente.css` |

Nada se quitó: síntomas sigue primero (decisión C5), la próxima cita, receta, atención y
beneficios del seguro siguen; la grilla de accesos que el doctor pidió quitar el 22/09 **no**
vuelve. La escala tipográfica global no cambia (el propietario la bajó el 18/09).

Todo cuelga de `.app-shell--paciente`, que el armazón pone sólo con sesión de paciente.
`styles/paciente.css` se compila sin inyectar (`inject: false`) y el armazón pone el `<link>`
sólo para el paciente: el resto de los roles no lo descarga y el paquete inicial queda dentro
del presupuesto de 1,5 MB.

## Evidencia

Capturas reproducibles con `node playwright/paciente-redisenio-capturas.mjs --base <url> --out <carpeta>`
(antes contra un worktree limpio de `origin/mockup` en :4301, después contra esta rama en :4300).

| Pantalla | Antes | Después |
|---|---|---|
| Inicio 1440 | `antes/inicio-1440.jpg` | `despues/inicio-1440.jpg` |
| Inicio 390 | `antes/inicio-390.jpg` | `despues/inicio-390.jpg` |
| Inicio oscuro | `antes/inicio-1440-oscuro.jpg` | `despues/inicio-1440-oscuro.jpg` |
| Mis citas | `antes/mis-citas-*.jpg` | `despues/mis-citas-*.jpg` |
| Mi historia clínica (+ oscuro) | `antes/historia-*.jpg` | `despues/historia-*.jpg` |
| Farmacia | `antes/farmacia-*.jpg` | `despues/farmacia-*.jpg` |
| Mi perfil | `antes/mi-perfil-*.jpg` | `despues/mi-perfil-*.jpg` |
| Directorios / Médicos | `antes/directorios-*`, `antes/medicos-*` | `despues/…` |
| Resultados, Tutoriales, Chats | `antes/…` | `despues/…` |
| **Médica (control: no cambia)** | `antes/medica-inicio-1440.jpg` | `despues/medica-inicio-1440.jpg` — visualmente idénticas |
| Recorrido guiado, pasos 1–7 | — | `despues/recorrido-paso-N-1440.jpg` |

## Escalera de evidencia

- **RUNS**: `tsc -p tsconfig.app.json` 0 errores; `ng build` de producción OK, inicial 1,50 MB
  (base `mockup`: 1,49 MB).
- **TESTED**: dashboard + shell + tutoriales + navegación + centro de tutoriales + síntomas:
  **584/585**. El único rojo, `access-tree.spec.ts › la portada sigue en el registro`, falla
  igual en `origin/mockup` limpio (comprobado en worktree aparte): preexistente.
  Nuevas: `first-steps.store.spec.ts` (4), `first-steps-card.spec.ts` (4), `patient-home.copy.spec.ts` (3).
  `patient-home.spec.ts`: el saludo ahora se exige con el nombre de pila y **sin** apellido.
- **VERIFIED (navegador)**: `node playwright/paciente-redisenio-recorrido.mjs` → 7/7 pasos, al
  terminar desaparece el botón de la portada y el paso «Hacer el recorrido» queda hecho, 0
  errores de página. Capturas a 1440 y 390, claro y oscuro.
- `eslint` limpio en lo tocado. El `tabindex="-1"` del contenedor de atajos es el mismo que
  ya tiene `test` (corrige un error de lint preexistente).

## No verificado / pendiente

- La suite unitaria completa no se corrió (sólo las dirigidas de arriba).
- Contra la API real no se probó: es trabajo de maqueta (`mockup`), sin contrato nuevo.
- El avance de «Primeros pasos» se guarda en el navegador por cuenta (igual que el progreso
  de tutoriales): no hay módulo de preferencias en el backend.
- Al entrar por la SPA, la hoja del paciente llega un instante después del primer dibujo; bajo
  SSR va en el HTML.
- En el paso 6 del recorrido, con la página desplazada y el objetivo en la cabecera fija, la
  sombra del motor de tutoriales existente se corta a media pantalla. Es del motor, no de este
  cambio.

## Compatibilidad con `test`

En los archivos tocados `test` difiere en: tarjeta de síntomas `elevated` (adoptado igual acá),
`tabindex="-1"` en atajos (igual acá), enlace «Seguridad de la cuenta» en el menú de cuenta y
CSS de cabecera de vidrio / una fila en teléfono (no se tocan esas zonas). Los tokens
`--spring-*` de `test` se usan con valor de respaldo, así la hoja vale en las dos ramas.
