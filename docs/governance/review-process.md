# Proceso de revisión

Lo que hay que comprobar antes de fusionar, y qué exige revisión explícita.

---

## La batería mínima

```bash
yarn install --immutable
yarn lint
yarn tsc -p tsconfig.app.json --noEmit
yarn build
yarn test:coverage
node scripts/generate-doc-report.mjs
```

Referencias de la línea base:

| Orden | Resultado esperado |
|---|---|
| `install --immutable` | Sin cambios en el lockfile. Avisos preexistentes conocidos |
| `lint` | Limpio |
| `tsc --noEmit` | Limpio |
| `build` | El aviso de presupuesto conocido, **y ninguno nuevo** |
| `test:coverage` | 804 pruebas, umbrales cumplidos |
| `generate-doc-report` | Las seis verificaciones documentales |

**Cualquier fallo nuevo bloquea.** Un fallo preexistente se registra, no se
esconde.

## Checklist de revisión

### Siempre

- [ ] La batería pasa
- [ ] La cobertura **no baja** — los umbrales suben, nunca bajan
- [ ] Sin `console.log` nuevos
- [ ] Sin `any` ni `$any()` nuevos
- [ ] Sin `@ts-ignore` ni `eslint-disable` sin justificar en el propio código

### Si toca componentes compartidos

- [ ] `generate-inventory.mjs --check` pasa, o el inventario se regeneró
- [ ] **¿Cambió una entrada, una salida o un valor por defecto?** → ver abajo
- [ ] Se exhibe en la vitrina si es nuevo
- [ ] Los estados de teclado y foco se mantienen
- [ ] No depende solo del color

### Si toca `core/data-access/`

- [ ] `check-api-contract-drift.mjs` pasa
- [ ] El cuerpo lleva **exactamente** los campos del contrato
      (`forbidNonWhitelisted` devuelve 400 con uno de más)
- [ ] Los opcionales vacíos **no viajan**
- [ ] Las fechas se convierten a `Date` en el cliente
- [ ] Hay prueba

### Si toca sesión, guard o interceptor

- [ ] **Ninguna rama toca `localStorage` en la ruta de SSR**
- [ ] El refresco sigue siendo **uno solo en vuelo**
- [ ] El reintento **no recursa**
- [ ] El cierre de sesión limpia **pase lo que pase**
- [ ] `X-Tenant-Id` **no se manda** cuando el tenant no está resuelto

### Si toca rutas o renderizado

- [ ] `app.routes.server.ts` coherente con `app.routes.ts`
- [ ] Nada que dependa del navegador en la ruta de render
- [ ] Los ids siguen siendo deterministas
- [ ] `yarn build` sigue diciendo `Prerendered 4 static routes.`

### Si toca tokens o estilos

- [ ] Las pruebas que leen `styles.css` pasan
- [ ] Las tres duplicaciones necesarias siguen a la par
- [ ] **Los dos bloques del modo oscuro dicen lo mismo**
- [ ] Los contrastes se revisaron **a mano** — no hay verificación automática

## Lo que exige revisión explícita

Cinco categorías, y todas por el mismo motivo: **no rompen la compilación**.

| Cambio | Por qué |
|---|---|
| **Valor por defecto de una entrada compartida** | Compila en los 25 sitios que usan el botón y cambia el aspecto de todos |
| **Estilos de un componente compartido** | Sin regresión visual, nadie lo ve |
| **Comportamiento de teclado o foco** | Sin prueba de accesibilidad, nadie lo ve |
| **Orden de los `provideAppInitializer`** | Rompe la recuperación de sesión en silencio |
| **Un token del modo oscuro** | Los dos bloques están duplicados a propósito |

Deben **declararse en la descripción del pull request**. Es la única defensa que
hay contra ellos.

## Los nodos que exigen dos revisores

| Archivo | Importadores |
|---|---:|
| `shared/components/atoms/button/button.ts` | 25 |
| `shared/forms/form-control.context.ts` | 19 |
| `core/view-state/view-state.types.ts` | 14 |
| `core/view-state/view-state.ts` | 12 |
| `core/auth/session.store.ts` | 8 |

Y `core/http/auth.interceptor.ts`, que no está entre los más importados pero
**toca todas las peticiones**.

## Plantilla de pull request

```markdown
## Qué cambia

## Tipo
- [ ] Documental (no altera comportamiento)
- [ ] Instrumentación segura
- [ ] **Cambio de producto** — describir impacto

## Checklist
- [ ] `yarn lint` · `tsc --noEmit` · `yarn build` · `yarn test:coverage`
- [ ] `node scripts/generate-doc-report.mjs`
- [ ] La cobertura no baja
- [ ] Documentación actualizada, si aplica
- [ ] ADR, si es una decisión de arquitectura

## Cambios que no rompen la compilación
- [ ] Valor por defecto de una entrada compartida
- [ ] Estilos de un componente compartido
- [ ] Teclado o foco
- [ ] Orden de arranque
- [ ] Token del modo oscuro
(marcar y explicar los que apliquen)

## Cómo se probó
```

## Trabajo concurrente

`COORDINACION-AGENTES.md` es el mecanismo del proyecto: cada sesión declara qué
archivos crea, cuáles modifica y **cuáles no toca**.

Funciona, y este trabajo documental lo respetó cuando apareció trabajo paralelo
sobre los archivos de entorno. Ver
[la línea base §1.1](../reports/baseline.md#11--trabajo-concurrente-durante-la-medición).

## Lo que no hay

| Elemento | Estado |
|---|---|
| CI que corra la batería | **No existe** |
| `CODEOWNERS` | No existe |
| Revisores obligatorios | No definidos |
| Plantilla de PR en el repositorio | **No existe** — la de arriba es propuesta |
| Reglas de protección de rama | Desconocidas |

**Sin CI, todo lo de esta página depende de que alguien lo haga a mano.** Es la
brecha `HIGH` de [gestión del cambio](change-management.md).
