# Doble revisión — capturas de `/auth` (H1.S2, production-api)

6 capturas: 375/768/1440 × claro/oscuro. Ninguna backend real detrás (build servido standalone,
sin nginx ni API arriba) — lo que se está verificando es que **no hay cartel de maqueta y que la
petición sale a la red real** (no capturado en la imagen; ver `PLAN.md` §H1 para la evidencia de
red), no el contenido clínico de la pantalla.

## Primera pasada — verificación

| Captura | Nota |
|---|---|
| auth-375-light.png | Formulario completo, sin cartel de mock. OK |
| auth-375-dark.png | Formulario completo, sin cartel de mock. OK |
| auth-768-light.png | Formulario completo, sin cartel de mock. OK |
| auth-768-dark.png | Formulario completo, sin cartel de mock. OK |
| auth-1440-light.png | Formulario completo, sin cartel de mock. OK |
| auth-1440-dark.png | Formulario completo, sin cartel de mock. OK (recapturada — ver hallazgo abajo) |

## Segunda pasada — adversarial

1. ¿Algún elemento cortado o superpuesto? No.
2. ¿Placeholder, lorem o imagen rota? No.
3. ¿Contraste dudoso? No, a simple vista en ambos temas.
4. ¿Estados obligatorios (carga/vacío/error) faltantes? N/A — esta captura es sólo la carga
   inicial del login; no es el kill-test de estados M34.
5. ¿Artefacto de depuración visible? No.
6. **¿El cartel de cuentas demo está realmente ausente?** Sí, confirmado contra las capturas
   equivalentes de la maqueta (`debug-mockup-1440-dark.png`), que sí lo muestra («Datos de
   prueba» / «Ver componentes» abajo a la izquierda).
7. ¿Parpadeo o mismatch de hidratación visible? Sí — ver hallazgo.
8. ¿Los dos temas se ven realmente distintos? Sí.
9. ¿Scroll horizontal o layout roto en 375? No.
10. ¿Marca consistente (logo, motivo del pulso) en las seis? Sí.

**Veredicto por pantalla: APROBADA** las 6.

## Hallazgo (pre-existente, fuera de alcance) — no bloquea esta entrega

La primera corrida de este mismo script, con una espera fija de 500 ms tras `networkidle`,
capturó `auth-1440-dark.png` con el formulario **parcialmente vacío**: sin título, sin los dos
campos ni el botón «Entrar» — sólo el pie del panel. Antes de asumir que era un defecto de H1, se
reprodujo **exactamente igual en la maqueta** (`debug-mockup-1440-dark.png`, con el campo de correo
visible pero contraseña y botón todavía ausentes) — o sea, **no lo causó este carril**: es un
retraso de hidratación o una transición ya existente en el formulario de login compartido, que se
resuelve solo si se espera a que `input[type=password]` quede visible (lo que hace la recaptura
final de arriba). Se deja anotado para quien sea dueño de esa pantalla; no se investigó más porque
está fuera del alcance de este encargo (`src/app/features/auth/**` no está en su IN).
