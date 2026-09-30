# Brechas front ↔ back para cerrar el frontend — 2026-09-24

> **Qué es:** el informe de todo lo que separa al front (`mantra-core-health`) de la API
> (`mantra-core-health-api`) antes de dar el front por cerrado. Viene con **30 prompts de
> ejecución** (`prompts/`) escritos con la plantilla oficial
> (`PLANTILLA_OFICIAL_PROMPTS_TAREAS_MANTRA.md`), para que cualquier persona o agente tome uno y
> lo ejecute en modo planificación.
>
> **Fuera de alcance, por pedido:** **pasarela de pago** y **delivery**. Donde aparecen, sólo se
> anotan como excluidos: `payments/*`, `PUT|GET /scheduling/bookings/:id/payment-state`,
> `paymentDemo`, los modos `DOMICILIO`/`TRABAJO` de farmacia, y `tracking` y los trips, pings y
> geocercas de `geo`.

---

## 1. Cómo leer este informe

| Carpeta | Qué hay |
|---|---|
| `README.md` (este) | Resumen ejecutivo, cifras, bloqueantes, mapa y orden de los prompts, decisiones pendientes y advertencias |
| `prompts/BR-NN-*.md` | 30 prompts ejecutables, uno por frente de trabajo. Cada uno lista los hallazgos que cierra |
| `anexos/A-identidad-y-perfiles.md` | 24 hallazgos `ID-01…ID-24`: alta y perfil del médico y del paciente, identidad, roles, acceso delegado |
| `anexos/B-clinico.md` | 73 hallazgos `CL-01…CL-79`: historia clínica, recetas, notas, diagnósticos, formularios, encuestas, triage IA, consentimiento |
| `anexos/C-agenda-social-directorios-operacion.md` | 45 hallazgos `AG-01…AG-45`: agenda, comunidad y chat, notificaciones, directorios públicos, farmacia, visitadores, cotizaciones, contabilidad, portal admin |
| `anexos/D-transversal-salida-del-mock.md` | 34 hallazgos `TX-01…TX-34`, más el **checklist de apagado del mock** en 15 pasos |
| `anexos/E-cobertura-pantallas-y-casos-de-uso.md` | 26 hallazgos `CV-01…CV-26`: mapa de pantallas por actor, módulos de la API sin pantalla clasificados y casos de uso sin pantalla |
| `anexos/F-tabla-pantallas-endpoints.md` | Tabla de cada pantalla con los endpoints que consume |
| `inventarios/` | Los cruces mecánicos y los scripts que los generan (ver §11) |

El **§10 del README** corrige los anexos donde el código dijo otra cosa y suma 12 hallazgos
nuevos (N-01…N-12). **Cuando un anexo y un prompt no coinciden, manda el prompt.**

**Cada hallazgo** trae en su anexo: severidad, tipo, evidencia `archivo:línea` en los dos repos,
tablas del modelo involucradas, qué hacer, archivos a tocar y criterios Gherkin. Los prompts
resumen y agrupan; **la evidencia completa está en los anexos**.

---

## 2. Método y límites (leer antes de citar una cifra)

