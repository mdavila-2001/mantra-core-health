# Mensajería y perfil público — 24/08/2026

Recorrido con **tres médicos dados de alta por el alta pública de la API viva**,
la aplicación servida desde el código de esta rama y la API **desde el fuente**
—no el contenedor, que corre una imagen vieja y ni siquiera acepta el cuerpo de
login actual—.

Las tres cuentas: `doc1` (Lucía Salas, cardióloga), `doc2` (Diego Rivas,
clínico) y `doc3` (Ana Vera, **sin perfil público**, que es el caso que rompía).

## Qué muestra cada captura

| Archivo | Qué prueba |
| --- | --- |
| `01-bandeja-de-diego-sin-leer` | La bandeja con la forma de un chat: lista a la izquierda, hueco de la conversación a la derecha. El contador dice **3**, que son exactamente los que le mandó Lucía — antes decía 4, contando el suyo |
| `02-hilo-lado-de-diego` | El hilo con carril de conversaciones, cabecera con quién es, separador de día, burbujas agrupadas y el mensaje recién enviado **abajo y a la vista** |
| `03-hilo-lado-de-lucia` | El **mismo hilo desde el otro lado**: lo de Lucía a la derecha con doble tilde —Diego ya lo leyó—, la respuesta de Diego a la izquierda |
| `04-perfil-publico` | La ficha pública con portada, retrato montado, identidad, y «Enviar mensaje» junto al nombre |
| `05-sin-perfil-la-puerta-esta-aca` | Ana entra a Chats sin perfil público: se lo ofrece crear **ahí**, en un botón, en vez de mandarla a buscar un formulario a otra sección |
| `06-del-perfil-al-chat` | El circuito entero: Ana crea su perfil de un clic, entra a la ficha de Lucía, pulsa «Enviar mensaje» y termina escribiendo en un hilo nuevo |

## Los cuatro defectos que este recorrido encontró

Ninguno se veía leyendo el código; los cuatro aparecieron al usarlo.

1. **El hilo se rompía con cada mensaje en vivo.** El socket entregaba el JSON
   crudo con tipo de `DirectMessage`, así que `sentAt` llegaba como texto con
   tipo de `Date`. `leido()` hace `sentAt.getTime()`: cada mensaje empujado por
   WebSocket tiraba `sentAt.getTime is not a function` **en cada ciclo de
   detección de cambios**, y el hilo quedaba inutilizable hasta recargar.
2. **Los mensajes propios contaban como sin leer** (arreglo en la API). Con
   cuatro mensajes, tres de Lucía y uno de Diego, la bandeja de Diego decía «4».
3. **El hilo no bajaba al último mensaje.** Se veía al enviar: el mensaje se
   guardaba —está en la base— y quedaba fuera de la vista.
4. **«Enviar mensaje» en la propia ficha abría un hilo ajeno.** Pedía una
   conversación con un solo participante repetido y el backend devolvía otra
   cualquiera de las suyas. Ahora se rechaza con un aviso.

## Lo que esto NO prueba

- **El tiempo real no se ejercitó con dos navegadores a la vez.** Las dos
  sesiones se miraron una después de otra, así que lo verificado es que el
  estado llega bien a los dos lados, no que el empujón del WebSocket pinte el
  mensaje sin recargar. El arreglo del `sentAt` sí está verificado por tipos y
  por la ausencia del error en consola.
- **La API se corrió desde el fuente, no desde el contenedor.** Lo que está
  desplegado sigue siendo la imagen vieja hasta que estos cambios lleguen a
  `dev` y el autodespliegue pase.
- Las cuentas son de prueba y sus perfiles están casi vacíos: la ficha se ve con
  presentación cargada a mano, sin foto, sin especialidades y sin sedes —esos
  datos la API pública no los sirve, y está anotado en `PENDIENTES-BACKEND.md`—.
