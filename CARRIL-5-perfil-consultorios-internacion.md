# Carril 5 · Historial laboral del profesional, consultorios y alta de internación

**Puntos del reclamo:** 8 (histórico de evoluciones — específicamente, poder dar de alta una
internación), 9 (red social profesional: hospitales/entidades donde trabajó — **solo el hueco
de historial laboral**, no la red social entera), 11 (consultorios: dónde atiende cada doctor).
**Repos:** backend + frontend, los dos. **Rama sugerida:**
`carril-5/perfil-consultorios-internacion` en ambos.
**Coordinación:** ver `CARRILES-2026-08-14-README.md` antes de tocar cualquier archivo
compartido, y postear tu bloque en `COORDINACION-AGENTES.md` antes de empezar.

## ⚠️ Arrancá leyendo esto antes que nada

El backend ya tiene **cambios sin commitear**, hoy, en `pablo/contabilidad-visible`, dentro de
`src/modules/profiles/controllers/profiles-practitioners.controller.ts` y su service —
exactamente el archivo que este carril necesita extender. **No partas de `master` limpio en ese
módulo**: leé ese working tree primero, coordiná con quien lo dejó ahí (buscá su bloque en
`COORDINACION-AGENTES.md` del repo backend si existe, o preguntá) antes de tocar nada en
`profiles`. Si te bajan esos cambios a una rama propia, decilo en tu bloque de coordinación.

Tampoco toques `community` — el hoyo de "más información del profesional" que señaló la
auditoría (reseñas, grupos, mensajería) **ya tiene su propio plan activo** en
`PENDIENTES-RED-SOCIAL.md` (fases F1–F10, con H2/H4 abiertos). Este carril es solo el campo de
historial laboral, no la red social.

## Por qué estos tres van juntos

Los tres son, en el fondo, "el perfil del profesional le falta un dato concreto que el cliente
pidió por nombre": dónde trabajó (9), dónde atiende hoy (11), y si puede abrir una internación
desde la atención que ya está dando (8). Ninguno de los tres colisiona con el trabajo de los
otros cuatro carriles — no tocan `billing`, `forms`, `chart` templates, `procedures_perioperative`
ni `diagnostics` — así que es el carril con más aislamiento de módulo, a pesar de ser el que más
modelo de datos nuevo necesita.

## Lo que ya existe, y por qué no alcanza (evidencia de la auditoría)

**Punto 9 — historial laboral:**
- `practitioner-profile.ts`, `practitioner-profile-edit.ts`, `public-profile-preview.ts` y
  `medical-articles.ts` (todos en `src/app/features/account/my-profile/`) son reales — inyectan
  `ProfilesClient`/`CommunityClient`, hacen escrituras de verdad. Es lo más maduro de la
  auditoría.
- Pero `OwnPractitionerProfile` (`src/app/core/data-access/profiles/profiles.types.ts:164-185`)
  solo tiene `specialties`, `credentials` (dónde se **formó**, no dónde trabajó), `licenses` e
  `languages`. **No hay ningún campo de historial de empleo/afiliación institucional.**
  `grep -rli "affiliation|employer|hospital|workplace" src/modules/profiles` en el backend → 0
  resultados. El cliente pidió literalmente "hospitales o entidades médicas" y hoy no hay dónde
  guardarlo.

**Punto 11 — consultorios:**
- `SchedulingClient` (`src/app/core/data-access/scheduling/scheduling.client.ts`) está
  genuinamente conectado — reservar un horario funciona. Pero `AgendaResource`
  (`scheduling.types.ts:19-30`) no tiene ningún campo de sitio/consultorio/dirección, y
  `booking-new.html` no muestra ubicación en ningún punto.
- El backend sí modela consultorios (`practice.sites.controller.ts`,
  `GET /practices/:practiceId/sites`), pero **no hay cliente frontend para `practice/sites`** —
  `grep -rln "sites\b|/sites|practice/sites" src/app/core/data-access` → 0 resultados. Hoy se
  sabe *cuándo* atiende un profesional, no *dónde*.

**Punto 8 — alta de internación:**
- El expediente sí carga como contexto real al iniciar la atención
  (`patient-chart.ts:782-783`, llega desde `agenda.ts:984`) — esa parte funciona.
- Pero no hay ningún método en `clinical.client.ts` para **crear** un episodio de internación
  (`care_episodes`) desde el frontend — solo se lee `episodeId` si ya existe.

## Backend (`mantra-core-health-redesa-api`)

**Módulo `profiles`** — historial laboral, siguiendo el mismo molde que ya usan
`addSpecialty()`/`addJurisdictionAuthorization()` en `profiles-practitioners.controller.ts`:

```
src/modules/profiles/entities/practitioner_affiliations.entity.ts   (nueva)
src/modules/profiles/dto/affiliation.dto.ts
```

