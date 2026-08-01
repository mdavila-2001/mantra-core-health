# Almacenamiento del navegador

Dos claves, dos guardianes, y una regla de degradación que es más sutil de lo que
parece.

---

## El inventario

| Clave | Contenido | Escribe | Sensibilidad |
|---|---|---|---|
| `mantra.refresh-token` | Refresh token | `RefreshTokenStorage` | **Alta** |
| `mantra-core-health.theme` | `'light'` o `'dark'` | `ThemeService` + el script de `index.html` | Nula |

```bash
grep -rn "localStorage\|sessionStorage\|indexedDB\|document.cookie\|caches\." src/
```

Devuelve **solo** esos tres archivos. No hay `sessionStorage`, ni `IndexedDB`, ni
cookies propias, ni Cache API.

## `localStorage` lanza, no devuelve `null`

Es la distinción que hace correcto todo lo demás:

```ts
private storage(): Storage | null {
  if (!this.isBrowser) {
    return null;
  }
  try {
    return this.document.defaultView?.localStorage ?? null;
  } catch {
    return null;
  }
}
```

En Safari en modo privado con cookies de terceros deshabilitadas, **acceder a
`window.localStorage` lanza una excepción**. Un `if (window.localStorage)`
también lanzaría, y la aplicación se caería al arrancar.

Por eso hay dos guardas: la de plataforma (`isBrowser`, para SSR) y el
`try/catch` (para el navegador que lo bloquea).

Y cada operación tiene el suyo:

```ts
clear(): void {
  const storage = this.storage();
  if (storage === null) return;
  try {
    storage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  } catch {
    // Ídem: que no se pueda borrar no debe impedir cerrar sesión.
  }
}
```

Ese comentario es el que importa: **un fallo al borrar no puede bloquear el
cierre de sesión.**

### Qué pasa cuando está bloqueado

| Cosa | Comportamiento |
|---|---|
| Sesión | **Funciona durante la pestaña**, se pierde al recargar |
| Tema | Funciona durante la sesión, vuelve al del sistema al recargar |
| Todo lo demás | Igual |

> *«Peor es romper.»*

## El access token nunca se persiste

> *«el de acceso dura minutos y se vuelve a obtener con el otro, así que
> guardarlo sería exponer una credencial de más sin ganar nada.»*

Consecuencia de arquitectura: `SessionStore` no persiste, así que **ninguna rama
del código toca `localStorage` en la ruta de SSR**.

## Valores normalizados y validados

Lo que vuelve del almacenamiento **es texto sin contrato**, y el proyecto lo trata
así:

```ts
// refresh token: '' equivale a ausencia
return value === null || value === '' ? null : value;

// tema: guarda de tipo
export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);
}
```

Y el script de `index.html`, que corre antes de Angular, compara contra dos
cadenas exactas:

```js
if (preferencia === 'light' || preferencia === 'dark') { … }
```

**Un `localStorage` manipulado no puede estampar nada distinto.**

## `system` se guarda como ausencia

```ts
if (mode === 'system') storage.removeItem(THEME_STORAGE_KEY);
else                   storage.setItem(THEME_STORAGE_KEY, mode);
```

Guardar la cadena `'system'` obligaría al script del `<head>` a interpretarla, y
el punto era que no interpretara nada: sin clave, manda el `@media` del CSS.

## Riesgos

### 1 · XSS puede leer el refresh token · `MEDIUM`

**Mitigado por:** cero `innerHTML`, cero `bypassSecurityTrust*`, cero scripts de
terceros, 10 dependencias.
**Sin mitigar:** no hay CSP.
**No es del frontend:** una cookie `HttpOnly` exige que la API deje de entregar
el token en el cuerpo del login.

### 2 · Sobrevive al cierre del navegador · `LOW`

`localStorage` no expira. **Mitigación real:** el refresh token sí expira del
lado del servidor, y si el canje falla al arrancar la clave se borra.

### 3 · Persiste en un dispositivo compartido · `MEDIUM`

Quien no cierre sesión deja el token en disco. `logout()` limpia pase lo que
pase, pero nadie obliga a cerrar sesión.

**Propuesta:** cierre por inactividad. Ver
[sesión y tokens](session-and-tokens.md#2--sin-cierre-por-inactividad--medium).

### 4 · Otra pestaña no se entera · `MEDIUM`

Cerrar sesión en una pestaña deja la otra viva. Se resolvería con un oyente de
`storage`, que dispara en las **otras** pestañas del mismo origen.

## Reglas para lo que venga

**PHI y `localStorage` no se mezclan.** Hoy no se guarda ningún dato clínico, y
esa propiedad hay que conservarla:

1. **Nada de PHI en `localStorage` ni en `IndexedDB`.** Sobreviven al cierre de
   sesión si nadie los limpia.
2. **Si hiciera falta guardar algo entre navegaciones**, `sessionStorage` es la
   primera opción a evaluar: muere con la pestaña.
3. **Toda clave nueva se declara en esta página**, o el inventario deja de ser
   completo.
4. **Toda clave nueva se limpia en `clearLocal()`.** Hoy limpia el store y el
   refresh token; una clave que no se agregue ahí sobrevive al cierre de sesión.
5. **Todo lector valida lo que lee.** El almacenamiento es entrada no confiable.
6. **Toda escritura degrada.** `try/catch` alrededor, siempre.

La regla 4 es la que más fácil se rompe y la que peor consecuencia tiene.

## Cómo inspeccionarlo

```text
DevTools › Application › Local Storage › http://localhost:4200
```

Debe haber **como máximo dos claves**. Una tercera sin documentar en esta página
es una infracción de la regla 3.
