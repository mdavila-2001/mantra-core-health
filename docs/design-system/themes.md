# Temas

Claro, oscuro y «del sistema». **La preferencia del sistema no parpadea nunca**, y
esa propiedad es el resultado de una decisión de tres piezas.

---

## Los tres modos

```ts
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = Exclude<ThemeMode, 'system'>;
```

| Modo | Atributo en `<html>` | Quién resuelve |
|---|---|---|
| `system` | **Ninguno** | `@media (prefers-color-scheme: dark)`, en CSS, sin JavaScript |
| `light` | `data-theme="light"` | Neutraliza el `@media` |
| `dark` | `data-theme="dark"` | Manda sobre el sistema |

## Por qué `system` no escribe atributo

Es la decisión central. Escribir `data-theme="light"` cuando la persona no eligió
nada obligaría a JavaScript a decidir el tema, y bajo SSR JavaScript llega tarde:
el HTML se pinta primero.

Dejando el atributo ausente, **el CSS resuelve solo**:

```css
@media (prefers-color-scheme: dark) {
  :root:not([data-theme='light']) {
    --bg-base: var(--c-petrol-900);
    …
  }
}
```

El selector `:root:not([data-theme='light'])` es lo que hace que la elección
manual gane sobre el sistema sin necesidad de `!important` ni de orden frágil.

## Las tres piezas

### 1 · El script anti-parpadeo (`src/index.html`)

```html
<script>
  (function () {
    try {
      var preferencia = localStorage.getItem('mantra-core-health.theme');
      if (preferencia === 'light' || preferencia === 'dark') {
        document.documentElement.dataset.theme = preferencia;
      }
    } catch (e) { /* almacenamiento bloqueado: queda la preferencia del sistema */ }
  })();
</script>
```

Corre en el `<head>`, **antes del primer paint**. Sin él, una preferencia manual
guardada se vería con el tema contrario hasta que Angular hidratara.

Solo estampa `light` o `dark`. Si no hay preferencia guardada, no toca nada — y
ahí es donde entra el `@media`.

### 2 · El CSS

Dos bloques con el mismo contenido:

| Bloque | Cuándo aplica |
|---|---|
| `@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) }` | El sistema pide oscuro y la persona no eligió claro |
| `:root[data-theme='dark']` | La persona eligió oscuro explícitamente |

**Están duplicados a propósito**: uno no puede derivarse del otro en CSS plano
sin un preprocesador, y el proyecto no usa ninguno.

### 3 · `ThemeService`

```ts
readonly currentTheme  = this.preference.asReadonly();   // lo que se eligió
readonly resolvedTheme = computed<ResolvedTheme>(…);     // lo que se pinta
readonly isDark        = computed(() => this.resolvedTheme() === 'dark');

setTheme(mode: ThemeMode): void
toggleTheme(): void        // desde lo que se VE, no desde la preferencia
useSystemTheme(): void
```

Tres responsabilidades, ninguna más: *«leer la preferencia, resolverla contra el
sistema, y estamparla en `document.documentElement`».*

Se instancia al arrancar, sin esperar a que exista un componente:

```ts
provideAppInitializer(() => { inject(ThemeService); })
```

### `toggleTheme` parte de lo que se ve

```ts
toggleTheme(): void {
  this.preference.set(this.resolvedTheme() === 'dark' ? 'light' : 'dark');
}
```

Con el motivo escrito: *«Alternar desde "system" fija una preferencia explícita:
es lo que el usuario acaba de pedir.»*

Si alguien en modo sistema/oscuro pulsa el interruptor, espera pasar a claro. Que
el resultado sea «claro» y no «sistema» es lo correcto.

## `system` se guarda como ausencia

```ts
if (mode === 'system') {
  storage.removeItem(THEME_STORAGE_KEY);
} else {
  storage.setItem(THEME_STORAGE_KEY, mode);
}
```

> *«"system" se guarda como ausencia: así el script de index.html no estampa
> nada.»*

Guardar la cadena `'system'` obligaría al script del `<head>` a interpretarla, y
el punto era que no interpretara nada.

## La clave está duplicada, y es un espejo declarado

```text
src/index.html                        'mantra-core-health.theme'
core/tokens/theme.service.ts          THEME_STORAGE_KEY
```

Los dos archivos se declaran espejo mutuamente en sus comentarios. Es una de
[las tres duplicaciones necesarias](tokens.md#las-tres-duplicaciones-necesarias),
y no se puede unificar: el script corre antes de que exista Angular.

## Escuchar el cambio del sistema

```ts
const query = this.document.defaultView?.matchMedia?.(DARK_SCHEME_QUERY);
if (!query) return;
this.systemPrefersDark.set(query.matches);
query.addEventListener('change', onChange);
this.destroyRef.onDestroy(() => query.removeEventListener('change', onChange));
```

Cambiar el tema del sistema operativo con la aplicación abierta se refleja al
instante. Y el oyente **se limpia** en `onDestroy` — una fuga menor pero real si
faltara.

`?.` en `matchMedia` porque puede faltar en un DOM recortado de pruebas.

## Degradación si el almacenamiento está bloqueado

```ts
private storage(): Storage | null {
  try {
    return this.document.defaultView?.localStorage ?? null;
  } catch {
    return null;
  }
}
```

> *«`localStorage` **lanza** —no devuelve null— cuando el navegador bloquea el
> almacenamiento (Safari privado, cookies de terceros deshabilitadas). Sin
> persistencia el tema sigue funcionando por sesión, así que se degrada.»*

La distinción entre *lanzar* y *devolver null* es la que hace que este código sea
correcto y que una comprobación `if (localStorage)` no lo sea.

## `color-scheme`

```css
:root { color-scheme: light dark; }
```

Le dice al navegador que la página soporta ambos, y con eso las barras de
desplazamiento, los controles nativos y el fondo por defecto siguen el tema sin
que haya que estilarlos.

## Probar los dos temas

```bash
yarn start
# 1 · Cambiar el tema del sistema operativo → la aplicación sigue, sin recargar
# 2 · Elegir claro/oscuro en la vitrina → gana sobre el sistema
# 3 · Recargar → la elección persiste, sin parpadeo
# 4 · Volver a «sistema» → se borra la clave y vuelve a mandar el @media
```

El paso 3 es el que verifica el script anti-parpadeo. Si parpadea, la clave se
separó entre los dos archivos.

## Lo que no hay

| Elemento | Estado |
|---|---|
| Tema de alto contraste | No. Hay `outline: 2px solid transparent` en el foco, que reaparece con color de sistema en modo de contraste forzado |
| Temas por organización (marca blanca) | No |
| Transición animada entre temas | No — y probablemente correcto: animar 30 variables produce un barrido incómodo |
| Prueba de regresión visual entre temas | **No existe.** Un cambio de token puede romper el oscuro sin que nadie lo vea |

La última es la que más importa: es el único mecanismo que detectaría una
regresión de contraste. Anotada en
[regresión visual](../testing/visual-regression.md).
