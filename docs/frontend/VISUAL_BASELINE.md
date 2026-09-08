# Baseline visual

Estado del navegador **antes** de tocar nada. Sin baseline no se puede demostrar
mejora ni detectar regresión.

## Viewports

```text
390x844 · 768x1024 · 1024x768 · 1440x900 · 1920x1080
```

## Cómo capturarlo

```bash
yarn start            # ng serve
yarn pw:baseline      # playwright/carril-01-baseline.spec.ts
yarn pw:rutas         # salud de rutas
```

Trampas del arnés (ver skill `visual-quality-gate`): no esperar `networkidle`
contra `ng serve`; `testId` no es `data-testid`; entrar por URL directa además
de navegar.

## Dónde va

```text
docs/frontend/evidence/baseline/<ID-ruta>/<ancho>x<alto>.png
```

## Qué registrar además de la imagen

Errores de consola · page errors · requests fallidas · defectos responsive ·
comportamiento roto · observaciones de accesibilidad.

Clasificar cada defecto con la taxonomía del playbook: `VIS-*`, `RESP-*`,
`UX-*`, `ARCH-*`, `A11Y-*`.

## Rutas a cubrir

Las 11 de `docs/routes/route-catalog.md`. P0 primero.

| ID | Ruta | Rol | Capturado | Defectos |
|---|---|---|---|---|
| - | - | - | no | - |
