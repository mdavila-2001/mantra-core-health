# Lectores de pantalla

Regiones vivas, nombres accesibles y las cuatro pantallas donde falta el anuncio.

---

## Regiones vivas

Dos, y las dos existen **antes** de que llegue el mensaje que anuncian — que es
el requisito que más se incumple.

### El anuncio de ruta

```html
<!-- Cambiar de ruta sin recargar no dispara ningún anuncio del navegador: lo
     hace esta región. `<output>` ya es una región viva por sí misma. -->
<output class="sr-only" aria-live="polite">{{ announcement() }}</output>
```

Vive en `app-shell`, así que **cubre todas las rutas con sesión**. Las de `auth/`
no lo tienen.

Usar `<output>` en vez de un `<div role="status">` es correcto y menos frecuente:
el elemento ya es una región viva por definición.

### El estado de una sección

```ts
host: {
  class: 'view-state-host',
  // Los cambios de estado se anuncian; la urgencia la decide cada estado en
  // su propio bloque (S4/S9 son assertive por su rol de alerta).
  'aria-live': 'polite',
}
```

El matiz importa: `polite` en el host, y los estados que **son** alertas (S4, S9)
aportan su urgencia desde el rol de `app-alert`.

### El ancla de avisos existe desde el primer render

```html
<router-outlet />
<app-toast-container />
```

> *«va una sola vez, fuera del outlet, para que sobreviva a los cambios de ruta y
> exista como región viva desde el primer render.»*

**Una región viva creada después de que llegue el contenido no lo anuncia.** Los
lectores observan regiones que ya existían.

## Nombres accesibles

### El contrato de formularios

`FORM_CONTROL_CONTEXT` garantiza que **todo** control envuelto en un
`app-form-field` tenga:

| Atributo | De dónde |
|---|---|
| `id` | `controlId` que genera el campo |
| Nombre | `<label for>` o `aria-labelledby`, según `controlLabelable` |
| `aria-describedby` | Hint y/o error, concatenados |
| `aria-invalid` | La señal `invalid` |
| `aria-required` | La señal `required` |

Es la pieza que evita el defecto más caro: *«un `<label for>` sin `id` al que
apuntar deja el control sin nombre accesible»*.

### El caso de los grupos

```ts
/**
 * Si el control es «etiquetable» en el sentido del HTML (input, select,
 * button…). Un grupo de radios NO lo es: el `for` del label no puede
 * apuntarle, y el grupo se nombra con `aria-labelledby`.
 */
readonly controlLabelable: WritableSignal<boolean>;
```

**El control lo declara; el campo decide.** Es la única forma de que un mismo
`app-form-field` sirva para un `<input>` y para un grupo de radios sin que la
pantalla tenga que saber la diferencia.

### Botones de solo ícono

```ts
if (!hasName) {
  console.warn('[app-button] iconOnly sin nombre accesible: agregá aria-label al <button>.', host);
}
```

Comprueba `aria-label`, `aria-labelledby` y el texto del host. Solo en
desarrollo: *«en producción no cuesta nada»*.

**Es un aviso, no un error.** No rompe el build ni la prueba — lo cual es
discutible: un control mudo en producción es un control inutilizable. Anotado
como brecha `LOW`.

### `.sr-only`

```css
.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap; border: 0;
}
```

Para *«texto que completa un nombre accesible sin ocupar espacio visual (p. ej.
"(obligatorio)" junto al asterisco)»*.

Dos detalles correctos: `clip-path` en vez del `clip` obsoleto, y
`white-space: nowrap` para que el texto no se parta en una línea de 1 px.

Se usa en el anuncio de ruta y en el `<caption>` de `app-data-table`.

## Estructura semántica

| Elemento | Dónde |
|---|---|
| `<header>` | `app-header` es el host, con selector de atributo |
| `<main>` | `app-shell`, con `id` y `tabindex="-1"` |
| `<dialog>` | `app-dialog` |
| `<output>` | El anuncio de ruta |
| `<table>` + `<caption>` + `<th scope="col">` | `app-data-table` |
| `<dl>/<dt>/<dd>` | Los datos de sesión del panel |
| `<h1>` … `<h3>` | Escala tipográfica, con `PageHeader` aportando el `h1` |

**El panel usa `<dl>` para los pares clave–valor**, que es el elemento correcto y
casi nadie lo usa.

## Los íconos decorativos se ocultan

```html
<span class="side-nav__icon" aria-hidden="true">…</span>
```

Un ícono junto a una etiqueta que ya lo describe no debe anunciarse dos veces.

Y el encabezado del panel evita la duplicación en el otro sentido:

> *«Sin `page-meta` con el nombre: el encabezado del shell ya lo muestra a dos
> centímetros de acá, y repetirlo hace que un lector de pantalla lo lea dos veces
> en la misma pantalla.»*

## Las cuatro pantallas sin anuncio

Las que no usan `ViewStateHost` **no tienen región viva propia**:

| Pantalla | Qué no se anuncia |
|---|---|
| `/auth/forgot-password` | **El acuse** — que es toda la respuesta |
| `/auth/register` | La confirmación de alta |
| `/auth/reset-password` | La confirmación y `revokedSessions` |
| `/auth/verify-email` | La transición de «verificando» a «verificado» |

Más el estado vacío de `/auth/organization`, que no tiene mensaje.

En las cuatro, **la respuesta del sistema aparece visualmente y no se anuncia**.
Es la familia de hallazgos más consistente de esta auditoría. Ver
[el informe](audit-report.md).

## S6 no filtra existencia

Vale la pena verlo desde la perspectiva de un lector de pantalla: el texto de «no
encontrado» es **fijo**, y `NotFoundViewState` no transporta ningún dato del
recurso.

```html
<!-- El copy es FIJO a propósito: cualquier variación entre «no existe» y
     «existe pero no lo podés ver» confirma la existencia del recurso. -->
```

Un mensaje que dijera «no tenés permiso para ver el paciente 4821» confirmaría
que ese paciente existe — a quien mire la pantalla y a quien la escuche.

## Lo que no se verificó

| Comprobación | Estado |
|---|---|
| Prueba con NVDA / JAWS / VoiceOver | **No ejecutada** |
| Árbol de accesibilidad revisado en DevTools | No |
| Orden de lectura verificado | No |
| Anuncios de `aria-live` comprobados en un lector real | No |

Esta auditoría es de código. Un `aria-live` correcto en el HTML puede no
anunciarse por razones que solo aparecen al probarlo: contenido que se
reemplaza entero, cambios demasiado rápidos, o un lector que trata `<output>`
distinto.

**Probar con un lector real es la recomendación número uno** de
[el informe de auditoría](audit-report.md).
