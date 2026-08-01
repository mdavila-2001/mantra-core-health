# Pruebas unitarias

Lógica pura, servicios y stores. Corren con Vitest 4 sobre jsdom, orquestadas por
el builder `@angular/build:unit-test`.

---

## Cómo correrlas

```bash
yarn test            # modo observador
yarn test:coverage   # una pasada, con umbrales bloqueantes
```

Ver [ejecutar las pruebas](../getting-started/running-tests.md).

## Qué está cubierto

### `core/auth/`

| Archivo | Qué fija |
|---|---|
| `access-token.spec.ts` | Decodificación del JWT: formato inválido, base64 corrupta, JSON ilegible, claims del tipo equivocado → `null` en todos los casos. Y que **solo `sub` es obligatorio** |
| `session.store.spec.ts` | Las diez derivadas; que `''` equivale a ausencia; que `renew` **no** toca el tenant elegido y `start` sí |
| `auth.guard.spec.ts` | Los tres caminos: sin sesión, falta elegir organización, pasa |
| `auth.service.spec.ts` | Login, logout que limpia **pase lo que pase**, y `restoreSession` que descarta el token muerto |

### `core/http/`

| Archivo | Qué fija |
|---|---|
| `auth.interceptor.spec.ts` | Que las rutas públicas pasan sin tocar; que se añaden `Authorization` y `X-Tenant-Id`; que el reintento **no recursa** |
| `error-to-view-state.spec.ts` | El mapeo de los doce códigos a los nueve estados, incluidos los dos que comparten el 403 |

### `core/view-state/`

`view-state.spec.ts` fija los constructores, las guardas y —lo más
importante— **la correspondencia con los nueve códigos del M34**:

```ts
export const M34_CODE_BY_STATUS: Readonly<Record<ViewStateStatus, M34Code | null>> = { … };
```

> *«la trazabilidad al modelo la da `M34_CODE_BY_STATUS`, que sí está fijada con
> una prueba contra los 9 códigos literales.»*

Es trazabilidad ejecutable: si alguien renombra un estado, la prueba lo dice.

### `core/data-access/`

Cinco clientes con prueba. Fijan lo que el contrato exige:

- Que el cuerpo lleve **exactamente** los campos declarados (por
  `forbidNonWhitelisted`).
- Que los opcionales vacíos **no viajen**.
- Que las fechas se conviertan a `Date`.
- Que el `$` de terminología vaya **literal**, no `%24`.

## Las pruebas que leen el CSS del disco

Doce archivos importan `node:fs`:

```bash
grep -rln "node:fs" src/ | wc -l   # 12, todos .spec.ts
```

Leen `src/styles.css` y comprueban que cada token declarado en TypeScript existe
de verdad en CSS. Es la defensa contra
[las tres duplicaciones necesarias](../design-system/tokens.md#las-tres-duplicaciones-necesarias):

| Duplicación | Prueba |
|---|---|
| Escala de breakpoints (`--bp-*` ↔ `BREAKPOINTS`) | `core/tokens/breakpoints.spec.ts` |
| Umbral del cajón (780 px en CSS ↔ `NAV_DRAWER_MAX_WIDTH`) | `core/layout/breakpoints.spec.ts` |
| Catálogo de tokens (`DESIGN_TOKENS` ↔ `styles.css`) | `core/tokens/design-tokens.types.spec.ts` |

**Es una práctica poco común y muy acertada.** Una duplicación que una prueba
vigila deja de ser deuda.

### El hueco

La comprobación es **en un solo sentido**: TypeScript → CSS. Un token declarado
solo en CSS pasaría sin aviso.

No rompe nada, pero el catálogo tipado dejaría de ser completo. Brecha `MEDIUM`
(D4). Ver
[la auditoría de estructura](../reports/graphify-audit.md#d4--el-sistema-de-diseño-se-declara-en-dos-escalones-distintos).

## Cómo se nombran

```ts
it('lleva rel="noopener noreferrer": la pestaña nueva no hereda la sesión', () => { … });
it('devuelve null ante un token ilegible: una sesión que no sirve se resuelve cerrando', () => { … });
```

**El nombre dice por qué importa, no qué hace el código.** Es lo que hace que una
prueba que falla sea útil: el mensaje ya explica qué se rompió.

## Qué NO probar

| No probar | Por qué |
|---|---|
| Que un `computed` devuelva lo que devuelve su expresión | Es probar Angular |
| Las clases CSS que genera un `computed` | Frágil. Probar el comportamiento observable |
| Los detalles internos de un servicio | Probar su superficie pública |
| La vitrina | Excluida a propósito de la cobertura |

## Servicios sin prueba propia

| Servicio | Cubierto por | ¿Merece una? |
|---|---|---|
| `RefreshTokenStorage` | `auth.service.spec.ts`, indirectamente | Sí: la degradación cuando `localStorage` **lanza** es exactamente lo que una prueba fija |
| `TokenRefreshService` | `auth.interceptor.spec.ts` | **Sí, la más clara**: su garantía de *una sola petición en vuelo* |
| `PublicClient` | — | Sí, y es trivial |
| `DialogService` | `dialog.spec.ts` | Menos urgente |
| `ShellService` | `shell.spec.ts` | Menos urgente |

Las dos primeras son las que un refactor puede romper sin que nada avise.

## Dobles de prueba

El proyecto usa `HttpTestingController` y `TestBed` estándar. **No hay
`node_modules` de mocking añadido**: coherente con las diez dependencias.

Los datos son **sintéticos y deterministas**. Verificado: ninguna prueba llama a
un servicio real.
