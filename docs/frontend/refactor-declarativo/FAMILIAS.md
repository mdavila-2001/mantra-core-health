# Matriz de familias

Repetición semántica investigada sobre el corte `5a0776c66b005ad4d2d6722321e933cd7adea621`
(`origin/mockup`, 2026-09-21). Cada familia lleva su ficha de decisión: miembros, invariantes,
diferencias, pieza canónica, contraejemplo, consumidores y estado. Los porcentajes de similitud
no existen a propósito: lo que decide es la regla repetida y la adopción real.

**Estados:** detectada · analizada · decisión tomada · extracción en curso · consumidores migrados ·
verificada · retirada · descartada.

| # | Familia | Miembros (producto) | Decisión | Estado |
|---|---|---|---|---|
| F-01 | Cursor hacia adelante con memoria | 4 | Extraer `historialDeCursor`; migrar los 4 | **verificada** |
| F-02 | Búsqueda que vive en la URL (`?q=`) | 4 | `FilterBar` es la canónica; adopción diferida | analizada · decisión tomada |
| F-03 | Modal con contenido proyectado | 25 | `ContentDialog` ya es la única; nada que fusionar | verificada (ya adoptada) |
| F-04 | Tabla escrita a mano en producto | 10 | No son listados: calendarios, mapas de calor, sub-tablas de detalle | descartada |
| F-05 | Celda «sin dato» con nombre accesible | 3 | Demasiado pequeña; queda como convención | descartada |
| F-06 | Tablas de la maqueta portada | 70 | Referencia de diseño, no se migran (ADR-0014) | descartada |

---

## F-01 · Cursor hacia adelante con memoria — **verificada**

**Miembros y ubicación (antes):**

| Consumidor | Estado duplicado | Centinela | Reinicio al filtrar |
|---|---|---|---|
| `features/admin/patients/patient-list/patient-list.ts` | `historia`, `cursorSiguiente`, `cursor` | `VOLVER` | sí |
| `features/admin/organizations/organization-list/organization-list.ts` | ídem | `VOLVER` | sí |
| `features/admin/services-catalog/services-catalog.ts` | ídem | `VOLVER` | sí (filtro y práctica) |
| `features/insurance/insurance-claims/insurance-claims.ts` | `history`, `nextCursor`, `cursor` | `BACK` | sí |

Las cuatro escribían la misma regla con los mismos tres `signal`, el mismo `computed` y el mismo
comentario explicándola: «el contrato solo entrega `nextCursor`; el camino de vuelta lo recuerda la
pantalla».

**Invariantes de comportamiento (las cinco se conservan):**

1. La primera página no ofrece «Anterior»; la petición va sin `cursor`.
2. Avanzar recuerda el cursor opaco; volver reusa el visitado, nunca uno inventado.
3. Un cambio de filtro es otra lista: se vuelve al principio y se olvida el camino.
4. Un fallo apaga «Siguiente» pero no pierde la página: reintentar (S8/S9) repite la misma.
5. Cuándo pedir lo decide el contenedor, no el historial.

**Diferencias visuales:** ninguna. La regla es de estado; la tabla la dibuja `app-data-table` igual
que antes. **Diferencias de dominio:** ninguna en la regla; cada pantalla conserva su cliente, su
tamaño de página y sus dos vacíos.

**Pieza canónica:** nueva, `shared/components/organisms/data-table/cursor-history.ts`
(`historialDeCursor()` + `CURSOR_ANTERIOR`). Vive junto a `CursorState` porque es la otra mitad
de ese contrato: la tabla emite `prevCursor` tal cual, y alguien tiene que saber qué significa.
No puede ir a `core/` sin invertir la dirección de capas (importa un tipo de `shared/`).

**Alternativas descartadas:**

| Alternativa | Por qué no |
|---|---|
| Que `DataTable` lleve el historial adentro | La tabla no pide datos; meterle el historial la obliga a saber cuándo se recarga y rompe «recibe, no averigua» |
| Un servicio inyectable | No hay estado compartido entre pantallas: es por instancia, y un `providedIn: 'root'` lo mezclaría |
| Una clase base para listados | Herencia de componentes; la regla también la usa un anfitrión del catálogo que no es un listado |

**Contraejemplo (lo que NO absorbe):** `features/my-services/my-services.ts` también tiene un
`cursorSiguiente`, pero su paginación es «cargar más» sin vuelta atrás (la lista se acumula).
No hay historial que recordar: forzarle `historialDeCursor` le daría un «Anterior» que no tiene
sentido. `glossary` pagina por índice sobre una lista en memoria: tampoco.

**Qué cambio se hace ahora una sola vez:** si mañana la API publicara `prevCursor` de verdad, se
cambia `mover` en un archivo y las cuatro pantallas vuelven con cursor real en vez de con la
memoria. Antes eran cuatro ediciones idénticas, y `insurance-claims` con otros nombres.

**Consumidores migrados:** los cuatro. **Pruebas:** `cursor-history.spec.ts` (8, la regla
aislada) + los specs de las cuatro pantallas sin tocar (fijan `mover`, `cursor`, reintento y
filtro a través de la interfaz del componente). **Riesgo:** bajo; sin cambio de plantilla ni CSS.
Verificación en navegador: `evidence/refactor-declarativo/veredictos.json`.

