# Intento de medición del flujo de reserva

Fecha: 2026-09-23. Corte: `b655e8449abd662d6b24156fd6e2b06aeb120cc1`.

1. Se inició un único `yarn start:dev` y `http://localhost:4200` respondió `200`.
2. Una visita anónima a `/directory` mostró el formulario de inicio de sesión, como corresponde al guard.
3. El arnés Playwright cargó `paciente@alovida.mock` y una contraseña no vacía, pulsó `login-submit` y esperó la respuesta de `/iam/auth/login`.
4. La espera agotó los 30 s sin observar ninguna respuesta de esa ruta. Por tanto no hay una tabla honesta de solicitudes de la ficha, ni medición de cuatro clics, ni capturas que puedan declararse válidas.

El servidor y el navegador temporal se apagaron al terminar. Para cerrar H1.S2 hay que restablecer un inicio de sesión observable en el servidor local o proporcionar una sesión autenticada reproducible; recién entonces se medirá el mismo recorrido antes/después.
