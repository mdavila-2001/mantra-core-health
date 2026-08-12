# Monitoreo de rendimiento

**No existe ninguno.** Ni sintético, ni de campo, ni en el pipeline.

---

## Estado

| Mecanismo | Estado |
|---|---|
| Lighthouse en CI | No existe |
| Telemetría de Web Vitals | No existe |
| Monitoreo sintético (Checkly, Pingdom) | No existe |
| Monitoreo de usuarios reales (RUM) | No existe |
| Alertas de degradación | No existe |
| Panel de métricas | No existe |
| Presupuestos de bundle en CI | **Existen en el build**, no en un pipeline |

## Lo único que sí se mide, y en cada build

```text
▲ [WARNING] bundle initial exceeded maximum budget.
  Budget 500.00 kB was not met by 16.70 kB with a total of 516.70 kB.
```

Los presupuestos de `angular.json` son la **única** medición automática de
rendimiento del proyecto. Se evalúan en cada `yarn build` de producción.

Es poco, pero no es nada: detecta la regresión de rendimiento más común —que el
paquete crezca— antes de que llegue a nadie.

`scripts/check-bundle-budget.mjs` lo formaliza para un pipeline.

## Qué no se puede saber hoy

| Pregunta | |
|---|---|
| ¿Cuánto tarda en cargar la aplicación para un usuario real? | Sin dato |
| ¿Empeoró con el último despliegue? | Sin dato |
| ¿Hay usuarios con conexiones donde es inusable? | Sin dato |
| ¿Cuál es la pantalla más lenta? | Sin dato |
| ¿Cuántos errores S8/S9 se ven por día? | Sin dato |
| ¿La API está lenta o caída para los usuarios? | **Sin dato** |

La última no es de rendimiento: es operativa. **Sin ella, la única señal de que
algo se rompió es que alguien lo reporte.**

## Los tres niveles, y en qué orden conviene

### 1 · Sintético en CI — el más barato

```bash
yarn build
yarn serve:ssr:mantra-core-health &
npx lighthouse http://localhost:4000/auth --output=json --output-path=./lh.json
```

| Ventajas | Límites |
|---|---|
| No requiere instalar nada permanente (`npx`) | Mide una máquina de CI, no un usuario |
| Detecta regresiones entre commits | No mide INP |
| Da la primera línea base real | Solo cubre las 4 rutas públicas: `/dashboard` necesita sesión |

**Es el primer paso obvio**, y el único que no requiere ninguna decisión de
privacidad.

### 2 · Presupuestos formalizados en el pipeline

Ya existen en el build. Formalizarlos con
`scripts/check-bundle-budget.mjs` los convierte en un paso con resultado
explícito.

Ver [presupuestos](budgets.md) — incluida la decisión pendiente sobre el aviso de
16,70 kB.

### 3 · Campo (RUM) — el único que da INP

Exige telemetría, y con ella una discusión de privacidad que en salud no es
menor. Ver [Web Vitals](../observability/web-vitals.md) y
[privacidad](../security/privacy.md).

**No conviene empezar por acá**, aunque sea lo que más información da: las
decisiones que exige son más caras que las dos primeras.

## Y el prerrequisito de todo

**No hay despliegue de producción.** No hay imagen, ni destino, ni pipeline. Ver
[despliegue](../operations/deployment.md).

Monitorear el rendimiento de algo que no está desplegado no tiene destinatario:
lo primero es que exista un entorno donde medir.

Por eso, en [el informe de preparación productiva](../reports/production-readiness.md),
la ausencia de despliegue está clasificada como `BLOCKER` y ésta como `HIGH`
dependiente de aquélla.

## Cuando exista el despliegue

Umbrales de alerta propuestos —**a fijar con datos, no antes**:

| Métrica | Alerta si | Fuente |
|---|---|---|
| LCP p75 | > 2,5 s | RUM |
| INP p75 | > 200 ms | RUM |
| CLS p75 | > 0,1 | RUM |
| Errores S9 por hora | > línea base × 3 | Telemetría de errores |
| Errores S8 por hora | > línea base × 3 | Ídem — indica la API caída |
| Paquete inicial | > 550 kB | CI |
| Tiempo de build | > 30 s | CI |

Las dos de errores son las que más valen: **un pico de S8 significa que la API no
responde para los usuarios**, que es la clase de incidente que hoy nadie detecta.

## Estado

`HIGH`, dependiente del `BLOCKER` de despliegue. Registrado en
[el análisis de brechas](../reports/documentation-gap-analysis.md).
