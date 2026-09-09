# Plan · Mensajería con la forma de WhatsApp

> Objetivo: que `/messaging` se use como WhatsApp Web — una sola pantalla, lista a la
> izquierda siempre visible, conversación a la derecha, burbujas con la hora adentro,
> envío instantáneo, respuestas con cita, adjuntos, emojis y notas de voz.
>
> Relevado el 08/09/2026 sobre `mantra-core-health` (rama `carril-c/motor-de-sintomas`)
> y `mantra-core-health-api` (`community`). Todo lo que dice «hoy» se midió contra el código.

---

## Estado · 09/09/2026

**F0, F1, F2, F3 y F5 están hechas.** F4 (backend) sigue abierta y no bloquea nada.

| Fase | Estado | Dónde |
|---|---|---|
| F0 · store y ruta anidada | ✅ | `core/messaging/chat.store.ts`, `app.routes.ts` (`RUTAS_ANIDADAS`), `.pantalla-a-sangre` en `alovida.css` |
| F1 · bandeja | ✅ | `messaging.*`, `conversation-list/*`, `chat-preferencias.ts`, `shared/date/hora-de-chat.ts` |
| F2 · hilo | ✅ | `thread.*`, `public/chat-patron.svg`, tokens `--chat-*` |
| F3 · composer | ✅ | `thread/composer/{composer,selector-emojis,grabador}.*` |
| F4 · backend | ⏳ abierta | seis PR chicos en `mantra-core-health-api` |
| F5 · pruebas y evidencia | ✅ | 63 pruebas verdes · 4 casos nuevos de Playwright · capturas en `evidencias/chat-whatsapp/` |

### Lo verificado

- `ng build` limpio; `ng test` acotado: **63 pruebas verdes** en `chat.store.spec`,
  `messaging.spec`, `thread.spec`, `hora-de-chat.spec` y `app.routes.spec`.
- `check-architecture`, `check-route-prefixes` y `check-tokens` pasan.
  `check-client-prefixes` y los cuatro fallos de `access-tree`/`navigation.service`/
  `shell-layout` **ya fallaban antes** de este trabajo (medido revirtiendo los cambios).
- Capturas en claro, oscuro y móvil contra una API simulada desde el navegador.

### Retoques del 09/09 sobre `mockup`

- **Hora unificada** entre fila y burbuja (`horaDelReloj`), sin el cero de adelante.
- **Menú ⋮ en la cabecera del hilo**: ver perfil, favorito, archivar. Y **buscar
  dentro de la conversación** (lupa): deja sólo las coincidencias y las resalta.
- **Reenviar** desde el menú del mensaje, eligiendo entre las otras conversaciones.
  Va por el mismo camino que un envío (`ChatStore.reenviar`), adjunto incluido.
- **Enlaces clicables** dentro de las burbujas; **contador de no leídos en el
  título de la pestaña** («(3) AloVida - Chats»).
- Los adjuntos con URL `data:image/…` o `blob:` se pintan como imagen (antes
  la foto del lunar de la maqueta salía como documento).
- El backend simulado ganó un **chat de grupo** (médica + pediatra + endocrino)
  con documento, foto y citas, y una respuesta con cita en el hilo del paciente,
  para que la maqueta muestre todo lo que el chat sabe hacer.
- El cartel «Datos de prueba» de la maqueta ya no tapa el campo de escribir en móvil.

### Diferencias con el plan original

- **El envío optimista, los adjuntos y los emojis entraron con F0–F2**, no en un PR
  aparte: son la misma función del store y separarlos habría significado escribir
  `enviar()` dos veces.
- **El botón «+» de chat nuevo no existe**: lo reemplaza el buscador de arriba, que ya
  ofrece contactos nuevos mientras escribís. Un botón que abre otra caja de búsqueda al
  lado de una caja de búsqueda es una puerta de más.
- **Los ✓✓ de la bandeja no se pintan**: el contrato de `GET /conversations` no dice si
  el otro lado leyó el último mensaje. Se pinta un solo tilde —que sí se sabe— y el
  doble queda pedido en F4.3. Pintar dos sin saberlo sería mentir sobre lo único que la
  gente mira antes de volver a escribir.
- **El fondo del hilo entra como máscara CSS**, no como imagen: un color fijo en el SVG
  se veía igual en los dos temas. Cuidado al editar ese archivo — dos guiones seguidos
  dentro de un comentario XML lo dejan sin parsear y el navegador no dibuja nada sin
  decir por qué.

---

## 0 · Lo que había el 08/09 y por qué no se parece

