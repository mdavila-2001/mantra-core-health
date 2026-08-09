# `/error` y `**` — Recuperación y página no encontrada

Dos pantallas que existen para que un fallo deje de ser silencioso.

- `src/app/features/error-recovery/` · `ErrorRecovery`
- `src/app/features/not-found/` · `NotFound`

---

## `/error` — Pantalla de recuperación

### Propósito

Lo que se ve cuando algo se rompió y **no hubo petición que culpar**.

Es la contraparte del estado **S9** para los fallos que no son de red: un error
de render no produce `requestId` porque nunca hubo petición, y hasta esta
versión dejaba la pantalla en blanco sin nada que reportar.

### Cuándo se llega

| Camino | Cuándo |
|---|---|
| `loadComponent` fallido | El fragmento diferido no bajó — el caso más probable en producción |
| Navegación directa a `/error` | Manual |

```ts
loadComponent: () =>
  import('./features/design-system-sample/design-system-sample')
    .then((m) => m.DesignSystemSample)
    .catch(() => chunkFallido()),
```

**El chunk fallido es seguro, no hipotético:** `outputHashing: "all"` renombra
todo en cada build, así que quien tenga una pestaña abierta durante un
despliegue pide un archivo que ya no existe.

### Qué muestra

| Elemento | Por qué |
|---|---|
| **Código de soporte** (`E-<commit>-<n>`) | Lo genera `ErrorReporter`. Es el equivalente al `requestId` de S9 |
| **Versión del artefacto** (`0.1.0 · ced38e8`) | Un código sin versión no dice contra qué código comparar |
| Botón **Recargar** | Resuelve el chunk fallido: baja el `index.html` nuevo |
| Botón **Copiar código** | Con degradación: si el navegador no deja, el código sigue visible y seleccionable |

`role="alert"` en el contenedor: reemplaza al contenido que la persona esperaba,
así que su aparición **es** la noticia.

### Notas

- **Recargar, no navegar.** Una navegación del router no alcanzaría: el problema
  está en el paquete ya cargado.
- No lleva `title` propio con la palabra «error»: quien quizá solo necesita
  recargar no debería ver «Error» en la pestaña.

---

## `**` — Página no encontrada

### Propósito

Decirle a quien escribió mal una dirección que se equivocó.

> Antes el comodín **redirigía a `/`**, que mandaba al panel —o al login, vía el
> guard— **sin decir nada**. Para quien navega con lector de pantalla, un
> destino inesperado y silencioso es especialmente desorientador.

### Qué muestra

`app-empty-state` con el mismo texto que el estado **S6** del M34, y por el
mismo motivo: **no dice si el recurso existe**.

Una URL desconocida y una que existe pero no se puede ver tienen que verse
igual. Si el 404 dijera «esta página no existe» y una ruta protegida dijera otra
cosa, la diferencia sería una forma de averiguar qué rutas hay.

`role="alert"`: la persona esperaba contenido y llegó acá.

### Accesibilidad

| Aspecto | Estado |
|---|---|
| Se anuncia | `role="alert"` en el contenedor |
| Salida disponible | Enlace «Ir al inicio» |
| Es un enlace, no un botón | Navega a otra ruta: tiene que poder abrirse en pestaña nueva |
| No filtra existencia | Texto fijo, igual que S6 |

---

## Lo que estas dos pantallas **no** resuelven

| Ausencia | Estado |
|---|---|
| Captura remota de errores | **No existe** — `ErrorReporter` escribe en consola y expone el último fallo |
| Frontera de fallo real alrededor del `router-outlet` | Angular no la ofrece; el `catch` de `loadComponent` cubre el caso más probable |
| Recuperación de un fallo en el **constructor** de un componente de ruta directa | El `ErrorHandler` lo registra y le da código, pero la pantalla queda en blanco |

La primera es la que convierte «la persona ve un código» en «el equipo se
entera». Ver [reporte de errores](../observability/error-reporting.md).
