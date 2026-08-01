# ADR-0003: Sin store global ni caché de estado remoto

## Estado

**Aceptado** — documenta el estado observado. **Revisable a corto plazo.**

## Contexto

El proyecto contempla 81 secciones. Hoy hay 8 pantallas y **una sola** hace una
lectura de la API.

## Fuerzas y restricciones

- Las señales de Angular ya dan estado reactivo compartido en servicios
  `providedIn: 'root'`.
- Solo hay **diez dependencias externas**, todas de Angular. Añadir una es una
  decisión, no un trámite.
- El proyecto ya modela la obsolescencia de datos: el estado **S7** exige
  declarar `asOf`.

## Opciones consideradas

| Opción | Descartada porque |
|---|---|
| NgRx / Akita / Elf / NGXS | Ceremonia desproporcionada para el estado actual |
| TanStack Query o equivalente | Ver §Riesgos: es la que va a hacer falta |
| Resolvers de ruta | Mezclaría autorizar con pedir, que es lo que S1 ≠ S2 evita |

## Decisión

**Señales en servicios `providedIn: 'root'` para el estado de aplicación, y una
señal `ViewState<T>` por pantalla para el estado de servidor.**

Sin caché, sin invalidación, sin deduplicación — **con una excepción**:
`TokenRefreshService` garantiza una sola petición de refresco en vuelo.

Y esa excepción existe **porque su ausencia rompía algo concreto**:

> *«tres 401 simultáneos gastarían tres de los 20 intentos por minuto que admite
> la API y las tres rotarían el token unas sobre otras.»*

## Consecuencias positivas

- Cero dependencias añadidas.
- El estado se lee donde se usa; no hay que perseguir una acción por tres
  archivos.
- `SessionStore` tiene **dos señales de escritura y diez derivadas**: el estado
  no se duplica.
- Cada pantalla es independiente: ninguna puede corromper el estado de otra.

## Consecuencias negativas

Honestas, porque hoy no duelen y mañana sí:

| Consecuencia | Hoy | A 81 secciones |
|---|---|---|
| Dos pantallas que pidan lo mismo lo piden dos veces | Nulo | **Alto** |
| Sin invalidación tras una mutación | Nulo | **Alto** |
| Volver a una pantalla la recarga entera | Aceptable | Medio |
| Sin actualización optimista | Nulo | Medio |

## Riesgos

**El riesgo principal es esperar demasiado.** Añadir caché tarde exige tocar
todas las pantallas escritas hasta entonces.

Y añadirla mal, en este dominio, tiene cuatro trampas concretas:

1. **PHI en caché.** Una caché en `IndexedDB` sobrevive al cierre de sesión.
2. **Contexto de organización.** Una caché que no segmente por `X-Tenant-Id`
   sirve datos de la organización anterior.
3. **Cierre de sesión.** Toda caché debe vaciarse.
4. **Dos fuentes de antigüedad.** El proyecto ya tiene S7 con `asOf` del
   servidor; una caché agregaría una segunda, y habría que decidir cuál manda.

La cuarta es la más específica: **este proyecto ya modela la obsolescencia, y una
caché mal integrada mentiría sobre ella.**

## Evidencia

- `package.json`: ninguna dependencia de estado.
- `SessionStore`: dos `signal`, diez `computed`.
- El patrón `signal<ViewState<T>>` repetido en las siete pantallas que piden
  datos.
- `TokenRefreshService`, con su motivo escrito.

## Plan de revisión

**Revisar cuando aparezca el primer caso concreto**: una lista con detalle, o dos
pantallas que compartan un recurso. Ver
[caché](../data-and-state/caching.md#lo-que-hay-que-resolver-antes-de-agregar-caché).
