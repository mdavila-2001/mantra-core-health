# Capas del frontend (C4 · nivel 3)

Qué va en cada carpeta, qué no, y cómo se comprueba.

---

## `core/` — infraestructura sin interfaz

13 servicios, 1 guard, 1 interceptor, 0 componentes de producto. **Nada de acá
pinta nada** (salvo la excepción de `dev/`, abajo).

| Subcarpeta | Contenido | Nodo clave |
|---|---|---|
| `auth/` | `SessionStore`, `AuthService`, `RefreshTokenStorage`, `authGuard`, lectura del JWT | `session.store.ts` (8 importadores) |
| `data-access/` | 6 clientes de API + sus tipos de vista + el token `API_BASE_URL` | `api.ts` |
| `http/` | `authInterceptor`, `TokenRefreshService`, `readApiError`, `errorToViewState` | `error-to-view-state.ts` |
| `layout/` | `Breakpoints` — mide la ventana para decidir el modo del nav | — |
| `tokens/` | `ThemeService`, catálogo tipado de tokens, escala de breakpoints | `design-tokens.types.ts` |
| `view-state/` | Los 9 estados del M34: tipos, constructores, guardas | `view-state.types.ts` (14 importadores) |
| `dev/` | Panel de disparo de avisos, para desarrollo | — |

### La regla de `data-access/`

Los clientes devuelven **tipos de la vista, no DTOs**. La diferencia es
concreta: que la API mande una fecha como texto ISO es asunto del transporte.

```ts
// iam.types.ts
export interface Session {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly expiresAt: Date;      // ← Date, no string
}
```

Y los cuerpos se arman campo por campo, nunca reenviando el objeto de la vista,
porque el backend valida con `forbidNonWhitelisted` y un campo de más devuelve
400.

## `shared/` — interfaz reutilizable

48 componentes en tres niveles de atomic design, más el contrato de formularios.

| Nivel | Qué es | Cantidad |
|---|---|---:|
| `atoms/` | Un control, sin dominio. Botón, entrada, insignia, esqueleto | 15 |
| `molecules/` | Composición de átomos con un comportamiento propio. Campo de formulario, diálogo, pestañas | 19 |
| `organisms/` | Estructura de pantalla o control complejo. Armazón, tabla de datos, encabezado | 14 |
| `forms/` | El contrato de accesibilidad campo ↔ control | — |
| `index.ts` | La API pública | — |

### La regla inviolable

> *«`shared/` NUNCA importa de `features/`. Si algo en shared necesita saber de
> un dominio, es que no pertenece a shared.»* — `src/app/shared/index.ts`

Se cumple: **0 aristas de `shared/` a `features/`**.

### El nivel se deduce de la carpeta, no se declara

No hay un decorador ni un campo que diga «esto es una molécula». La ubicación
**es** la declaración, y por eso mover una carpeta es reclasificar. El inventario
generado lee el nivel de la ruta.

## `features/` — pantallas

11 componentes, agrupados por dominio:

| Carpeta | Pantallas | Rutas |
|---|---|---|
| `auth/` | Login, registro, selección de organización, verificar correo, recuperar y fijar contraseña | 6 |
| `dashboard/` | El panel | 1 |
| `shell-layout/` | El armazón con sesión (no es pantalla: es el layout padre) | — |
| `design-system-sample/` | La vitrina + dos galerías internas | 1 (diferida) |

Un feature puede importar de `shared/` y de `core/`. **No puede importar de otro
feature** — hoy no lo hace ninguno.

## La única excepción medida

`core/dev/` importa de `shared/`, que va contra la dirección de las capas:

```text
core/dev/toast-dev-panel/toast-dev-panel.ts → shared/…/button
core/dev/toast-dev-panel/toast-dev-panel.ts → shared/…/toast.service
core/dev/toast-dev-panel/toast-dev-panel.ts → shared/…/toast.types
core/dev/toast-samples.ts                   → shared/…/toast.types
```

Son **4 aristas sobre 587**, todas en `core/dev/`, que es una herramienta de
desarrollo. `app.html` documenta que se desmontó del árbol:

> *«El disparador de avisos flotante se quitó de acá: aparecía encima de TODAS
> las pantallas en desarrollo, incluida una demostración.»*

Se carga de forma diferida (`toast-dev-panel`, 2,98 kB) y **no está montado en
ninguna pantalla**, así que no entra al paquete inicial.

`scripts/check-architecture.mjs` la trata como excepción declarada: si aparece
una violación fuera de `core/dev/`, falla.

## Qué NO existe como capa

| Capa habitual | Estado |
|---|---|
| `store/` o `state/` | No existe. El estado vive en servicios de `core/` y en señales locales |
| `models/` o `entities/` global | No existe. Cada cliente declara sus tipos junto a él (`*.types.ts`) |
| `utils/` cajón de sastre | **No existe, y es una virtud.** No hay una carpeta donde las cosas van a morir |
| `constants/` | No existe. Cada constante vive junto a lo que la usa (`LOGIN_ROUTE` en el interceptor, `TENANT_SELECTION_ROUTE` en el guard) |
| `interceptors/` aparte | Vive en `core/http/`, con el resto de lo que es HTTP |
| `pipes/` y `directives/` | No hay ninguno propio |

## Cómo se verifica

```bash
node scripts/check-architecture.mjs
```

Comprueba tres cosas sobre el grafo real:

1. Ninguna dependencia circular.
2. Ninguna arista que vaya contra la dirección de las capas, salvo las cuatro
   declaradas de `core/dev/`.
3. Ningún `this.http` fuera de `core/data-access/` — que es lo que mantiene la
   superficie de red en un solo lugar.

Está en el [pipeline documental](../governance/change-management.md#pipeline).
