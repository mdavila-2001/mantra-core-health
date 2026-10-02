# «Horarios de otros servicios» — médico y paciente — 2026-10-02

Rama `justin/horarios-otros-servicios`, base `mockup`. Solo front: la maqueta
en memoria sirve todo. La API ya expone `bookingMode` por franja y
`GET /scheduling/service-availability`, y no se tocaron ni el modelo ni la API.

## Por qué el propietario no lo veía

Se lo pidió varias veces, y lo que se entregó fue otra cosa:

- **C-12 (20/09)** agregó un botón «Programar horario» en «Mis servicios» que
  bloqueaba la agenda con la razón «Otros servicios». **Se retiró** en
  `798d6623`.
- **v4.2.40 (`163abfc7`)** puso la columna **«Atiendo: Consultas / Servicios /
  Ambos»** en cada franja de «Cambiar mi horario». El dato existe, pero ninguna
  pantalla lo mostraba como horario:
  - la grilla de «Mis horarios» no decía qué atiende cada franja;
  - «Mis horarios» dibuja **una sola plantilla**. Las tardes de estudios de la
    médica de demostración son una segunda plantilla de la misma sede, así que
    **no aparecían en ninguna pantalla**;
  - el paciente sólo veía esos horarios entrando a «Agendar una cita» y eligiendo
    el servicio en una lista. En la ficha del médico no había nada.

## Qué cambió

- **Médico, `/schedule`.** Hay una pestaña nueva, **«Horarios de otros
  servicios»**, al lado de «Mis horarios» (`?vista=servicios`).
  - Muestra por sede la grilla semanal con las franjas `Servicios` y `Ambos`,
    juntando todas las plantillas vigentes.
  - Debajo lista los servicios que se reservan ahí, con duración y precio.
  - Tiene el botón «Cambiar mi horario». Sin franjas de servicios, explica dónde
    se marcan y lleva ahí.
- **«Mis horarios»** ya no muestra las franjas que son sólo de servicios. Las
  «Ambos» siguen, porque también reparten turnos.
- **La grilla** dice qué atiende cada franja, en el bloque, en su rótulo
  accesible y en el globo («Atiende: Otros servicios»). Se distingue por forma
  (borde punteado) y color (menta), no sólo por color. Una franja de servicios no
  cuenta «turnos», porque no los reparte.
- **Paciente, ficha del médico `/directory/:id`.** «Sedes y horarios» tiene dos
  pestañas, **«Consultas»** (lo de siempre) y **«Otros servicios»** (nueva).
  - En la nueva se elige el servicio y se ven, por sede y semana, los inicios
    disponibles.
  - Cada inicio lleva directo a confirmar la reserva, con el mismo contrato que
    usa «Agendar una cita» para un servicio (`recurso`, `desde`, `hasta`,
    `oferta`).

## Fuera de alcance

- No hay entrada nueva en el menú lateral. La lista del médico está fijada por
  prueba y la pestaña vive dentro de «Consultas médicas».
- La prueba vieja de C-12 en `dictamen-h6-recorrido-2.spec.ts` queda en
  `test.skip`, con el motivo escrito. Sus `data-testid` ya no existen desde
  `798d6623`.
- **Defecto aparte, preexistente:** a 375 px la barra superior
  (`.app-header__derecha`) desborda en todas las pantallas. Se midió 513 px en
  «Mis horarios» y «Mis servicios» y 465 px en el panel. No lo causa este cambio.
  Quedó registrado como tarea propia, y la prueba de este cambio mide el área de
  contenido.

## Evidencia

Ver la sección «Resultados» al final y la carpeta `evidencia/`.

## Resultados

| Comprobación | Resultado |
|---|---|
| `yarn typecheck` | exit 0 |
| eslint sobre los archivos tocados | sin errores (el lint global ya tenía 276 errores en otros archivos) |
| Specs unitarias de agenda, grilla, «Mis horarios» y pestaña nueva | 180 + 45 en verde |
| Specs de ficha, disponibilidad, reserva y pestaña del paciente | 140 en verde |
| Navegador, médica (maqueta, Chrome, 1 worker) | pestaña visible, grilla sólo con franjas `SERVICES`/`MIXED`, servicios listados, enlace a «Cambiar mi horario» |

**No verificado** (se cortó la sesión porque la RAM de la Mac se llenó):

- `yarn build`: no terminó.
- La prueba de navegador completa: el caso del médico falló en la medición de
  desborde por la barra superior preexistente. Se corrigió la medición, pero la
  prueba no se volvió a correr.
- El caso del paciente en navegador no llegó a correr.
- Las capturas en 375/768/1440 claro y 1440 oscuro no se generaron.
