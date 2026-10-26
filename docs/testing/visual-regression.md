# Regresión visual

**No existe.** Y es la única defensa posible contra la clase de cambio que no
rompe la compilación.

---

## Estado

Sin herramienta, sin capturas de referencia, sin comparación.

`.gitignore` reserva `__screenshots__/`, pero la carpeta no existe.

## El problema concreto

El sistema tiene **220 tokens** y **dos temas**. Un cambio en un token:

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