| Hoy | WhatsApp | Qué falta |
|---|---|---|
| Dos pantallas (`Messaging` bandeja, `Thread` hilo), cada una con su propia copia de la lista, su sondeo y su suscripción al socket | Una sola pantalla; la lista nunca se recarga al cambiar de chat | Un `ChatStore` compartido y una ruta anidada |
| Tarjeta con borde redondeado dentro de la página, alto `min(100dvh - 9rem, 46rem)` | Ocupa toda la ventana, de borde a borde | Marco a pantalla completa |
| El buscador está escondido detrás del lápiz y sólo busca en el directorio | «Buscar un chat o iniciar uno nuevo» siempre arriba: filtra los chats **y** ofrece contactos nuevos | Buscador permanente con dos secciones |
| Sin filtros | Chips Todos · No leídos (n) · Favoritos · Grupos | Chips + favoritos locales |
| Fila: nombre, «hace 2 min», vista previa, globo azul | Fila: nombre, `8:00 p.m.` / `Ayer` / `lunes`, `✓✓ texto` o `Justin: texto`, 📎 si es adjunto, globo verde | Rehacer la fila |
| Burbuja con la hora en una línea aparte debajo del texto | Hora incrustada a la derecha de la última línea; un mensaje corto ocupa una línea | Hora flotante |
| Fondo liso | Papel con patrón (doodles) | Patrón SVG tintado por tema |
| Enviar recarga el hilo entero (parpadea) | Aparece al instante con 🕓, pasa a ✓ y a ✓✓ | Envío optimista |
| Sin responder, sin adjuntos, sin emojis, sin audio | Responder con cita, `+` adjuntar, 😊, 🎤 | El backend ya acepta `replyToMessageId`, `contentType: 'MEDIA'` y `attachmentFileId`; el front no los usa |
| «Ver mensajes anteriores» a mano | Carga sola al subir, sin saltar el scroll | Scroll infinito hacia arriba |
| «Enter envía · Shift+Enter…» como línea de ayuda | Nada | Sacarla (queda en `title`) |
| Sin «escribiendo…», sin «en línea» | Ambos | Backend: el gateway sólo empuja; no acepta eventos del cliente |

Lo que el backend **ya** da y alcanza para casi todo:
`GET/POST /community/conversations`, `GET/POST …/messages` (con `replyToMessageId`,
`contentType`, `attachmentFileId`), `POST …/read` (+ `peerReadUpTo`), gateway con
`conversation:message` / `conversation:read` / `conversation:new`, `peers` con nombre y
avatar, `FilesClient.upload()` + `downloadUrl()`, bloqueos (`block/unblock`).

Lo que el backend **no** da (y se decide abajo qué hacer): favoritos, archivados, fijados,
presencia, «escribiendo», editar/borrar mensajes, cursor y búsqueda en la lista de
conversaciones.

---

## 1 · Decisiones tomadas (no reabrir)

- **D1 · Un store, dos componentes.** `ChatStore` (`core/messaging/chat.store.ts`) es el
  único dueño de: perfil propio, conversaciones, mensajes del hilo activo, cursor,
  envíos pendientes, `peerReadUpTo`, sondeo y suscripción al socket. `Messaging` y
  `Thread` leen señales y disparan acciones. Se elimina la doble llamada a
  `listConversations` (`nombrarHilo`) y las dos suscripciones al socket.
- **D2 · Ruta anidada.** `messaging` pasa a tener hijas: `''` (panel derecho vacío) y
  `:conversationId` (`Thread`). La lista queda montada; sólo cambia el panel derecho.
  `/messaging/:id` sigue funcionando igual para la campana y las fichas públicas.
- **D3 · Favoritos y archivados se guardan en el navegador** (`localStorage`, mismo patrón
  que `MessageTemplates`). No hay columna en `conversation_participants` para eso y
  agregarla es un cambio de esquema en `SQL/`; se anota como pendiente de backend (F4)
  y el front migra a la API cuando exista sin cambiar de pantalla.
- **D4 · Envío optimista.** Al enviar se pinta la burbuja con id temporal y 🕓; el
  `POST` devuelve `id` + `sentAt` y se reemplaza; el evento del socket con el mismo id se
  descarta. Si falla, la burbuja queda con ⚠ y «Reintentar». Se deja de hacer `recargar()`.
- **D5 · Adjuntos por `FilesClient`.** Imagen o documento → `upload(file, categoría,
  sensibilidad)` → `sendMessage({ contentType: 'MEDIA', attachmentFileId, bodyText? })`.
  La URL para mostrar sale de `downloadUrl(fileId)` y se cachea por id en el store. Sin
  nuevos endpoints.