Extendé `profiles-practitioners.controller.ts`/`.service.ts` (**ya tienen cambios sin
commitear — leelos primero**, ver advertencia arriba) con:
`GET /profiles/practitioners/me/affiliations`, `POST /profiles/practitioners/me/affiliations`
(institución, cargo, fecha de inicio/fin). **Tabla nueva → pipeline `.puml` →
`gen_ddl.py` → `SQL/patches/`, no se edita a mano** — marcalo como bloqueador en
`COORDINACION-AGENTES.md` desde el primer día, es el ítem de mayor riesgo del carril.

**Módulo `practice`** — probablemente no necesites nada nuevo; `practice.sites.controller.ts` ya
expone lo necesario. Confirmá que `GET /practices/:practiceId/sites` devuelve suficiente
(nombre, dirección) para mostrarlo en la agenda.

**Módulo `scheduling`** — si `AgendaResource`/el recurso agendable no tiene un `siteId` que lo
vincule a `practice.sites`, hace falta agregarlo:

```
src/modules/scheduling/entities/   (agregar relación siteId, si falta)
src/modules/scheduling/controllers/  (extender el GET de resources para incluir el site)
```

Si esto también requiere columna nueva, mismo protocolo: bloqueador declarado, no editado a
mano.

**Módulo `clinical`/`chart`** — alta de internación:

```
src/modules/clinical/controllers/   (agregar POST de care-episodes, si no existe)
```

Confirmá primero si el endpoint de escritura ya existe y solo falta exponerlo/documentarlo antes
de asumir que hay que construirlo desde cero.

**Archivos existentes que tocás:** `profiles/` (coordinando con el working tree existente),
`practice/` (probablemente solo lectura, sin cambios), `scheduling/` (si falta `siteId`),
`clinical/`. Ningún otro carril de este documento toca estos cuatro módulos — el único riesgo de
choque es con trabajo *fuera* de este plan que ya está en curso en `profiles`, señalado arriba.

## Frontend (`mantra-core-health`)

**Archivos nuevos (no chocan con nada):**

```
src/app/core/data-access/practice-sites/practice-sites.client.ts   + .types.ts + .spec.ts
src/app/features/clinical-record/patient-chart/admission-block/admission-block.ts + .html + .css + .spec.ts
```

**Archivos existentes que tocás — son tuyos, ningún otro carril los toca:**

| Archivo | Qué agregás |
|---|---|
| `src/app/core/data-access/profiles/profiles.client.ts` | métodos `listAffiliations()` / `addAffiliation()` — solo métodos nuevos, no tocás los existentes |
| `src/app/core/data-access/profiles/profiles.types.ts` | tipo `PractitionerAffiliation` |
| `src/app/features/account/my-profile/practitioner-profile/practitioner-profile.ts` (+ `.html`) | sección de historial laboral, mismo patrón visual que la línea de tiempo de credenciales que ya existe ahí |
| `src/app/features/account/my-profile/practitioner-profile-edit/practitioner-profile-edit.ts` (+ `.html`) | alta/edición de una afiliación, mismo patrón que `addSpecialty()` |
| `src/app/core/data-access/scheduling/scheduling.types.ts` | campo de sitio/ubicación en `AgendaResource` |
| `src/app/features/agenda/agenda.ts` / `booking-new.ts` (+ `.html`) | mostrar la ubicación junto al horario |
| `src/app/core/data-access/clinical/clinical.client.ts` | método `createCareEpisode()` — solo el método nuevo, no tocás `getSummary`/`getChart`/`checkInEncounter`/etc. |

**Archivos compartidos con otros carriles (siguiendo el protocolo del README):**

| Archivo | Qué agregás |
|---|---|
| `src/app/app.routes.ts` | si `admission-block` necesita una ruta hija propia (probablemente no — puede vivir embebido en `patient-chart`) |
| `src/app/features/clinical-record/patient-chart/patient-chart.ts` (+ `.html`) | import de `admission-block` + una entrada en el ensamblado de bloques, al final, en tu último commit — coordiná con carriles 1, 2 y 3, que también agregan bloques ahí el mismo período |

No necesitás tocar `navigation.map.ts`: ninguno de los tres puntos abre una sección nueva de
menú — son extensiones de pantallas que ya existen (Mi perfil, Agenda, ficha del paciente).

**Lo que NO tocás:** `community.client.ts` ni ninguna pantalla de `medical-articles/` o
`public-profile-preview/` (son del plan de red social, no de este carril), `medication-block/`,
`diagnosis-block/`, `specialty-form-block/` (carril 2), `budget-block/` (carril 1),
`procedures-block/` (carril 3), y todo `redsat/`.

## Definición de hecho

- El perfil de un profesional muestra dónde trabajó (institución, cargo, período), editable por
  él mismo.
- La agenda muestra dónde atiende cada profesional, no solo cuándo.
- Desde un encuentro activo se puede dar de alta una internación, y esa internación aparece
  después como contexto al reabrir la ficha.
- `yarn lint` · `yarn typecheck` · `yarn test` · `yarn build` en frontend; `yarn lint` ·
  `yarn typecheck` · `yarn test` · `yarn test:integration` en backend.
