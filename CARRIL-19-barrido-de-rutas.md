# Carril 19 — barrido de rutas y basura

> Entregable de `lanes/19_DEAD_TABS_GARBAGE_RECOVERY.md`.
> La matriz de rutas se **genera**: [`ROUTE_HEALTH_MATRIX.md`](ROUTE_HEALTH_MATRIX.md),
> con `yarn pw:rutas`. Este documento es lo que la matriz no puede decir: qué se
> encontró leyendo el código, qué se borró y con qué evidencia.

---

## Lo que hizo el barrido

`playwright/carril-19-route-health.spec.ts` abre **todas las rutas que el router
declara**, con tres sesiones reales y contra la API viva, y clasifica cada
apertura. La lista de rutas no está escrita en la suite: sale de
`docs/reports/generated/rutas.json`, que genera el auditor del carril 01 leyendo
`app.routes.ts`. Una pantalla nueva entra sola al barrido; una lista a mano se
habría quedado vieja y el barrido diría «todo bien» sin haberla mirado.

**405 aperturas** — 93 rutas × 3 roles, más las 126 vistas portadas sin sesión.

| Estado | Aperturas |
|---|---|
| `ok` | 375 |
| `denegada` (el rol no alcanzaba: el guard funcionando) | 30 |
| `no navega`, `vacía`, `error de consola`, `error de API` | **0** |

Los 30 `denegada` son el resultado del carril 02 visto desde afuera, y los 0 `no
navega` son su comprobación más fuerte: **no hay una sola ruta que el menú
ofrezca y el guard rechace**. Menú, «Tus accesos» y ruta salen del mismo
registro, y el barrido lo confirma con sesiones de verdad.

### El instrumento tuvo que corregirse dos veces antes de creerle

Vale contarlo porque el primer resultado era falso y parecía verdadero:

1. **Seis «errores de consola» que no lo eran.** Chromium escribe en la consola
   *toda* petición que no vuelve 2xx, con el mismo `console.error` que usaría una
   excepción. El barrido ya descartaba el `403` del lado de la red —es el backend
   autorizando, no un defecto— y lo volvía a contar del lado de la consola. La
   matriz marcaba en rojo seis pantallas cuyo único pecado era que la seguridad
   funciona.
2. **Dos «vacías» que cambiaban de rol entre corridas.** `/schedule` y
   `/laboratory-directory` salían vacías en una corrida y bien en la siguiente,
   con roles distintos cada vez. Las secciones encadenan lecturas —la agenda pide
   recursos y después citas— y `networkidle` se cumple en el hueco entre las dos:
   se estaba midiendo el reloj, no la pantalla. Ahora se pregunta por el
   contenido hasta que aparezca o hasta el techo; vacía sigue significando vacía,
   pero deja de significar «todavía no».

Un instrumento que da dos veredictos sobre lo mismo no sirve para decidir nada,
y uno que llora lobo deja de servir para encontrar al lobo.

---

## Lo que se borró, y con qué evidencia

### 1 · `features/redsat/organizaciones/` — 26 archivos, copia muerta

13 componentes idénticos a los de `features/redsat/directorio/`. Sobra de cuando
el segmento se renombró `organizaciones` → `directorio`.

Evidencia de no uso —tres fuentes independientes, no una impresión:

- `redsat.routes.ts` importa **siempre** de `@features/redsat/directorio/…`: 11
  coincidencias, ninguna de `organizaciones/`;
- `vistas.manifest.json` no declara ni una vista con esa importación;
- `grep -rn "redsat/organizaciones" src/` sobre `.ts`, `.html` y `.json`: cero.

Después de borrar: `tsc` limpio, 2 399 pruebas en verde, `check-architecture` sin
ciclos ni imports colgados.

### 2 · El buscador del encabezado, que no buscaba

`shell-layout.html` tenía un campo «Buscá en toda la organización» **sin un solo
manejador**: ni `(input)`, ni `(keydown.enter)`, ni formulario. Se escribía, se
apretaba Enter y no pasaba nada.

Peor: el tutorial del armazón lo señalaba con un paso propio —«desde acá llegás a
personas y registros sin pasar por el menú»—, o sea que el producto **explicaba**
una funcionalidad que no existía.

Se retiran los dos juntos: el control y su paso. El buscador global vive maquetado
en `features/redsat/`, que es donde vive el diseño; cuando se construya, vuelve
con su manejador y con su paso.

---

