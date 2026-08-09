# Persistencia

Dos claves en `localStorage`. Nada más. Ni cookies propias, ni `sessionStorage`,
ni `IndexedDB`.

---

## El inventario completo

| Clave | Contenido | Escribe | Sensibilidad |
|---|---|---|---|
| `mantra.refresh-token` | Refresh token de la sesión | `RefreshTokenStorage` | **Alta** |
| `mantra-core-health.theme` | `'light'` o `'dark'` | `ThemeService` + el script de `index.html` | Nula |

Verificable:

```bash
grep -rn "localStorage\|sessionStorage\|indexedDB\|document.cookie" src/ --include="*.ts" --include="*.html"
```

Devuelve `RefreshTokenStorage`, `ThemeService` y el script en línea de
`index.html`. Nada más toca el almacenamiento.

## El access token **no** se persiste

```ts
/**
 * Se persiste **solo el refresh token**, nunca el de acceso: el de acceso dura
 * minutos y se vuelve a obtener con el otro, así que guardarlo sería exponer
 * una credencial de más sin ganar nada.
 */
```

Es la decisión correcta y conviene entender por qué: guardar el access token no
ahorraría ningún viaje —hay que canjear el refresh token igual al arrancar— y
dejaría una credencial válida en disco.

Y tiene una consecuencia de arquitectura: **el `SessionStore` no persiste nada**,
así que ninguna rama del código toca `localStorage` durante el render del
servidor.

## La degradación no es opcional

```ts
private storage(): Storage | null {
  if (!this.isBrowser) return null;
  try {
    return this.document.defaultView?.localStorage ?? null;
  } catch {
    return null;
  }
}
```

> *«`localStorage` **lanza** —no devuelve null— cuando el navegador bloquea el
> almacenamiento.»*

Es la distinción que hace correcto este código. Un `if (window.localStorage)`
**lanzaría** en Safari privado con cookies de terceros deshabilitadas, y la
aplicación entera se caería al arrancar.

Las tres operaciones (`read`, `write`, `clear`) tienen su propio `try/catch`:

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

Ese último comentario importa: **el fallo al borrar no puede bloquear el cierre
de sesión.**

### Qué pasa cuando el almacenamiento está bloqueado

| Cosa | Comportamiento |
|---|---|
| Sesión | **Funciona durante la pestaña**, se pierde al recargar |
| Tema | Funciona durante la sesión, vuelve al del sistema al recargar |
| Todo lo demás | Igual |

> *«Peor es romper.»*

## `system` se guarda como ausencia

```ts
if (mode === 'system') {
  storage.removeItem(THEME_STORAGE_KEY);
} else {
  storage.setItem(THEME_STORAGE_KEY, mode);
}
```

> *«así el script de index.html no estampa nada.»*

Guardar la cadena `'system'` obligaría al script del `<head>` a interpretarla, y
el punto era que no interpretara nada: sin clave, manda el
`@media (prefers-color-scheme)` del CSS, sin JavaScript y sin parpadeo.

## Lo que se lee desde afuera de Angular

```html
<script>
  var preferencia = localStorage.getItem('mantra-core-health.theme');
  if (preferencia === 'light' || preferencia === 'dark') {
    document.documentElement.dataset.theme = preferencia;
  }
</script>
```

Corre antes del primer paint. La clave está duplicada con `THEME_STORAGE_KEY` y
los dos archivos se declaran espejo: es una de
[las tres duplicaciones necesarias](../design-system/tokens.md#las-tres-duplicaciones-necesarias).

**El script valida el valor leído.** Un `localStorage` manipulado con
`data-theme="'; …"` no se estampa: solo pasan las dos cadenas exactas.

## Guardas de tipo sobre lo que vuelve del almacenamiento

`localStorage` devuelve texto sin contrato, y el proyecto lo trata como tal:

```ts
/** Guarda de tipo para lo que viene de `localStorage`, que es texto sin contrato. */
export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value);
}
```

Y el refresh token se normaliza igual: `''` se trata como ausencia.

## Riesgos, y por qué se aceptan

### El refresh token es alcanzable por XSS

Cualquier script que se ejecute en el origen puede leer `localStorage`. Una
cookie `HttpOnly` no sería legible desde JavaScript.

**Por qué está así:** la API entrega el refresh token **en el cuerpo del login,
no como cookie**. El frontend no puede convertirlo en `HttpOnly` — eso es una
decisión del backend.

Mitigaciones actuales:

- Angular escapa todo por defecto; **no hay un solo `innerHTML` ni
  `bypassSecurityTrust*` en el proyecto**.
- Cero scripts de terceros: no hay ninguna vía de inyección por dependencia de
  ejecución.
- Solo 10 paquetes externos, todos de Angular.

**Sin mitigar:** no hay CSP. Ver
[política de seguridad de contenido](../security/content-security-policy.md).

### El token sobrevive al cierre del navegador

`localStorage` no expira. Mitigación real: **el refresh token sí**, del lado del
servidor, y si el canje falla al arrancar se descarta la clave:

```ts
catchError(() => {
  this.storage.clear();   // para no reintentar en cada arranque contra el límite
  return of(false);
})
```

### Un dispositivo compartido conserva la sesión

Quien no cierre sesión deja el refresh token en el disco. `logout()` lo limpia
**pase lo que pase**, incluso si la petición al servidor falla.

Análisis completo en
[almacenamiento del navegador](../security/browser-storage.md) y en
[el modelo de amenazas](../security/threat-model.md).

## Lo que no se persiste, y está bien

| Dato | Por qué no |
|---|---|
| Access token | Dura minutos; guardarlo es exponer de más |
| Organización elegida | **Ver abajo** |
| Datos clínicos | Ninguno se guarda. Es lo correcto para PHI |
| Filtros, orden, página | No hay listados todavía |
| Borradores de formulario | No existe |

### La organización elegida sí molesta

No se persiste, y `SessionStore.start()` la descarta. Consecuencia:
**quien pertenezca a varias organizaciones pasa por la pantalla de selección en
cada recarga.**

Es coherente con no adivinar, pero es fricción real y repetida. Persistirla es un
cambio de producto con su propia decisión de seguridad (¿la organización activa
es un dato sensible?). Registrado como brecha `MEDIUM` en
[el análisis de brechas](../reports/documentation-gap-analysis.md).
