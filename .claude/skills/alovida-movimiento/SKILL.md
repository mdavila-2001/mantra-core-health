---
name: alovida-movimiento
description: El movimiento en ALOVIDA — tokens `--dur-*`/`--ease-*` y la regla global de movimiento reducido en el front Angular, `MantraMotion` y `MediaQuery.disableAnimationsOf` en Flutter. Cuándo una animación está justificada y cuándo es decoración que hay que quitar. Usar al animar una entrada, un diálogo, una lista o una microinteracción, y al diagnosticar una interfaz que "se mueve sola".
---

# Movimiento en ALOVIDA

Portada de `atlas-movimiento` (allí Reanimated/RN). Aquí: **CSS con tokens** en el front y
**`MantraMotion`** en Flutter. Referencia: `docs/design-system/motion.md`,
`docs/refactor-profesional/trabajo/MATRIZ_MOVIMIENTO.md`.

## 1. La regla única

Todo movimiento contesta una de dos preguntas: **«¿de dónde salió esto?»** o **«¿me hizo caso?»**. Lo
demás es decoración. Corolario aprendido en Atlas: **lo que se mueve sin que nadie lo toque no comunica
nada**, y en un contexto clínico compite con el dato. Reglas del propio `motion.md`:

1. Solo `transform` y `opacity`; nunca `width/height/top/left/margin` (reflow en cada cuadro).
2. Nada por encima de ~320 ms.
3. Nada esencial detrás de una animación: con movimiento reducido el contenido aparece igual.
4. Bucles infinitos solo para carga o "estoy escuchando" (spinner, skeleton, grabando).
5. **Nada de movimiento en contenido clínico**: un valor que se desliza al actualizarse se lee mal.
6. Sin transiciones entre rutas ni paralaje.

## 2. Front Angular: los tokens

Una sola escala en `src/styles.css` (espejo Flutter `MantraMotion`; nombres tipados en
`src/app/shared/motion/motion-tokens.ts`, `durationVar()`):
`--dur-fast` 120 ms (eco de un clic: hover/foco/color), `--dur-base` 200 ms (cambio de estado),
`--dur-slow` 320 ms (entra/sale: cajón); `--ease-standard`, `--ease-out`, `--ease-spring` (solo para
confirmar un gesto, nunca para datos). La hoja v1.1 los usa como alias `--mov-rapido/medio/lento`.
Escribe `transition: background-color var(--dur-fast) var(--ease-standard)`; **un literal nuevo
(`.2s ease`) es deuda**.

Directivas existentes: `shared/motion/reveal-on-scroll.directive.ts`, `stagger-list.directive.ts`,
`pointer-scene.directive.ts` (decorativas, para públicas/landing, no para pantallas clínicas).

## 3. Movimiento reducido no es una casilla

`styles.css` tiene la regla global con `!important` (`0.01ms`, no `0`: mantiene `transitionend`;
`animation-iteration-count: 1`). Un componente NO debe pelear contra ella: `progress.css` y
`spinner.css` la contrarrestan a propósito (`infinite !important`) porque una barra indeterminada
parada parece rota; cualquier otro caso que la sobreescriba necesita comentario que lo justifique.
Falta aún una prueba automatizada de reduced-motion (el doc lo admite): probar con
`page.emulateMedia({ reducedMotion: 'reduce' })` en Playwright.

## 4. Flutter

`MantraMotion.fast` = 150 ms y `MantraMotion.of(context)` devuelve `Duration.zero` si
`MediaQuery.disableAnimationsOf(context)`. Úsalo en vez de `Duration(milliseconds: n)` suelto.
Controles con su token: `kSwitchSlideDuration`, `kSkeletonPulseDuration` (ya respetan reducir
movimiento). Splash tiene el suyo (`splash_tokens.dart`, con `esperaSinMovimiento`).
Literales sueltos detectados: `chat_detail_screen.dart:68` (200 ms). Debounces/timeouts no son movimiento.

## 5. Diagnóstico de "se mueve sola"

```bash
grep -rn "infinite" src --include='*.css'                       # 25 hoy; cada uno, justificado o fuera
grep -rnE ":hover[^{]*\{[^}]*transform" src --include='*.css'   # superficies que se elevan sin ser pulsables
grep -rnE "(animation|transition)[^;]*[0-9]+m?s" src/app --include='*.css' | grep -v 'var(--'  # literales
```
Cargar la pantalla y no tocar nada 10 s: lo que se mueva, se justifica o se quita. Hoy los bucles más
discutibles son los del acceso (`auth-split.css`, `auth-stage.css`: halos/latidos/ecg, ~10 animaciones
infinitas en una pantalla donde se rellena un formulario) y la nube de `symptom-check`. **No se quitan
en barrido**: se evalúan cuando se toca esa pantalla.

## Checklist
- [ ] La animación responde "¿de dónde salió?" o "¿me hizo caso?".
- [ ] Duraciones/curvas de tokens (`--dur-*`, `--ease-*` / `MantraMotion`), cero literales.
- [ ] Solo `transform`/`opacity`; ≤ 320 ms; nada en contenido clínico.
- [ ] Con `prefers-reduced-motion` / `disableAnimations` la pantalla está completa.
- [ ] Ningún `infinite` sin causa (carga o escucha).