## Lo que se arregló en vez de borrarse

### 3 · El cuadre de contabilidad no se anunciaba

`accounting.html` marcaba el bloque del cuadre con `appAnnounceOnAppear` — el
nombre de la **clase**, no el del atributo. El selector real de la directiva es
`appAnuncio`, así que no aplicaba: el cuadre aparecía sin anunciarse y quien usa
lector de pantalla no se enteraba de si la contabilidad cuadra, que es lo primero
que hay que saber para leer todo lo de abajo.

El compilador lo venía diciendo con un `NG8113` en cada build. Corregido a
`appAnuncio [asertivo]="false" [enfocar]="false"`: llega cuando termina una
lectura, no como respuesta a una acción, y robar el foco ahí sería perder el
lugar en la página.

### 4 · Los objetivos de tutorial del panel no existían

`TutorialTarget` estaba importado en `dashboard.ts` y **ausente de `imports`**,
así que `appTutorialTarget` se renderizaba como un atributo cualquiera: el
tutorial del panel no encontraba ni el título ni la rejilla de accesos y se
salteaba esos pasos en silencio. Se corrigió dentro del carril 02, que es donde
se reescribió esa plantilla. Con eso `yarn lint` vuelve a pasar — venía fallando
por este import desde antes de estos carriles.

---

## Lo que se deja, y por qué

| Qué | Dónde | Por qué no se toca |
|---|---|---|
| `DIAGNOSTICS_ROUTE`, exportada y sin consumidores | `features/diagnostics/diagnostics.routes.ts` | Está muerta, pero **no engaña a nadie**: es una constante inerte que sigue el patrón de las otras cuatro secciones, y borrarla se lleva la intención documentada. El carril persigue lo que aparenta funcionar, no lo que sobra 15 líneas. |
| `TODO(IT3)`: tipos de organización desde el DTO | `admin/organizations/organization-new.html:67` | Los valores son los reales del contrato, declarados como pendientes de `dynamic-enums`. Es deuda anotada, no un mock. Dominio de organizaciones. |
| Las 126 maquetas de `features/redsat/` | `features/redsat/` | Son el entregable del diseñador (corrección #8) y ya declaran que lo son, desde el carril 01. Cablearlas es trabajo de los carriles de dominio. |
| Las 6 pantallas `presentacional` | M29, M40, M27, M44, M13 | No listan porque su backend **es sólo de comando, sin `GET` de colección**. Está documentado sección por sección en `navigation.map.ts`. No son pantallas rotas. |
| `accounting.ts` sin pruebas unitarias | `features/accounting/` | Hueco real de cobertura, pero escribir su suite es trabajo de su dominio, no de un barrido. |

---

## Gaps que el barrido deja abiertos

1. **Las pantallas hijas de operación no tienen guard de rol.** El carril 02 puso
   `seccionRolesGuard` en las rutas de sección y en la ficha de la Guía, pero no
   por prefijo sobre todo el árbol: hay hijas cuyo rol legítimo **no** es el de su
   sección —`administration/patients` es `SECURITY_ADMIN` en el menú, y su alta
   asistida la usa también un `CLINICIAN` que llega por su propio flujo—, y
   cerrarlas por prefijo rompería flujos que nadie pidió tocar. Hoy un paciente
   que escriba `/administration/geolocation/trips/new` llega a un formulario que
   el backend le va a rechazar. **No hay fuga de datos** —la API responde 403—
   pero la pantalla no debería ofrecerse. Resolverlo pide declarar roles por
   pantalla hija, que es un cambio de contrato del registro.
2. **Las 138 rutas de `features/redsat/` siguen sin `authGuard`.** Es el hallazgo
   H-1 del carril 01. Se marcaron como referencia de diseño, que era lo que el
   carril 01 pedía; ponerles guard es una decisión de producto —hoy sirven para
   mostrar el diseño sin sesión— que no me corresponde tomar acá.
3. **Rutas con parámetro sin medir.** Las 9 rutas `:id` se saltean: abrirlas con
   un identificador inventado mide cómo responde la pantalla ante un 404 del
   backend, que es una prueba legítima pero distinta de «la ruta existe y pinta».

---

## Cómo se reproduce

```bash
yarn audit:vistas    # regenera el catálogo de rutas desde el router
yarn pw:rutas        # barre todas las rutas y reescribe ROUTE_HEALTH_MATRIX.md
```

Necesita la API en `localhost:3005` y el front en `localhost:4200`.