- **D6 · Notas de voz = un adjunto más.** `MediaRecorder` → `audio/webm` → mismo camino
  que D5. Se distingue por el `mimeType` del archivo, no por un concepto nuevo.
- **D7 · Emojis sin dependencia.** Selector propio con ~10 categorías fijas y «recientes»
  en `localStorage`. No se agrega librería.
- **D8 · «Escribiendo…» y «en línea» van al backend (F4) y son opcionales.** No bloquean
  ninguna fase del front; cuando el gateway los emita, el store ya tiene dónde escucharlos.
- **D9 · Tema oscuro obligatorio.** Los colores del chat se definen como tokens propios
  (`--chat-papel`, `--chat-patron`, `--chat-propia`, `--chat-ajena`, `--chat-tick-leido`,
  `--chat-no-leido`) en `alovida.css`, con los tres bloques de siempre (`:root`,
  `prefers-color-scheme: dark`, `[data-theme='dark']`).
- **D10 · Llamadas quedan fuera.** No hay nada en el producto para eso.

---

## 2 · Fases

Cada fase se puede mergear sola. Orden: F0 → F1 → F2 → F3 → F5; F4 en paralelo cuando
alguien de API pueda.

### F0 · Base: store, ruta anidada y marco a pantalla completa

**Archivos**
- `core/messaging/chat.store.ts` (nuevo) + `chat.store.spec.ts`
- `app.routes.ts` — `messaging` con `children: [{ path: '' }, { path: ':conversationId' }]`
- `features/messaging/messaging.{ts,html,css}` — pasa a ser el marco: columna izquierda +
  `<router-outlet>` a la derecha
- `features/messaging/thread/thread.{ts,html,css}` — deja de pintar el carril izquierdo y
  de pedir la bandeja
- `features/shell-layout/shell-layout.css` — `.app-main__inner` sin padding cuando la
  ruta es `messaging` (clase `is-chat` desde `Messaging` vía `host`)

**Qué hace**
- Store con señales: `perfil`, `perfilResuelto`, `conversaciones`, `activaId`, `mensajes`,
  `cursor`, `peerReadUpTo`, `pendientes`, `cargando*`, `error`. Acciones: `iniciar()`,
  `abrir(id)`, `cerrar()`, `cargarAnteriores()`, `enviar()`, `marcarLeido()`,
  `escribirA(slug)`, `crearPerfil()`.
- Un solo sondeo (60 s bandeja, 30 s hilo activo) y una sola suscripción al socket, en el
  store; el socket **actualiza la fila** de la bandeja en el acto (último mensaje, hora,
  no-leídos +1) y después relee para confirmar.
- Marco: `grid-template-columns: minmax(20rem, 30%) 1fr`, alto `calc(100dvh - var(--h-header))`,
  sin borde ni radio. Bajo 60rem: lista sola en `/messaging`, hilo solo en `/messaging/:id`
  con flecha de volver.

**Listo cuando**: cambiar de chat no vuelve a pedir la bandeja; el `spec` del store cubre
merge sin duplicados, orden y `peerReadUpTo`; `messaging.spec` y `thread.spec` siguen
verdes (adaptados al store).

### F1 · Bandeja como WhatsApp

**Archivos**
- `features/messaging/messaging.{html,css}`
- `features/messaging/conversation-list/*` (rehacer la fila)
- `core/messaging/chat-preferencias.ts` (nuevo: favoritos, archivados, emojis recientes)
- `shared/date/hora-de-chat.ts` (nuevo) + spec
- `core/data-access/community/community.types.ts` — `NewDirectMessage` gana
  `contentType` y `attachmentFileId` (ya lo usa F3, se hace acá para no tocar el tipo dos
  veces)

**Qué hace**
- Buscador fijo arriba con lupa. Al escribir: sección **Chats** (filtro local por nombre
  y por vista previa) y sección **Contactos** (`searchPractitioners(q)` con debounce de
  300 ms); tocar un contacto abre/crea el hilo (`escribirA`). Vacío: «Sin resultados».
- Chips: **Todos**, **No leídos (n)**, **Favoritos**, **Grupos** (`groupId !== undefined`).
  Botón `+` a la derecha abre el buscador con foco.
- Fila **Archivados (n)** arriba de la lista si hay alguna; tocar muestra sólo las
  archivadas. Menú contextual de fila (⋮ en hover / mantener apretado en móvil):
  Favorito, Archivar, Marcar como leído, Ver perfil, Bloquear.
