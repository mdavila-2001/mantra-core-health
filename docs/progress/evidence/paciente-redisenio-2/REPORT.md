# Rediseño del paciente — segunda vuelta (22/10/2026)

Pedido del cliente sobre lo entregado en #1143: «el corazón está horrible, que sea el logo
de AloVida de verdad»; «¿Cómo se siente?» estaba mejor antes, volver a ponerlo y mejorarlo;
mejorar **todas** las instancias de la onda; mejorar los chats, que tienen problemas de
padding; y subir el nivel de todo.

Base: `origin/mockup` (5b4e4ff0d, con #1143 ya mergeado).

## Qué cambia

| # | Cambio | Dónde |
|---|---|---|
| 1 | **Portada del inicio**: el corazón dibujado a mano se reemplaza por el **logo real** (`alovida-logo.svg`, sin redibujar ni recolorear) en un sello blanco con dos anillos que laten | `patient-home.html`, `styles/paciente.css` |
| 2 | **«¿Cómo se siente?» como estaba antes**: vuelve a `outlined`, con borde neutro y el radio de siempre, sin el borde de color de la capa del paciente | `patient-home.html`, `styles/paciente.css` |
| 3 | **…y mejorado**: el hueco en blanco al lado de la figura ahora tiene un «cómo funciona» en 3 pasos con número (toque dónde le pasa → elija lo que siente → le decimos a qué especialidad ir). Se va apenas se toca una zona | `symptom-check.html/.css` |
| 4 | **La onda del encabezado** de cada pantalla (trazo de electro que asomaba detrás del botón) → sello con el **logo real** a la izquierda del título | `styles/paciente.css` |
| 5 | **La onda del menú lateral** (dos trazos animados que, cortados, se veían como rayas sueltas al pie) → el logo como marca de agua, entero y centrado | `styles/paciente.css` |
| 6 | **La onda del chat vacío** → sello con el logo real y el globo de chat como insignia. «Alovida · Chats» → **«AloVida · Chats»** | `messaging.html/.css` |
| 7 | **Chats: separadores de fecha rotos**. «HOY», «19 DE OCTUBRE» se dibujaban como una barra blanca de lado a lado con la pastilla pegada a la izquierda (el `li` y su `span` llevaban los dos la pastilla). Ahora es una pastilla centrada. El mismo error está en `test` | `thread.css` |
| 8 | **Chats: padding**. Título, buscador y filtros arrancaban a 16, 12 y 8 px: ahora todos en la misma línea. Buscador de 44 px, filtros de 34 px con el elegido en petróleo, carril que se desvanece en vez de cortar a media palabra, filas de 80 px con separador | `styles/paciente.css` |
| 9 | **Mis citas**: fecha y hora en tamaño titular, franja de color por estado (confirmada, pedida, cancelada, anterior) y sombra suave | `styles/paciente.css` |
| 10 | **Tema oscuro**: la hora de la próxima cita y la fecha/hora de Mis citas no llegaban al contraste; pasan a la rampa clara | `styles/paciente.css` |

La onda del **login** (`auth-split scene="stage"`) no se toca: es regla del cliente.
La de la portada pública y la del sistema de diseño tampoco, porque no son del paciente.

## Evidencia

`antes/` es el estado de `mockup` con #1143; `despues/` es esta rama. Capturas con
`playwright/paciente-redisenio-capturas.mjs` (se agregó `dependientes`) y la nueva
`playwright/paciente-redisenio-hilo.mjs`, que abre el primer chat.

| Pantalla | Antes | Después |
|---|---|---|
| Inicio 1440 / 390 | `antes/inicio-*.jpg` | `despues/inicio-*.jpg` (+ `-oscuro`) |
| Dependientes (la onda detrás del botón) | `antes/dependientes-*.jpg` | `despues/dependientes-*.jpg` (+ `-oscuro`) |
| Chats, bandeja | `antes/chats-*.jpg` | `despues/chats-*.jpg` |
| Chats, conversación abierta | `antes/chat-abierto-*.jpg` | `despues/chat-abierto-*.jpg` |
| Mis citas | `antes/mis-citas-*.jpg` | `despues/mis-citas-*.jpg` (+ `-oscuro`) |

## Escalera de evidencia

- **RUNS**: `ng build` de producción OK; inicial 1,50 MB, dentro del presupuesto. Los avisos
  del build son preexistentes.
- **TESTED**: síntomas + mensajería + inicio + Mis citas + armazón: **548/549**. El rojo,
  `messaging.spec.ts › no borra la bandeja cuando un tic falla`, falla igual en
  `origin/mockup` limpio (comprobado en un worktree aparte): espera un texto de error que el
  componente ya no muestra. Es preexistente.
- **VERIFIED (navegador)**: capturas de arriba contra `ng serve`, claro y oscuro, 1440 y 390.

## No verificado

- La suite unitaria completa no se corrió, sólo la dirigida.
- `:has()` (franjas por estado en Mis citas) no lo soporta Firefox < 121. Ahí la franja queda
  en el color por omisión: no se pierde información, el sello sigue diciendo el estado.
