# Ola 7 · Matriz de regresión global

**Corrida:** 2026-09-08 · **Rama:** `mockup` · **Cuenta:** `superadmin@alovida.mock`
**Herramienta:** `FABLE_ALCANCE=todo yarn pw playwright/fable-baseline.spec.ts`
**Datos crudos:** `evidence/matriz/mediciones.json`

---

## Resultado

**1110 mediciones** sobre **222 rutas** × 5 viewports, en 5,3 minutos.

| Medición | Resultado |
|---|---:|
| Pantallas que no pintan | **0** |
| Desborde horizontal | **0** |
| Errores de consola | **0** |
| Peticiones fallidas | **0** |
| Rutas que redirigen | **1** (5 mediciones) |

Todo el frontend navegable, a 390, 768, 1024, 1440 y 1920 px, **sin un solo
desborde horizontal ni un error de consola**.

## Qué significa y qué no

Significa que la estructura responsive del producto es sólida: no hay pantallas
rotas, ni contenido que se salga, ni rutas caídas. Para 222 pantallas, eso es un
resultado bueno y poco común.

**No significa que el frontend esté terminado.** Lo que esta matriz mide es la
carga inicial de cada ruta con una cuenta. No mide:

- **los otros cuatro roles** — paciente, médica, administrador y visitador ven
  pantallas distintas, y varias sólo existen para ellos;
- **interacción** — no se abrió un diálogo, no se envió un formulario, no se
  recorrió con teclado;
- **los nueve estados M34** — se ve el estado en que quedó cada pantalla con los
  fixtures por defecto, no S3 vacío, S4 validación, S8 sin conexión ni S9 error;
- **mutaciones** — ninguna escritura se verificó
  `UI → request → response → persistencia → recarga → UI`;
- **las 10 rutas parametrizadas**, que necesitan identificadores reales.

## Rutas por estado declarado

| `maqueta portada` | 126 |
| `conectada` | 86 |
| `presentacional` | 6 |
| `conectada con deuda` | 3 |
| `placeholder` | 1 |

## Observación abierta

`/directory` redirige a `/dashboard` con `superadmin@` en los cinco viewports.
Capturas en `evidence/matriz/directory/`. Falta reproducirlo con la cuenta a la
que la pantalla está dirigida para saber si es un guardia de rol correcto o una
ruta rota. **Hasta entonces es una observación, no un defecto.**

## Sobre la intermitencia

La corrida anterior marcó `/glossary` sin pintar en uno de cinco viewports, y
una sonda dirigida lo mostró pintando 3 de 3. El arnés ahora **reintenta una vez
antes de declarar NO-PINTA**: sin eso la matriz miente hacia el rojo, y una
matriz que miente en cualquier dirección no sirve para decidir.

## Cómo repetirla

```bash
yarn start
FABLE_ALCANCE=todo yarn pw playwright/fable-baseline.spec.ts --timeout=3600000
```

Sin `FABLE_ALCANCE` mide sólo las 28 secciones (~80 s), que es el baseline de
trabajo diario.
