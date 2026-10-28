# `app-loading-state` — evidencia de navegador (2026-10-28)

Capturas de la molécula montada en la vitrina `/design-system` con `ng serve`
(Chromium/Playwright), en 1440 y 390 px, tema claro y oscuro (`data-theme="dark"`).
El montaje en la vitrina fue temporal y no se commitea: el HTML de la vitrina
está en su techo de `check-max-lines`.

Medido en cada combinación: cada `app-loading-state` es `role="status"`, sin
otro `role="status"` adentro (un solo anuncio), sin desborde horizontal; el
aro toma `--brand-primary` (claro `rgb(11, 85, 126)`, oscuro `rgb(112, 193, 185)`).

**No se ejecutó** la captura dentro del diálogo «Llenar el formulario médico»
con la lectura demorada: necesita sesión de médico y backend.

## Segunda tanda: pantallas reales (migración)

`pantallas-reales/`: `ng serve --configuration development,demo` (maqueta), sesión
de paciente `7654321`, en 1440 y 390 px, tema claro y oscuro (la preferencia
guardada del `ThemeService`). La maqueta responde en 40–600 ms con `timer` de
rxjs; para que la espera llegue a la foto, `captura.cjs` congela solo esos
plazos (`setTimeout`/`setInterval` de 40, 90, 120 y 600 ms) **después** de
iniciar sesión y navega dentro de la app. Es un arreglo de captura y no toca
el código.

Medido en `/dashboard` («Cargando su historia clínica…») y `/my-account/privacy`
(«Cargando quién ve su historia…»), en las 8 combinaciones: un solo
`role="status"`, sin desborde de la espera ni scroll horizontal del documento,
y el aro en `--brand-primary` (claro `rgb(11, 85, 126)`, oscuro
`rgb(112, 193, 185)`).

**No se ejecutó** en `/messaging`: la espera no apareció con este método. Las
otras 42 plantillas migradas están cubiertas por sus pruebas unitarias, no por
capturas.
