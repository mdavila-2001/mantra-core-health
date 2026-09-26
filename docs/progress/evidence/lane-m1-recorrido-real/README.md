# H5 — Recorrido real contra el VPS de preproducción (carril M1)

> **AVANCE: 9/10 tests — 3 corridas consecutivas, mismo resultado determinístico.**
> No es 10/10: hay un bug real y reproducible, documentado abajo, fuera del alcance de M1.

- Commit bajo prueba: front `5717bdb6` (imagen `zslh6pytstjjgf5mexeopvkz_web:5717bdb6...`),
  backend `abe90074`.
- Comando: `E2E_BASE_URL=https://test.173.249.39.237.sslip.io E2E_API_URL=https://test.173.249.39.237.sslip.io yarn pw --workers=1 playwright/carril-m1-recorrido-real-vps.spec.ts`
- Las tres salidas completas: `h5-corrida-1.txt`, `h5-corrida-2.txt`, `h5-corrida-3.txt`.

## Lo que sí quedó `VERIFIED` (9/10, las tres corridas)

1. La API responde por el proxy del mismo origen — no 503, no HTML (antes de esta sesión, esto
   daba 503 siempre).
2. El médico se registra y entra **contra la API real** (vía HTTP directo, no navegador).
3. El paciente se registra y entra contra la API real.
4–9. La vitrina pública del directorio carga en 200 con consola limpia, en 3 viewports × 2 temas.

## Lo que no anda (1/10, las tres corridas, mismo motivo)

**"la sesión real navega al panel sin que el simulador la intercepte"** — falla siempre en el
mismo punto: tras crear una cuenta de médico sintética y enviar el formulario de login real
(`login-identifier` + `login-password` + `login-submit`), la pantalla se queda en `/auth` con el
mensaje **"Las credenciales no son válidas"**, sin navegar nunca a `/dashboard`.

### Causa raíz encontrada (reproducida, no es una corazonada)

- Con `curl` directo contra `/iam/auth/login`, la MISMA cuenta recién creada (mismo email,
  misma contraseña) inicia sesión correctamente **dos veces seguidas**, con `200` y un
  `accessToken`/`refreshToken` reales en el cuerpo de la respuesta — ver la sesión de curl en
  este mismo hallazgo (no incluida acá por tener tokens reales, pero reproducible con
  cualquier alta nueva).
- Es decir: el backend **no** rechaza estas credenciales. El rechazo lo produce específicamente
  el flujo de login del navegador (Angular), no la API.
- El registro devuelve `"verificationStatus":"PENDING"` para toda cuenta nueva — hipótesis más
  probable: el front bloquea o interpreta mal el login de una cuenta con el correo sin verificar,
  y muestra el mensaje genérico de credenciales inválidas en vez de uno específico.
- Otra pista encontrada, sin confirmar como causa: el commit más reciente de la rama `test`
  (`a820d976`, de esta misma madrugada) declara `refreshCookie` en `environment.production-api.ts`
  — la respuesta real de `/iam/auth/login` trae `refreshToken` en el **cuerpo** (no en una
  cookie), así que si ese valor quedara en `true` en el artefacto desplegado, el `AuthService`
  esperaría una cookie que nunca llega. No se pudo confirmar el valor exacto horneado en el
  bundle desplegado (no aparece como string literal en `main-*.js`, probablemente inlineado o
  tree-shakeado) — queda como pista, no como veredicto.

### Clasificación (regla 80.4)

**`PRODUCT_BUG`**, reproducido tres veces de forma determinística (no es un fallo intermitente:
mismo resultado, mismo punto, mismo mensaje, corrida tras corrida). Fuera del alcance de M1
(infraestructura/despliegue/base de datos): esto es el flujo de sesión del front, terreno de
quien lleve esa área. Se documenta acá en vez de forzarlo a HECHO o taparlo con un reintento.

### Qué NO se hizo, a propósito

- No se debilitó la aserción del test para que pasara.
- No se investigó más profundo el `AuthService`/`refreshCookie` del front: es una capa que no
  le corresponde tocar a este carril (infraestructura), y ya se aisló el síntoma con evidencia
  suficiente para que quien sí la lleve continúe sin arrancar de cero.

## Artefactos

- `test10-fallo-artifacts/error-context.md` — snapshot de accesibilidad de la pantalla en el
  momento del fallo (se ve el email cargado y el mensaje de error real).
- `test10-fallo-artifacts/test-failed-1.png` — captura de pantalla del fallo.
