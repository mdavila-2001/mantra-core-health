# Runbook 9 · Error de hidratación

**Síntoma.** La consola muestra `NG0500` / `NG0501`, o la pantalla parpadea y se
repinta al cargar. Puede aparecer contenido duplicado.

**Impacto.** Medio: la aplicación funciona, pero mal. Peor en las cuatro rutas
prerenderizadas.
**Severidad.** S2.

---

## Por qué este proyecto es sensible

Cuatro rutas se prerenderizan y **su HTML se genera en el build**:

```text
/auth  /auth/registro  /auth/recuperar  /design-system
```

Angular compara ese HTML con lo que el cliente produce. **Si no coinciden,
descarta el DOM del servidor y repinta.**

## Las cuatro causas posibles, y cómo las evita el código

### 1 · Ids no deterministas

```ts
let sequence = 0;
export function nextControlId(prefix: string): string {
  sequence += 1;
  return `mch-${prefix}-${sequence}`;
}
```

> *«Server y cliente arrancan en 0 y avanzan en el mismo orden, así que los ids
> coinciden y la hidratación no rompe.»*

**Un `Math.random()` o un `crypto.randomUUID()` en un id rompería la
hidratación.** Es la causa número uno y está resuelta.

### 2 · API del navegador durante el render

`localStorage`, `window`, `matchMedia` **no existen en Node**. El proyecto lo
maneja en tres lugares:

| Clase | Cómo |
|---|---|
| `RefreshTokenStorage` | `isPlatformBrowser` + `try/catch` |
| `ThemeService` | `isPlatformBrowser` en el constructor |
| `Breakpoints` | `afterNextRender` |

### 3 · Árbol distinto entre servidor y cliente

**El caso vivo del proyecto:**

```ts
private readonly narrow = signal(false);   // false = escritorio, bajo SSR
constructor() {
  afterNextRender(() => this.observe(), { injector: this.injector });
}
```

En un teléfono, el nav pasa de columna a cajón **después** del primer render.
Es un cambio de layout **deliberado**:

> *«Al revés sería peor: el HTML del servidor traería el botón de hamburguesa y
> desaparecería al hidratar en cualquier pantalla grande.»*

**Un elemento que llega es mejor que uno que se va**, y ésa es la elección.

### 4 · Fechas y aleatoriedad

Una fecha formateada en el servidor y otra en el cliente difieren por zona
horaria o por el paso del tiempo. `ViewStateHost` muestra `asOf` con `DatePipe`,
pero **solo en S7**, y S7 nunca se prerenderiza (requiere datos).

## Diagnóstico

### 1 · Leer el código de error

| Código | Significa |
|---|---|
| `NG0500` | El nodo del servidor no coincide con el esperado |
| `NG0501` | Falta un nodo que el servidor había emitido |
| `NG0502` | Nodo inesperado |

El mensaje **indica el componente**.

### 2 · ¿Qué ruta?

| Ruta | Nota |
|---|---|
| Una de las 4 prerenderizadas | El HTML es del **build**: puede estar desfasado del código desplegado |
| `/panel`, `/` | Cliente: hidrata sobre el cascarón |

**Si es prerenderizada, la primera sospecha es un despliegue parcial**: se
desplegó JavaScript nuevo con HTML viejo.

### 3 · Comparar los dos árboles

```bash
curl -s https://<dominio>/auth > servidor.html
# y en el navegador, tras cargar: copiar el DOM desde el inspector
```

Buscar diferencias en ids, atributos y elementos presentes/ausentes.

### 4 · Reproducir en local

```bash
yarn build && yarn serve:ssr:mantra-core-health
```

**El dev-server no reproduce esto igual**: hace falta el artefacto de
producción.

### 5 · Es el tema

Si el síntoma es «parpadea de claro a oscuro», **no es hidratación**: es el
script anti-parpadeo. Comprobar que la clave siga siendo la misma en los dos
lados:

```text
src/index.html                        'mantra-core-health.theme'
core/tokens/theme.service.ts          THEME_STORAGE_KEY
```

## Evidencia

- [ ] Código `NG0xxx` completo y el componente que nombra
- [ ] Ruta
- [ ] HTML del servidor (`curl`)
- [ ] ¿Reproducible en local con el mismo commit?
- [ ] ¿El despliegue fue completo (browser + server)?

## Mitigación

| Causa | Acción |
|---|---|
| Despliegue parcial | **Redesplegar el artefacto completo** |
| Código no determinista | Revertir y corregir |
| API del navegador en el render | Revertir y mover a `afterNextRender` |
| Cambio de layout conocido (`Breakpoints`) | **No es un error**: es la decisión documentada |

## Escalamiento

Frontend.

## Prevención

1. **Ids deterministas, siempre.** Nunca `Math.random()` ni `randomUUID()` en un
   id.
2. **`afterNextRender` para todo lo que toque el navegador.**
3. **Desplegar el artefacto entero**: browser y server juntos.
4. **Probar el build de producción antes de desplegar** — el dev-server no
   reproduce estos fallos.
5. **Telemetría**: hoy un error de hidratación es invisible salvo que alguien
   mire su consola.
