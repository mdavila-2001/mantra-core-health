# Evidencia — «Dónde comprar» muestra toda la red

Datos de prueba: dos farmacias (Farmacia Chavez S.A. y Farmacia Nostas S.R.L., dos sedes cada una); una receta con amoxicilina y
paracetamol. Chavez publica solo amoxicilina; Nostas, los dos.

| Captura | Qué muestra |
|---|---|
| `c5-donde-comprar-{desktop,mobile}-{light,dark}.png` | Tras recargar: primero la sede que tiene toda la receta (Nostas · Casa central); las demás detrás de «Ver las 3 que tienen una parte». Una sola llamada `GET /pharmacy-inventory/availability/medications` |
| `c5-parciales-desktop-light.png` | Las sedes parciales dicen por nombre qué tienen («Tiene: Amoxicilina») y qué les falta |
| `c5-pedido-parcial-desktop-light.png` | «Enviar pedido» en Chavez · Casa central (parcial) → `POST /pharmacy/orders` 201 con una sola línea, el producto de **esa** farmacia; sin 404 |

Por la API: con «No lo tengo» en Nostas · Sucursal Norte para la amoxicilina, esa sede pasa de completa a parcial (le falta
amoxicilina) en la siguiente lectura.
