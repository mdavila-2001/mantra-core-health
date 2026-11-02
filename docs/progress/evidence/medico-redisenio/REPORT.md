# Rediseño del médico — la capa del paciente, para quien atiende (22/10/2026)

Pedido: «lo mismo que se hizo para paciente, que se haga para doctor».

## Qué cambió

El armazón pone `.app-shell--redesign` al paciente **y** al médico
(`PRACTITIONER` que no es paciente) y les carga a los dos `paciente.css`. En
esa hoja, lo general pasó de `.app-shell--paciente` a `.app-shell--redesign`;
lo que es sólo del paciente (su inicio, Mis citas) sigue donde estaba.

Lo que el médico gana, en las 13 pantallas de su menú:

| | Antes | Después |
|---|---|---|
| Encabezado de cada pantalla | Título suelto con una línea abajo | Cinta de color con el sello del logo de AloVida |
| Menú lateral | Dos trazos de electro cortados al pie | El logo como marca de agua; renglones más altos |
| Atajos de la cabecera | Cinco íconos sin nombre | Cada ícono con su nombre (y «Más» en anchos intermedios) |
| Tarjetas, botones, pestañas | Planos | Más redondas con sombra; botones en píldora; pestaña elegida con fondo |
| Chats | Tres márgenes distintos, filtros cortados | Todo alineado, filtros más grandes |

Sin tocar plantillas de pantallas: el panel ya usa `app-page-header` (el
«Hola, <nombre>» de #1154 queda dentro de la cinta).

## Verificación

- Roles, en navegador (`ng serve`):
  - paciente → `app-shell--paciente app-shell--redesign`;
  - médica → `app-shell--medico app-shell--redesign`, sello con el logo;
  - admin y farmacia → ninguna clase, sin hoja: la aplicación de siempre.
- Paciente sin cambios visibles (Mi perfil, inicio, chats).
- Capturas: 13 pantallas a 1440 y 390 en `scratchpad`; acá las 6 principales,
  antes y después, y tres en oscuro. Página sin desborde horizontal a 390
  (el mapa de calor del panel desplaza dentro de su propia tira, como antes).
- `yarn build`: OK, inicial **1,36 MB** (sin cambio; la hoja creció 79 bytes).
- `yarn typecheck` y eslint de lo tocado: OK.
- Pruebas de armazón, panel y mensajería: 259/260. El rojo —
  `messaging.spec.ts › no borra la bandeja cuando un tic falla`— **falla igual
  en `mockup` limpio**.
- No se corrió la suite completa ni Playwright de regresión.
