# Las 24 capturas, una línea cada una

Producidas el 2026-09-26 por la mañana, con el navegador que la corrida de la noche no tenía
(había cuatro carriles en paralelo y la regla 70 prohibía levantar servidores). Servidor:
`corepack yarn dev --port 4219` sobre `justin/carga-masiva-pantalla-2026-09-25`; Chromium por
Playwright; cuenta `admin@alovida.mock`; ruta `/administration/terminology/import`.

**3 viewports (375 · 768 · 1440) × 2 temas (claro · oscuro) × 4 estados = 24.** El tema se fija
con `emulateMedia({ colorScheme })`, que es el camino real: el tema por defecto es `'system'` y
lo resuelve `@media (prefers-color-scheme)` en CSS, sin escribir `data-theme`.

| Captura | Qué se ve |
|---|---|
| `01-vacio-{tema}-{ancho}.png` | Los tres pasos con el paso 1 sin elegir: «Importar» deshabilitado, las dos plantillas deshabilitadas, y el paso 3 diciendo qué va a aparecer ahí. Nada promete todavía |
| `02-validado-{tema}-{ancho}.png` | Tras `ok-50.csv` y «Validar sin guardar»: el informe con las filas leídas y la vista previa. **Nada se guardó** — «Importar» recién acá se habilita |
| `03-exito-{tema}-{ancho}.png` | Tras «Importar»: el resumen de lo insertado, con el foco puesto en él |
| `04-con-errores-{tema}-{ancho}.png` | Tras `con-errores.xlsx`: la carga **aborta entera**, `inserted: 0`, con las filas y su columna. «Importar» sigue deshabilitado |

## Lo que las capturas dejaron medido, no opinado

En las 24, sobre `document.documentElement`:

```text
claro-375    01-vacio {scrollWidth:375, innerWidth:375, fondo:"rgb(255, 255, 255)"}
             02-validado / 03-exito / 04-con-errores: idénticos
claro-768    los cuatro estados: scrollWidth 768 = innerWidth 768
claro-1440   los cuatro estados: scrollWidth 1440 = innerWidth 1440
oscuro-375   los cuatro: scrollWidth 375 = innerWidth 375, fondo "rgb(8, 22, 28)"
oscuro-768   los cuatro: scrollWidth 768 = innerWidth 768, fondo "rgb(8, 22, 28)"
oscuro-1440  los cuatro: scrollWidth 1440 = innerWidth 1440, fondo "rgb(8, 22, 28)"

errores de consola propios: 0 en las 6 corridas
errores de CSP:             2 por corrida — PREEXISTENTES, del servidor de dev, que sirve una
                            CSP que bloquea los dos scripts en línea del `<head>` (uno es el
                            anti-parpadeo del tema). No son de esta pantalla
```

1. **`scrollWidth === innerWidth` en los cuatro estados a 375**, que es lo que H5.S1.M3 pedía y
   que hasta ahora era una afirmación de lectura del CSS. Ahora está observado.
2. **El tema oscuro se aplica de verdad**: el fondo del cuerpo pasa de blanco a `rgb(8, 22, 28)`.
   Sin esta medición, seis capturas «oscuras» podrían haber sido seis capturas claras.
3. **Cero errores de consola propios** en los seis recorridos completos.

## Lo que sigue sin hacerse, y por qué

- **Contraste medido en oscuro (H5.S1.M4).** Las capturas oscuras existen y el tema se aplica,
  pero nadie midió una relación de contraste: eso pide leer los píxeles o los tokens, y no se
  hizo. **No se declara.**
- **La segunda pasada adversarial** sobre estas capturas no es de este carril (regla 35.1.6): es
  de Marcelo.
- **Las capturas «antes» (H1.S2.M3 en su sentido literal)** no se pueden producir: la ruta ya
  existía, pero el «antes» habría que sacarlo de un árbol en `origin/mockup`, que es otro
  worktree y otro servidor. Lo que hay es el «después», y las medidas de arriba.
- **El NDJSON de tres líneas (H1.S2.M4)** no se subió: el recorrido usó CSV y XLSX.