- **Código auditado:** front `origin/mockup` @ `9b3e0101` (y `origin/dev` @ `64939119` para
  comparar); API `origin/dev` @ `7541797c` (incluye los PR #451, portal admin, y #452).
- **Inventario de rutas de la API:** se sacó del **código de los controladores**
  (`inventarios/api-routes.json`, **1 362 rutas**). No se usó `openapi/openapi.json`, que es
  del 19/09 y le faltan 52 rutas reales (TX-23).
- **Inventario del front:** **490 llamadas únicas** de `core/data-access` y `features`
  (`inventarios/client-calls.json`) y **538 rutas** que simula el mock
  (`core/mock/handlers`).
- **Controladores registrados:** los 257 controladores están en el arreglo `controllers` de
  algún módulo. No queda ninguna ruta «existe pero da 404» por la trampa del módulo
  (`inventarios/controladores-sin-registrar.js` → 0).
- **Validación global de la API:** `whitelist + forbidNonWhitelisted + transform`
  (`src/main.ts:159-164`). **Todo campo que el front mande y el DTO no declare da 400.** Esa
  es la causa más común de las brechas de contrato de abajo.
- **Nada se ejecutó contra la API viva.** Cada «→ 400», «→ 403» o «→ 404» sale de leer el DTO,
  el `@Roles` o el controlador. En el Definition of Done de cada prompt, lo primero es
  **reproducirlo en runtime**: pruebas del front en verde no prueban el contrato (lección del
  08/08: 3 defectos reales con 1 248 pruebas pasando).
- Lo no confirmado está marcado **«sin confirmar»** en los anexos.

---

## 3. Cifras

| Dominio | Hallazgos | Bloqueante | Alta | Media | Baja |
|---|---:|---:|---:|---:|---:|
| A · Identidad y perfiles (`ID`) | 24 | 3 | 5 | 10 | 6 |
| B · Clínico (`CL`) | 73 | 3 | 26 | 23 | 21 |
| C · Agenda, social y operación (`AG`) | 45 | 3 | 13 | 17 | 12 |
| D · Transversal (`TX`) | 34 | 7 | 10 | 14 | 3 |
| E · Cobertura (`CV`) | 26 | 2 | 8 | 11 | 5 |
| **Total** | **202** | **18** | **62** | **75** | **47** |

(Hay solapamientos entre dominios, por ejemplo CL-40 = TX-09 o CV-01 = CL-04. Los prompts los
agrupan para no hacer el trabajo dos veces.)

**Rutas:**
- **21 operaciones** que el front llama **no existen** en la API (TX-05, CV-05). El mock las
  responde y en la maqueta no se nota. Son 18 del cruce automático más 3 que el cruce no vio,
  porque se arman con `getPage(`: `o/:slug/services`, `f/:slug/products` y `f/:slug/branches`.
  Hay además 2 falsos positivos: `checks:plan` existe y `/v1/triage` es otro servicio.
- Otras **12 rutas** existen sólo en el mock y ningún cliente las llama: son alias muertos.
- **868 de 1 362 rutas de la API no tienen pantalla.** Se reparten así:
  - ~390 son del producto de lanzamiento.
  - ~326 son infraestructura interna y no necesitan UI.
  - ~126 son producto futuro.
  - 26 quedan excluidas por pago y delivery.

**Pantallas:** ~205 rutas con pantalla y 126 maquetas portadas de la bóveda. Una sola sección es
placeholder (`/billing`).

**Casos de uso:** de 220 casos de uso con actor paciente, médico u organización, **154 no
tienen pantalla**, y 82 de ellos son del producto.

---

## 4. Las cinco conclusiones que cambian el plan

1. **Hoy no existe un front de producción que hable con la API.** `mockBackend: true` está fijo
   en `production` **y también en `origin/dev`**, que trae los 91 archivos de `core/mock`. La
   única configuración sin mock es `real-api`/`e2e-real`, que es de `ng serve` y **apaga el
   SSR**. El `Dockerfile` construye `production`, así que el contenedor sale con el mock
   encendido. Por eso «terminar el front» no puede significar «terminar `mockup`»: hay que
   construir la salida (BR-01).
2. **El mock esconde las brechas.** Tres mecanismos:
   - `respuestaGenerica` inventa un éxito para cualquier ruta sin manejador (TX-06).
   - No aplica `forbidNonWhitelisted` (ID-20) ni controla roles (AG-02, AG-03, CL-13).
   - Responde errores con otra forma que la API: 412 en vez de 422, `issues` en vez de
     `details.violations` (TX-12).

   **Todo recorrido en `mockup` sale verde aunque la API lo rechace.** Antes de apagarlo hay
   que volverlo honesto (BR-02).
3. **Muchos 403 salen de roles que nadie emite, no de lógica.** Hay ~25 roles que usan el menú
   y los `@Roles` y no se siembran (ID-18). El médico autorregistrado sólo recibe
   `PRACTITIONER`, así que le dan 403:
   - el check-in (AG-02) y la reserva de mostrador (AG-03);
   - la ficha del paciente (ID-15);
   - la administración de su propio laboratorio (CL-44).

   El personal de farmacia necesita `SECURITY_ADMIN` para su bandeja (AG-32), y
   `MEDICAL_VISITOR` y `PHARMA_LAB_ADMIN` se siembran, pero ningún flujo los asigna (AG-31). Un solo frente de roles
   (BR-06) destraba media docena de pantallas.
4. **El propósito central («el paciente es dueño de su historia») no está completo de punta a
   punta:**
   - **Ver:** probablemente funciona (D-3 corregido en código, sin confirmar en runtime).
   - **Descargar:** la historia es un PDF armado en el navegador, sin notas ni adjuntos
     (CV-06, CL-30/31). Además, el paciente **no puede bajar el PDF de su propio resultado**:
     da 403 por `canActorReadOwnFile`, y 401 porque `window.open` sale sin token (CL-40, TX-09).
   - **Actualizar:** `GET|PUT /clinical/me/medical-aspects` no existe en la API ni en el modelo
     (CL-04, CV-01).
   - **Laboratorios:** no hay pantalla para liberar un informe, y hay dos caminos de liberación
     que no coinciden (CV-02, CL-46).
   - **Hospitales:** no tienen alta ni consola (CV-03).
5. **La fuente del modelo cambió y el `CLAUDE.md` de la raíz no lo refleja.**
   - El modelo vive en el repo **`mantra-core-health-model`**, que es hermano de la API.
   - La API versiona una **copia** en `database/SQL` y `database/NoSQL`, sincronizada con
     `yarn db:vendor` y controlada con `yarn db:vendor:check`, y los compose montan esa copia.
     **No es una violación de ADR-0021: es la política nueva.**
   - El `SQL/` de la raíz del workspace es una foto vieja (v4.0.10) y le faltan columnas de
     v4.1 y v4.2, como `schedule_rules.gap_minutes`. **Toda auditoría hecha contra `SQL/` de la
     raíz sale mal.**
   - **Todo prompt que toque el modelo sigue este camino:** `.puml` en `mantra-core-health-model`
     → `gen_ddl.py` → `SQL/` del modelo → `yarn db:vendor` en la API → entidad → DTO.

---

## 5. Los 18 bloqueantes

**Bloquean la demo con la API real:**

| # | Hallazgo | Qué pasa | Prompt |
|---|---|---|---|
| 1 | ID-01 | Alta del médico: `workEmail` da 400 y el correo personal se guarda como de trabajo | BR-07 (PR #453 abierto) |
| 2 | ID-02 | Alta del médico: dirección laboral da 400 | BR-07 (PR #453) |
| 3 | ID-03 | Alta del médico: el PDF del título (`credentials[].fileId`) da 400 | BR-07 (PR #453) |
| 4 | CL-01 | Registrar una alergia desde la consulta da 400 (`encounterId`, P26) | BR-11 |
| 5 | CL-40 | El paciente no puede descargar el PDF de su resultado (403 + 401) | BR-05 |
| 6 | CL-60 | El editor de encuestas no existe en la API (PATCH, DELETE y orden de preguntas) | BR-19 |
| 7 | AG-04 | *(en `mockup`)* El mock no simula el walk-in: el paciente de mostrador no aparece | BR-21 |
| 8 | AG-30 | Las rutas de visitadores y visitas (76 en 12 controladores) dan 500: no hay `.puml` ni DDL de `pharma_lab` | BR-26 |
| 9 | AG-35 | Ninguna cotización se guarda: importes `number` contra `@IsNumberString` → 400 | BR-25 |
| 10 | CV-01 | La autodeclaración de salud del paciente llama una ruta inexistente (= CL-04) | BR-12 |
| 11 | CV-02 | El laboratorio no puede publicar un resultado: «Mis resultados» queda vacío | BR-17 |

**Bloquean la salida a producción:**

| # | Hallazgo | Qué pasa | Prompt |
|---|---|---|---|
| 12 | TX-01 | No existe un build de producción con la API real | BR-01 |
| 13 | TX-02 | SSR + API real nunca se ejercitó (`real-api` apaga el SSR) | BR-01 |
| 14 | TX-03 | Las demos que fabrican datos están encendidas por defecto en producción | BR-01 |
| 15 | TX-04 | El cartel de cuentas demo se pinta siempre, con o sin mock | BR-01 |
| 16 | TX-05 | 21 operaciones del front no existen en la API | BR-02, más el prompt de cada dominio |
| 17 | TX-07 | Faltan en nginx de producción `/loyalty`, `/patients/me/reviews` y `/ai`: el SSR contesta HTML con 200 | BR-03 |
| 18 | TX-08 | Triage IA: servicio sin repo, sin ruta en nginx, y manda texto clínico sin autenticar a una IP pública | BR-03 |

---

## 6. Mapa de los 30 prompts

La columna **Modelo** dice si el prompt toca el `.puml`. Si lo toca, necesita el camino de las 4
capas y lo tiene que revisar quien mantiene `mantra-core-health-model`.

| Prompt | Título | Repo(s) | Hallazgos que cierra | Máx. severidad | Modelo |
|---|---|---|---|---|---|
| [BR-01](prompts/BR-01-build-produccion-api-real.md) | Build de producción contra la API real (SSR, demos apagadas, cartel, hosts) | front | TX-01, TX-02, TX-03, TX-04, TX-21, TX-22, CV-04, CV-24 | Bloqueante | no |
| [BR-02](prompts/BR-02-mock-honesto-e-inventario.md) | Mock honesto: 501 ante ruta desconocida, whitelist, roles y errores reales, inventario mock↔API en CI | front | TX-05, CV-05, TX-06, TX-12, TX-13, ID-20, AG-26, AG-33, AG-34, CL-12, CL-13, CL-21, CL-22, CL-41, CL-52, CL-53, CL-71 | Bloqueante | no |
| [BR-03](prompts/BR-03-enrutado-produccion-y-triage-ia.md) | Enrutado de producción (nginx y proxy) y servicio de triage IA | front + infra | TX-07, TX-08, CL-73, CL-74, CL-75, CL-76 | Bloqueante | no |
| [BR-04](prompts/BR-04-sesion-tenants-y-seguridad-cuenta.md) | Sesión, tenants y seguridad de la cuenta | front + API | TX-10, TX-11, TX-15, TX-16, TX-19, TX-20, TX-28, TX-29, TX-30, TX-31, ID-24, CV-22 | Alta | no |
| [BR-05](prompts/BR-05-archivos-descarga-y-acceso.md) | Archivos: descarga autenticada, acceso del paciente a lo suyo, escaneo y almacenamiento | front + API | CL-40, TX-09, TX-33, TX-34, CL-27, CL-28 | Bloqueante | no |
| [BR-06](prompts/BR-06-roles-sembrados-y-autorizacion.md) | Roles sembrados y `@Roles` alineados al actor real | API (+front menús) | ID-18, ID-15, AG-02, AG-03, AG-31, AG-32, AG-37, AG-39, CL-44, CL-49, CL-54, CV-16 | Alta | seeds |
| [BR-07](prompts/BR-07-alta-y-perfil-del-medico.md) | Alta y perfil del médico (cerrar #453 + lo que le falta) | API + front | ID-01…ID-09, ID-12, ID-13, ID-14 | Bloqueante | no (las columnas de P28 ya existen) |
| [BR-08](prompts/BR-08-titulo-historial-laboral-y-alta-paciente.md) | Título (universidad, país, ciudad), historial laboral del padrón y alta del paciente | API + front + modelo | ID-10, ID-11, ID-16, ID-21, ID-22, ID-23 | Media | sí |
| [BR-09](prompts/BR-09-altas-laboratorio-imagenologia-hospital.md) | Altas de laboratorio, imagenología y hospital conectadas a la API | front + API | ID-17, CL-42, CL-43, CV-03 | Alta | no |
| [BR-10](prompts/BR-10-receta-completa.md) | Receta completa: prescriptor por sesión, motivo libre, QR público, corrección, favoritas y políticas D-05 | API + front | CL-02, CL-03, CL-06, CL-14, CL-15, CL-17, CL-19, CV-09 | Alta | sí (`indication_text`, P24) |
| [BR-11](prompts/BR-11-alergias-y-adjuntos-clinicos.md) | Alergia desde la consulta (P26) y adjuntos de receta, alergia y encuentro (P25) | modelo + API + front | CL-01, CL-05 | Bloqueante | sí |
| [BR-12](prompts/BR-12-aspectos-medicos-del-paciente.md) | «Aspectos médicos» que declara el paciente | modelo + API + front | CL-04, CV-01 | Bloqueante | sí |
| [BR-13](prompts/BR-13-notas-clinicas-firma-y-liberacion.md) | Notas clínicas: firmar, enmendar, liberar, autor por sesión, versiones e inmutabilidad | API + front | CL-18, CL-20, CL-21, CL-23, CL-29, CL-32, CL-33, CL-35, CV-08 | Alta | trigger |
| [BR-14](prompts/BR-14-encuentros-y-seguridad-clinica.md) | Encuentros: sello del cierre, acceso por paciente, CDS y lecturas del resumen | API | CL-07, CL-08, CL-09, CL-10, CL-11, CL-16 | Alta | según la decisión de CL-10 |
| [BR-15](prompts/BR-15-historia-del-paciente-y-pdf-oficial.md) | Historia del paciente: lo liberado visible y PDF oficial desde la API | API + front | CL-30, CL-31, CV-06, TX-32 | Alta | no |
| [BR-16](prompts/BR-16-plan-de-cuidados-plantillas-y-documentos.md) | Plan de cuidados, plantillas de nota y documentos del expediente | modelo + API + front | CL-24, CL-25, CL-26, CL-34, CL-36 | Alta | sí (catálogos) |
| [BR-17](prompts/BR-17-diagnosticos-liberacion-y-consola-laboratorio.md) | Diagnósticos: un solo camino de liberación, consola del laboratorio y compartir resultados | API + front | CV-02, CL-45, CL-46, CL-47, CL-48, CL-50, CL-51, CL-55, CL-56 | Bloqueante | no |
| [BR-18](prompts/BR-18-formularios-dinamicos.md) | Formularios dinámicos: opciones en el modelo, editar, quitar y ordenar, una transacción | modelo + API + front | CL-61…CL-69 | Alta | sí |
| [BR-19](prompts/BR-19-editor-de-encuestas.md) | Editor de encuestas en la API | API + front | CL-60, CL-70, CL-72, CL-79, CL-78 (parte encuestas) | Bloqueante | no |
| [BR-20](prompts/BR-20-consentimiento-y-accesos-del-paciente.md) | Consentimiento (M07) y accesos a la historia vistos por el paciente | front + API | CL-77, CL-78 (parte consentimiento), CV-07, CV-19 | Alta | no |
| [BR-21](prompts/BR-21-agenda-reglas-y-mostrador.md) | Agenda: horario flexible, retiro con citas vivas, walk-in, cupos, reprogramación del paciente | modelo + API + front | AG-01, AG-04, AG-05, AG-08, AG-09, AG-10, AG-11, AG-12, CV-18 | Bloqueante | sí (P36) |
| [BR-22](prompts/BR-22-notificaciones-y-tiempo-real.md) | Notificaciones y tiempo real: destinos de la campana, aviso de horario liberado, socket y chat F4 | front + API | AG-06, AG-07, AG-17, AG-19, AG-20, AG-21, AG-22, AG-29, TX-17, TX-18 | Alta | seeds |
| [BR-23](prompts/BR-23-directorios-publicos.md) | Directorios públicos: fichas de clínica y farmacia, sucursales, farmacias de turno y tendencias | modelo + API + front | AG-13, AG-14, AG-15, AG-16, AG-24, AG-25, AG-27, AG-28, AG-41, AG-42 | Alta | sí |
| [BR-24](prompts/BR-24-farmacia-sin-delivery.md) | Farmacia (sin delivery): mostrador, campañas, ficha de la empresa y fixtures | API + front | AG-32, AG-34, AG-40, CV-15, TX-26 | Alta | no |
| [BR-25](prompts/BR-25-cotizaciones-y-contabilidad.md) | Cotizaciones y contabilidad del médico | front + API | AG-35, AG-36, AG-37, AG-38, AG-39, AG-45 | Bloqueante | no |
| [BR-26](prompts/BR-26-visitadores-y-pharma-lab.md) | Visitadores médicos y laboratorio farmacéutico: modelo, DDL y pantallas | modelo + API + front | AG-30, AG-31, AG-43, CV-17 | Bloqueante | sí |
| [BR-27](prompts/BR-27-comunidad-moderacion-y-funciones-sin-ui.md) | Comunidad: apelación del sancionado y funciones de la API sin UI | API + front | AG-18, AG-23, CV-26 | Media | no |
| [BR-28](prompts/BR-28-organizacion-miembros-y-hubs-admin.md) | Organización: aprobar médicos, miembros, hubs de administración con listados y acceso delegado | front + API | CV-13, CV-14, CV-20, ID-19 | Media | no |
| [BR-29](prompts/BR-29-clinica-extendida-seguros-facturacion.md) | Clínica extendida: derivaciones, teleconsulta, cobertura de seguros, lecturas de facturación y perioperatorio | front (+API) | CV-10, CV-11, CV-12, CV-23 | Alta | no |
| [BR-30](prompts/BR-30-contrato-ci-e2e-y-observabilidad.md) | Contrato y calidad: OpenAPI regenerado, tipos generados, CI, suite real con SSR, N+1, request-id y docs | front + API | TX-14, TX-23, TX-24, TX-25, TX-27, CV-21, CV-25, AG-44 | Alta | no |

---

## 7. Orden de ejecución: tres olas, sin que nadie espere a otro

La regla es que **nadie espere a que otro termine**: primero va el contrato y el mock, y cada
prompt se puede mergear solo.

**Ola 1: destrabar la demo contra la API real (paralelo total)**
- API: BR-07 (mergear #453 y completar), BR-06 (roles), BR-25 (cotizaciones), BR-19 (encuestas),
  BR-05 (archivos).
- Front: BR-02 (mock honesto), BR-01 (build real), BR-03 (enrutado).
- Modelo: BR-11 y BR-12 (columnas y tablas nuevas), BR-26 (`pharma_lab`).

**Ola 2: cerrar el propósito central y la agenda**
- BR-15 (historia del paciente + PDF oficial), BR-17 (liberación de resultados), BR-13 (notas
  firmadas y liberadas), BR-10 (receta), BR-21 (agenda), BR-09 (altas de laboratorio y
  hospital), BR-04 (sesión).

**Ola 3: completar la cobertura**
- BR-18, BR-20, BR-22, BR-23, BR-24, BR-14, BR-16, BR-08, BR-27, BR-28, BR-29.

**En todas las olas:** BR-30 (CI, OpenAPI y suite real). Sin CI, cada ola vuelve a abrir las
brechas de la anterior.

**Dependencias blandas.** Todas se pueden empezar en paralelo si el front trabaja contra el mock
con el contrato ya acordado:
- BR-15 lee lo que BR-13 libera.
- BR-17 necesita BR-05 para que el paciente baje el PDF.
- BR-09 necesita BR-06 (el dueño del laboratorio necesita un rol).
- BR-02 destapa las rutas que resuelven BR-07, BR-11, BR-12, BR-18, BR-19 y BR-23.

---

## 8. Decisiones que necesitan dueño

Ningún prompt las puede resolver solo. Cada prompt afectado arranca pidiendo la decisión en el
plan.

| # | Decisión | Prompt | Por qué bloquea |
|---|---|---|---|
| D-A | «Horario flexible»: ¿un bloque con capacidad, o un pedido de hora que el médico confirma? | BR-21 (AG-01, P36) | No hay columna en el modelo. El mock inventa `floor(dur/15)` |
| D-B | «Aspectos médicos» del paciente: ¿tabla propia, `health_context`, o `forms`? | BR-12 (CL-04) | La ruta no existe y el modelo no tiene dónde guardarlo |
| D-C | Triage IA: ¿qué servicio atiende `/v1/triage/analyze`, con qué base legal y dónde corre? | BR-03 (TX-08, CL-75) | Hoy manda texto clínico sin autenticación a `https://ai.173.249.39.237.sslip.io`, y el dictado va a Google |
| D-D | Opciones de los campos de elección en `forms`: ¿value sets por campo o una tabla de opciones? | BR-18 (CL-63) | El modelo usa `value_set_id`, y el front manda `options[]` libres |
| D-E | Liberación de informes: ¿`/clinical/diagnostic-reports/:id/release` o el camino de `diagnostics`? | BR-17 (CL-46) | Hoy son dos caminos y sólo uno llega a «Mis resultados» |
| D-F | Farmacias 24 h y de turno (P34): ¿dato del modelo o calendario externo? | BR-23 (AG-25, AG-41) | `openNow` no lo calcula nadie |
| D-G | Mostrador del médico: ¿reserva por la vía hold (sumar `PRACTITIONER`) o por `appointments/direct`? | BR-21 / BR-06 (AG-03) | Hoy le da 403 |
| D-H | Rama fuente del despliegue real: ¿`dev` absorbe los 80 commits de `mockup`, o se crea una rama de lanzamiento? | BR-01 (TX-01) | Ninguna rama construye hoy contra la API |
| D-I | Sesión: ¿encender la cookie httpOnly del refresh (`AUTH_REFRESH_COOKIE_ENABLED`)? | BR-04 (TX-10) | La API ya la soporta. Si se enciende sin tocar el front, la sesión se pierde al recargar |

---

## 9. Advertencias para quien ejecute

1. **PR #453 de la API está abierto** (`justin/medical-module-execution-20260924`, «completar
   credenciales médicas y serializar agenda»). Tiene 18 commits por delante de `dev`, ninguno
   por detrás, y está `MERGEABLE` pero sin revisión.
   - **Cierra** ID-01 a ID-06 y, de ID-09, sólo el `fileId` del diploma.
   - **Deja parcial** ID-12.
   - **No cierra** ID-07, ID-08, ID-13 ni ID-14.
   - **Trae trabajo de otros frentes:**
     - vuelve obligatorios la CI y el departamento emisor (`09af2caf`);
     - lock de agenda y walk-ins aislados por tenant → BR-21;
     - autorización de teleconsulta → BR-29;
     - siembra de `SCHEDULING_ADMIN` y `SCHEDULING_AGENT` → parte de BR-06.
   - Su evidencia de integración corrió con `ORM_SCHEMA_SYNC=safe` y hay que repetirla con
     `off`.

   **No rehacer ese trabajo:** BR-07 arranca revisándolo y mergeándolo, y BR-06, BR-21 y
   BR-29 parten de lo que ese PR ya hace. Además tocan los mismos archivos: los PR del front
   #624, #625 y #627 (`practitioner-profile-edit.ts`, igual que BR-07) y el PR #454 de la API
   (`iam-patient-self-registration.service.ts`, igual que BR-08).
2. **El `CLAUDE.md` de la raíz del workspace está desactualizado en tres puntos:**
   - dice que `database/` de la API se eliminó (volvió como copia versionada, ver §4.5);
   - dice que el modelo está en `Mantra Core Health Context/` de la raíz (está en
     `mantra-core-health-model/`);
   - llama `mantra-core-health-api/` a la carpeta de la API (el clon de trabajo es
     `mantra-core-health-redesa-api/`; los dos apuntan al mismo remoto).
3. **`openapi/openapi.json` de la API está viejo** (19/09) y el front escribe sus tipos a mano
   (TX-23). No usarlo como verdad hasta que BR-30 lo regenere.
4. **Hay pendientes previos que ya están cerrados** y no hay que rehacerlos (detalle en cada
   anexo):
   - P11, P12, P14 (modelo), P15, P17, P19, P20, P22 (vía walk-in), P27.
   - Las subtareas 1.3, 1.4 y la 1.5 del lado de la API.
   - B-9, B-13, R-7/B-7, F-34, y las fases 1–5 del plan de evoluciones.
   - Del REGISTRO-DEFECTOS: A-02 y A-03 (hold y disponibilidad en el pasado) y A-04 (grupo sin
     dueño).
   - **P18 (`GET /charts/notes`) está cerrado en la API desde `f361b42f`**, pero el front
     sigue estimando las evoluciones por fecha (CL-23).
5. **Siguen abiertos**, y cada uno está asignado a un prompt:
   - P23 → BR-21; P24 → BR-10; P25 y P26 → BR-11; P28 → BR-07; P29 (lectura) → BR-07.
   - P30, P31, P37 y P38 → BR-23; P34 → BR-23; P36 → BR-21.
   - La subtarea 1.6 → BR-08.
   - `docs/pendientes-backend-formularios.md` → BR-18 (**dice que `options` «se ignora», y es
     falso: da 400**).
   - `docs/pendientes-backend-surveys.md` → BR-19.
6. **El mock miente en al menos 12 puntos concretos.** Están listados en BR-02. Un recorrido
   verde en `mockup` **no es evidencia de nada** contra la API.
7. **Las pruebas no reemplazan al runtime.** Los specs del front fabrican la respuesta, y los de
   la API instancian el controlador a mano. Cada prompt pide la verificación contra la API viva:
   `UI → request → response → persistencia → recarga → UI`.

---

## 10. Correcciones a los anexos y hallazgos nuevos (salieron al redactar los prompts)

Quien redactó cada prompt volvió a verificar en el código la evidencia de los anexos. Donde un
anexo y un prompt no coinciden, **manda el prompt**. Lo que sigue queda registrado para que nadie
ejecute sobre un dato viejo.

### 10.1 Hallazgos nuevos, que no estaban en ningún anexo

| # | Hallazgo | Evidencia | Va en |
|---|---|---|---|
| N-01 | **IDOR:** `GET /common/files/links` no recibe al actor y no tiene `@Roles` ni guard. Cualquier sesión lista los adjuntos de cualquier condición o procedimiento. Sumar tipos clínicos (P25) agranda el agujero | `common-files.controller.ts:106-111` | BR-11 |
| N-02 | `POST /cds/evaluate` está abierto sin `@Roles`, igual que `check-interactions` | `cds.controller.ts:78` | BR-14 |
| N-03 | El motivo del cambio de estado de una condición (dato de salud) se escribe en texto plano en el log | `conditions.service.ts:338` | BR-14 |
| N-04 | Ninguna lectura clínica escribe en `audit.data_access_log`; sólo el break-the-glass. `chart.patient_timeline_view` está en el `.puml` y no se genera | `authz-clinical.service.ts:198` | BR-15 |
| N-05 | Abrir al paciente el PDF oficial del encuentro tal como está expondría borradores y documentos «solo para el profesional» (usa `currentVersionId` y todos los documentos) | `encounter-pdf.service.ts:335-347` | BR-15 |
| N-06 | `billing.quotations` no tiene `tenant_id`, así que ninguna RLS por tenant la cubre. Además hay un N+1 de cuotas en `listQuotationsByPatient` | modelo + `quotations` service | BR-25 |
| N-07 | `verify-clean-init.sh` deja pasar como «heredada» cualquier `tabla-ausente`, sin distinguir `pharma_lab` ni `polyglot_storage` | `scripts/db/verify-clean-init.sh:261-264` | BR-26 |
| N-08 | Borrar una matrícula puede fallar con 23503: `audit.jurisdiction_authorizations_history` tiene una FK sin `ON DELETE` | modelo módulo 10 | BR-07 |
| N-09 | La RLS por `custodian_tenant_id` (patch v4219) choca con una declaración del paciente, que no pertenece a ningún tenant | patch v4219 | BR-12 |
| N-10 | Imagenología pide 7 adjuntos en el alta y el DTO tiene lugar para 6: radioprotección no tiene dónde ir. La provisión ignora en silencio una modalidad desconocida | `register-imaging-center.ts`, DTO de alta | BR-09 |
| N-11 | El alta pública con `tenantType: HOSPITAL` crea sólo el tenant, sin la parte de `orgext`, y `orgext` no tiene ningún GET | `organization_extensions` | BR-09 |
| N-12 | La médica demo del mock tiene roles que la API no le da: `['PRACTITIONER','CLINICIAN','SCHEDULING_ADMIN']` contra sólo `PRACTITIONER`. Aunque el mock controlara roles, igual pasaría el check-in y la reserva de mostrador. Además, su token dura 8 h y el de la API 15 min | `mock-session.ts:89` | BR-02, BR-06 |

### 10.2 Correcciones a lo que dicen los anexos

- **CL-18** está desactualizado. `GET /charts/notes` (`chart-notes.controller.ts:73`, commit
  `f361b42f`) y el `encounterId` de la reserva (`scheduling-read.dto.ts:303`) ya existen en `dev`.
  Lo que queda es CL-23: el front sigue estimando las evoluciones por fecha.
- **CL-55:** el tipo TS de `operativeSteps` sí declara `description`. El defecto es que
  `@ApiProperty({isArray:true})` no lleva `type`, así que OpenAPI no describe los ítems.
- **CL-77:** no es cierto que `consent` tenga «cero GET»: existe
  `GET /consent/practitioner-access-requests/mine` (rol PATIENT). Lo que no existe es ninguna
  lectura de consentimientos, autorizaciones ni objeciones.
- **CL-48:** para el paciente no sirve `GET /authz/care-relationships`, porque exige `CLINICIAN`
  o `SECURITY_ADMIN`. Hace falta una lectura nueva.
- **CV-19:** el paciente tampoco puede revocar sus relaciones asistenciales (el revoke es
  `CLINICIAN`/`SECURITY_ADMIN`). `CLINICAL_APPROVER` está sembrado, pero no se le asigna a nadie
  (sin confirmar).
- **CV-12:** `billing` no tiene ningún GET de facturas ni de estados de cuenta. Para las
  «lecturas» de BR-29 hay que crear las rutas.
- **CV-11 y CV-10:** no hay GET de cobertura ni de teleconsulta con rol de paciente. En
  `claims.controller`, `@Roles()` vacío significa «sin rol exigido» (`roles.guard.ts:30`).
- **CV-13:** el hub de verificación de identidad sí tiene lectura (`case-queue.ts` →
  `GET /identity/verification-cases`).
- **CV-14:** hay dos caminos para que el médico pida entrar a una organización:
  - La afiliación por tenant ya tiene UI de aprobar y rechazar; le falta revocar.
  - La asignación de práctica (`self-request`) no tiene GET de pendientes.
- **CV-15:** `GET /pharmacy/orders/:id` sí tiene UI (`order-detail.ts`, `inbox-order.ts`). El
  inventario no la vio porque la URL se arma con `orderUrl(id)`.
- **CV-20:** la matrícula ya se verifica por un caso de `identity_assurance`. Lo que falta es la
  cola filtrada, y sobre todo la **cola de títulos**, porque no hay GET de credenciales
  pendientes.
- **AG-31:** `MEDICAL_VISITOR` y `PHARMA_LAB_ADMIN` **sí se siembran** en `authz.roles`
  (`pharma_lab.roles.ts`, `authz-clinical-roles-seed.service.ts`). Lo que falta es que alguien
  **asigne** el rol.
- **AG-30:** hoy son **12 controladores y 76 rutas** de `pharma_lab` (el «47» es la cifra del
  18/08). Los conceptos `PHL_*` los siembra la app al arrancar, así que **no** van también en
  `gen_seeds.py`.
- **AG-06 / AG-21:** el enum de destinos del contrato de notificaciones
  (`notifications.contract.ts:80-110`) no incluye los `scheduling.*` que emite la agenda. En la
  API conviven tres vocabularios de destino.
- **P28 (ID-13):** `persons.sex_at_birth_concept_id` e
  `identifiers.issuer_administrative_area_concept_id` ya existen. BR-07 no toca el modelo salvo
  que se decida un trámite de corrección de CI.
- **ID-10:** los conceptos `COUNTRY_*` existen en el código, pero el value set `VS_COUNTRY` no
  aparece ni en la API ni en el modelo. La subtarea 1.6 quedó en parte superada:
  `credentials[]` ya hace de `academicTitles[]`. BR-08 indica no ejecutarla tal como está
  escrita.
- **ID-16:** el índice único de afiliaciones no impide fechas superpuestas. El 409 sólo sale con
  el mismo cargo y la misma fecha de inicio.
- **BR-10 sí toca el modelo:** P24 necesita `medication_requests.indication_text`. **BR-14
  puede tocarlo:** CL-10 necesitaría `conditions.status_reason_text` si se elige esa opción. La
  tabla del §6 se corrigió.
- **CL-33:** las barreras WORM salen de la matriz de `diagram_33_integrity.puml`, no de los
  estereotipos del módulo 15. Prohibir todo UPDATE en `clinical_note_versions` rompería
  `signVersion`. BR-13 lo plantea como decisión.
- **TX-24:** el CI de la API ya corre `test:integration --ci` completo (`docs.yml:389`), no sólo
  `postgres-privileges`: el `CLAUDE.md` de la raíz está viejo también en esto. El CI del front
  no corre `check-client-prefixes` ni `check-real-api-config`.
- **TX-19:** el almacenamiento Redis del límite de tasa ya está cableado (`app.module.ts:258`).
  El límite sigue contando por IP.
- **TX-33:** la descarga directa `:id/content` sí entrega versiones pendientes de escaneo. Lo
  que exige el escaneo limpio es emitir la URL firmada y `downloadPublicMedia`. Ese 422 no trae
  `details.reason`. Además, `worker-files` no está en `docker-compose.coolify.yml`.
- **Roles con dos dueños:** `authz.roles` lo siembra la app, y también el paquete del modelo
  (`seedsGenerales/modules/06_authz.seeds.json`), con códigos distintos (`PHARMACIST`,
  `BILLING_OPERATOR`, `PLATFORM_ADMIN`). BR-06 tiene que dejar un solo dueño.
- **Modalidades de imagen:** el front sólo ofrece XRAY y ULTRASOUND. La API ya declara además CT,
  MRI, MAMMOGRAPHY y BONE_DENSITOMETRY (sembradas: sin confirmar).
- **`docs/pendientes-backend-formularios.md`** tiene dos errores:
  - ubica `value_set_id` en `field_assignments`, y está en `dynamic_field_definitions`;
  - dice que `options` «se ignora», y en realidad da 400.

### 10.3 Coordinación entre prompts

- **Reglas propias de la API.** El repo trae `.claude/rules/`: todo trabajo necesita
  `docs/trabajo/<fecha>-<slug>/PLAN.md` y `REPORTE.md`, y un hook bloquea escribir código sin el
  plan. Los prompts de API lo incluyen en sus Reglas.
- **Specs de módulo compartidos.** `clinical.module.spec.ts` lo tocan BR-11 y BR-12, y
  `chart.module.spec.ts` lo tocan BR-13 y BR-15. Van como `[CREAR o MODIFICAR]`: el segundo que
  llegue suma su caso.
- **Número de diagrama.** El siguiente libre es `diagram_67`. Lo proponen AG-44 (`data_catalog`)
  y BR-26 (`pharma_lab`): hay que acordarlo antes de que dos PR choquen.
- **`yarn db:vendor`** usa `rsync`, así que en Windows corre en WSL.
- **Ruta de la bóveda.** `salud-db/paths.py` espera `<workspace>/Mantra Core Health Vault/SALUD`,
  y en esta máquina está en `mantra_core_technologies_health_docs/SALUD` (sin confirmar cuál es
  la vigente).
- **Maquetas HTML.** Sólo existen para V02–V06 y V65. Para el resto, los prompts remiten al
  `Vistas.md` de la vista.

## 11. Cómo se regeneran los inventarios

Desde la raíz del workspace, con los dos repos al día:

```bash
node mantra-core-health/docs/brechas-front-back-2026-09-24/inventarios/extraer-rutas-api.js \
     mantra-core-health-redesa-api <carpeta-salida>          # api-routes.json
node .../inventarios/cruzar-llamadas-front.js mantra-core-health <carpeta-salida>   # client-calls.json
node .../inventarios/cruzar-mock.js           mantra-core-health <carpeta-salida>   # mock-missing.json + api-unused.json
(cd mantra-core-health-redesa-api && node ../.../inventarios/controladores-sin-registrar.js)
```

**Limitaciones conocidas del cruce:**
- No resuelve rutas armadas en variables ni con ayudantes (`getPage(`, `orderUrl(id)`, concatenación con `+`). Por eso se le escaparon 3 llamadas de `public-catalog` y dio un falso positivo en `community/conversations/:id`.
- No desescapa `\:`: `checks:plan` sale como falso negativo, pero **existe**.
- Puede emparejar `/search` con `/:id`. En la API las literales se declaran antes, así que no
  hay choque real.

Cuando BR-02 esté hecho, este cruce debería correr en el CI del front y fallar si la lista de
operaciones sin ruta crece.
