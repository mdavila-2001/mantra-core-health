# Dirección visual — fase 03

## Decisión: conservar la identidad REDSAT y ajustar su aplicación

El producto **ya tiene** identidad definida y documentada: sistema REDSAT v1.0 del diseñador
(`src/styles.css`, 188 tokens; norma en `SALUD/Arquitectura/identidad-visual.md`), con claro y
oscuro, excepciones WCAG E1–E4 medidas y un espejo en Flutter. El kit prevé exactamente este caso
(«Identidad definida: conserva logotipo y colores; adapta tokens para contraste y coherencia»).

Por eso esta fase **no** crea paleta, tipografía ni tokens de color nuevos. La «claridad con
profundidad moderada» del kit se traduce aquí en tres reglas sobre lo existente:

| Principio del kit | Cómo se aplicó | Dónde |
|---|---|---|
| El contenido que se viene a buscar manda | La fecha es el único dato con peso en la fila de una cita; lo próximo antes que lo pasado | `appointments.css` `.turnos__fecha` |
| La acción principal siempre reconocible | Primaria en la ranura `[page-actions]` del `page-header`, que la garantiza en todos los anchos | `appointments.html` |
| Materiales discretos, sin efectos gratuitos | Subtítulos de grupo en vez de otra tarjeta; sombra sólo donde hay contenido oculto | `.turnos__grupo-titulo`, `data-table.css` |
| Texto en castellano correcto | Sólo la inicial en mayúscula (`::first-letter`), no `capitalize` | 5 reglas |
| Movimiento con una sola escala | `--dur-*`/`--ease-*` canónicos; `--mov-*` como alias | ver `MATRIZ_MOVIMIENTO.md` |

## Tokens usados (todos existentes)

Espaciado `--sp-1…6` · tipografía `--fs-body`, `--fs-h3`, `--fs-caption` · color
`--text-primary|secondary|muted`, `--bg-surface`, `--border-*` · foco: el anillo global
`:focus-visible` (`styles.css:400`), **no** uno propio · movimiento `--dur-*`, `--ease-standard`.

Excepción documentada: la sombra de la tabla usa `color-mix()` sobre `--text-secondary` al 40 %
en lugar de un token de sombra, porque su intensidad es variable (0→1 según el scroll) y los
tokens `--sombra-*` son valores fijos.

## Pantalla patrón

«Mis citas» del paciente, en sus estados: lista con próximas y anteriores, filtros plegados y
desplegados, foco tras «Pedir una cita», oscuro. Capturas en `capturas/despues/` y
`capturas/e2e/`. Estados vacío, error y «ninguna coincide» **no cambiaron** de marcado (siguen
siendo los `app-alert` previos) y los cubren las pruebas unitarias existentes.

## Contraste y tema

- No se introdujo ningún par color/fondo nuevo: los textos usan tokens ya auditados en
  `identidad-visual.md`.
- Oscuro verificado visualmente en 1440 (`mis-citas-1440-oscuro.png`).
- La sombra de la tabla se tiñe con `--text-secondary`, que se invierte con el tema: en oscuro
  aclara el borde en vez de oscurecerlo.
