# Material de comunicación de AloVida

Material hecho con el frontend de este repositorio, no con recreaciones.

**Los videos son cuatro, uno por módulo** —paciente, médico, farmacia y aseguradora—, y cada uno graba el
**ejercicio completo manejando la aplicación de verdad**: se entra con la cuenta de la maqueta, se
escribe campo por campo —los que el layout separa van separados—, se hace clic donde hay que hacerlo
y se fotografía lo que la aplicación responde. Los módulos van por separado a propósito: cada
ejercicio se mira solo. **La marca aparece al final**, cuando el ejercicio terminó; nunca lo abre.

| Pieza | Archivo | Salida |
|---|---|---|
| **Video · paciente** | `flujos/paciente.mjs` | `alovida-flujo-paciente-1080p.mp4` (+ 720p) |
| **Video · médico** | `flujos/medico.mjs` | `alovida-flujo-medico-1080p.mp4` (+ 720p) |
| **Video · farmacia** | `flujos/farmacia.mjs` | `alovida-flujo-farmacia-1080p.mp4` (+ 720p) |
| **Video · aseguradora** | `flujos/aseguradora.mjs` | `alovida-flujo-aseguradora-1080p.mp4` (+ 720p) |
| Motor y escenario | `flujos/motor.mjs`, `flujos/flujo.html` | manejan la aplicación y pintan marco, rótulos y puntero |
| **Mazo de paciente y médico** | `deck-paciente-y-medico.html` | `AloVida-modulos-paciente-medico.pdf` (15 láminas 16:9) y un PNG por lámina |
| Tokens de marca | `marca.css` | del mazo y de los rótulos del video |
| Artboards de Claude Design | `a-canvas.mjs` | un `.dc.html` por pantalla, con el mismo HTML y CSS |

```bash
yarn start                                   # las dos piezas necesitan la maqueta levantada
node tools/promo/generar.mjs --solo-deck     # PDF + PNG (rápido, sin ffmpeg)

brew install ffmpeg                          # una vez; sólo lo necesita el video
node tools/promo/flujos/grabar.mjs           # los cuatro ejercicios
node tools/promo/flujos/grabar.mjs --solo farmacia
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

## Los ejercicios

| Módulo | Qué se recorre |
|---|---|
| **Paciente** | Crea la cuenta —cada nombre y cada apellido en su propio campo, como los separa el layout—, busca al profesional, pide el horario, ve la cita con su estado, mira sus resultados y sigue su receta hasta el pedido de farmacia. |
| **Médico** | La agenda del día, registrar la llegada, iniciar la consulta, dejar el diagnóstico del catálogo CIE-10, la receta, y marcar el cobro sin salir de la agenda. |
| **Farmacia** | La bandeja del mostrador, el pedido que llega con su receta electrónica, confirmarlo con lo que hay —tal cual, sustituto o no disponible— y ver la bandeja moverse. |
| **Aseguradora** | El catálogo de la compañía con sus planes y coberturas —prestación por prestación: cobertura, copago, deducible, tope y autorización previa—, los corredores con su matrícula, lo presentado a cada compañía filtrando por aseguradora, el dictamen ítem por ítem (aprobado, denegado y su motivo) y el reclamo, que no borra el dictamen sino que lo referencia. |

Cada módulo es un archivo aparte y termina con la marca.

## Cómo está grabado

`flujos/motor.mjs` maneja la aplicación y anota, fotograma a fotograma, qué foto toca, dónde está el
puntero y qué rótulo va encima; deja `app/*.png` (sin repetir lo que no cambia) y `guion.js`.
`flujos/flujo.html` reproduce ese guion con el marco, el módulo y la escena arriba, el rótulo abajo y
el puntero con su clic — y el cierre de marca. `grabar.mjs` levanta un servidor mínimo sobre lo
grabado, fotografía el escenario y encadena con ffmpeg.

Escribir es escribir: el motor teclea letra por letra en el campo real y fotografía cada pulsación,
así que lo que se ve es la aplicación respondiendo, no una animación de texto.

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
