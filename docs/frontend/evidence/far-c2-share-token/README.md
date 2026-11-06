# Evidencia — el token de la receta no se filtra y cada enlace se administra

Capturas con datos de prueba (cuentas `@alovida.test`), front y API de esta corrección.

| Captura | Qué muestra |
|---|---|
| `c2-compartir-antes-*.png` | Abrir «Compartir» no crea nada: explica qué se crea y ofrece «Crear enlace». Abrirlo y cerrarlo tres veces: 0 `POST /clinical/prescription-shares` |
| `c2-compartir-creado-desktop-light.png` | Con «Crear enlace»: un `POST`, el enlace y su QR |
| `c2-enlaces-*.png` | «Enlaces compartidos» tras recargar: fecha y hora de creación, estado y aperturas **de farmacia** |
| `c2-revocar-confirmar-…`, `c2-revocado-recarga-…` | Revocar pide confirmación; `POST …/revoke` 204; tras recargar la fila dice «Revocado · ya no abre para nadie» |
| `c2-rx-publica-mobile-light.png` | `/rx/<token>` sin sesión; la respuesta trae `X-Robots-Tag: noindex, nofollow` y `Referrer-Policy: no-referrer` |
| `c2-farmacia-abre-mobile-light.png` | «Soy farmacia» → `/auth?returnUrl=…` → login de la farmacia → vuelve a la receta (`/administration/pharmacy-orders/rx/<token>`) |

Por la API: tres vistas públicas dejan el contador de aperturas igual (se registran como `PUBLIC_VIEW`), y una apertura de
farmacia lo sube en uno. Con un token de prueba, el log de la API y el del servidor de renderizado no lo contienen, tampoco
tras el login con `returnUrl`.
