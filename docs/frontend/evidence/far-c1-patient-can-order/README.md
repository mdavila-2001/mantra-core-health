# Evidencia — el paciente pide con su receta emitida

Capturas con datos de prueba (cuentas `@alovida.test`), front y API de esta corrección.

| Captura | Qué muestra |
|---|---|
| `c1-mis-recetas-{desktop,mobile}-{light,dark}.png` | «Mis recetas» tras recargar: la receta emitida dice «Vigente» y ofrece «Buscar dónde comprarla» y «Compartir» |
| `c1-donde-comprar-*.png` | «Dónde comprar» lista las sedes de la farmacia, sin «no se puede usar para comprar» |
| `c1-pedido-titular-*.png` | El titular abre el detalle de su pedido (`GET /pharmacy/orders/:id` → 200) |
| `c1-pedido-enviado-desktop-light.png`, `…-recarga-…` | «Enviar pedido» → checkout → `POST /pharmacy/orders` 201 → detalle, y el mismo detalle tras recargar |

Por la API, con el mismo pedido: la farmacia dueña lo abre (200); la farmacia de otro tenant, una cuenta sin tenant que no es la
titular y un id inexistente reciben el mismo 404 «Pedido no encontrado».
