# Pruebas de componente

49 de 61 componentes tienen `.spec.ts`. Se montan con `TestBed` y se verifican
contra el DOM real de jsdom.

---

## Cobertura por nivel

| Nivel | Con prueba | Total |
|---|---:|---:|
| Átomos | 14 | 15 |
| Moléculas | 15 | 19 |
| Organismos | 12 | 14 |
| Features | 7 | 11 |
| Otros | 1 | 2 |

Cobertura de `shared/`: **94,21 %** de sentencias. Los cinco subcomponentes sin
prueba propia quedan ejercitados por la de su padre.

## Qué se verifica

### Comportamiento observable, no implementación

```ts
it('lleva rel="noopener noreferrer": la pestaña nueva no hereda la sesión', () => {
  expect(ancla().getAttribute('rel')).toBe('noopener noreferrer');
});
```

Se comprueba el atributo que llega al DOM, no la señal que lo produce.

### Las constantes exportadas se recorren

```ts
export const BUTTON_VARIANTS = [...] as const;
export const CHIP_REMOVE_KEYS = [...] as const;
export const TOOLTIP_POSITIONS = [...] as const;
```

Que se exporten **como valores además de como tipos** permite que la prueba
recorra todas las variantes en vez de enumerar tres a mano. Agregar una variante
la incluye automáticamente.

Es la razón por la que los barriles exportan las constantes:

```ts
export { BUTTON_SIZES, BUTTON_VARIANTS } from './button/button.types';
export type { ButtonSize, ButtonType, ButtonVariant } from './button/button.types';
```

### Accesibilidad, a mano

Sin `axe-core`, las aserciones de accesibilidad son explícitas:

| Componente | Qué fija |
|---|---|
| `Link` | `rel="noopener noreferrer"` en externos — **tres pruebas** |
| `AppButton` | `aria-disabled`, `aria-busy`, que el clic se intercepta |
| `FormField` | El vínculo label ↔ control |
| `Dialog` | Que `Escape` cancela y no confirma |
| `ViewStateHost` | Que S4 mueve el foco y S2/S7 no |
| `DataTable` | `<caption>`, `scope="col"`, `aria-sort` |

Es más trabajo que un `expect(await axe(fixture)).toHaveNoViolations()`, y a
cambio fija **la intención concreta** en vez de la ausencia genérica de
infracciones.

## Las pantallas

Las seis de `auth/` tienen prueba. Verifican:

- La detección correo/documento por la arroba (`Login`).
- El bloqueo del envío con formulario inválido.
- La omisión de campos vacíos del cuerpo.
- La traducción de errores a estados.
- La navegación posterior.
- Los dos formularios y el cambio de tipo (`RegisterPatient`).
- Los cuatro estados de `VerifyEmail`, incluido el token en blanco.
- `revokedSessions` en `ResetPassword`.

**`Dashboard` y `ShellLayout` no la tienen.** Es la brecha `HIGH` de
[la estrategia](strategy.md#las-dos-últimas-son-la-brecha-high).

## Cómo montar un componente

Patrón del proyecto:

```ts
TestBed.configureTestingModule({ imports: [ComponenteBajoPrueba] });
const fixture = TestBed.createComponent(ComponenteBajoPrueba);
fixture.componentRef.setInput('variant', 'danger');
fixture.detectChanges();
```

`setInput` es la forma correcta con entradas de señal: asignar la propiedad
directamente no notifica.

## Lo que jsdom no puede

| Limitación | Consecuencia |
|---|---|
| Sin layout real | No se puede comprobar tamaño, posición ni solapamiento |
| Sin `matchMedia` completo | `Breakpoints` lo comprueba y **degrada a escritorio** si falta |
| `<dialog>` parcialmente implementado | La trampa de foco del navegador no se puede verificar acá |
| Sin renderizado de tipografías | Ningún contraste ni métrica tipográfica |
| Sin foco real en algunos casos | Las aserciones de foco son limitadas |

**Las tres primeras son las que más pesan**: la trampa de foco de `app-dialog` y
el comportamiento responsivo real **solo se pueden verificar en un navegador**, y
no hay ninguna prueba que lo haga.

Es el argumento estructural para las pruebas E2E: no es que las de componente
estén mal hechas, es que hay cosas que jsdom no puede ver.

## Reglas

1. **`setInput`, no asignación directa**, para entradas de señal.
2. **Comprobar el DOM**, no la señal interna.
3. **Recorrer las constantes exportadas** en vez de enumerar valores.
4. **Nombrar por la intención**, no por el método.
5. **Un `detectChanges` por cambio**, no uno global al final.
6. **Nada de datos reales.** Sintéticos y deterministas.
7. **Si algo solo se puede probar en un navegador, decirlo** en vez de fingir
   que jsdom alcanza.