- Fila: avatar 49 px, nombre en 17 px, hora a la derecha (`horaDeChat`: hoy → `8:00 p.m.`,
  ayer → `Ayer`, esta semana → `lunes`, después → `07/09/2026`), segunda línea con
  `✓`/`✓✓` si el último mensaje es propio, `Nombre:` si es de grupo, 📷 «Foto» / 📄
  «Documento» / 🎤 «0:42» si es adjunto; globo verde `--chat-no-leido` con el contador;
  hora en verde y negrita cuando hay no leídos. Sin filete entre filas; hover y activa
  con `--sup-inset`.
- Vista previa de adjunto: el `ConversationPreviewMessage` no trae `attachmentFileId`;
  se pide al backend (F4.3) y mientras tanto se infiere de `bodyText` vacío.

**Listo cuando**: se puede encontrar un chat y un contacto desde la misma caja; los chips
filtran; favoritos y archivados sobreviven a recargar; `messaging.spec` cubre filtro
local, chips y archivados.

### F2 · Hilo como WhatsApp

**Archivos**
- `features/messaging/thread/thread.{ts,html,css}`
- `features/messaging/thread/burbuja/burbuja.{ts,html,css}` (nuevo, un mensaje)
- `public/chat-patron.svg` (nuevo, patrón de fondo, `currentColor`)
- `styles/alovida.css` — tokens `--chat-*` (D9)

**Qué hace**
- Cabecera: avatar, nombre, subtítulo con los participantes (`Justin, Marcelo, Tú`) en
  grupos o el `headline` del perfil en directas; acciones: buscar en el chat (filtro
  local que resalta coincidencias), ⋮ (Ver perfil, Favorito, Archivar, Bloquear).
- Fondo `--chat-papel` con `chat-patron.svg` tintado `--chat-patron` a ~6 % de opacidad.
- Burbuja: `max-inline-size: 65%`, padding `6px 7px 8px 9px`, radio 7.5 px, cola sólo en
  la primera del bloque, propia en `--chat-propia`, ajena en `--chat-ajena`; **hora y ticks
  flotan a la derecha de la última línea** (`float: inline-end` + `margin` sobre un
  `span` con la hora); en grupos, nombre del autor arriba en un color estable por
  perfil (hash → 8 tonos). Menciones `@Nombre` que coincidan con un participante se
  resaltan.
- Cita (`replyToMessageId`): bloque arriba del texto con barra de color, nombre del
  autor y primeras 2 líneas; si el original no está cargado, «Mensaje anterior»; tocar
  hace scroll y destella el original.
- Adjuntos en la burbuja: imagen (miniatura, abre en `app-dialog` a tamaño completo),
  documento (tarjeta con icono, nombre, tamaño, «Descargar»), audio (reproductor con
  play, barra y duración).
- Separador «N mensajes no leídos» al abrir, con `unreadCount` de la fila; separadores
  de día como hoy.
- Scroll infinito hacia arriba: al llegar a 200 px del tope pide la página anterior y
  **conserva la posición** (`scrollHeight` antes/después). Botón flotante «⌄» con
  contador de nuevos cuando no está al pie.
- Menú de mensaje (▾ en hover / mantener apretado): Responder, Copiar, Reenviar (elige
  chat de la lista y envía el mismo texto/adjunto).

**Listo cuando**: un mensaje corto ocupa una línea con la hora al lado; subir carga sin
saltar; la cita navega al original; `thread.spec` cubre líneas, cita y separador de no
leídos; capturas claro/oscuro en `evidencias/`.

### F3 · Composer: envío optimista, respuesta, emojis, adjuntos y audio

**Archivos**
- `features/messaging/thread/composer/composer.{ts,html,css}` (nuevo)
- `features/messaging/thread/composer/selector-emojis.{ts,html,css}` (nuevo)
- `features/messaging/thread/composer/grabador.ts` (nuevo, `MediaRecorder`)
- `core/messaging/chat.store.ts` — `enviar()` optimista, `enviarAdjunto()`, `responderA`
- `core/data-access/community/community.client.ts` — `sendMessage` manda `contentType` y
  `attachmentFileId`

**Qué hace**
- Barra: `+` (menú: Fotos e imágenes, Documento, Plantilla P9), 😊, campo pill con
  auto-grow hasta 6 líneas, y a la derecha 🎤 si está vacío o ➤ si hay texto.
- Envío optimista (D4): burbuja con 🕓 → ✓ al `next` del `POST` → ✓✓ por `peerReadUpTo`
  / `conversation:read`. Error: ⚠ «No se envió · Reintentar».
- Responder: tira arriba del campo con la cita y ✕; `Esc` la cierra; se manda
  `replyToMessageId`.
