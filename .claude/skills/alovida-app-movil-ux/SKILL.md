---
name: alovida-app-movil-ux
description: UX de la app móvil de ALOVIDA (Flutter, `mantra_core_health_mobile`) — tokens de `lib/theme`, componentes `Mantra*` de `lib/shared`, áreas táctiles de 48, safe areas, teclado, accesibilidad con Semantics, permisos, dart-defines por entorno y cómo probar en el simulador iOS. Usar al diseñar o revisar cualquier pantalla de la app, al portar algo del front, o cuando algo "en el celular se siente incómodo".
---

# UX de la app móvil de ALOVIDA

Portada de `atlas-app-movil-ux`. Allí era Expo/RN; **aquí es Flutter** (paquete `alovida_mobile`,
`lib/` con `core/`, `features/`, `shared/`, `theme/`, `mockup/`). El front Angular es la fuente de
verdad visual: la paleta y escalas de Flutter son espejo suyo (`MantraMotion` ↔ `--dur-*`).

## 1. Un sistema, dos plataformas

- Tokens: `lib/theme/` — `mantra_palette.dart`/`mantra_ramp.dart` (color), `mantra_tokens.dart`
  (`MantraState` bg/fg/bd por estado + `MantraTokens` extension; atajo `context.mantra`),
  `mantra_geometry.dart` (`MantraPadding` sp1…sp20, `MantraRadius`, `MantraStroke`, `MantraMotion`),
  `mantra_typography.dart`, `mantra_theme.dart`.
- Lo que cabe en `ColorScheme` no se duplica; el resto va en `MantraTokens`. **Nada de `Color(0x…)`
  ni `Colors.red` en una pantalla**: piden `Theme.of(context).colorScheme` o `context.mantra`.
- Componentes en `lib/shared/` (atoms/molecules/organisms, barril `shared.dart`): ver `alovida-ui-componentes`.
- Reglas de `alovida-ui` también aquí: formularios con icono a la izquierda en cada campo, pestañas
  centradas a ancho completo, cero cards laterales, catalogables en select.

## 2. Áreas táctiles, safe areas, teclado

- Mínimo **48×48** de hit-area: los botones lo logran con `MaterialTapTargetSize.padded`
  (`shared/atoms/button/button_tokens.dart`). Un `GestureDetector`/`InkWell` a pelo sobre un icono de
  16 px no cumple: envolver en `IconButton`/`Semantics` + `ConstrainedBox(minWidth/minHeight: 48)`.
- `SafeArea` en pantallas; `MediaQuery.viewInsetsOf(context).bottom` para que el campo con foco quede
  sobre el teclado, y llevar la vista hasta el primer error en formularios largos.
- Hojas modales: `shared/organisms/bottom_sheet`. Volver atrás: `mantra_app_bar` (no inventar cabeceras).

## 3. Accesibilidad como contrato

`test/a11y_contract_test.dart` recorre todas las familias de `shared/` y exige nombre accesible; una
familia nueva se añade ahí. Antecedente real: ocho controles de formulario sin una sola llamada a
`Semantics` → el lector anunciaba "campo de edición" en un formulario clínico entero. Estado nunca solo
por color (`MantraState` trae borde y texto). Respetar `MediaQuery.disableAnimationsOf` (ver `alovida-movimiento`)
y `textScaler` (sin alturas fijas en texto).

## 4. Entornos y datos

`dart_defines/*.json` por entorno (`API_BASE_URL`, `WS_BASE_URL`, `ENVIRONMENT`, timeouts); por defecto
apuntan a `https://dev.alovida.api.arauzsoftware.com`. Para el stack local se usa un define propio
(`dart_defines/local-ios.json`, sin versionar) con `API_BASE_URL=http://localhost:3000` (el simulador
iOS ve el localhost del Mac; en Android emulador es `10.0.2.2` o `adb reverse`). `lib/mockup/` simula
repositorios sin API (`main_mockup.dart`). Config en `lib/core/config/app_config.dart`.
Si el simulador rechaza el HTTP plano, mirar ATS: `ios/Runner/Info.plist` no declara `NSAppTransportSecurity` (excepción solo para desarrollo, nunca en el build de TestFlight/producción).

## 5. Estados y espera

Vacío / cargando / error / sin permiso en cada vista que trae datos (`empty_state`, `skeleton`,
`alert`). Un botón apagado dice por qué, como instrucción y no como alarma. Nada en pasado sobre lo que
no ocurrió ("Te enviamos un código" sin haberlo pedido).

## 6. Cómo se prueba

```bash
cd mantra_core_health_mobile
flutter analyze && flutter test                    # test/ incluye atoms, parity, a11y_contract
flutter run -d <UDID> --dart-define-from-file=dart_defines/local-ios.json
xcrun simctl io <UDID> screenshot salida.png       # evidencia; el simulador del brief: "Visual_A_iPhone17"
```
`integration_test/` + `test_driver/` para recorridos. `test/parity/` compara contra el catálogo de Angular.

## 7. Deuda conocida (informativa, no barrer)

Colores literales fuera de `lib/theme`: `#14B8A6` en 3 pantallas (`book_appointment_sheet.dart:133`,
`patient_health_screen.dart:265`, `diagnostic_results_viewer_screen.dart:215`) y `Colors.*` de Material en
21 sitios (`invoice_detail_sheet`, `redeem_qr_sheet`, `attachment_viewer_screen`,
`insurance_claim_detail_screen`, `mantra_bottom_nav`, `mantra_app_bar`, `mantra_timeline`). Se corrigen al
tocar esa pantalla, con el token semántico, nunca todas de una pasada.

## Checklist
- [ ] Sin `Color(0x…)`/`Colors.*` nuevos; tokens de `lib/theme`.
- [ ] Todo tocable ≥ 48 y con `Semantics`; `a11y_contract_test` verde.
- [ ] SafeArea + teclado resueltos; vacío/cargando/error/sin permiso vistos.
- [ ] Movimiento con `MantraMotion.of(context)`.
- [ ] Capturas del simulador en claro y oscuro; `flutter analyze` y `flutter test` verdes.
