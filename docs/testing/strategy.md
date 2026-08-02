# Estrategia de pruebas

804 pruebas en 71 archivos, todas unitarias y de componente. **Cero E2E, cero
visuales, cero de contrato, cero de accesibilidad.**

---

## Lo que hay

| Capa | Estado | Cantidad |
|---|---|---|
| Unitarias (lógica pura) | ✅ | Incluidas en las 804 |
| Servicios y stores | ✅ | 11 de 15 servicios con `.spec.ts` |
| Componentes | ✅ | 49 de 61 con `.spec.ts` |
| Integración de feature | ✅ parcial | Las 6 pantallas de `auth/` |
| **E2E** | ❌ | **Ninguna** |
| **Contrato de API** | ❌ | **Ninguna** |
| **Regresión visual** | ❌ | **Ninguna** |
| **Accesibilidad automatizada** | ❌ | **Ninguna** |
| **Rendimiento** | ❌ | **Ninguna** |
| **Smoke de despliegue** | ❌ | No hay despliegue |

## Cobertura medida

Los umbrales son **por glob** y bloquean:

| Área | Umbral | Sentencias | Ramas | Funciones | Líneas |
|---|---:|---:|---:|---:|---:|
| `src/app/core/**` | 80 % | 87,37 % | 85,12 % | 87,50 % | 87,80 % |
| `src/app/shared/**` | 80 % | 94,21 % | 90,75 % | 91,52 % | 94,67 % |
| `src/app/features/**` | 60 % | 74,74 % | 80,34 % | 77,59 % | 77,90 % |

Los tres pasan con holgura.

> **El total global (≈56 %) no es una métrica del proyecto.** Arrastra el
> arranque, los polyfills y todo lo que ninguna prueba unitaria ejercita.
> Comparar contra él induce a error.

### Los umbrales suben, nunca bajan

```js
/**
 * Umbrales bloqueantes (decisión D2 del plan). **Suben, nunca bajan**: si
 * un cambio deja la cobertura por debajo, la orden falla en vez de avisar.
 */
```

`core/` y `shared/` al 80 % *«porque son el cimiento —los usan todas las
pantallas—»*; `features/` al 60 % *«porque una pantalla tiene mucho cascarón que
probar aporta poco»*.

### Exclusiones justificadas

| Excluido | Motivo |
|---|---|
| `**/*.spec.ts` | Las pruebas no se miden a sí mismas |
| `**/*.types.ts` | Solo declaraciones |
| `features/design-system-sample/**` | *«118 funciones que son manejadores de demostración… Incluirla arrastraba la cobertura de funciones de `features/` de 84,6 % a 26,1 %»* |

## Componentes sin prueba propia

Diez, y **ocho tienen buena razón**:

| Componente | Razón |
|---|---|
| `TooltipPanel`, `AccordionPanel`, `MenuItem`, `Radio`, `Tab` | Subcomponentes que solo existen dentro de su padre. Quedan ejercitados por la prueba del padre — por eso `shared/` está al 94 % |
| `ToastContainer` | Envoltorio de `Toast`, que sí está probado |
| `ToastDevPanel` | Herramienta de desarrollo |
| `OrganismsGallery` | Vitrina, excluida de cobertura |
| **`Dashboard`** | **La única pantalla autenticada** |
| **`ShellLayout`** | **El layout de todo lo autenticado** |

### Las dos últimas son la brecha `HIGH`

`Dashboard` concentra lógica que merece prueba:

```ts
function toState(projection: PublicProjection): ViewState<PublicProjection> {
  if (projection.records.length === 0) return empty(…);        // ← vacío gana
  return projection.refreshedAt === null
    ? ready(projection)                                        // ← null no es stale
    : stale(projection, projection.refreshedAt);
}
```

Las dos decisiones —vacío gana sobre atrasado, y `null` resuelve como `ready`—
son reglas de producto **sin ninguna prueba que las fije**. Un refactor las
rompería en silencio.

`ShellLayout` deriva `user`, `tenants` y `sections` de la sesión, y navega al
panel al cambiar de organización. Nada de eso está cubierto.

Cuatro servicios tampoco tienen `.spec.ts`: `RefreshTokenStorage`, `PublicClient`,
`TokenRefreshService`, `DialogService`, `ShellService`. Los cubre indirectamente
la cobertura de `core/` (87 %), pero `TokenRefreshService` merece una propia: su
garantía de *una sola petición en vuelo* es exactamente lo que una prueba puede
fijar y un refactor puede romper.

## Prácticas destacables

### Las pruebas leen el CSS del disco

Doce archivos importan `node:fs` para comparar `src/styles.css` con las
declaraciones de TypeScript. Es lo que convierte
[las tres duplicaciones necesarias](../design-system/tokens.md#las-tres-duplicaciones-necesarias)
en duplicaciones **gobernadas**.

### Las pruebas fijan intenciones, no implementación

```ts
it('lleva rel="noopener noreferrer": la pestaña nueva no hereda la sesión', () => {
  expect(ancla().getAttribute('rel')).toBe('noopener noreferrer');
});
```

El nombre dice **por qué** importa, no qué hace el código.

### `test-setup.ts` falla ruidosamente

Comprueba que el entorno exponga `atob` y `TextDecoder`, *«porque el síntoma sería
un puñado de pruebas fallando por "token ilegible" y nadie miraría el entorno»*.

## Las cinco capas que faltan

| Capa | Severidad | Qué costaría |
|---|---|---|
| **E2E** | `HIGH` | Playwright (journeys y visual) + Selenium (funcional, responsive y accesibilidad) |
| **Contrato de API** | `HIGH` | Acceso al OpenAPI del backend |
| **Accesibilidad automatizada** | `MEDIUM` | `axe-core` en las pruebas de componente |
| **Regresión visual** | `MEDIUM` | Herramienta de captura + baseline |
| Rendimiento | `MEDIUM` | Lighthouse — **sin instalar nada, con `npx`** |

Ver cada una en su página.

### El argumento de la E2E, concretamente

Seis flujos fueron verificados **a mano** contra la API viva
(`ESTADO-FRONTEND.md` §«El recorrido que se verificó en un navegador real»).
Funcionaron. **Y nada garantiza que sigan funcionando.**

Los que más la necesitan:

| Journey | Por qué |
|---|---|
| Login → panel | Atraviesa guard, interceptor, store y persistencia |
| Recarga con sesión | `restoreSession` en el arranque: **nada lo prueba de punta a punta** |
| Login con varias organizaciones | Tres componentes y dos navegaciones |
| Recuperación completa | Cruza el correo: **imposible de cubrir con pruebas unitarias** |

## Recomendaciones, en orden

1. **Probar `Dashboard` y `ShellLayout`.** No requiere ninguna herramienta nueva
   y cubre la única pantalla autenticada.
2. **Probar `TokenRefreshService`.** Su garantía es exactamente lo que una prueba
   fija.
3. **Lighthouse con `npx`.** Sin instalar nada.
4. **E2E de los cuatro journeys críticos.** Añade una dependencia grande.
5. **`axe-core` en las pruebas de componente.**
6. **Regresión visual**, la más cara de mantener.

Ninguna se ejecuta en este trabajo documental: las seis son cambios de producto o
de herramientas. La 1 y la 2 son las de mejor relación valor/riesgo.

Ver [la matriz de trazabilidad](../governance/traceability-matrix.md).
