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

`atoms/nav-icon/nav-icon.types.ts` declara **cincuenta y cinco** nombres y nada
más —`side-nav.types.ts` los re-exporta, por quien ya los importaba de ahí—.
El listado completo y comentado vive sólo ahí (no se duplica acá, por la misma
razón que `design-tokens.types.ts` no duplica valores): cuarenta y siete
nombran una sección, y ocho más no nombran ninguna —son los que siguen, cada
uno con su propia historia:

```ts
/**
 * Set de íconos de trazo propio de la navegación. Cerrado a propósito: un
 * string libre terminaría en nombres que no existen y en íconos mudos.
 */
export const NAV_ICON_NAMES = [
  // 47 nombres de sección: home, patients, calendar, orders, results,
  // billing, settings, people, chat, directory, stethoscope, hospital,
  // flask, scan, scalpel, pill, heart, folder, note, clipboard, survey,
  // book, labels, building, factory, package, bag, tag, megaphone, pin,
  // route, globe, chart, star, shield, key, lock, link, flag, umbrella,
  // briefcase, mail, phone, bell, sliders, history, teach,

  // + 4 glifos de dirección/acción (no nombran sección): arrow-left,
  // arrow-right, remove, edit — ver "Los glifos de acción" más abajo.

  // + 4 de preferencia del dispositivo (tampoco nombran sección):
  // monitor, sun, moon, camera — el panel «Apariencia» y «Permisos».
] as const;
export type NavIconName = (typeof NAV_ICON_NAMES)[number];
```

```ts
{ label: 'Panel', route: '/dashboard', icon: 'home' }
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

### Por qué son cincuenta y cinco y fueron siete

Los siete originales se eligieron cuando el menú tenía dos entradas y el set
«anticipaba los portales del modelo». Con **cincuenta y cinco secciones** eso
dejó de ser un set y pasó a ser un reparto: `orders` —una hoja de papel—
cargaba catorce secciones y `settings` doce, así que «Chats» era una onda de
electrocardiograma, «Directorio de médicos» una casa y «Directorio de
farmacias» un documento.

Un ícono aporta **una** cosa: reconocer una sección sin leerla. Repetido
catorce veces no aporta nada —peor, miente—, y en la rejilla de «Tus accesos»
del panel, donde treinta secciones se ven juntas, la repetición es lo primero
que se nota.

La regla al agregar uno: que **diga algo que su etiqueta no dice ya**. Dos
secciones comparten ícono sólo cuando son la misma idea vista dos veces
—«Turnos» y «Mis turnos», la agenda de quien atiende y la de quien consulta—,
nunca por falta de dibujo. Hoy ninguno carga más de tres.

### Los glifos de acción (09/09/2026)

Cuatro nombres del set **no** nombran una sección: `arrow-left`,
`arrow-right`, `remove` y `edit`. Responden «¿hacia dónde va este botón?» o
«¿qué le hace a lo que tiene al lado?». `edit` es el lápiz que habilita los
campos de un formulario que entró en sólo lectura («Mi perfil», FT-11-R04): un
botón `iconOnly` con `aria-label="Editar"` y el mismo texto en el globo.
No se usa `note` para eso, aunque tenga un lápiz dibujado: `note` es la
sección «Evoluciones», y el mismo glifo para «esta sección» y para «editar
esto» rompe el reconocimiento.

### Preferencia del dispositivo

Cuatro nombres más por el mismo motivo que los de arriba: `monitor`, `sun`,
`moon` y `camera` tampoco nombran una sección del menú, nombran un valor de
una preferencia —los tres del panel «Apariencia» y el que le faltaba a
«Permisos»—. `camera` no es lo mismo que `scan`: una es la cámara del
dispositivo, la otra la imagenología clínica, y confundirlas en el set sería
el mismo error que ya resolvió `lock` frente a `key`.

### Cómo se dibuja uno (28/08/2026)

Tener cincuenta y cinco nombres distintos no alcanzaba si los dibujos no se
leían. Tres reglas, que salieron de mirarlos al tamaño en que se ven de verdad
—20 px en el menú, 22 px dentro de una zona del árbol de accesos—:

1. **Trazo 1,5.** Era 1,6, y a ese tamaño ese décimo de más empasta: dos trazos
   paralelos a menos de 2 px se leen como uno solo grueso.
2. **Centro en 12, con aire.** El `viewBox` es `0 0 24 24` y el dibujo se centra
   ahí, con unos 2 px libres a cada lado. `patients` tenía la cabeza en x=9 y
   los hombros llegando a x=1: en una fila de íconos se veía torcido sin que se
   supiera por qué.
3. **Un detalle interior que lo distinga.** Una silueta sola no basta cuando hay
   cincuenta y cinco: el calendario lleva los días marcados, la orden dos
   renglones escritos, el globo de diálogo tres puntos, la carpeta su tapa. Sin
   eso, a 20 px `orders`, `note` y `clipboard` son el mismo rectángulo.

Y dos íconos no pueden compartir el mismo interior: `results` y `scan` llevaban
los dos el mismo electrocardiograma y en el menú eran el mismo dibujo. Ahora el
trazo es del informe (`results`) y el barrido es de la placa (`scan`).

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

Con cincuenta y cinco íconos de navegación, once de categoría del glosario y
unos pocos sueltos en los componentes, la columna derecha ya pesa: no hay
catálogo que explorar y cada forma se dibuja a mano. Sigue ganando la izquierda
—los cincuenta y cinco son trazos de dos o tres `path`, no una dependencia que
actualizar ni una petición de red—, pero la próxima vez que el set se duplique
conviene volver a mirar esta tabla en vez de darla por saldada.

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
