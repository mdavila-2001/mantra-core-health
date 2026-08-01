# Pruebas de accesibilidad

**No hay ninguna herramienta automatizada.** Lo que sí hay son aserciones
explícitas dentro de las pruebas de componente, y en algunos aspectos son mejores
que un escáner.

---

## Estado

```bash
grep -n "axe\|pa11y\|jest-axe\|lighthouse" package.json
```

Sin resultados.

| Herramienta | Estado |
|---|---|
| `axe-core` / `jest-axe` | No existe |
| `pa11y` | No existe |
| Lighthouse (categoría de accesibilidad) | No se ejecuta |
| Prueba con lector de pantalla | No ejecutada |

## Lo que sí hay: aserciones explícitas

| Componente | Qué fija la prueba |
|---|---|
| `Link` | `rel="noopener noreferrer"` en externos — **tres pruebas**, una con el motivo en el nombre |
| `AppButton` | `aria-disabled`, `aria-busy`, y que el clic se intercepta cuando no es interactivo |
| `FormField` | El vínculo label ↔ control vía `FORM_CONTROL_CONTEXT` |
| `RadioGroup` | Que el grupo se nombra con `aria-labelledby` y no con `for` |
| `Dialog` | Que `Escape` cancela y **no** confirma |
| `ViewStateHost` | Que S4 mueve el foco al mensaje y **S2/S7 no lo mueven** |
| `DataTable` | `<caption>`, `scope="col"`, `aria-sort` |
| `value-accessor-groups.spec.ts` | El caso de los grupos, que es donde se rompe el nombre accesible |

### Por qué esto no es peor que un escáner

Un `expect(await axe(fixture)).toHaveNoViolations()` comprueba **la ausencia de
infracciones conocidas**. Estas pruebas comprueban **la presencia de la intención
concreta**.

`axe` no detectaría:

- Que `Escape` en un diálogo **cancele** en vez de confirmar.
- Que S4 mueva el foco y S2 **no** lo mueva.
- Que el foco inicial de un diálogo destructivo **no** caiga sobre la acción
  destructiva.
- Que un enlace externo no herede la sesión.

Las cuatro son decisiones de diseño accesible que solo una aserción explícita
puede fijar.

## Lo que `axe` sí detectaría y hoy nadie ve

- Contraste insuficiente en una combinación concreta.
- Un `aria-*` mal escrito o con un valor inválido.
- Jerarquía de encabezados rota.
- Un rol sin sus atributos obligatorios.
- Un `id` duplicado.
- Un campo sin nombre accesible **fuera** de `app-form-field`.

El último es concreto: **nada impide un `app-input` suelto**, y en ese caso cae en
su propio id sin nombre. Ver
[A11Y-12](../accessibility/audit-report.md#a11y-12--low--nada-impide-un-control-sin-app-form-field).

## Propuesta

### 1 · `axe-core` en las pruebas de componente

```ts
// PROPUESTA, no implementada
import { axe } from 'vitest-axe';

it('no tiene infracciones de accesibilidad', async () => {
  const fixture = TestBed.createComponent(Componente);
  fixture.detectChanges();
  expect(await axe(fixture.nativeElement)).toHaveNoViolations();
});
```

**Complementa, no reemplaza** las aserciones actuales.

Límite conocido: jsdom no calcula estilos, así que **las reglas de contraste no
se evalúan**. Cubre estructura y ARIA, no color.

### 2 · Verificación de contrastes, sin dependencias

Es aritmética sobre valores que ya están en `styles.css`:

```js
// PROPUESTA
// leer styles.css → extraer los pares (fondo, tinta) declarados
// calcular el ratio → fallar bajo 4,5:1 (texto) o 3:1 (componentes)
// declarar E1/E2/E3 como excepciones esperadas
```

**No requiere ninguna dependencia** y cubre el hueco que `axe` en jsdom deja.
Ver [A11Y-06](../accessibility/audit-report.md#a11y-06--medium--contrastes-sin-verificación-automática).

### 3 · Lighthouse sobre las rutas prerenderizadas

```bash
npx lighthouse http://localhost:4000/auth --only-categories=accessibility
```

Sin instalar nada. Cubre las cuatro rutas públicas con estilos reales, que es
justo lo que jsdom no puede.

### 4 · Prueba manual con lector de pantalla

**La que más información aporta**, y no requiere instalar nada. El guion está en
[teclado](../accessibility/keyboard.md#guion-de-prueba-manual).

## Orden recomendado

| # | Qué | Dependencias nuevas |
|---|---|---|
| 1 | Lector de pantalla, a mano | **Ninguna** |
| 2 | Guion de teclado, a mano | **Ninguna** |
| 3 | Verificación de contrastes | **Ninguna** |
| 4 | Lighthouse con `npx` | Ninguna permanente |
| 5 | `axe-core` en pruebas de componente | Una de desarrollo |

**Las cuatro primeras no añaden nada al proyecto.** Es la razón para empezar por
ellas.

## Estado

`MEDIUM` en [el análisis de brechas](../reports/documentation-gap-analysis.md).

Consecuencia declarada: [el informe de auditoría](../accessibility/audit-report.md)
**no puede declarar conformidad AA**, porque no hay ninguna verificación
ejecutada. Declara lo que el código muestra y enumera catorce hallazgos.
