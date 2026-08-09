# Runbook 2 · Pantalla en blanco

**Síntoma.** El servidor responde 200, el HTML llega, y la pantalla queda en
blanco o a medias. **No hay código de soporte** — porque nunca hubo una petición
fallida.

**Impacto.** Total o parcial, según la ruta.
**Severidad.** S1 si es general, S2 si es una pantalla.

---

## Por qué este runbook es el más incómodo

**No hay frontera de fallo para los errores de render.** `app.config.ts` declara
`provideBrowserGlobalErrorListeners()`, cuyo `ErrorHandler` por defecto **escribe
en la consola** y nada más.

`AppErrorHandler` lo lleva a `/error` con un código de soporte, así que la
persona **tiene qué reportar**. Sin captura remota, sigue haciendo falta que lo
reporte: el equipo no se entera solo. Ver
[error boundaries](../../architecture/error-boundaries.md#nivel-3--lo-que-se-rompe-fuera-de-una-petición).

## Diagnóstico

### 1 · La consola del navegador es la única fuente

Pedir a quien reporta:

```text
F12 → Consola → captura de todo lo que esté en rojo
F12 → Red    → ¿hay algún 404?
```

| Lo que se ve | Causa probable |
|---|---|
| `TypeError: Cannot read properties of null/undefined` | Excepción de render → paso 2 |
| `Failed to fetch dynamically imported module` | **Chunk fallido** → [runbook 3](chunks-desactualizados.md) |
| `NG0500` / `NG0501` (hidratación) | [Runbook 9](error-de-hidratacion.md) |
| `Refused to execute inline script` | Una CSP mal puesta |
| 404 de un `.js` | [Runbook 3](chunks-desactualizados.md) o [7](assets-no-disponibles.md) |
| **Nada** | Ver paso 3 |

### 2 · ¿Qué ruta?

| Ruta | Nota |
|---|---|
| `/auth`, `/auth/registro`, `/auth/recuperar`, `/design-system` | **Prerenderizadas**: el HTML debería verse aunque JavaScript falle. Blanco acá es más grave |
| `/panel`, `/` | Cliente. Blanco puede ser una excepción en `Dashboard` o `ShellLayout` |
| `/auth/verificar`, `/auth/nueva-clave` | Cliente, con token del query string |

**Que una ruta prerenderizada salga en blanco apunta al servidor**, no al
cliente: el HTML se genera en el build.

### 3 · ¿Con sesión o sin ella?

`/panel` y `/` tienen sesión, y ahí concentran la lógica sin prueba:

```ts
// Dashboard — sin .spec.ts
protected readonly tenantName = computed(() => {
  const id = this.activeTenantId();
  return id === null ? null : this.auth.tenantName(id);
});
```

`Dashboard` y `ShellLayout` **no tienen prueba propia** (brecha `HIGH`), así que
son las candidatas más probables a una excepción no cubierta.

Prueba rápida: **cerrar sesión y entrar a `/auth`**. Si el login se ve, el fallo
está en la superficie autenticada.

### 4 · Reproducir en local

```bash
git checkout <sha desplegado>
yarn install --immutable
yarn build && yarn serve:ssr:mantra-core-health
```

Con `sourceMap` activado en desarrollo, la traza es legible. **En producción no
hay mapas de fuente**, y es correcto que no los haya.

## Evidencia

- [ ] Consola completa
- [ ] Pestaña de red, filtrada por 4xx/5xx
- [ ] Ruta exacta
- [ ] ¿Con sesión? ¿Qué organización?
- [ ] Navegador y versión
- [ ] ¿Reproducible en local con el mismo commit?

## Mitigación

| Causa | Acción |
|---|---|
| Regresión de un despliegue | **Revertir** |
| Chunk fallido | [Runbook 3](chunks-desactualizados.md) — recargar suele bastar |
| Solo una ruta, no crítica | Corregir hacia adelante |
| Desconocida | **Revertir** |

**Recargar con caché limpia** (`Ctrl/Cmd+Shift+R`) resuelve el caso de chunk
viejo, que es el más frecuente tras un despliegue.

## Escalamiento

Frontend. **Este síntoma casi nunca es de la API**: un fallo de la API produce
S8 o S9 con su código, no una pantalla en blanco.

## Prevención

De las cuatro piezas de
[error boundaries](../../architecture/error-boundaries.md#lo-que-sigue-faltando),
tres están. Queda la primera, que es la que decide cuánto valen las otras:

1. **Telemetría de errores** — sin ella este fallo sigue dependiendo de que
   alguien lo reporte.
2. ~~**Componente frontera** alrededor del `router-outlet`, con pantalla de
   recuperación.
3. **Manejo del fallo de carga de un fragmento diferido.**
4. **Probar `Dashboard` y `ShellLayout`** — no requiere ninguna herramienta
   nueva.

La 4 es la más barata y cubre las dos pantallas más probables.
