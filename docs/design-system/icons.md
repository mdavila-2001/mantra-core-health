# Íconos

**No hay biblioteca de íconos.** Los íconos son SVG en línea, proyectados dentro
de los componentes.

---

## Cómo funciona

```html
<button app-button iconOnly variant="neutral" aria-label="Notificaciones">
  <svg …></svg>
</button>
```

`AppButton` lo documenta:

> *«Los íconos se proyectan como SVG (`stroke="currentColor"`): el componente los
> dimensiona y, en carga, se apagan solos con el resto del contenido.»*

`stroke="currentColor"` es la clave: el ícono hereda el color del texto, así que
sigue el tema, el estado de hover y el deshabilitado **sin una sola regla
adicional**.

## El set del menú es cerrado y tipado

`side-nav.types.ts` declara siete nombres y nada más:

```ts
/**
 * Set de íconos de trazo propio del nav. Cerrado a propósito: un string libre
 * terminaría en nombres que no existen y en íconos mudos.
 */
export const NAV_ICON_NAMES = [
  'home', 'patients', 'calendar', 'orders', 'results', 'billing', 'settings',
] as const;
export type NavIconName = (typeof NAV_ICON_NAMES)[number];
```

```ts
{ label: 'Panel', route: '/panel', icon: 'home' }
{ label: 'Sistema de diseño', route: '/design-system', icon: 'settings' }
```

**`icon: 'dashboard'` no compila.** Es la diferencia entre un contrato y una
convención: con un `string` libre, el ítem se pintaría sin ícono y nadie se
enteraría hasta verlo.

`app-side-nav` los resuelve con un `@switch` sobre el nombre, y el `<span>` que
los contiene lleva `aria-hidden="true"` — el ícono acompaña a la etiqueta, no la
sustituye.

**`icon` es opcional.** Sin él, el ítem colapsado muestra la inicial de su
etiqueta en vez de un hueco.

Los siete nombres anticipan los portales del modelo (pacientes, agenda, órdenes,
resultados, facturación) aunque solo dos estén en uso: el set se declaró
completo, no se irá ampliando de a uno.

## Nombre accesible

**Un botón de solo ícono sin nombre accesible es un control mudo.** `AppButton`
lo comprueba, y solo en desarrollo:

```ts
private warnIfMissingAccessibleName(): void {
  if (!this.iconOnly()) return;
  const host = this.hostElement.nativeElement;
  const hasName =
    host.hasAttribute('aria-label') ||
    host.hasAttribute('aria-labelledby') ||
    (host.textContent ?? '').trim().length > 0;

  if (!hasName) {
    console.warn('[app-button] iconOnly sin nombre accesible: agregá aria-label al <button>.', host);
  }
}
```

> *«Solo en desarrollo: en producción no cuesta nada.»*

**El nombre va en el host, no en el SVG.** El `<button>` es el control; el SVG es
contenido.

### El SVG decorativo se oculta

Un ícono junto a un texto que ya lo describe **no debe anunciarse dos veces**:

```html
<svg aria-hidden="true" focusable="false" …></svg>
<span>Guardar</span>
```

`focusable="false"` es por Internet Explorer y Edge antiguo, donde un SVG entraba
en el orden de tabulación. Cuesta nada dejarlo.

## Por qué no hay biblioteca

Coherente con [no tener biblioteca de interfaz](../adr/ADR-0004-sistema-de-diseno-propio.md):

| A favor | En contra |
|---|---|
| Cero peso: solo entran los íconos que se usan | Cada ícono se pega a mano |
| Sin conflicto de estilo con el sistema | Sin catálogo que explorar |
| Sin dependencia que actualizar | Sin consistencia garantizada entre íconos de distintas fuentes |
| Sin petición de red ni de fuente de íconos | |

A esta escala —dos íconos en el menú y unos pocos en los componentes— es la
decisión correcta. Con cincuenta pantallas, la columna derecha empieza a pesar.

## Reglas al agregar un ícono

1. **SVG en línea**, no `<img>` ni fuente de íconos.
2. **`stroke="currentColor"`** (o `fill="currentColor"`), nunca un color literal:
   un ícono con color propio no sigue el tema.
3. **Sin `width`/`height` en el SVG**: los dimensiona el componente que lo
   contiene. Un tamaño fijo se pelea con la variante `sm`.
4. **`viewBox` siempre.** Sin él no escala.
5. **Decorativo → `aria-hidden="true"` + `focusable="false"`.**
6. **Único contenido de un control → `aria-label` en el control**, no en el SVG.
7. **Trazo, no relleno**, para mantener la coherencia con los que ya hay.

## Lo que no hay

| Elemento | Estado |
|---|---|
| Componente `app-icon` genérico | No existe |
| Sprite SVG | No existe |
| Fuente de íconos | No existe, y es correcto: son inaccesibles y se rompen sin la fuente |
| Catálogo de íconos en la vitrina | No hay una sección propia |
| Íconos fuera del set del nav | No están catalogados: viven en el CSS o el HTML del componente que los usa |
| Favicon distinto por tema | `public/favicon.ico` es el único archivo de `public/` |
