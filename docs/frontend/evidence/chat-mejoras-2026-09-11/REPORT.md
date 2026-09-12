# Mensajería — seis mejoras pedidas por el propietario

**Fecha:** 2026-09-11 · **Rama:** `mockup` · **Entorno:** maqueta (backend en
memoria), `ng serve` en `http://localhost:4301`

Lo que el propietario pidió, textual: poder **editar mensajes con el límite de
cinco minutos**, **respuestas predeterminadas tras inactividad, todo
configurable**, **stickers**, **descargar la conversación en JSON**, **muchos
más emojis**, y que **«Ver perfil» funcione**.

---

## Resultado

| # | Pedido | Estado | Dónde se demuestra |
|---|---|---|---|
| 1 | «Ver perfil» no funciona | **Corregido** | `01`, `01b`, `08b` · E2E 1 y 1b |
| 2 | Editar mensaje, límite de 5 min | **Hecho** | `02`–`02d` · E2E 2 y 2b |
| 3 | Muchísimos más emojis | **Hecho** — 150 → **1 946** | `03`–`03c` · E2E 3 |
| 4 | Stickers | **Hecho** — pack de 24 | `04`, `04b` · E2E 4 |
| 5 | Descargar conversación en JSON | **Hecho** | `05-conversacion-descargada.json`, `05b` · E2E 5 |
| 6 | Respuesta automática configurable | **Hecho** (con un límite declarado) | `06`–`06c` · E2E 6 |

Dos defectos más, encontrados **por el navegador** mientras se recogía esta
evidencia, y corregidos:

- **El hilo quedaba en blanco** al cambiar de conversación antes de que
  contestara el servidor. `cargarHilo()` salía temprano si ya había una carga en
  vuelo, y la respuesta de la anterior se descartaba por ser de otro chat: nadie
  volvía a pedir nada hasta el sondeo, treinta segundos después. Es preexistente
  y no tiene que ver con lo pedido; se arregló porque bloqueaba la evidencia y
  es del mismo subsistema. Fijado en `chat.store.spec.ts`.
- **El panel de contacto no cerraba con Escape**, porque no tomaba el foco al
  abrirse. Fijado en `contact-panel.spec.ts`.

---

## Verificación

| Qué | Resultado |
|---|---|
| `yarn typecheck` | limpio |
| `yarn lint` | limpio |
| `yarn test --watch=false` | **463 archivos · 5 574 pruebas · 0 fallos** |
| `yarn build` | compila |
| `yarn pw --workers=1 chat-mejoras-evidencia.spec.ts` | **11 / 11** |
| `check-css-tokens` · `check-architecture` · `check-client-prefixes` · `check-route-prefixes` | los cuatro en verde |
| `check-doc-coverage` · `check-doc-links` | los dos en verde |

Viewports fotografiados: **390×844**, **768×1024**, **1440×900**, más modo
oscuro a 1440. Sin scroll horizontal en ninguno (aserción, no vista).

---

## Lo que esta evidencia **no** demuestra

Se dice acá para que nadie lo lea como probado:

1. **La ventana de cinco minutos en el servidor.** Hoy la aplican la pantalla y
   la maqueta —que responde **422** fuera de plazo, no sólo esconde el botón—.
   La API real acepta `PATCH …/messages/:id` sin límite de tiempo: mientras eso
   no cambie, la regla es del cliente. Es trabajo del repositorio de la API.
2. **La persistencia de un mensaje editado tras recargar.** La maqueta guarda
   los mensajes en memoria, así que recargar los devuelve al fixture. Lo que sí
   se demuestra (E2E 2b) es que el texto nuevo **vuelve del servidor** al salir
   del hilo y entrar de nuevo.
3. **La respuesta automática con la aplicación cerrada.** No existe: vive en
   `localStorage` porque el modelo no tiene dónde guardarla. La pantalla de
   Ajustes lo dice con todas las letras, y hay una prueba que falla si ese aviso
   desaparece.
4. **El enlace a la ficha pública contra la API real.** Aparece cuando el
   servidor dice de qué vertical es el perfil (`kind`). La maqueta lo manda; la
   API todavía no, y hasta entonces el panel no ofrece el enlace en vez de
   adivinar un prefijo.

---

## Hallazgos abiertos, ajenos a esta tanda

- **Violaciones de CSP por scripts en línea del servidor de desarrollo.** Medido,
  no supuesto: una sonda sobre `/auth` y `/buscar` —dos rutas que esta tanda no
  toca— devolvió **cuatro** violaciones idénticas. Es del entorno de desarrollo.
- **Presupuesto de bundle inicial excedido** (1,28 MB contra 620 kB) y varios
  `.css` sobre su tope, `thread.css` incluido. Preexistente: todo lo que agrega
  esta tanda es perezoso — el catálogo de emojis es un fragmento propio de
  **130 kB / 28,7 kB comprimido** que sólo se baja al abrir el panel.

---

## Las fotos

| Archivo | Qué muestra |
|---|---|
| `01-ver-perfil-hoja-contacto.png` | La hoja del contacto abierta desde el menú del hilo |
| `01b-ver-perfil-desde-la-bandeja.png` | El mismo destino desde el menú de la fila |
| `02-menu-con-editar.png` | «Editar» en el menú de un mensaje propio reciente |
| `02b-composer-en-modo-edicion.png` | El composer en modo edición, con su tira ámbar |
| `02c-mensaje-editado.png` | El texto corregido, con la marca «editado» |
| `02d-al-volver-al-hilo-sigue-editado.png` | Lo mismo tras releer el hilo del servidor |
| `03-panel-de-emojis-salud.png` | El panel abierto en la pestaña «Salud» |
| `03b-buscando-jeringa.png` | Búsqueda por nombre en castellano |
| `03c-buscando-corazon-sin-tilde.png` | «corazon» encuentra «corazón» |
| `04-panel-de-stickers.png` | El pack «AloVida Salud» |
| `04b-sticker-en-el-hilo.png` | El sticker enviado, sin burbuja |
| `05-conversacion-descargada.json` | El archivo real que baja el producto |
| `05b-menu-con-descargar.png` | La acción en el menú de la conversación |
| `06-ajustes-chats-apagada.png` | Ajustes → Chats, con el aviso del límite |
| `06b-ajustes-chats-configurada.png` | Encendida, con espera, texto, descanso y franja |
| `06c-tras-recargar-sigue-configurada.png` | Lo elegido sobrevive a recargar |
| `07-*`, `07b-*`, `07c-*` | Bandeja, hilo y emojis en los tres viewports |
| `08-hilo-oscuro.png`, `08b-contacto-oscuro.png` | Modo oscuro |

## Cómo repetirlo

```bash
yarn start --port 4301
E2E_BASE_URL=http://localhost:4301 yarn pw --workers=1 chat-mejoras-evidencia.spec.ts
```

Cuenta: `medica@alovida.mock`, cualquier contraseña no vacía.
