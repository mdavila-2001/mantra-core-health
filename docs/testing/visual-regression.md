# Regresión visual

**No existe.** Y es la única defensa posible contra la clase de cambio que no
rompe la compilación.

---

## Estado

Sin herramienta, sin capturas de referencia, sin comparación.

`.gitignore` reserva `__screenshots__/`, pero la carpeta no existe.

## El problema concreto

El sistema tiene **188 tokens** y **dos temas**. Un cambio en un token:

| Consecuencia | ¿Lo detecta algo hoy? |
|---|---|
| Compila | — |
| Pasa el lint | — |
| Pasa las 804 pruebas | **Sí, pasa** |
| Cambia el aspecto de la aplicación entera | **Nada lo detecta** |

Las pruebas comprueban que los tokens **existan**, no que sus valores produzcan
el resultado correcto.

### El caso peor: el modo oscuro

Los valores de oscuro están **duplicados** en dos bloques de `styles.css`:

```css
@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) { … } }
:root[data-theme='dark'] { … }
```

Están duplicados a propósito —uno no se deriva del otro en CSS plano— pero
**nada comprueba que sigan diciendo lo mismo**. Alguien puede editar uno y
olvidar el otro, y el resultado es que el tema del sistema y el manual se ven
distinto.

Es exactamente lo que una comparación visual entre temas detectaría en un
segundo.

### Y el cambio silencioso

```ts
readonly size = input<ButtonSize>('md');   // → 'lg'
```

Compila en los 25 sitios que usan el botón y **cambia el aspecto de todos**. Ver
[deprecación](../components/deprecation.md#el-más-peligroso-es-el-que-no-rompe-la-compilación).

## La vitrina ya es la mitad del trabajo

`/design-system` exhibe los 48 componentes con sus variantes y estados, y
`ViewStateGallery` recorre los nueve estados del M34.

**Es la superficie ideal para una comparación visual**: una sola URL, sin
sesión, sin datos, y prerenderizada. Dos capturas —una por tema— cubrirían casi
todo el sistema de diseño.

## Propuesta

### Con Playwright, que ya haría falta para [E2E](e2e-tests.md)

```ts
// PROPUESTA, no implementada
test('vitrina · tema claro', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/design-system');
  await expect(page).toHaveScreenshot('vitrina-claro.png', { fullPage: true });
});

test('vitrina · tema oscuro', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/design-system');
  await expect(page).toHaveScreenshot('vitrina-oscuro.png', { fullPage: true });
});
```

**Una sola dependencia cubre E2E y regresión visual.** Es el argumento que decide
la herramienta.

### Qué capturar, en orden de valor

| # | Superficie | Por qué |
|---|---|---|
| 1 | `/design-system`, dos temas | Los 48 componentes de una vez |
| 2 | `/design-system` con `prefers-reduced-motion` | Verifica que nada quede invisible |
| 3 | `/auth`, dos temas, dos anchos | La pantalla más vista |
| 4 | `ViewStateGallery`, los nueve estados | El contrato del M34, visualmente |
| 5 | `/dashboard` con sesión simulada | La única pantalla autenticada |

## Las dificultades conocidas

Una suite visual mal montada falla al azar y se termina ignorando:

| Problema | Mitigación |
|---|---|
| Diferencias de renderizado entre sistemas operativos | **Capturar en un contenedor**, siempre el mismo |
| Tipografías que cargan tarde | Esperar a `document.fonts.ready` |
| Animaciones | Forzar `prefers-reduced-motion: reduce` |
| Datos variables | La vitrina no tiene datos: por eso es la mejor superficie |
| Fechas | S7 muestra `asOf`. **Fijar la fecha** o excluir esa región |
| Aprobación de cambios legítimos | Un cambio de diseño **debe** cambiar la captura. Requiere un flujo de aprobación |

La última es la que hace cara la práctica: sin un flujo claro para aprobar
capturas nuevas, cada cambio de diseño se vuelve una discusión.

## Estado

`MEDIUM` en [el análisis de brechas](../reports/documentation-gap-analysis.md).

**Sin ella, la métrica «regresiones visuales no aprobadas: 0» del plan maestro no
se puede verificar.** Está declarado así en
[el informe final](../reports/final-validation.md): la métrica no se cumple por
ausencia de instrumento, no por incumplimiento conocido.