- Emojis (D7): panel sobre el composer, categorías + recientes, inserta en el cursor.
- Adjuntos (D5): al elegir archivo aparece una previsualización sobre el composer con
  campo de leyenda; enviar sube y manda. Límite 20 MB y tipos `image/*`, `application/pdf`,
  `audio/*`; el resto se rechaza con `app-alert`.
- Audio (D6): mantener 🎤 graba (contador `0:42`, onda simple), soltar envía, deslizar a
  la izquierda / ✕ cancela. Sin permiso de micrófono: aviso y el botón se deshabilita.
- Borrador por conversación en memoria del store: cambiar de chat y volver conserva lo
  escrito (como WhatsApp).

**Listo cuando**: enviar no parpadea; un adjunto de imagen se ve en las dos pestañas
en vivo (Playwright); nota de voz se graba, se envía y se reproduce; `composer.spec`
cubre Enter/Shift+Enter, respuesta y rechazo de tipo.

### F4 · Backend (API `community`) — en paralelo, no bloquea

Cada punto es un PR chico contra `dev` de `mantra-core-health-api`:

1. **`typing`** en el gateway: `@SubscribeMessage('typing')` con `{conversationId,
   profileId, typing}` que reemite `conversation:typing` a la sala del hilo. Sin
   persistencia. El front muestra «escribiendo…» bajo el nombre y en la fila.
2. **Presencia**: al `join:inbox` marcar `profile:{id}` en línea (set en Redis con TTL
   de 60 s renovado por ping) y emitir `profile:presence` a las conversaciones donde
   participa; al desconectar, `lastSeenAt`. El front muestra «en línea» / «últ. vez hoy
   a las 19:50».
3. **`GET /conversations`** con `cursor` y `q` (nombre del peer / texto del último
   mensaje), y que `lastMessage` traiga `contentTypeConceptId` y `attachmentFileId`.
4. **Preferencias por participante**: columnas `is_favorite`, `is_pinned`, `archived_at`
   en `community.conversation_participants` (`SQL/`), `PATCH
   /conversations/:id/participant` y los campos en `ConversationListItemDto`. El front
   deja `localStorage` y usa esto.
5. **Editar y borrar mensajes**: `PATCH /messages/:id` (`bodyText`, pone `isEdited`) y
   `DELETE /messages/:id` (soft, `deletedAt`, la lectura devuelve «Se eliminó este
   mensaje»); eventos `conversation:message:updated` / `:deleted`.
6. **Fijar mensaje** (barra superior de la captura): `pinned_message_id` en
   `conversations` + `POST/DELETE /conversations/:id/pin`.

### F5 · Pruebas, evidencia y cierre

- Unit (`ng test` acotado con `--include` explícito): `chat.store.spec`,
  `messaging.spec`, `thread.spec`, `composer.spec`, `hora-de-chat.spec`.
- Playwright `carril-chat-realtime.spec.ts`: agregar «el mensaje aparece antes de que
  responda el servidor», «la respuesta con cita llega en vivo», «la imagen adjunta se
  ve del otro lado», «el filtro No leídos deja sólo las pendientes». Esperar por
  `testId`, nunca `networkidle`.
- `node scripts/check-*.mjs` a mano (el CI no corre).
- Capturas claro/oscuro/móvil en `evidencias/chat-whatsapp/` y párrafo en
  `AVANCE-FRONTEND-*.md`.
- PR a `dev` por fase (`gh pr create`; el merge lo hace quien revisa).

---

## 3 · Orden de trabajo y tamaño

| Fase | Archivos nuevos / tocados | Tamaño |
|---|---|---|
| F0 | 1 nuevo, 5 tocados | M |
| F1 | 3 nuevos, 4 tocados | M |
| F2 | 3 nuevos, 4 tocados | L |
| F3 | 4 nuevos, 3 tocados | L |
| F4 | API, 6 PR chicos | M (otra persona) |
| F5 | specs + e2e + evidencia | S |

Se trabaja en un worktree propio (`wt-pablo-front`), rama `pablo/chat-whatsapp` desde
`dev`, un PR por fase para que se pueda revisar y mergear de a partes.

---

## 4 · Lo que queda fuera y por qué

- **Llamadas y videollamadas** (D10).
- **Estados / historias**, **comunidades**: no existen en el modelo.
- **Cifrado de extremo a extremo**: no aplica a un producto donde la organización debe
  poder auditar.
- **Reacciones a mensajes**: `reactions` existe pero sólo para `POST`/`COMMENT`/`REVIEW`
  (`REACTABLE_TYPES`); agregar `MESSAGE` es otro cambio de esquema. Se anota para
  después de F4.
