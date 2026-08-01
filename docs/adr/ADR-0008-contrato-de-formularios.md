# ADR-0008: Contrato de accesibilidad campo ↔ control por inyección

## Estado

**Aceptado** — con evidencia documental en el propio archivo.

## Contexto

El defecto de accesibilidad más caro de un sistema de componentes es un
`<label for>` sin `id` al que apuntar: **deja el control sin nombre accesible**.

Con 15 átomos, 19 moléculas y seis pantallas con formulario, resolverlo caso por
caso garantiza que en algún sitio quede mal.

## Fuerzas y restricciones

- **El campo** conoce label, hint y error. **El control** conoce su elemento
  nativo. Ninguno tiene solo lo necesario.
- **Un grupo de radios no es «etiquetable»**: el `for` de un `<label>` no puede
  apuntarle.
- Bajo SSR, los ids deben coincidir entre servidor y cliente o la hidratación
  rompe.
- Un control debe seguir funcionando **sin** un campo alrededor.

## Opciones consideradas

| Opción | Descartada porque |
|---|---|
| Que cada pantalla pase el `id` a mano | Se olvida, y el fallo es invisible hasta probar con lector |
| Que el control genere su `id` y el campo lo lea | El campo se renderiza antes; no puede leerlo a tiempo |
| Content projection con consultas | Frágil y acopla al orden del DOM |

## Decisión

**Un `InjectionToken` que el campo provee y el control consume.**

```ts
export interface FormControlContext {
  readonly controlLabelable: WritableSignal<boolean>;   // el control DECLARA
  readonly controlId: Signal<string>;                   // el campo GENERA
  readonly labelId: Signal<string>;
  readonly describedBy: Signal<string | null>;
  readonly invalid: Signal<boolean>;
  readonly required: Signal<boolean>;
}
```

Con tres decisiones de detalle:

1. **`controlLabelable` va del control al campo**, no al revés: solo el control
   sabe si su elemento nativo admite `for`.
2. **`inject(…, { optional: true })`**: un control sin campo cae en su propio id.
3. **Ids por contador incremental**, no aleatorios.

## Consecuencias positivas

- **Todo control envuelto tiene nombre accesible, `aria-describedby`,
  `aria-invalid` y `aria-required`.** Sin que la pantalla haga nada.
- El caso de los grupos se resuelve una vez, no por componente.
- **Los ids sobreviven a la hidratación**:
  > *«Server y cliente arrancan en 0 y avanzan en el mismo orden, así que los ids
  > coinciden y la hidratación no rompe.»*
- 19 importadores: es el segundo nodo de mayor centralidad del proyecto.

## Consecuencias negativas

- Es un mecanismo implícito: quien lea solo el control no ve de dónde sale su
  `id`.
- **Nada obliga a envolver el control.** Un `app-input` suelto compila y queda sin
  nombre accesible.
- El contador global es estado de módulo; funciona porque el orden es
  determinista, y eso es una suposición que conviene conocer.

## Riesgos

| Riesgo | Estado |
|---|---|
| Un control suelto sin nombre | **Sin mitigar** — no hay regla de lint (A11Y-12) |
| Que alguien use un id aleatorio | Rompería la hidratación. Mitigado por el comentario, no por código |
| Que el orden de render difiera entre servidor y cliente | Improbable, y rompería más cosas antes |

## Evidencia

- `form-control.context.ts`, con el problema declarado en su encabezado.
- 19 importadores en el grafo de módulos.
- `value-accessor-groups.spec.ts`, que cubre el caso de los grupos.
- Las pruebas de `FormField` y `RadioGroup`.

## Plan de revisión

**Añadir una regla de lint** que exija `app-form-field` alrededor de un control
de formulario. Es la mitigación que falta y cerraría A11Y-12.

Y revisar si aparece un control que necesite más del contexto (por ejemplo, el
estado de «solo lectura» o el `autocomplete`).