## F-02 · Búsqueda que vive en la URL — **analizada · decisión tomada · adopción diferida**

**Miembros:** `patient-list`, `organization-list`, `terminology-catalog`, `services-catalog`.
Los cuatro montan `app-search-field` suelto y escriben a mano `buscar(texto)` →
`router.navigate([], { queryParams: { q }, replaceUrl: true })`, y leen `?q=` con
`toSignal(queryParamMap)`.

**Pieza canónica existente:** `FilterBar`. Su contrato ya dice «la URL es la fuente de verdad:
publica en la URL y ahí termina su trabajo», usa la misma clave `q` (`SEARCH_PARAM`) y el mismo
`replaceUrl` al tipear. La regla no hay que extraerla: ya vive en un solo lugar.

**Por qué la adopción no se hace en esta oleada:** cambia la anatomía visible. Con un término
escrito, `FilterBar` dibuja el renglón de activos con «Limpiar todo» debajo del campo, cosa que
hoy esas cuatro pantallas no muestran; y el buscador pasa de un ancho acotado (`max-inline-size:
28rem`, decidido por el largo de lo que se escribe) al reparto en fila de la barra. Es una
corrección de producto razonable, no una refactorización que conserve la apariencia: se decide
con el propietario, no acá.

**Contraejemplo:** `glossary` ya usa `FilterBar` **y además** lee `?category=` y `?tag=` por su
cuenta: leer la URL sigue siendo del contenedor; lo que `FilterBar` centraliza es escribirla desde
sus controles.

**Pendiente:** decisión de producto sobre «Limpiar todo» y el ancho; después, migrar los cuatro
con sus specs (`buscar publica el texto en la URL…` ya existe en cada uno).

## F-03 · Modal con contenido proyectado — **verificada (ya adoptada)**

Se buscó `<dialog` fuera de `molecules/dialog`, `date-picker` y `tree-select`: los cuatro
resultados en producto (`agenda`, `tarjeta-del-dia`, `patient-chart`, `public-profile-card`) son
comentarios que explican por qué usan `app-content-dialog` o un componente que lo envuelve. No
queda ningún modal de contenido escrito a mano. 24 componentes de producto instancian
`ContentDialog`; 13 proyectan acciones en `[dialog-actions]` (ver `usos-organismos.md`).

**No se fusiona** `ContentDialog` con `molecules/dialog` (confirmación con `boolean`) ni con
`attachment-dialog` (que lo compone): responsabilidades complementarias, como advierte el
encargo.

## F-04 · Tabla escrita a mano en producto — **descartada**

| Archivo | Qué es | Por qué no es `DataTable` |
|---|---|---|
| `account/appointments/appointment-calendar` | Calendario mensual | Rejilla de fechas, sin filas de dominio |
| `agenda/my-agenda/month-view`, `agenda/agenda-create` | Calendario y grilla horaria | Ídem |
| `dashboard/consultas-resumen` | Mapa de calor día × hora | Celdas de intensidad, sin cursor ni columnas de entidad |
| `insurance-analytics/monthly-trend-chart`, `practitioner-profile/activity-chart` | Gráficos | Tablas semánticas para un gráfico |
| `clinical-record/patient-chart/free-note-block/note-grid` | Cuadrícula de nota clínica | Formulario en rejilla |
| `insurance-catalog` (coberturas por plan) | Sub-tabla dentro de cada tarjeta de plan, con acciones de admin | Anidada en un `@for` de planes; no es un listado paginado ni tiene `ViewState` propio |
| `insurance-claim-detail` (ítems facturados) | Sub-tabla de detalle | Lista fija dentro de un detalle ya cargado |

Las dos últimas son las únicas candidatas discutibles. Adoptar `DataTable` les daría plegado en
móvil y estados uniformes, pero cambia la apariencia dentro de una tarjeta y exige envolver una
lista ya cargada en un `ViewState` artificial: se registran como **posible oleada futura**, con
decisión visual previa.

## F-05 · Celda «sin dato» con nombre accesible — **descartada**

`patient-list`, `organization-list` y la rama `pablo/refactor-tabla-canonica` repiten
`<span class="…__vacio" aria-label="Sin X">—</span>`. Es una convención de dos líneas con un
texto que depende del dato; un átomo `app-celda-vacia` con `[motivo]` sería un intermediario que
reenvía un `aria-label`. Queda como convención documentada en `docs/components/tables.md` cuando
haya un tercer consumidor con la misma regla de accesibilidad.

## F-06 · Tablas de la maqueta portada — **descartada**

70 de las 81 `<table>` a mano están en `features/alovida/**`, que el propio producto declara
«referencia de diseño, no la aplicación» y que el generador de portadas borra y regenera.
La decisión y su mecanismo de graduación están en `docs/adr/ADR-0014` (rama
`pablo/refactor-tabla-canonica`, pendiente de integrar). El denominador de adopción son las
pantallas conectadas, no la maqueta.
