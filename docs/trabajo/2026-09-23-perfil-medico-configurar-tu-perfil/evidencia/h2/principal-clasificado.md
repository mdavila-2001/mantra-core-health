# Inventario de «principal» de especialidad (H2.S2.M1) — 2026-09-23

Salida cruda: `principal.txt` (300 líneas: casi todas son «diagnóstico principal», «sede principal», botones `lienzo__principal`, etc., ajenas a D-01). Filtrado a lo que distingue una especialidad como principal:

| Dónde | Qué hace | Destino |
|---|---|---|
| `shared/components/organisms/specialty-badge/specialty-badge.ts:81,89` + `.html:25-28` + `.css:69` | input `principal`: tono `primary` y la palabra «Principal» | H2.S2.M2: se retira el input; tono único `secondary` |
| `shared/components/organisms/specialty-badge/specialty-badge.types.ts:23-24` | `SpecialtyBadgeItem.principal` | H2.S2.M3: se retira (nadie lo lee después de M2/M3) |
| `shared/components/organisms/specialty-badge-grid/specialty-badge-grid.ts:19-22,54` + `.html:6` | ordena la principal primero y la pasa a la insignia | H2.S2.M3 |
| `practitioner-profile-view.html:1296` | `[principal]` a la insignia en la tabla de especialidades | H2.S2.M2 (cae con el input) |
| `practitioner-profile-view.html:1340-1341` | `app-badge` «Principal» | H2.S2.M9 (nueva) |
| `practitioner-profile-view/credentials-panel/credentials-panel.ts:83` | renglón «Principal» en la tarjeta de la especialidad | H2.S2.M9 (nueva) |
| `practitioner-profile-view.html:771-776`, `practitioner-profile.ts:611-620`, `practitioner-detail.ts:319-324` | `especialidadPrincipal`: nombre con que se presenta a la persona cuando no hay lista; prefiere la marcada y si no, la primera vigente | Se conserva: no marca nada en pantalla. Sólo se corrige el comentario de L771-773, que describe la insignia «Principal» |
| `practitioner-profile-edit.html:600-634, 796-819, 1020` + `.ts:123-124, 571-579, 679, 710, 734-735, 775-793, 1214-1267` | badge «Principal», «Marcar como principal», orden, `caption`, columna «Tipo» | H2.S2.M4 |
| `register-practitioner.ts:864-866, 876, 1901-1911, 2106-2108, 2450-2460` | select «Especialidad principal (opcional)» | H2.S2.M5 (Q-I6) |
| `core/data-access/profiles/profiles.types.ts:95,156,982` · `profiles.client.ts:706-715, 805-807` | `isPrimary` en el contrato y `PATCH …/primary` | H2.S2.M6: quedan en el cable, con la deuda comentada (Q-1) |
| `core/mock/handlers/profiles.handlers.ts:85-97, 160-172, 1061-1064, 1114-1136` · `core/mock/fixtures/personas.ts:473` | `PrincipalElegida` y el `PATCH …/primary` del simulador | H2.S2.M7: quedan, anotados sin consumidor |
| `practitioner-profile.ts:486` · `practitioner-detail.ts:224` | `principal: especialidad.isPrimary` en el modelo de vista | Se conserva el campo del modelo de vista para `especialidadPrincipal`; ya no lo lee ninguna insignia |

**Fuera de alcance, anotado (no se toca):**

- `features/clinical-record/patient-chart/specialty-form-block/specialty-form-block.ts:1076-1077`: la historia clínica preselecciona el formulario de la especialidad principal. Es comportamiento, no una marca visible, y es ajeno.
- `features/alovida/personas/especialidades-formulario/especialidades-formulario.html:79`: maqueta estática con el interruptor «Mostrarla como su especialidad principal». Es ajena; queda como hallazgo para quien la tenga.
- `features/alovida/buscar/profesionales-listado/profesionales-listado.ts:45`: agrupa por el primer tramo del `headline`, no por `isPrimary`. Sólo el comentario dice «principal».
- `isPrimary` de `medical-organization`, `practice-sites`, `my-organizations`: son organizaciones y sedes, no especialidades.
