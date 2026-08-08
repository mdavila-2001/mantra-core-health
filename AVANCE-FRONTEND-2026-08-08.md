# Avance de frontend · 2026-08-08 — W1 (vistas de Fase 0) y el estado real de los bloqueos

**Autor:** Justin · **Tarea:** W1 del `PLAN-SEMANA-WEB-Y-MOVIL.md` (vistas de Fase 0 de
`V01 iam` · `V02 common` · `V05 profiles`) · **Ramas:** `justin/w1-vistas-fase0-pacientes` (PR #25,
mergeado) y `justin/w1-fusion-pacientes` (PR #27)

> ⚠️ **Diferencia con los avances anteriores, y hay que decirla primero.** Los de agosto se
> verificaron ejecutando contra la API viva en `localhost:3000`. **Éste no.** Docker Desktop estuvo
> apagado toda la sesión y las 1 248 pruebas usan `HttpTestingController`, así que fijan **el
> contrato leído de los DTOs, no el que el servidor responde**. Todo lo que sigue está verificado
> por compilación, pruebas unitarias, guardrails y CI — pero no contra el backend real. Antes de
> mergear el #27 conviene levantar el stack y recorrer las cinco pantallas a mano.

---

## Resumen en seis líneas

1. **V05-01 (Pacientes) y V05-03 (Resumen propio) están completas** — listado, ficha F-01, alta,
   fusión de duplicados y autoservicio. Dos de las 693 vistas, pero cerradas de verdad.
2. **La ficha del vault mentía**: V05-01 figuraba bloqueada y no lo estaba. El ⚠︎ es anterior al
   PR #31. **Esto le importa a todo el reparto de la semana.**
3. **Un botón del sistema de diseño no hacía nada**: el «Reintentar» de S8/S9 dentro de cualquier
   tabla era decorativo. Corregido.
4. **El bloqueo grande no es de vistas: es de datos.** Los campos `*_concept_id` no tienen catálogo
   que ofrecer — hay 737 placeholders `DEFAULT_*` y ningún value set de género, sexo, nacionalidad
   ni idioma. Bloquea casi todos los formularios del sistema **y también a móvil**.
5. **Pablo destrabó el buscador de referencia** (PR #26) y la acción de fusionar se construyó
   encima el mismo día. El circuito «pedido → pieza → uso» funcionó.
6. **Fusionar dos pacientes es irreversible en cuanto cerrás la pantalla.** Hallazgo nuevo.

---

## 1 · Qué quedó construido

| Vista | Fila | Qué incluye | PR |
|---|---|---|---|
| **V05-01 · Pacientes** | 85 | Listado (cursor + búsqueda en la URL) · ficha F-01 · alta · **fusionar duplicados** | #25 y #27 |
| **V05-03 · Resumen propio** | 28 | Autoservicio; enciende la sección `mi-cuenta` | #25 |

Las dos quedaron marcadas `x` en el `🗺️ Orden de trabajo` del vault.

**Números:** 1 248 pruebas en 108 archivos (+114 sobre el punto de partida) · build SSR en verde ·
CI 4/4 en los dos PRs · todos los guardrails salvo `check-doc-links`, que en Windows reporta el
mismo número de rotos que un árbol limpio de `dev` — **ninguno lo agregó este trabajo**. Es el
falso positivo de resolución de rutas ya conocido, y el CI de Linux lo confirmó pasando en el
PR #25. Ojo al comparar: el conteo cambia según la rama, así que la comparación válida es contra
la misma base, no contra un número recordado.

---

## 2 · Tres cosas que le sirven al resto del equipo

### 2.1 · El ⚠︎ del vault no es autoridad sobre si una vista se puede construir

V05-01 figuraba `Tabla ⚠︎ · Listado pendiente` — la deuda que el vault reporta en **674 de las 693
vistas**. No aplicaba: `GET /profiles/patients` y `GET /profiles/patients/:profileId` entraron con
el **PR #31**, y las fichas se escribieron antes.

El plan ya lo advertía, pero conviene decirlo más fuerte porque **cambia el reparto de esta
semana**: antes de dar una vista por bloqueada, comprobalo contra los controllers.

```bash
grep '@Get(' src/modules/<modulo>/controllers/*.controller.ts
```

Cuesta diez segundos y puede desbloquear una vista entera. Ya corregí la ficha de V05.

### 2.2 · Cuidado: el endpoint devuelve menos columnas que la entidad

La ficha de V05-01 derivaba sus columnas de `profiles.patient_profiles` — grupo ABO, factor Rh,
estado de cobertura, idioma clínico. **El listado no devuelve nada de eso.** La fila real es
`profileId` · `personId` · `patientCode` · `displayName` · `birthDate` · `personStatusConceptId` ·
`deceased`, y es angosta a propósito.

**Es probable que pase en otras fichas**, porque todas se derivaron de las entidades. Quien
implemente contra las columnas de la ficha se encuentra con media tabla vacía.

### 2.3 · Defecto corregido en `app-data-table` — afectaba a todos

El organismo delega los 9 estados del M34 en `app-view-state-host`, que está bien, **pero no
escuchaba lo que el host emite**. En S8 (sin conexión) y S9 (error inesperado) la tabla dibujaba un
botón «Reintentar» perfectamente visible que no disparaba absolutamente nada; igual el «Actualizar»
de S7.

Un control visible que no responde es peor que no ofrecerlo: quien lo pulsa concluye que la
aplicación está rota, y tiene razón. Corregido con dos pruebas que **pulsan el botón**, no que
comprueban que el output existe.

---

## 3 · El bloqueo que hay que resolver antes que cualquier otra cosa

### Los campos de catálogo no tienen catálogo

**Para:** Marcelo (seeds y modelo) · **Bloquea:** casi todos los formularios de las 693 vistas,
**y el frente móvil**.

La regla del modelo es taxativa: todo `*_concept_id` es un selector poblado desde terminología,
nunca entrada libre. Faltan las dos cosas que hacen falta.

**1 · No existe el conjunto de valores. Lo que hay es relleno de arranque.**

Contado sobre `seedsGenerales/`:

| | |
|---|---|
| Value sets sembrados | **55** (42 con miembros, 208 miembros) |
| De qué son | `Plan Feature Key`, `Api Key Scope`, `Feedback Status`… — los patches v4.0.2–v4.0.6 |
| De género, sexo, nacionalidad o idioma | **ninguno** |
| `administrative_gender_concept_id` de las personas sembradas | **uno solo**, código `DEFAULT_ADMINISTRATIVE_GENDER` |
| Placeholders `DEFAULT_*` en total | **737** |

Ese concepto se describe a sí mismo como «Configuración de arranque para Terminology; debe
revisarse por tenant y jurisdicción». Es un relleno, no un género. Aunque mañana se publicara el
binding, el selector ofrecería **una sola opción sin significado**.

**Es el mismo defecto que el `CLAUDE.md` ya documenta como bloqueador de móvil:**
`iam.devices.platform_concept_id` apunta a `DEFAULT_PLATFORM` porque no hay conceptos iOS/Android
sembrados. No es del módulo 05 — es el patrón de los 737.

**2 · Y si existiera, el frontend no podría encontrarlo.**

El único `GET` es `…/value-sets/:id/$expand`, que pide el **uuid** del conjunto; no hay búsqueda por
código ni por nombre. Los uuid se derivan con `uuid5` en `gen_seeds_v407.py`, pero reimplementar esa
derivación en TypeScript sería acoplar el front a las tripas del generador: se rompe el día que
alguien toque `VS_OWNER`. Y `…/concepts?q=` busca texto libre sobre los 965 conceptos, así que
usarlo como selector de «sexo al nacer» rompería el vínculo que el modelo declara.

> **El orden importa: primero sembrar, después publicar el binding.** Al revés no sirve de nada.

**Qué salió mutilado por esto, ya:** el alta de paciente va sin género administrativo ni sexo al
nacer, y las dos operaciones de fusión van sin motivo. Los cuatro son opcionales en el contrato, así
que las pantallas funcionan — pero ninguna está completa.

---

## 4 · Hallazgo nuevo: una fusión de pacientes es irreversible al salir de la pantalla

**Para:** Pablo · **Bloquea:** que «revertir una fusión» signifique lo que parece.

`POST /profiles/patients/merge/{eventId}/reverse` (UC-05-09) existe y funciona, pero exige el
identificador del evento — y **el backend no expone ningún listado de eventos de fusión**.
Verificado: no hay un solo `@Get` con `merge` en `ProfilesPatientsController`.

Ese identificador aparece **una sola vez en el mundo**: en la respuesta del `POST` de fusión. En
cuanto esa respuesta se pierde de vista, unir dos historias clínicas deja de tener vuelta atrás
desde la aplicación.

**Lo que hice con eso:** el «Deshacer» vive en la pantalla de resultado y avisa con palabras que al
salir se pierde. Es lo único que el contrato permite. Pero quien se dé cuenta del error al día
siguiente no tiene camino de vuelta, y eso no es lo que «revertir» debería significar.

Una lectura sobre `profiles.patient_merge_events` —tabla que ya existe— lo cierra.

---

## 5 · Lo que se destrabó, y por qué vale la pena contarlo

**Pablo tomó el buscador de referencia** (`reference-combobox`, PR #26) después de que quedara
levantado como bloqueo, y **el mismo día se construyó la fusión encima**. En el mismo PR vino
`AppButtonLink`, que cerró otro pedido chico: un ancla con aspecto de acción primaria. Ya está
adoptado en el listado de pacientes.

Vale la pena decirlo porque es la parte del proceso que funcionó: **la pieza de sistema de diseño la
tomó alguien que no estaba escribiendo vistas**, que era exactamente la sugerencia. Si se hubiera
compuesto a mano dentro de una vista, hoy tendríamos tres versiones distintas y ninguna probada.

---

## 6 · Estado de mis 37 vistas de Fase 0

| Módulo | En Fase 0 | Construidas | Esperando `GET` |
|---|---|---|---|
| `V01 iam` | 18 | 10 (los formularios de auth, de los PR #20 y #22) | 8 |
| `V02 common` | 8 | 0 | 7 |
| `V05 profiles` | 11 | **2** | 9 |

Dos correcciones al plan de la semana:

- **`common` no tiene lectura de colección.** El plan lo cuenta entre los módulos «con lectura»,
  pero su único `@Get` es `/common/files/:id/content` — una descarga de archivo. Quien lo tome
  creyendo que puede cerrarlo completo se va a encontrar con eso.
- **V01-11 (registrar organización) no es el terreno libre que parecía.** `POST
  /iam/auth/register-organization` existe y el `IamClient` no lo envuelve, pero los **tipos
  territoriales** —`PROVIDER`, `UNIVERSITY`, `PHARMACY`, `HOSPITAL`, `MEDICAL_OFFICE`, `NURSING`,
  `HEALTH_OTHER`, `HEALTH_BUSINESS`, o sea casi todos— exigen `countryConceptId` y
  `jurisdictionConceptId`. Vuelve a chocar con el bloqueo de catálogos. Sólo `PAYER` y `BROKER`
  quedan fuera, y a cambio piden bloques anidados propios.

**Conclusión honesta: con los catálogos sin sembrar, el techo no es de esfuerzo.** Se pueden
escribir pantallas toda la semana, pero cada campo de catálogo sale vacío — y son casi todos.

---

## 7 · Notas de stack, para no tropezarlas

- **`withComponentInputBinding()` no está habilitado.** Un `input.required<string>()` no se llena
  desde un segmento de ruta; hay que leer `ActivatedRoute`. Activarlo cambia cómo se enlazan las
  entradas de **todas** las pantallas, así que no es decisión de una ficha — si alguien quiere el
  idioma moderno, que sea un cambio propio y discutido.
- **La prueba «no hay rutas hijas que el registro no declare» era demasiado estricta.** Una ficha de
  paciente no es una entrada de menú. Se afinó en vez de relajarse: una ruta vale si **es** una
  sección o si **cuelga** de una. Y se agregó la que faltaba: los segmentos fijos van antes que los
  paramétricos, o `:profileId` se traga `nuevo` — el mismo defecto que el backend documenta haber
  evitado al declarar `patients/me/summary` antes que `patients/:profileId`.
- **`app-dialog` es un diálogo de confirmación, no un anfitrión de formularios.** Su contrato es
  `confirm({ title, message })` y no proyecta contenido. Por eso la fusión es una pantalla y no el
  modal que la ficha especifica; el diálogo se usa para la confirmación final, que es lo suyo. Si
  alguien necesita un modal con formulario, es una extensión del sistema de diseño y merece pasar
  por el diseñador.
- **Cambio de ruta:** el alta asistida se movió de `/administracion/pacientes` a
  `/administracion/pacientes/alta-asistida`, para dejarle la raíz al listado. Cambia la ruta, no la
  pantalla.
- **Inconsistencia menor del vault:** la fila 1 del orden de trabajo (V01-09) tiene `X` en la
  columna «Bloqueo», donde el resto usa `—` o `Listado pendiente`. Parece un dedazo.

---

## 8 · Qué pido, y a quién

Los pedidos formales están en `PENDIENTES-BACKEND.md` (**P7 a P10**). En una línea cada uno:

| # | Para | Qué | Por qué urge |
|---|---|---|---|
| **P7** | Marcelo | **Sembrar los value sets** de género, sexo al nacer, nacionalidad, idioma, ABO, Rh y cobertura | Es el bloqueo más caro del sistema y también frena a móvil |
| **P8** | Pablo | Publicar el binding campo → value set | Sin P7 no sirve; con P7, es lo único que falta |
| **P9** | Pablo | `GET /profiles/patients/merge-events` | Sin él, unir dos historias clínicas no tiene vuelta atrás |
| **P10** | Pablo | `GET` de colección para `iam` y `directory` (0 lecturas cada uno) | 23 de mis 37 vistas, y buena parte del reparto de Itzan |

**Y un pedido al equipo, que no es de código:** revisar el #27 antes de mergearlo **con el stack
levantado**. La pantalla de fusión es la operación de más consecuencia del módulo y es la única de
las cinco que nunca tocó un servidor real.
