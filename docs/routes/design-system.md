# `/design-system` — Vitrina del sistema de diseño

`src/app/features/design-system-sample/design-system-sample.ts` ·
`DesignSystemSample` · `app-design-system-sample`

---

## 1 · Propósito

Exhibir los 49 componentes de `shared/` con sus variantes y estados. **Es el
Storybook de este proyecto**: no hay una herramienta de catálogo aparte, hay una
ruta de la propia aplicación.

Incluye dos galerías internas:

| Componente | Qué muestra |
|---|---|
| `OrganismsGallery` | Los organismos, que necesitan más espacio y contexto |
| `ViewStateGallery` | Los nueve estados del M34, uno por uno |

## 2 · Acceso y permisos

| Aspecto | Valor |
|---|---|
| Guard | **Ninguno.** Es pública |
| Sesión | No requiere |
| Render | **Prerender** |
| Carga | **Diferida** (`loadComponent`) |
| Título | «Mantra Core Health - Vitrina de Diseño» |
| Enlace | Menú lateral → «Herramientas › Sistema de diseño» |

### Por qué está diferida

> *«La vitrina expone el sistema de diseño entero y nadie que entre a la
> aplicación real necesita descargarla. Con import directo se llevaba el
> presupuesto inicial por delante.»* — `app.routes.ts`

El fragmento pesa **181,73 kB** crudos (40,29 kB en tránsito). Es el 35 % de lo
que pesa todo el paquete inicial.

## 3 · Flujo

No hay flujo de negocio: es una superficie de exhibición. Cada sección muestra un
grupo de componentes con controles que disparan sus variantes.

## 4 · Estados de interfaz

Los de cada componente exhibido. `ViewStateGallery` recorre los nueve estados del
M34 de forma explícita, que es la mejor documentación viva que tiene el proyecto
sobre cómo se ve cada uno.

## 5 · Contratos de datos

**Ninguna petición.** Todos los datos son literales dentro de los componentes de
la galería. Es lo que la hace prerenderizable y lo que permite verla sin backend.

## 6 · Componentes

Los 49 de `shared/`, más `Radio`, `RadioGroup`, `DatePicker`, `FileInput`,
`AvatarGroup` importados por el alias `@shared/…`.

## 7 · Analítica

**Ninguna.**

## 8 · Accesibilidad

Como es una vitrina, su valor de accesibilidad es **mostrar** cómo se comportan
los componentes con teclado y lector de pantalla. La vitrina en sí no está
auditada como pantalla de producto: no lo es.

## 9 · Pruebas

| Componente | Prueba |
|---|---|
| `DesignSystemSample` | Sí |
| `ViewStateGallery` | Sí |
| `OrganismsGallery` | **No** |

**La vitrina está excluida de la medición de cobertura**, y es deliberado:

```js
// vitest.config.ts
exclude: [ …, 'src/app/features/design-system-sample/**' ]
```

> *«118 funciones que son manejadores de demostración, no lógica de producto.
> Incluirla arrastraba la cobertura de funciones de `features/` de 84,6 % a
> 26,1 % midiendo algo que nadie va a probar.»*

## 10 · Notas operativas

- **Es pública y está prerenderizada.** En un despliegue de producción,
  cualquiera con la URL puede verla. No expone datos —no hace ninguna petición—
  pero sí expone el inventario completo de la interfaz. Si eso no es deseable,
  la decisión de excluirla del build de producción es un cambio de producto;
  registrada como brecha `LOW`.
- **Sustituye a Storybook.** El plan maestro contempla incorporar Storybook si no
  existe. Acá **existe un equivalente que ya funciona**, no añade dependencias y
  no toca el build. La recomendación es no incorporar Storybook: ver
  [ADR-0004](../adr/ADR-0004-sistema-de-diseno-propio.md).
- **Su tamaño es la mayor oportunidad de bundle**, pero ya está diferida: no
  entra al paquete inicial. Ver [presupuestos](../performance/budgets.md).
