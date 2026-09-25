# «Mis puntos» como quinta pestaña del perfil del paciente — 2026-09-23

Pedido del cliente (N-03): la billetera de puntos deja de ser una pantalla aparte con su propia
cabecera y pasa a ser la quinta pestaña de «Mi perfil», dentro de la misma tarjeta.

Cuenta sintética de la maqueta: `paciente@alovida.mock`. Ruta: `/my-account`. Guion:
`playwright/mis-puntos-quinta-pestana.mjs` (18 comprobaciones, todas en verde; consola y red sin
errores ni respuestas 4xx/5xx).

## Capturas y lo que se miró en cada una

| Captura | Viewport · tema | Qué se miró | Resultado |
|---|---|---|---|
| `despues-ficha-1440-claro.png` | 1440 · claro | Tira con cinco pestañas en el orden del alta y «Mis puntos» al final; se entra por «Datos personales» | OK |
| `despues-puntos-1440-claro.png` | 1440 · claro | La billetera dentro de la tarjeta, sin cabecera propia; una sola cabecera en la pantalla («Mi perfil»); estado vacío con explicación y salida («Ver mis pedidos») | OK |
| `despues-puntos-1440-oscuro.png` | 1440 · oscuro | Lo mismo en tema oscuro: fondo de tarjeta, subrayado de la pestaña activa, texto e ícono del vacío legibles | OK |
| `despues-puntos-768-claro.png` | 768 · claro | Sin desborde horizontal; la tira entra completa | OK |
| `despues-puntos-375-claro.png` | 375 · claro | Sin desborde horizontal; la tira desborda con sus flechas y el panel de la billetera se lee entero | OK |
| `despues-puntos-375-oscuro.png` | 375 · oscuro | Lo mismo en oscuro | OK |
| `despues-url-directa-1440-claro.png` | 1440 · claro | `/my-account?pestana=puntos` entra con la billetera abierta (es lo que necesita el redirect de la ruta vieja) | OK |
| `despues-ruta-propia-1440-claro.png` | 1440 · claro | `/my-account/loyalty` sigue existiendo con su cabecera y migas, como antes | OK |
| `despues-editor-1440-claro.png` | 1440 · claro | Con el lápiz abierto, «Mis puntos» sigue en la tira pero apagada; pulsarla no abre nada | OK |

Observación, no defecto de este cambio: en 375 la tira muestra dos rótulos por vez y la pestaña
activa puede quedar fuera de la parte visible de la tira cuando se seleccionó antes de achicar la
ventana; las flechas la traen. Es el comportamiento previo de la tira de pestañas.

## Estados de la billetera

La cuenta de la maqueta no tiene programa activo, así que la pestaña se vio en su estado vacío
(S3, con próxima acción). Los estados con saldo, canje y comprobante son los de la pantalla
propia y no cambian con este trabajo: los cubre `loyalty.spec.ts`.
