# Pruebas de contrato

**No existen.** Los tipos de la API están escritos a mano y su fidelidad depende
de que alguien la mantenga.

---

## Cómo está hoy

Los tipos de `core/data-access/**` se escribieron **a mano contra el contrato del
backend**, con la referencia anotada en comentarios:

```ts
/**
 * Códigos de error estables de la API.
 *
 * Copiados de `src/common/errors/error-codes.ts` del backend, que los declara
 * parte del contrato…
 */
```

```ts
/**
 * Rutas que la API declara `@Public()`…
 * Verificadas una por una contra `iam-auth.controller.ts`.
 */
```

**Es trazabilidad, no verificación.** Dice de dónde salió cada cosa; no comprueba
que siga siendo así.

## Qué sí verifican las pruebas actuales

Las de los clientes fijan **el lado del frontend** del contrato:

| Aserción | Qué protege |
|---|---|
| El cuerpo lleva exactamente los campos declarados | `forbidNonWhitelisted` devuelve 400 con un campo de más |
| Los opcionales vacíos **no viajan** | Un `undefined` presente viaja como clave declarada |
| Las fechas se convierten a `Date` | La frontera transporte/vista |
| El `$` va literal, no `%24` | Express enruta sin decodificar |
| Solo un identificador en el login | La unión discriminada lo impide, y la prueba lo confirma |

**Todo eso protege contra que el frontend rompa el contrato. Nada protege contra
que el backend lo cambie.**

## Lo que puede pasar sin que nadie se entere

| Cambio del backend | Qué pasa | Cuándo se detecta |
|---|---|---|
| Un campo de respuesta se renombra | El tipo miente. `undefined` en tiempo de ejecución | En producción |
| Un campo obligatorio pasa a opcional | El tipo es más estricto que el contrato | En producción |
| Se agrega un `code` de error nuevo | `readApiError` devuelve `null` → **S9 genérico** | Degradación silenciosa |
| Una ruta cambia | 404 → S9 | En producción |
| Una ruta deja de ser `@Public()` | El interceptor no manda credencial → 401 → **bucle evitado, pero fallo** | En producción |

### El tercero es el más insidioso

```ts
if (typeof code !== 'string' || !isApiErrorCode(code)) {
  return null;   // → unexpectedError(...) → S9
}
```

Un código nuevo **no rompe nada**: se degrada a S9. Es el comportamiento correcto
—no inventar significados que el contrato no declara— pero significa que un
`IDENTITY_VERIFICATION_REQUIRED` nuevo se mostraría como «algo salió mal» en vez
de como una puerta.

## Lo que sí se verifica hoy

```bash
node scripts/check-api-contract-drift.mjs
```

Compara los endpoints que el **código llama** con los declarados en
[la API de backend](../integrations/backend-api.md).

| Detecta | No detecta |
|---|---|
| Que se agregue una llamada sin documentarla | Que el backend cambie el contrato |
| Que se documente una operación inexistente | Cambios de forma de la respuesta |
| Deriva entre el código y esta documentación | Códigos de error nuevos |

**Es media solución, y la mitad que falta es la que importa.**

## La barrera: no hay OpenAPI alcanzable

El backend es otro repositorio (`mantra-core-health-redesa-api`) y **su
especificación no es alcanzable desde acá**. Sin ella, cualquier prueba de
contrato en este lado sería una copia manual del contrato, que es lo que ya hay.

## Propuestas, en orden de coste

### 1 · Publicar el OpenAPI en un lugar alcanzable

Es lo único que desbloquea todo lo demás. Un archivo versionado, o un endpoint,
con una versión fijada.

**No es trabajo de este repositorio**, y por eso está registrado como una
dependencia externa en
[el análisis de brechas](../reports/documentation-gap-analysis.md).

### 2 · Generar los tipos desde el OpenAPI

Con `openapi-typescript` o equivalente, los tipos dejan de escribirse a mano. Un
cambio del backend **rompe la compilación**, que es exactamente donde debe
romper.

Añade una dependencia de desarrollo y un paso de generación.

### 3 · Verificar los códigos de error contra el catálogo

Más barato que el 2 y cubre el caso insidioso: comparar `API_ERROR_CODES` con la
lista del backend y fallar si divergen.

### 4 · Contratos dirigidos por el consumidor (Pact)

La solución completa: el frontend declara qué espera, el backend verifica que lo
cumple. **Es la más cara y exige coordinación entre los dos equipos.**

### 5 · Un smoke E2E contra la API real

No es una prueba de contrato, pero detecta lo mismo con menos ceremonia: un
login y una lectura contra un entorno real, en cada despliegue.

**Probablemente la mejor relación valor/esfuerzo**, y depende de que exista un
[despliegue](../operations/deployment.md).

## Recomendación

**Empezar por la 3.** Es la única que se puede hacer sin coordinación, sin
dependencias nuevas y sin infraestructura, y cubre el modo de fallo más
silencioso.

La 1 y la 5 son las siguientes, y las dos dependen de decisiones fuera de este
repositorio.

## Estado

`HIGH` en [el análisis de brechas](../reports/documentation-gap-analysis.md),
con la nota de que **una parte de la solución no está en manos de este
repositorio**.
