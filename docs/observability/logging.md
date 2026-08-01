# Registros

**Dos `console.warn` en todo el proyecto.** No hay logger, ni niveles, ni envío
remoto.

---

## Lo que existe

### 1 · Aviso de lista truncada

`core/data-access/terminology/terminology.client.ts`:

```ts
console.warn(
  `[terminology] El conjunto ${valueSetId} tiene más de ${MAX_PAGES * BULK_PAGE_SIZE} ` +
    'opciones: se devuelven las recorridas hasta acá.',
);
```

Corre **en producción**, y es correcto que lo haga:

> *«Devuelve lo recorrido en vez de lanzar —una lista incompleta sigue siendo
> utilizable— pero deja el aviso en consola, porque una lista truncada en
> silencio es indistinguible de una lista que de verdad terminó ahí.»*

**No lleva datos personales:** solo el identificador del conjunto de valores.

### 2 · Aviso de botón sin nombre accesible

`shared/components/atoms/button/button.ts`:

```ts
if (isDevMode()) {
  afterNextRender(() => this.warnIfMissingAccessibleName());
}
```

> *«Solo en desarrollo: en producción no cuesta nada.»*

### 3 · Aviso de S9 sin identificador

`shared/components/organisms/view-state-host/view-state-host.ts`, también solo en
desarrollo:

```ts
console.warn('[app-view-state-host] S9 sin requestId: el estado no debería poder construirse así.');
```

### 4 · El manejador por defecto de Angular

```ts
provideBrowserGlobalErrorListeners()
```

Engancha `window.onerror` y `window.onunhandledrejection` y los reenvía al
`ErrorHandler` de Angular, cuyo comportamiento por defecto es **escribir en la
consola**.

Y `main.ts`:

```ts
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
```

## Lo que no hay

| Elemento | Estado |
|---|---|
| Biblioteca de registro | No existe |
| Niveles (debug/info/warn/error) | No existen |
| **Envío remoto** | **No existe** |
| Correlación con el backend en los registros | No existe |
| Contexto de sesión o de versión | No existe |
| Muestreo | No aplica |
| Redacción de datos sensibles | **No hace falta hoy**: no se registra nada sensible |

**La consola del navegador es efímera y local.** Un error que la persona no
reporta no deja rastro en ninguna parte.

## Lo que sí funciona: el identificador de soporte

Es la pieza que suple parcialmente la falta de registros:

```ts
function correlationOf(error: HttpErrorResponse, body: ApiErrorBody | null): string {
  return body?.correlationId ?? error.headers.get('x-request-id') ?? 'sin-id';
}
```

Se muestra en pantalla, copiable, y **el tipo lo exige** — un S9 sin
identificador no compila.

> *«es lo único que conecta el reporte de la persona con los registros del
> servidor.»*

**Su límite:** solo existe cuando hubo una petición. Un fallo de render no tiene
identificador ni deja rastro.

## Reglas para cuando haya registros remotos

Escritas ahora, que es cuando son baratas:

1. **Nada de PHI**, nunca. Ni en el mensaje, ni en el contexto, ni en la traza.
2. **Nada de tokens.** Ni completos ni truncados.
3. **Nada de contenido de formularios.** Ni siquiera «el campo X era inválido»
   con el valor.
4. **Sí el `requestId`.** Es lo que hace útil el registro.
5. **Sí la versión desplegada.** Sin ella, un registro no dice contra qué código
   comparar.
6. **Sí la ruta**, pero sin parámetros sensibles.
7. **Muestrear los `info`, nunca los `error`.**
8. **La redacción se prueba.** Una prueba que pase un objeto con un token y
   compruebe que no sale, o la regla es una intención.

La 8 es la que convierte las siete anteriores en algo verificable.

## Propuesta

Un `LoggerService` en `core/` con:

- Niveles, y `debug` desactivado en producción.
- Contexto fijo: versión, ruta, `sub` del usuario (**no** su nombre ni su
  documento).
- Una lista de campos prohibidos, con prueba.
- Un destino conectable — consola hoy, servicio remoto cuando exista.

**No se implementa acá**: es un cambio de producto y añadiría una dependencia si
el destino es un servicio de terceros, con la discusión de privacidad que eso
abre. Ver [reporte de errores](error-reporting.md) y
[privacidad](../security/privacy.md).
