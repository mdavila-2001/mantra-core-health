# Verificación ejecutada (2026-11-06) — salidas literales recortadas

Rama `claude/jolly-wozniak-l651q1` sobre `origin/dev` (68bb79660). Contra el **doble (mock)** del front; la API real no se ejercitó.

## yarn typecheck (app + cypress + playwright)
```text
exit 0
```

## yarn build
```text
Output location: /home/user/mantra-core-health/dist/mantra-core-health
exit 0
```

## Tests focalizados nuevos y del área (analysis-order-block, body-site-picker, mock study-detail, data-access diagnostics y anatomy-atlas)
```text
 Test Files  17 passed (17)
      Tests  220 passed (220)
```
Más los del glosario (la lógica del atlas se movió a `core` y el glosario la re-exporta) y `diagnostic-orders`: en la corrida `t5` (44 archivos) `540 passed | 3 failed`; los 3 fallos eran: 1 mío (se corrigió: usaba una región sin mallas) y 2 de `diagnostic-orders` (`«Reservar hora»…`), que **no son de este cambio** (ver «Fallos preexistentes»).

## yarn lint
- Rutas tocadas (`eslint` sobre `core/data-access`, `analysis-order-block`, `organisms/body-site-picker`, mock del detalle, `diagnostic-orders`, scripts y playwright nuevos): **sin errores**.
- `yarn lint` global (antes de corregir mis 4 errores): `✖ 17 problems (17 errors)`. Descontados los míos (corregidos, entre ellos «una molecule no puede depender de un organism», que movió el selector a `organisms/`), quedan **13 errores preexistentes** en archivos que no toqué: `app.routes.ts` (5), `files.handlers.ts`, `practice.handlers.ts`, `profile-photos.handlers.spec.ts` (3) y otros de `dev`.

## Playwright contra la maqueta (`ng serve --configuration development,demo --watch=false`, Chromium con SwiftShader, 1 worker, sin `networkidle`)
```text
Running 8 tests using 1 worker
  8 passed (3.0m)
```
Laboratorio (exige muestra, la guarda, la conserva tras recargar) · Imagen (lista con teclado, región propuesta por la pieza, lado, modalidad, tipo de hueso; todo vuelve tras recargar) · 6 capturas 390/768/1440 × claro/oscuro.

## yarn test completo — BLOCKED (ENVIRONMENT)
Cinco intentos (`yarn test`, y en trozos por carpeta) terminan con `exit 129` justo después de `RUN v4.1.10`, con `fatal error: all goroutines are asleep - deadlock!` del servicio de esbuild y el aviso del sandbox «the kernel killed at least one process for lack of memory». No es un fallo de pruebas: el corredor muere antes de reportar. No se ejecutó la suite completa.

## Fallos preexistentes (no de este cambio)
`diagnostic-orders.spec.ts` › «Reservar hora» sólo aparece en estudios de laboratorio o imagen sin resultado ni turno · una orden con turno… `accionesDe` agrega `reservar` a toda orden que no es procedimiento; el spec espera lo contrario. Verificado contra una copia limpia de `origin/dev` (ver abajo).
