# Bloqueos y supuestos sin respaldo en el contrato

Lo que el frontend hace **sin** que el repo traiga el contrato del backend que
lo respalde. Cada entrada dice qué se supuso, dónde vive el supuesto en el
código y qué lo levanta. Varios comentarios del código remiten acá; este
archivo existe para que esa remisión no apunte al vacío.

## `PATCH /profiles/practitioners/me` · `languages` (02/10/2026)

**Supuesto.** El cuerpo del `PATCH` acepta `languages` como lista entera con la
misma forma que devuelve la lectura (`PractitionerLanguage`:
`languageConceptId`, `proficiencyConceptId?`, `clinicalInterpretationAllowed`),
y la guardada se reemplaza por la que llega; `[]` quita el último idioma.

**Dónde.** `ProfilesClient.updateOwnPractitionerProfile`
(`src/app/core/data-access/profiles/profiles.client.ts`), el bloque «Idiomas en
los que atendés» del editor del perfil médico
(`practitioner-profile-edit.{ts,html}`) y el simulador
(`src/app/core/mock/handlers/profiles.handlers.ts`, `cambiosDelPerfilProfesional`).

**Por qué se hizo igual.** El perfil leía `languages` y la ficha los mostraba
en «Credenciales», pero ningún formulario los escribía: la persona no tenía
dónde corregirlos (pedido del doctor, 02/10/2026). El repo no trae el DTO del
`PATCH` ni una OpenAPI, y la persistencia sólo se demostró contra el
simulador (editar → guardar → recargar → la ficha muestra el idioma nuevo).

**Qué lo levanta.** Confirmar en `mantra-core-health-api` el DTO de
`PATCH /profiles/practitioners/me`: si acepta `languages` con esta semántica,
borrar esta entrada y el aviso del comentario; si lo rechaza, llega como
violación sobre `languages` y el editor ya la muestra en su bloque; si lo
ignora en silencio, la recarga lo delata y hace falta el recurso propio que el
backend ofrezca.
