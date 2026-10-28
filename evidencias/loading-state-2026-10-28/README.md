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
