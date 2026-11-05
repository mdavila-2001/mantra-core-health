# La hoja del paciente quedaba vieja en el navegador (22/10/2026)

Síntoma: en «Mi perfil» seguía el trazo de electro dibujado a mano —el de la
primera vuelta, #1143— en vez del sello con el logo de AloVida que puso
#1145. En móvil no salía ninguno de los dos.

Causa: `paciente.css` se compila aparte (`inject: false`) y Angular no le pone
huella al nombre, pero `express.static` servía **todo** con
`Cache-Control: public, max-age=31536000`. El navegador que la bajó en #1143
no la volvía a pedir durante un año. Medido contra el sitio publicado: el
servidor ya entregaba la versión con el logo; el navegador no la pedía.

Arreglo:
- `server/build-assets.ts` → `cachePorHuella`: lo que esbuild firma
  (`-XXXXXXXX.js|css`) sigue con un año; el resto —`paciente.css` y todo
  `public/`— va con `no-cache` (revalida con el ETag: 304 sin cuerpo).
- `shell-layout.ts`: el enlace pasa a `paciente.css?v=2`, para los navegadores
  que ya la tienen guardada con la cabecera vieja.

Verificación (`yarn build` + `node dist/.../server.mjs` en :4291):

| Archivo | Cache-Control |
|---|---|
| `paciente.css` | `no-cache` (y `If-None-Match` → `304`) |
| `alovida/imagenes/alovida-logo.svg` | `no-cache` |
| `main-NI65J4GG.js` | `public, max-age=31536000` |

En el navegador, paciente en «Mi perfil»: el enlace es `paciente.css?v=2` y el
sello es el logo, a 1440 y 390 (`cabecera-1440.png`, `cabecera-390.png`).
Pruebas: `build-assets.spec.ts` + `shell-layout`: 95/95. `yarn typecheck` OK.
