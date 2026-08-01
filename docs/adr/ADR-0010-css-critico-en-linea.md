# ADR-0010: CSS crítico en línea desactivado

## Estado

**Observado — el motivo no se pudo recuperar.**

> Este ADR **no reconstruye un razonamiento**. Documenta una decisión que está en
> el código, señala que su porqué no está registrado en ninguna parte, y enumera
> las hipótesis con cómo verificarlas.
>
> El plan maestro lo exige así: *«No crear ADR retroactivos con razonamientos
> inventados.»*

---

## Lo que hay

```json
// angular.json, configuración de producción
"optimization": {
  "scripts": true,
  "fonts": true,
  "styles": {
    "minify": true,
    "inlineCritical": false
  }
}
```

**Angular trae `inlineCritical` en `true` por defecto.** Está desactivado
explícitamente: alguien lo escribió.

## Qué hace la opción

Extrae el CSS necesario para la primera pintada y lo pone **en línea** en el
`<head>`, cargando el resto de forma asíncrona. Evita una petición bloqueante y
suele mejorar el LCP y el FCP.

## Qué se pierde al desactivarla

- Una petición de CSS **bloqueante** antes de la primera pintada.
- Peor LCP y FCP, especialmente en conexiones lentas.
- **Está sin medir**: no hay Lighthouse ni telemetría. Ver
  [Core Web Vitals](../performance/core-web-vitals.md).

## Hipótesis del motivo

Ninguna está confirmada. En orden de probabilidad, con cómo comprobarla:

### 1 · Conflicto con `@import` de tipografías

`styles.css` empieza con cuatro `@import`:

```css
@import '@fontsource/poppins/500.css';
@import '@fontsource/poppins/600.css';
@import '@fontsource/poppins/700.css';
@import '@fontsource-variable/inter';
```

La extracción de CSS crítico (Critters/Beasties) puede tratar mal las
declaraciones `@font-face` importadas, y producir **texto invisible** o un
parpadeo de tipografía.

**Cómo comprobarlo:** activar la opción, construir, servir y mirar la primera
pintada de `/auth`.

### 2 · Conflicto con el prerenderizado

Cuatro rutas se prerenderizan en el build. La extracción por página podría
producir un HTML distinto por ruta, o entrar en conflicto con el proceso de
prerenderizado.

**Cómo comprobarlo:** activar, construir y verificar que las cuatro rutas siguen
saliendo con `Prerendered 4 static routes.` y se ven bien.

### 3 · Conflicto con el script anti-parpadeo del tema

El `<head>` ya tiene un script en línea que estampa `data-theme`. Si el CSS
crítico se inyectara **antes**, podría pintarse un instante con el tema
equivocado.

**Cómo comprobarlo:** activar y recargar con una preferencia manual guardada.

### 4 · Simple precaución

Alguien lo desactivó al depurar otra cosa y no volvió a activarlo.

**Es una hipótesis tan plausible como las anteriores**, y la razón por la que
este ADR existe.

## Consecuencia de no saberlo

**Quien lea `angular.json` hoy no sabe si puede revertirlo.** Activarlo podría
mejorar el LCP o podría romper la primera pintada, y no hay forma de saberlo sin
probar.

Es exactamente el coste de no llevar registro de decisiones.

## Riesgos

| Riesgo | |
|---|---|
| Que se revierta sin probar y rompa el tema o las tipografías | Medio |
| Que quede desactivado para siempre por precaución | **Es lo que está pasando** |
| Que el LCP sea peor de lo necesario y nadie lo sepa | Medio — **no hay medición** |

## Plan de revisión

1. **Medir con `inlineCritical: false`** (el estado actual), con `npx lighthouse`.
   Sin instalar nada.
2. **Activarlo, construir y medir de nuevo.**
3. **Verificar las tres hipótesis** con las comprobaciones de arriba.
4. **Decidir con datos** y actualizar este ADR — cambiando su estado de
   «Observado» a «Aceptado» o «Reemplazado», con el motivo real.

Es una tarea acotada y de valor claro: cierra una incógnita y probablemente
mejora el LCP.

## Evidencia

- `angular.json`, configuración de producción.
- Ausencia de cualquier mención en el repositorio:
  ```bash
  grep -rn "inlineCritical" . --exclude-dir=.git --exclude-dir=docs
  # → solo angular.json
  ```
- Ausencia de medición de rendimiento.

## Estado del hallazgo

Brecha `MEDIUM` en
[el análisis de brechas](../reports/documentation-gap-analysis.md).
