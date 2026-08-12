# Presupuestos de rendimiento

Los que el proyecto ya declara, lo que miden hoy, y los que faltan.

---

## Los presupuestos que existen

`angular.json`, configuración de producción:

```json
"budgets": [
  { "type": "initial",           "maximumWarning": "500kB", "maximumError": "1MB" },
  { "type": "anyComponentStyle", "maximumWarning": "4kB",   "maximumError": "8kB" }
]
```

Son **los únicos** presupuestos del proyecto, y son reales: el build los evalúa
en cada compilación de producción.

## Medición actual

```text
Initial total        | 516,70 kB crudo | 132,27 kB estimado en tránsito
  chunk-…            | 241,89 kB
  chunk-…            | 204,00 kB
  main               |  55,15 kB
  styles             |  14,37 kB
  chunk-…            |   1,28 kB

Lazy
  design-system-sample | 181,73 kB  (40,29 kB en tránsito)
  toast-dev-panel      |   2,98 kB

Prerenderizadas: 4 rutas
```

| Presupuesto | Umbral aviso | Umbral error | Actual | Estado |
|---|---|---|---|---|
| Inicial | 500 kB | 1 MB | **516,70 kB** | ⚠️ **16,70 kB por encima del aviso** |
| Estilo por componente | 4 kB | 8 kB | — | ✅ sin avisos |

```text
▲ [WARNING] bundle initial exceeded maximum budget.
  Budget 500.00 kB was not met by 16.70 kB with a total of 516.70 kB.
```

**El build no falla**: está 483 kB por debajo del umbral de error. Es un aviso
preexistente, registrado en [la línea base](../reports/baseline.md).

### Qué son esos 516 kB

Casi todo es Angular. El proyecto tiene **diez dependencias externas**, todas del
propio framework:

| Bloque | Aproximado |
|---|---|
| Runtime de Angular (core, common, router, forms, platform-browser) | Los dos fragmentos de 241,89 y 204,00 kB |
| Código de la aplicación | `main`, 55,15 kB |
| Estilos | 14,37 kB |

**132,27 kB en tránsito** es una cifra razonable para una aplicación Angular con
SSR e hidratación. El problema no es el peso: es que el umbral se fijó en 500 y
nadie lo movió ni lo bajó.

## La oportunidad más clara

**Las seis pantallas de autenticación y el panel se importan de forma directa**
en `app.routes.ts`:

```ts
import { Dashboard } from './features/dashboard/dashboard';
import { Login } from './features/auth/login/login';
import { TenantSelection } from './features/auth/tenant-selection/tenant-selection';
import { RegisterPatient } from './features/auth/register-patient/register-patient';
import { VerifyEmail } from './features/auth/verify-email/verify-email';
import { ForgotPassword } from './features/auth/forgot-password/forgot-password';
import { ResetPassword } from './features/auth/reset-password/reset-password';
```

Solo `/design-system` usa `loadComponent`.

Consecuencia: **quien abre el login descarga también el registro, la
recuperación, la verificación, el selector de organización y el panel** — seis
pantallas que no va a ver.

Diferirlas es el cambio de mayor relación beneficio/riesgo del proyecto. Pero:

| A favor | En contra |
|---|---|
| Baja el paquete inicial | `/auth`, `/auth/register` y `/auth/forgot-password` están **prerenderizadas** |
| Cada pantalla se paga al usarla | Diferir una ruta prerenderizada exige comprobar que el prerender sigue funcionando |
| Es el patrón que ya usa la vitrina | Añade un salto de red en la primera navegación |

**No se ejecuta acá**: es un cambio de producto con impacto en el renderizado.
Registrado como propuesta con impacto y prueba requerida en
[el análisis de brechas](../reports/documentation-gap-analysis.md).

## Presupuestos que faltan

`angular.json` admite más tipos de los que el proyecto declara:

| Tipo | Propuesto | Por qué |
|---|---|---|
| `bundle` (por fragmento nombrado) | 200 kB aviso | Hoy `design-system-sample` pesa 181,73 kB y nada lo vigila |
| `allScript` | — | Cubierto por `initial` |
| `anyScript` | 250 kB aviso | Los dos fragmentos de Angular ya rozan ese tamaño |
| **Estilos iniciales** | 20 kB | Hoy 14,37 kB. Sin presupuesto propio |

Y los que `angular.json` **no** puede expresar y hoy nadie mide:

| Métrica | Propuesta inicial | Cómo medirla |
|---|---|---|
| LCP | ≤ 2,5 s | Lighthouse o Web Vitals |
| INP | ≤ 200 ms | Ídem |
| CLS | ≤ 0,1 | Ídem |
| Peticiones críticas | ≤ 10 | Panel de red |
| Tiempo de build | ≤ 30 s | Ya se mide: **~5–10 s** |
| Tiempo de pruebas | ≤ 60 s | Ya se mide: **~10–19 s** |

Las tres primeras **no tienen línea base**: no hay Lighthouse ni telemetría de
Web Vitals. Poner un objetivo sin haber medido sería inventarlo. Ver
[Core Web Vitals](core-web-vitals.md).

## Verificación

```bash
node scripts/check-bundle-budget.mjs
```

Lee los presupuestos de `angular.json`, mide el artefacto de
`dist/mantra-core-health/browser` y compara. Corre después de `yarn build`.

**Complementa al build, no lo reemplaza:** el build ya avisa. Lo que este script
agrega es un resultado en formato de informe, apto para el
[pipeline documental](../governance/change-management.md#pipeline), y la
posibilidad de aplicar presupuestos que `angular.json` no expresa.

## Decisión pendiente

El aviso de 16,70 kB tiene **dos salidas legítimas**, y elegir es del equipo:

1. **Bajar el paquete** difiriendo las pantallas de autenticación. Es trabajo, y
   toca el prerenderizado.
2. **Subir el umbral** a un valor que refleje la realidad (por ejemplo 550 kB) y
   dejar el error en 1 MB. Es reconocer que 500 era una cifra redonda, no una
   medida.

Lo que **no** es defendible es dejar el aviso indefinidamente: un aviso que nadie
va a atender entrena a ignorar los avisos.

Registrado en [el informe de preparación productiva](../reports/production-readiness.md).
