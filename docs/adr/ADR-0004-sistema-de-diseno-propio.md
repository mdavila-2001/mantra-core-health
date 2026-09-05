# ADR-0004: Sistema de diseño propio, sin biblioteca de terceros

## Estado

**Aceptado** — con evidencia normativa externa (`identidad-visual.md`).

## Contexto

El proyecto tiene una identidad visual definida —**ALOVIDA v1.0**— con paleta,
escala tipográfica, espaciado y reglas de uso propias, documentadas en el vault
del proyecto.

## Fuerzas y restricciones

- La identidad no es negociable: hay reglas como *«ámbar ≤ 10 % de la pantalla y
  UN solo punto de acción cálido»* o el radio de firma en un elemento por
  pantalla.
- Hay **excepciones WCAG declaradas** (E1–E4) con su medición.
- Es una aplicación de salud: la accesibilidad y la legibilidad de datos son
  requisitos, no adornos.
- El presupuesto inicial ya está por encima del umbral de aviso.

## Opciones consideradas

| Opción | Descartada porque |
|---|---|
| Angular Material | Su sistema de temas pelea con ALOVIDA. Peso considerable |
| PrimeNG | Ídem, y más superficie externa |
| Tailwind | Resuelve utilidades, no componentes accesibles |
| Solo Angular CDK | Habría dado la trampa de foco y el overlay… ver §Riesgos |

## Decisión

**48 componentes propios en `shared/`, sobre CSS plano con custom properties.**

Cero dependencias de interfaz. Los nombres viven en
`core/tokens/design-tokens.types.ts` y los valores en `src/styles.css`, con
pruebas que comparan las dos fuentes.

## Consecuencias positivas

- **Cero peso de biblioteca.** Los 516,70 kB iniciales son casi todo Angular.
- Los tokens son la única fuente de estilo: `cssVar(BRAND.primary)` y el
  compilador atrapa el error de tipeo.
- Control total de la accesibilidad — y el proyecto lo ejerce: `aria-disabled`
  en vez de `disabled`, `<dialog>` nativo, contrato campo ↔ control.
- Sin conflictos de versión con Angular 21.
- La vitrina sustituye a Storybook sin añadir nada. Ver
  [ADR-0009](ADR-0009-vitrina-en-vez-de-storybook.md).

## Consecuencias negativas

- **Todo hay que escribirlo**, y mantenerlo.
- Sin comunidad que reporte defectos de accesibilidad.
- Faltan piezas que una biblioteca traería: desplazamiento virtual, editor
  enriquecido, gráficos, árbol.
- El coste se paga cada vez que hace falta un componente complejo.

## Riesgos

| Riesgo | Estado |
|---|---|
| Reimplementar mal una trampa de foco | **Evitado**: `app-dialog` usa `<dialog>` nativo |
| Regresión de contraste al tocar un token | **Sin mitigar**: no hay verificación automática ni regresión visual |
| Deriva entre los valores de CSS y los nombres de TS | **Mitigado**: doce pruebas comparan las dos fuentes |
| Un token declarado solo en CSS | **Sin mitigar** (brecha `MEDIUM`) |

### El riesgo de la trampa de foco, resuelto

Es el argumento más fuerte que tendría el CDK, y el proyecto lo neutralizó
usando el elemento nativo:

> *«`showModal()` trae gratis el fondo, la inertización de lo que queda atrás, la
> trampa de foco y el cierre con `Escape` — cuatro cosas que una capa propia
> tendría que reimplementar.»*

## Evidencia

- `package.json`: diez dependencias, ninguna de interfaz.
- `styles.css`: 188 tokens, con las mediciones de contraste en comentarios.
- `design-tokens.types.ts`: *«acá viven solo los NOMBRES… duplicar un valor sería
  abrir una quinta frontera de deriva.»*
- Doce archivos de prueba que leen `styles.css`.

## Plan de revisión

Revisar si aparece una necesidad que exija un componente muy complejo
(desplazamiento virtual sobre miles de filas, editor enriquecido). **La respuesta
correcta entonces sería incorporar el CDK para esa pieza concreta**, no cambiar
el sistema entero.
