# Material de comunicación de AloVida

Dos piezas hechas con el frontend de este repositorio. **El video no usa capturas: usa el
frontend.** `extraer-pantallas.mjs` congela el DOM y las hojas de estilo de cada pantalla —lo que
sirve la aplicación, sin una caja dibujada a mano— y `video.html` las monta en iframes y las
**anima**: escribe en los campos reales, revela las tarjetas reales, abre el menú real y cambia el
estado de un cobro con las clases del propio sistema de diseño. El mazo sí son capturas quietas de
esa misma maqueta.

| Pieza | Archivo | Salida |
|---|---|---|
| **Video** | `video.html` + `extraer-pantallas.mjs` | `alovida-1080p.mp4` (92 s · 1920×1080 · 30 fps · sin audio), 720p y portada |
| **Mazo de paciente y médico** | `deck-paciente-y-medico.html` | `AloVida-modulos-paciente-medico.pdf` (15 láminas 16:9) y un PNG por lámina |
| Tokens de marca | `marca.css` | del mazo y de los rótulos del video |
| Artboards de Claude Design | `a-canvas.mjs` | un `.dc.html` por pantalla, con el mismo HTML y CSS |

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

Esas capturas alimentan **el mazo**. El video no las usa: trabaja sobre el DOM congelado, apunta a
los elementos por selector —`.tipos__card`, `.turnos__horario`, `app-menu.menu--open`— y posiciona
el puntero con el `getBoundingClientRect()` del elemento real. Si una pantalla cambia, el video
cambia con ella o falla; no hay coordenadas escritas a ojo.

## El canvas de Claude Design

`a-canvas.mjs` convierte esas mismas pantallas congeladas en artboards `.dc.html` —el mismo HTML y
el mismo CSS, con las tipografías incrustadas porque el lienzo no sale a la red— para revisarlas y
exportarlas fuera del video.

Las direcciones que dependen de datos —el perfil público, la consulta— se resuelven navegando, no
con identificadores escritos a mano, para que sobrevivan a un cambio de semillas.

## El video

| Tramo | Qué se ve |
|---|---|
| 00 · Marca | Logotipo y claim. |
| 01 · Registro | Las cinco tarjetas de cuenta aparecen, el puntero elige «Médico» y el alta del profesional **se escribe**: nombre y apellido, en sus campos reales. |
| 02 · El paciente pide turno | Se teclea el nombre del profesional en el buscador real, aparecen los horarios y el puntero pide uno; después, «Mis citas» con sus estados. |
| 03 · La agenda y el cobro | La tabla del día entra fila por fila, se abre el **menú real** de la columna «Pago» y al elegir «Pagada» el badge pasa de ámbar a verde: `badge--warning` → `badge--success`, las clases del propio sistema de diseño. |
| 04 · La consulta | Las nueve casillas de lo que se registra, y el puntero abre «Diagnóstico». |
| 05 · La red social | La publicación se **escribe** en el compositor real, el botón se habilita, se publica y el post aparece en el muro. |
| 06 · Los directorios | Las especialidades de la red y las clínicas por departamento, entrando en cascada. |
| 07 · Cierre | Marca y los cuatro atributos. |

Nada de eso está redibujado: el DOM es el de la aplicación y la animación se limita a mover
opacidad, desplazamiento y clases sobre él.

`video.html` no usa animaciones de CSS: declara pistas `{t0, t1, función}` y **cada fotograma es
función pura de `t`** (`window.__seek(t)`). El generador levanta un servidor mínimo —los iframes
tienen que ser del mismo origen para que el escenario pueda escribir en los campos de las
pantallas—, mueve la página fotograma a fotograma, fotografía y encadena con ffmpeg. De ahí salen tres propiedades que importan:

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
