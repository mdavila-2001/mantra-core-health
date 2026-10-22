---
name: alovida-estilo-front
description: Cómo se escribe el estilo en el front Angular de ALOVIDA — CSS plano de componente con los 188 tokens, sin Tailwind; dónde se añade un token, especificidad con encapsulación de Angular, tema claro/oscuro y los gates (contraste, tokens inexistentes, colores sueltos). Usar al tocar el aspecto de cualquier pantalla, al añadir un color o una clase, o cuando un estilo "no se deja sobrescribir".
---

# Estilo en el front de ALOVIDA

Portada de `atlas-estilo-portales`, pero aquí es lo contrario: **no hay Tailwind ni remapeo**. Cada
componente standalone lleva su `.css` junto al `.ts`/`.html`, y todo valor sale de una custom
property. Primero leer `alovida-diseno` (dónde vive cada token).

## 1. El modelo

- Un componente = `nombre.ts` + `nombre.html` + `nombre.css` (estilos encapsulados por Angular).
- Los valores NUNCA son literales: `color: var(--text-secondary)`, `padding: var(--sp-4)`,
  `border-radius: var(--r-md)`, `font-size: var(--fs-caption)`, `transition: background var(--dur-fast) var(--ease-standard)`.
- Estados semánticos: `var(--st-success-bg|fg|bd)`, `--st-warning-*`, `--st-error-*`, `--st-info-*`.
  Fondo claro + texto oscuro + borde del mismo tono; nunca color sólido con texto blanco.
- Desde TypeScript: `cssVar(BRAND.primary)`, `rampToken('petrol', 500)`, `spacingToken(4)` de
  `@core/tokens/design-tokens.types` (plantillas literales: un error de tipeo no compila).

## 2. Añadir un token (la única vía)

1. Declararlo en `src/styles.css` (bloque `:root`, y su par en AMBOS bloques de oscuro:
   `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) … }` y `:root[data-theme='dark']`).
2. Añadirlo al catálogo tipado `src/app/core/tokens/design-tokens.types.ts` (`node scripts/check-tokens.mjs`).
3. Si es texto o control, añadir su par a `scripts/check-contrast.mjs` y comprobar 4,5:1 / 3:1.
4. Documentarlo en `docs/design-system/tokens.md`.
`src/styles/alovida.css` es generado por `scripts/sync-alovida.mjs`: no se toca a mano.

## 3. Trampas medidas

- **`var(--x)` inexistente no rompe nada visible**: la declaración se descarta y la propiedad hereda.
  Pasó con `--radius-md` (real: `--r-md`) → esquinas cuadradas, y con `--st-*-border` (real: `-bd`) →
  ningún borde de estado. Si dentro de un atajo (`border: var(--stroke-1) solid …`) falla uno, cae el
  atajo entero. Gate: `node scripts/check-css-tokens.mjs`. Hoy marca `--fs-body-sm`
  (`organization-profile.css`).
- **Dos espacios de nombres**: `--text-*`/`--brand-*` (inglés, v1.0) vs `--tinta`/`--petroleo` (castellano,
  v1.1). No mezclar en un mismo componente sin motivo; lo nuevo, v1.0.
- **Especificidad con encapsulación**: el CSS de componente (atributos `_ngcontent`) gana a una clase
  global. Una regla escrita puede no aplicarse: se comprueba con el `getComputedStyle` real, no con `grep`.
  Evitar `::ng-deep`; si hace falta tocar un hijo, expón un token/variable (`--_avatar-fg`) en el hijo.
- **Rejillas de formulario**: `repeat(auto-fit, minmax(min(15rem,100%), 1fr))` mide la caja, no la
  ventana. Una media query de viewport parte los campos en una tarjeta estrecha.
- **`flex-1` en barras de filtros**: base 0 se come el déficit y la búsqueda desaparece; el suelo va en
  `min-width`, y `overflow: hidden` esconde el síntoma.
- **Sin `!important`** salvo la regla global de movimiento reducido (documentada en `styles.css`).
- Un worktree nuevo no compila hasta `node scripts/generate-env.mjs` y
  `node scripts/generate-component-index.mjs` (errores TS en archivos ajenos).

## 4. Tema y SSR

El script anti-parpadeo de `index.html` y `theme.service.ts` deciden el tema; los componentes no
leen el tema, solo piden tokens. Probar claro y oscuro; el modo `system` sin atributo.

## 5. Verificación

```bash
node scripts/check-css-tokens.mjs      # tokens usados pero no declarados
node scripts/check-contrast.mjs        # 4,5:1 texto / 3:1 controles, ambas hojas
node scripts/check-colores-sueltos.mjs # sin literales de color nuevos
yarn lint && yarn typecheck            # tsc no ve plantillas: abrir la pantalla
```
Capturas por ancho y por tema (`visual-proof`). `ng build` escribe `dist/`: en un worktree, no en el
árbol compartido.

## Checklist
- [ ] Ningún `#hex`/`rgb()` nuevo; ningún `px`/`ms` suelto donde hay token.
- [ ] Todo `var(--x)` existe (gate verde).
- [ ] Token nuevo: en `styles.css` (claro + 2 oscuros), catálogo tipado, contraste, docs.
- [ ] Mirado en claro y oscuro; sin `::ng-deep` ni `!important` sin comentario.
