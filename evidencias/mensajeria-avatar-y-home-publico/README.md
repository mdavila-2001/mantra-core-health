# Avatar en mensajería, `homeGuard` y el buscador de profesionales (26/08/2026)

Qué prueba cada archivo de esta carpeta.

| Archivo | Qué prueba |
| --- | --- |
| `01-home-sin-sesion-a-buscar.png` | Sin sesión, `/` redirige a `/buscar` (la vitrina pública), no al login. |
| `02-home-con-sesion-a-dashboard.png` | Con sesión, `/` redirige a `/dashboard`: el `homeGuard` no le cambia nada a quien ya inició sesión. |
| `03-buscar-profesional-url-corregida-200.png` | El buscador de «Escribirle a un profesional» dentro de Chats: la llamada a `GET /public/search/practitioners` responde `200` (antes de este PR pedía `/community/public/search/practitioners`, que no existe, y siempre daba `404`). |

Corrido contra la API arrancada desde el fuente en `:3030` (no el contenedor, que
sirve una imagen vieja — ver [[api-desde-el-fuente-en-3010]]) y el front en
`ng serve --proxy-config proxy.conf.verificacion.json --port 4230`, con
`tools/redesa/seed-dev-data.mjs` sembrando médicos y pacientes de prueba.

## El bug que apareció al verificar, no al escribir el código

El diff que motivó esta corrida —avatar en conversaciones (`avatarDeConQuien`),
`homeGuard`— ya tenía sus 123 tests unitarios en verde. Al probarlo de punta a
punta con un usuario real, «Escribirle a un profesional» fallaba con
**"No pudimos buscar profesionales."** El log de la API mostraba:

```
Cannot GET /community/public/search/practitioners?limit=10&q=Rojas
```

`CommunityPublicController` registra sus rutas sin prefijo de módulo —vive en
`/public/search/practitioners`, no en `/community/public/search/practitioners`—
pero `CommunityClient.searchPractitioners()` (commit `264bde23`, del
2026-08-18, **anterior** a este trabajo) armaba la segunda. `PublicDirectoryClient`,
en el mismo repo, ya llamaba a la ruta correcta — la inconsistencia era sólo en
este cliente. Sin test unitario que fijara la URL, nadie lo vio hasta correr el
flujo real. Corregido en `community.client.ts`; la ficha pública que no
aparece en los resultados se debe a que en esta máquina la proyección
`read_models.public_provider_directory` no existe (hueco de entorno ya
documentado, no de código).
