# Pruebas de accesibilidad

Tres capas, y ninguna reemplaza a las otras: **aserciones explícitas** en las
pruebas de componente, una **auditoría automática con `axe-core`**, y un
**verificador de contrastes** que no depende del navegador.

```bash
yarn test                        # incluye las aserciones y la auditoría de axe
node scripts/check-contrast.mjs  # contrastes, sin dependencias
```

---

## 1 · Aserciones explícitas — la intención concreta

| Componente | Qué fija la prueba |
|---|---|
| `Link` | `rel="noopener noreferrer"` en externos — **tres pruebas**, una con el motivo en el nombre |
| `AppButton` | `aria-disabled`, `aria-busy`, y que el clic se intercepta cuando no es interactivo |
| `FormField` | El vínculo label ↔ control vía `FORM_CONTROL_CONTEXT` |
| `RadioGroup` | Que el grupo se nombra con `aria-labelledby` y no con `for` |
| `Select` | Que `ariaLabel` nombra al control suelto y que **dentro de un campo se ignora** |
| `Dialog` | Que `Escape` cancela y **no** confirma |
| `ViewStateHost` | Que S4 mueve el foco al mensaje y **S2/S7 no lo mueven** |
| `DataTable` | `<caption>`, `scope="col"`, `aria-sort` |
| `value-accessor-groups.spec.ts` | El caso de los grupos, que es donde se rompe el nombre accesible |

Esta capa comprueba **la presencia de una intención**, no la ausencia de
infracciones. `axe` no detectaría ninguna de estas cuatro:

- Que `Escape` en un diálogo **cancele** en vez de confirmar.
- Que S4 mueva el foco y S2 **no** lo mueva.
- Que el foco inicial de un diálogo destructivo **no** caiga sobre la acción
  destructiva.
- Que un enlace externo no herede la sesión.

## 2 · `axe-core` — las reglas que nadie escribió a mano

`src/app/shared/components/a11y.spec.ts` monta trece componentes en su estado con
**más superficie de accesibilidad** —un campo con error, ayuda y obligatoriedad;
un menú con una acción destructiva; una tabla con una columna ordenada— y los
audita contra las ~90 reglas WCAG 2.0/2.1 A y AA.

El ayudante vive en [`src/testing/a11y.ts`](../../src/testing/a11y.ts) y devuelve
datos, no aserciones: así una prueba puede **admitir** una violación conocida
dejando escrito el motivo, en vez de apagar la regla para todos.

Un archivo y no una llamada en cada spec: las reglas son las mismas para todos
los componentes, repetirlas cuarenta veces no encuentra nada más y garantiza que
ajustar el ruleset cueste cuarenta ediciones.

### Qué encontró

Una violación **crítica** el primer día: `select-name` en el paginado. El
`<select>` de «resultados por página» no tenía nombre accesible, y los dos
desplegables de `app-filter-bar` tampoco.

La causa era un malentendido razonable: los tres pasaban un `placeholder`, y el
`placeholder` **no nombra al control** — se renderiza como un `<option hidden>` y
el lector de pantalla lo lee como una opción más. Los tres se anunciaban como
«cuadro combinado» y nada más.

Se resolvió dándole a `app-select` un `ariaLabel`, la misma vía que
`app-search-field` ya usaba con un `<label>` invisible. Era exactamente el
hallazgo [A11Y-12](../accessibility/audit-report.md#a11y-12--low--nada-impide-un-control-sin-app-form-field--cerrado-en-parte),
que estaba declarado y sin cerrar.

### Qué NO cubre

Las pruebas corren en jsdom, que **no calcula estilos ni geometría**. Estas
reglas están apagadas a propósito, y cada una tiene dónde se comprueba de verdad:

| Regla apagada | Por qué | Dónde se comprueba |
|---|---|---|
| `color-contrast` | Necesita colores calculados | `scripts/check-contrast.mjs` |
| `target-size` | Necesita geometría | Auditoría manual |
| `html-has-lang`, `document-title`, `region`, `bypass`… | Exigen un documento entero, no un fragmento | `index.html` y el layout |

axe las marca como *incomplete*, no como *pass*. El ayudante las ignora en vez de
convertirlas en fallo (ruido constante) o en éxito (una mentira).

> **Cero violaciones no significa «accesible».** Significa «sin los errores
> mecánicos que una máquina puede ver sin renderizar». El resto sigue siendo
> trabajo humano.

## 3 · Contrastes — aritmética, sin dependencias

`scripts/check-contrast.mjs` lee `src/styles.css`, mide **33 combinaciones** de
fondo y tinta en las **tres** configuraciones de tema (claro, oscuro por sistema,
oscuro manual) y falla por debajo de 4,5:1 en texto y 3:1 en componentes.

Las excepciones son **por tema**, no globales: `E1` solo aplica en claro, `E3`
solo en los dos oscuros. Una excepción global habría tapado el hallazgo real que
este verificador encontró — `--st-warning-fg` a 4,46:1, corregido a ámbar 800
(7,49:1).

Corre en CI y bloquea.

## Lo que sigue siendo manual

| Qué | Estado |
|---|---|
| Prueba con lector de pantalla | Guion en [teclado](../accessibility/keyboard.md#guion-de-prueba-manual) — **no ejecutada** |
| Lighthouse sobre las rutas prerenderizadas | `npx lighthouse http://localhost:4000/auth --only-categories=accessibility` |
| Área táctil (`target-size`) | Requiere navegador real |

Ninguna de las tres es sustituible por lo automático. La primera es la que más
información aporta y la que sigue pendiente.

## Estado

La conformidad **AA sigue sin poder declararse**, y ahora por un motivo más
acotado que antes: lo automatizable está automatizado y en verde, pero
[el informe de auditoría](../accessibility/audit-report.md) no puede cerrar los
hallazgos que requieren una persona con un lector de pantalla.
