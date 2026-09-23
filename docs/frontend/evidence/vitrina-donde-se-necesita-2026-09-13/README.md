# La vitrina se pide donde hace falta — 2026-09-13

Evidencia del cierre del bloqueo «Grupos públicos y Mis artículos quedaron sin camino de
autoservicio», del 2026-09-10.

## Con qué cuenta

`superadmin@alovida.mock`. Es la única cuenta sembrada **sin vitrina**: las cinco del simulador
la tienen completa salvo ésta, así que es la única con la que el estado se puede ver.

| Archivo | Qué muestra |
|---|---|
| `1440-articulos.png` | `/my-account/articles` sin vitrina. Antes decía «pedíselo a quien administra tu organización»; ahora se crea acá. Dos columnas, porque la caja da para dos. |
| `1440-articulos-ya-creada.png` | La misma pantalla tras crearla: el compositor, firmando como «Soporte AloVida». |
| `1440-grupos.png` | `/groups` → «Crear grupo», con el mismo formulario **dentro de la columna angosta del alta** y en una sola columna. Acá la foto es obligatoria y el botón queda apagado hasta que se adjunte: un grupo público la exige. |
| `390-telefono.png` | Teléfono 390×844. Una columna, todo alcanzable. |

Una columna o dos no lo decide el ancho de la pantalla sino el de la **caja** (`container-type:
inline-size`): el mismo componente vive en el ancho entero de «Mis artículos» y en una columna
de 390 px en el alta de un grupo, y una media query habría metido dos columnas en la angosta.

## Lo que hubo que arreglar en el simulador para poder ver esto

La maqueta **nunca emitía `PUBLIC_PROFILE_REQUIRED`**, el código con el que el servidor rechaza
un grupo público sin vitrina completa. La rama de `groups.ts` que lo atiende estaba muerta acá:
no había forma de revisarla. Ahora el simulador lo emite con la misma regla del servidor
—nombre visible, foto y visibilidad pública—, así que el camino entero se puede recorrer.
