# ADR-0009: Vitrina interna en vez de Storybook

## Estado

**Aceptado** — documenta el estado observado.

## Contexto

Un sistema de diseño de 48 componentes necesita una superficie donde verlos con
sus variantes y estados: para diseñar, para revisar y para copiar el uso
correcto.

## Fuerzas y restricciones

- El proyecto tiene **diez dependencias externas**, todas de Angular. Storybook
  añadiría decenas.
- El repositorio instala en modo **PnP**, que históricamente convive mal con
  herramientas que asumen `node_modules`.
- El plan maestro es explícito: *«No instalarlo ni modificar el build sin
  aprobación y prueba aislada.»*
- Los nueve estados del M34 necesitan verse, y no son un componente: son un
  contrato.

## Opciones consideradas

| Opción | Descartada porque |
|---|---|
| **Storybook** | Decenas de dependencias, su propio build, y riesgo con PnP |
| Histoire / Ladle | Ecosistema Vue/React |
| Nada | Un sistema de 48 componentes sin superficie de exhibición se usa mal |

## Decisión

**Una ruta de la propia aplicación: `/design-system`.**

```ts
{
  path: 'design-system',
  loadComponent: () => import('./features/design-system-sample/design-system-sample')
    .then((m) => m.DesignSystemSample),
}
```

Con dos galerías internas:

| Componente | Qué exhibe |
|---|---|
| `OrganismsGallery` | Los organismos, que necesitan más espacio |
| **`ViewStateGallery`** | **Los nueve estados del M34, uno por uno** |

Y dos decisiones de apoyo:

- **Diferida.** *«nadie que entre a la aplicación real necesita descargarla. Con
  import directo se llevaba el presupuesto inicial por delante.»* Pesa 181,73 kB.
- **Excluida de la cobertura.** *«118 funciones que son manejadores de
  demostración, no lógica de producto.»*

## Consecuencias positivas

- **Cero dependencias añadidas.**
- Usa los componentes **exactamente como los usa la aplicación**: mismos
  proveedores, mismo CSS, mismo tema. Un Storybook mal configurado puede mostrar
  algo que no se ve así en producción.
- Se despliega con la aplicación: siempre está al día.
- **`ViewStateGallery` documenta un contrato que Storybook no cubriría bien**: los
  estados del M34 no son componentes.
- Prerenderizada: se ve sin backend y sin sesión.
- Sirve de superficie para regresión visual el día que se implemente.

## Consecuencias negativas

- Sin controles interactivos de propiedades (los *args* de Storybook): las
  variantes se exhiben, no se manipulan.
- Sin documentación generada desde los tipos.
- Sin pruebas de interacción integradas.
- Sin diferenciación visual automática.
- **Es pública y está prerenderizada**: en producción, cualquiera con la URL ve
  el inventario completo de la interfaz.

## Riesgos

| Riesgo | Estado |
|---|---|
| Que la vitrina quede desactualizada respecto de los componentes | Bajo: vive en el mismo repositorio y se despliega junto |
| Que crezca sin control | **Sin mitigar**: no hay presupuesto por fragmento |
| Que se exponga en producción sin querer | **Sin mitigar** (brecha `LOW`) |
| Que su exclusión de cobertura tape lógica real | Bajo: es una superficie de exhibición |

## Evidencia

- `app.routes.ts`, con el comentario del motivo de diferirla.
- `vitest.config.ts`, con el motivo de excluirla y los números.
- `yarn build` → `design-system-sample | 181,73 kB`.
- `ViewStateGallery` y su prueba.

## Plan de revisión

**Revisar si aparece una necesidad concreta que la vitrina no cubra**: controles
interactivos, o diferenciación visual automática.

Si aparece regresión visual con Playwright, la vitrina **es la superficie ideal**
y refuerza esta decisión en vez de contradecirla. Ver
[regresión visual](../testing/visual-regression.md).

**Recomendación explícita: no incorporar Storybook.**
