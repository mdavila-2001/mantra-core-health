# Baseline visual

Estado del navegador **antes** de tocar nada. Sin baseline no se puede demostrar
mejora ni detectar regresión.

## Corrida vigente

| | |
|---|---|
| Fecha | 2026-09-08 |
| Rama | `mockup` (backend simulado, sin API ni Postgres) |
| Cuenta | `superadmin@alovida.mock` |
| Alcance | 28 secciones del catálogo generado × 5 viewports = **140 mediciones** |
| Herramienta | `playwright/fable-baseline.spec.ts` (`yarn pw playwright/fable-baseline.spec.ts`) |
| Datos crudos | `evidence/baseline/mediciones.json` |

## Resultado

| Medición | Valor |
|---|---:|
| Pantallas que no pintan | **0** |
| Desborde horizontal | **0** |
| Errores de consola | **0** |
| Peticiones fallidas | **0** |
| Rutas que redirigen | **1** (5 mediciones) |

Las 28 secciones principales pintan y **no desbordan en ningún viewport**,
incluido 390 px. El sistema responsive de la rama está sano en la superficie
medida.

### Hallazgo · `/directory` redirige a `/dashboard`

En los cinco viewports, pedir `/directory` con la cuenta `superadmin@` termina
en `/dashboard`. Capturas en `evidence/baseline/directory/`.

Falta determinar si es un guardia de rol correcto (el superadmin no es
destinatario del directorio público) o una ruta rota. **Sin esa distinción no
es un defecto todavía, es una observación**: la clasificación exige reproducir
con la cuenta a la que la pantalla sí está dirigida.

## Verificado, no asumido

La primera corrida dio «0 defectos» en 51 s y eso olía a verde falso. Se
comprobó con una sonda que la navegación era real: el login deja la sesión en
`/dashboard`, `/dashboard` pinta el encabezado «Panel» con 1.659 caracteres de
texto y `scrollWidth == clientWidth` a 390 px. Los tiempos bajos se explican
porque es una SPA: cambiar de ruta no recarga la página.

La segunda corrida agregó la comparación entre ruta pedida y URL final, que es
lo que destapó el redirect de `/directory`. La primera lo tapaba.

## Límites de esta corrida

Lo que **no** cubre, y hay que decirlo antes de que alguien lea «0 defectos»
como «el frontend está bien»:

- **Una sola cuenta.** Sólo `superadmin@`. Las pantallas de paciente, médica,
  administrador y visitador no fueron miradas con su propio rol.
- **28 de 232 pantallas.** Faltan las 78 hijas y las 126 portadas.
- **Sin interacción.** Se mide la carga inicial: no se abrieron diálogos, no se
  enviaron formularios, no se recorrió con teclado, no se verificó foco.
- **Sin los nueve estados M34.** Se ve el estado en que quedó cada pantalla con
  los fixtures por defecto, no S3 vacío, S4 validación, S8 sin conexión ni S9
  error.
- **Sin prueba de mutación.** Ninguna escritura fue verificada
  `UI → request → response → persistencia → recarga → UI`.

Ampliar cualquiera de estos puntos es una microtarea del DAG, no un ajuste del
spec.

## Cómo repetirlo

```bash
yarn start                                      # ng serve, rama mockup
yarn pw playwright/fable-baseline.spec.ts       # ~80 s
```

Trampas del arnés (skill `visual-quality-gate`): no esperar `networkidle`
contra `ng serve`; `testId` no es `data-testid`; entrar por URL directa además
de navegar.

## Dónde va la evidencia

```text
docs/frontend/evidence/baseline/mediciones.json    todas las mediciones
docs/frontend/evidence/baseline/<ruta>/<vp>.png    captura, sólo donde hay defecto
```

Fotografiar 140 pantallas sanas engorda el repositorio sin agregar información.
