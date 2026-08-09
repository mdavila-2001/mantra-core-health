# Pruebas de integración

No hay una capa separada: **las pruebas de las seis pantallas de `auth/` son
pruebas de integración de feature**, y así conviene leerlas.

---

## Qué integran

Cada prueba de pantalla monta el componente con sus dependencias reales de
`core/` y sustituye **solo** el transporte:

```text
Pantalla (feature)
  ↓  real
AuthService / IamClient
  ↓  real
errorToViewState → ViewState
  ↓  sustituido
HttpTestingController
```

Eso significa que una prueba de `Login` verifica de verdad:

- Que la arroba decide entre correo y documento.
- Que el cuerpo lleva **un solo identificador**.
- Que un `UNAUTHENTICATED` se traduce al mensaje propio del login y no al
  genérico.
- Que la navegación posterior depende de `needsTenantSelection()`.

**Cuatro capas en una prueba.** Es integración, aunque el archivo se llame
`login.spec.ts`.

## Lo que sí está integrado

| Flujo | Dónde |
|---|---|
| Formulario → cliente → cuerpo del contrato | Las 5 pantallas que envían |
| Error de la API → `errorToViewState` → estado → interfaz | Ídem |
| Interceptor → refresco → reintento | `auth.interceptor.spec.ts` |
| Guard → sesión → redirección | `auth.guard.spec.ts` |
| Sesión → almacenamiento → recuperación | `auth.service.spec.ts` |

## Lo que NO está integrado

| Flujo | Por qué falta |
|---|---|
| **Login → panel completo** | `Dashboard` y `ShellLayout` no tienen prueba |
| **Recarga con sesión** | `restoreSession` en el arranque real, con el router evaluando el guard después |
| **Login → elegir organización → panel** | Tres componentes y dos navegaciones |
| **Cambio de organización** | `ShellLayout.changeTenant` sin prueba |
| Cualquier cosa con navegación real del router | Se sustituye el `Router` |

### El más grave: la recuperación de sesión

```ts
provideAppInitializer(() => inject(AuthService).restoreSession())
```

Es la pieza que hace que **la sesión sobreviva a una recarga**, y que evita un
parpadeo al login. Su lógica está probada en `auth.service.spec.ts`, pero
**la integración con el ciclo de arranque y el guard no lo está**.

Un cambio en el orden de los `provideAppInitializer` rompería el comportamiento
sin que ninguna prueba se entere.

## La frontera con E2E

| Pregunta | Herramienta |
|---|---|
| ¿El cuerpo de la petición es el correcto? | Integración (ya cubierto) |
| ¿El error se traduce al estado correcto? | Integración (ya cubierto) |
| ¿El guard redirige? | Integración (ya cubierto) |
| **¿La sesión sobrevive a `F5`?** | **E2E** |
| **¿La trampa de foco del diálogo funciona?** | **E2E** |
| **¿El nav pasa a cajón bajo 780 px?** | **E2E** |
| **¿El correo de recuperación lleva a una pantalla que funciona?** | **E2E** |

Las cuatro de abajo **no se pueden cubrir con jsdom**, y no por falta de esfuerzo:
jsdom no tiene layout, ni `<dialog>` completo, ni recarga.

## Propuesta

Sin herramientas nuevas, dos pruebas de integración cerrarían lo más grave:

1. **`Dashboard`** — montar con `HttpTestingController` y verificar las tres
   ramas de `toState`: vacío, atrasado, fresco. Fija dos reglas de producto que
   hoy nada protege.
2. **`ShellLayout`** — verificar que `user`, `tenants` y `sections` derivan de la
   sesión, y que `changeTenant` navega al panel.

Las dos son pruebas de componente en forma, y de integración en alcance. **No
requieren instalar nada.**

Ver [la estrategia](strategy.md#recomendaciones-en-orden).
