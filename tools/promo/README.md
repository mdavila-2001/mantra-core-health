# Material de comunicación de AloVida

Dos piezas hechas con **capturas de la maqueta andando**: el video las mueve —zoom, recuadros,
cursor— y el mazo las muestra quietas. Ninguna de las dos dibuja pantallas a mano.

| Pieza | Archivo | Salida |
|---|---|---|
| **Video** | `video.html` | `alovida-1080p.mp4` (90 s · 1920×1080 · 30 fps · sin audio), 720p y portada |
| **Mazo de paciente y médico** | `deck-paciente-y-medico.html` | `AloVida-modulos-paciente-medico.pdf` (15 láminas 16:9) y un PNG por lámina |
| Tokens de marca | `marca.css` | compartido por las dos |

```bash
yarn start                                   # las dos piezas necesitan la maqueta levantada
node tools/promo/generar.mjs --solo-deck     # PDF + PNG (rápido, sin ffmpeg)

brew install ffmpeg                          # una vez; sólo lo necesita el video
node tools/promo/generar.mjs --solo-video    # MP4 1080p, 720p y portada
node tools/promo/generar.mjs                 # las dos
node tools/promo/generar.mjs --base http://localhost:4300
```

Todo sale a `artifacts/promo/`, que está en `.gitignore`.

## Las capturas

El generador entra al simulador como `paciente@alovida.mock`, `medica@alovida.mock` y
`superadmin@alovida.mock` —cualquier contraseña no vacía sirve—, recorre trece pantallas, oculta el
cartel flotante del modo demostración y fotografía a 2× de densidad:

| Captura | Pantalla | Cómo se llega |
|---|---|---|
| `reg-tipos`, `reg-medico` | Crear cuenta y alta del profesional | `/auth/register`, sin sesión |
| `paciente-agendar`, `paciente-mis-citas` | Pedir turno y mis citas | eligiendo profesional para que aparezcan los horarios |
| `paciente-resultados` | Mis resultados | `/my-account/diagnostic-results` |
| `medico-consultas`, `medico-pago` | Agenda y estado del pago | `/schedule`, con el menú de la columna «Pago» abierto |
| `medico-consulta`, `medico-diagnostico` | Consulta y nuevo diagnóstico | desde la agenda, con «Continuar consulta» |
| `medico-servicios`, `medico-contabilidad` | Precios y libros | `/my-services`, `/administration/accounting` |
| `social-muro`, `social-perfil`, `social-chats`, `social-directorios` | Red social | muro, perfil del directorio, chat abierto, índice de directorios |
| `directorio-medicos`, `directorio-clinicas` | Directorios | especialidades de la red; clínicas y hospitales por departamento |
| `seguros-solicitudes` | Lo presentado a cada aseguradora | `/administration/insurance-claims` |

**El muro se llena publicando de verdad**, con la propia pantalla, antes de la foto: el texto habla
del arancel odontológico 2026 y de sus especialidades —datos de los catálogos de
`markdown_convertidos/`—, firmado por una persona de la maqueta.

Además escribe **`regiones.js`**: dónde está, en porcentaje de cada imagen, lo que el video resalta
—la tarjeta «Médico», el botón «Pedir este horario», la columna «Pago», el texto del catálogo
CIE-10…—. Se mide con `boundingBox()` en el momento de la captura, así que los recuadros del video
**no son coordenadas escritas a ojo**: si la pantalla cambia de sitio, el recuadro la sigue, y si el
elemento desaparece el generador falla en vez de resaltar el vacío.

Las direcciones que dependen de datos —el perfil público, la consulta— se resuelven navegando, no
con identificadores escritos a mano, para que sobrevivan a un cambio de semillas.

## El video

| Tramo | Qué se ve |
|---|---|
| 00 · Marca | Logotipo y claim. |
| 01 · Registro | Los cinco tipos de cuenta y el alta del profesional, con sus trece pasos. |
| 02 · El paciente pide turno | Busca al profesional, elige sede y pide el horario; la cita queda con su estado. |
| 03 · La agenda del médico | Las que esperan respuesta encabezan la lista; motivo, seguro, estado y pago en la misma fila. |
| 04 · La consulta | Qué se registra durante la consulta, con lo que ya hay en la historia. |
| 05 · El cobro | El menú del estado de pago, sin salir de la agenda. |
| 06 · La red social | El muro profesional —con una publicación hecha durante la captura— y el perfil público con su matrícula verificada. |
| 07 · Los directorios | Las especialidades de la red y las clínicas y hospitales por departamento. |
| 08 · Cierre | Marca y los cuatro atributos. |

`video.html` no usa animaciones de CSS: declara pistas `{t0, t1, función}` y **cada fotograma es
función pura de `t`** (`window.__seek(t)`). El generador mueve la página fotograma a fotograma,
fotografía y encadena con ffmpeg. De ahí salen tres propiedades que importan:

- la fluidez no depende de la velocidad de la máquina;
- dos corridas dan el mismo video;
- se puede inspeccionar cualquier instante: abrí `artifacts/promo/video.html` y ejecutá
  `__seek(42.5)` en la consola; con `video.html?play` se reproduce en vivo y en bucle.

El ffmpeg que trae Playwright **no sirve**: está compilado sólo con VP8/WebM (`--disable-everything`),
así que no puede escribir H.264. El mazo no lo necesita.

## Qué es y qué no es

Todo lo que se ve es la **maqueta con `mockBackend: true`**: datos de demostración, no de un cliente.
Sirve para mostrar el producto, no como evidencia de funcionamiento —para eso están Playwright y
`evidencias/`—.

Tres detalles que conviene conocer antes de proyectar:

- el autor de las publicaciones del muro figura como «Perfil \<id\>»: el simulador todavía no
  resuelve ese nombre;
- el compositor del muro avisa que **no se pueden adjuntar imágenes**;
- el catálogo de aseguradoras de la maqueta usa **nombres de compañías reales** de Bolivia, y
  aparecen en la pantalla de solicitudes de seguro. Son datos de prueba, no clientes.

**Lo que nunca entra**: los archivos `USUARIO_PACIENTES_*.md` y `USUARIO_MEDICOS_*.md` de
`markdown_convertidos/` traen personas reales con cédula, teléfono, correo y domicilio. No se usan
en material promocional. Los catálogos sin datos personales de esa misma carpeta —aseguradoras,
clínicas, especialidades, aranceles— sí son la referencia de lo que el producto dice soportar.
