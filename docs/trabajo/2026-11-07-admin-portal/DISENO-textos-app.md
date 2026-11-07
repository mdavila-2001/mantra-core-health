# Diseño — Textos de la app editables sin otro build (móvil Flutter y web)

- Fecha: 2026-11-07 · Sesión F · Responsable: Ender · Rama: `feat/admin-f-diseno-textos`
- Alcance: **solo diseño**. Cero código, cero migraciones. Repos leídos: `mantra-core-health` (front), `mantra-core-health-api`, `mantra-core-health-model`.
- Pregunta: ¿cómo cambiar un texto de la app sin un nuevo build de Apple (≈3 días de aprobación)? Caso del cliente: retirar un texto que una norma prohíbe, cambiándolo en la base de datos.
- Convención de estados: **LEÍDO** = lo vi en código/modelo el 2026-11-07, no lo ejecuté · **NO VERIFICADO** = no lo leí ni lo probé · **DECISIÓN** = la toma una persona.

## 1. Veredicto corto

1. Hoy **no se puede**: no hay tabla, endpoint ni pantalla de textos de UI editables (LEÍDO en las tres capas, coincide con el hallazgo previo).
2. La reutilización de `ui_visibility` + localizaciones (opción a) **no cubre el caso del cliente tal cual** y fuerza a estirar un vocabulario cerrado. Recomiendo la opción **(b) tabla nueva `ui_text`**, **tomando prestado** de (a) lo que ya funciona: el patrón de catálogo sincronizado desde el código, el rol `SECURITY_ADMIN`, la regla anti-bloqueo, el `FK` a idioma de `field_definition_localizations` y el motor de aprobación `four_eyes_requests`.
3. Lo difícil **no es la tabla**: es **migrar los textos actuales a claves**. Hay 1 051 plantillas `.html` y 290 archivos `.ts` con `template:` en `src/app` (LEÍDO por conteo); en la app móvil el número es **NO VERIFICADO** (no está en este checkout). Un texto que nadie envolvió en una clave **sigue necesitando build**. Por eso la entrega correcta es por **superficies de riesgo**, no «toda la app».
4. Un mecanismo de textos remotos **no sustituye** el build para el contenido regulado que ya está en otro lado (listing de las tiendas, notificaciones push, plantillas de mensajes, PDFs, textos del API). Ver §3.

## 2. Qué existe hoy y por qué no alcanza (todo LEÍDO)

| Pieza | Qué es | Por qué no resuelve |
|---|---|---|
| `authz.ui_visibility_elements` (`label` ≤200, `description` ≤500) | Catálogo de elementos con `kind` en CHECK cerrado: `MODULE, MENU_SECTION, SCREEN, SECTION, WIDGET, FIELD, ACTION` | `label` es el nombre **para el administrador**, no el texto que ve la persona. No hay tipo para un toast, un error o un párrafo legal |
| `authz.ui_visibility_rules` | Regla `SHOW/HIDE` por sujeto `USER>TENANT>ROLE>ORG_TYPE>ALL`; `GET /me/ui-visibility` devuelve `{hiddenKeys, version, generatedAt}` | Decide **si** se muestra, no **qué dice**. Devuelve solo lo oculto: no hay forma de transportar un valor |
| `forms.field_definition_localizations` | `label, help_text, placeholder, validation_message` por `(field_id, language_concept_id)` | Solo campos de formularios dinámicos; no la UI fija |
| `messaging.message_templates` | Mensajes **salientes** por canal | No es texto de pantalla |
| `directory.tenant_web_configs` | `theme_json`, `locale`, `supported_languages_json` | Aspecto e idioma del sitio de la organización, no textos |
| `terminology.concept_designations`, `content_packs` | Designaciones de conceptos y siembras | No se editan en runtime |
| Front `src/app/core/i18n/` | Diccionarios **en código** (`es/en/pt`) para tipos societarios y documentos legales; `uiLanguage` es un `signal('es')` que nadie muta; `LOCALE_ID` fijo `es-BO` | Es empaquetado: cambiarlo = build. Sirve de **modelo de fallback** |

Piezas que **sí** conviene reutilizar (LEÍDO):

- **Catálogo sincronizado desde el código**: `declareUiElements` + `POST /admin/ui-visibility/elements/sync`, idempotente por `key`, retira los `CODE` ausentes, tope 2 000.
- **Política de fallo abierto** de `UiVisibilityService`: si el pedido falla, se muestra lo de siempre. Para textos el equivalente natural es «si falla, texto empaquetado».
- **Protección anti-bloqueo** (`UI_PROTECTED_KEY_PREFIXES`): el mismo razonamiento aplica a textos que no se pueden vaciar.
- **Motor de aprobación** `delegated_access.four_eyes_requests` (patch `2026-10-31_v4281_motor_aprobacion.sql`): `kind_concept_id` es FK a concepto, sin CHECK de tipo; agregar un `kind` es sembrar un concepto. Tiene `payload_json`, `payload_hash`, `expires_at`, `decided_by_user_id`, `subject_entity/subject_id`.
- **Historial por tabla**: el módulo 10 declara 132 tablas `<<HISTORY>>` (p. ej. `message_templates_history` con `revision_no, data_snapshot, changed_by_user_id, change_reason_concept_id`). Las tablas `ui_visibility_*` **no** tienen historial hoy (LEÍDO por grep en `diagram_10_audit.puml`).

## 3. Lo que un mecanismo de textos NO cubre (importante para el caso del cliente)

Un texto prohibido puede estar en varios sitios. Solo algunos se corrigen en la base de datos:

| Dónde vive el texto | ¿Se arregla con esto? |
|---|---|
| Pantallas web y móvil envueltas en una clave | Sí |
| Pantallas **no** envueltas todavía | No: build (web) o build + revisión (móvil) |
| Ficha de App Store / Google Play, capturas | No: se edita en las tiendas (la ficha se revisa aparte) |
| Push y correos (`message_templates`) | Ya es dato en BD, pero es otro camino y otra pantalla |
| Mensajes de error que devuelve el API | No, salvo que el front los mapee por código a una clave |
| Texto dentro de imágenes o PDFs | No |
| Caché del navegador / HTML renderizado en SSR / CDN | Hay que definir invalidación (§6) |

**Para urgencia legal** ya existe un freno que no requiere esta construcción: ocultar el elemento con una regla `HIDE` en `ui_visibility` (LEÍDO que el motor existe). Es **NO VERIFICADO** que la app Flutter consuma `GET /me/ui-visibility` y que el texto en cuestión tenga clave en el catálogo. Eso es lo primero que habría que comprobar para tener un «botón rojo» hoy.

## 4. Comparación (a) vs (b)

### (a) Reutilizar `ui_visibility` + localizaciones

Idea: añadir una tabla `ui_element_localizations(element_id, language_concept_id, text)` modelada sobre `field_definition_localizations`, colgada de `ui_visibility_elements`.

- A favor: catálogo, sincronización, pantallas del portal (`admin/portal/visibility`) y RBAC ya existen; una sola clave para «mostrar/ocultar/qué dice».
- En contra:
  1. El CHECK de `kind` es cerrado: textos de toast, error o legal exigen **cambiar un CHECK** del modelo para meter algo que no es un elemento visible.
  2. El resolver y `GET /me/ui-visibility` están hechos para devolver **solo ocultos** (diferencia calculada, sujeto → regla). Meter valores rompe esa forma de contrato; habría que crear un segundo endpoint de todos modos.
  3. `label` ya significa «nombre para el administrador»; reusar la palabra para el texto visible mezclaría dos significados.
  4. El ciclo de vida difiere: una regla de visibilidad es inmediata y por sujeto; un texto necesita borrador → revisión → publicación → versión.
  5. Acopla riesgo: un error en textos podría afectar el motor que **gobierna** las pantallas de administración.
- Esfuerzo menor en tablas, pero el cambio de CHECK y el segundo endpoint se llevan la ventaja.

### (b) Tabla nueva `ui_text`

- A favor: ciclo de vida propio (estados, versiones, aprobación), contrato propio, sin tocar el motor de visibilidad, sirve a pantallas no catalogadas como elementos.
- En contra: tablas, endpoints y pantalla nuevos; un registro de claves más que mantener.
- Mitigación: copiar de (a) el sincronizador de catálogo y la pantalla-lista, para no reinventar.

**Recomendación: (b)**, con las piezas prestadas de §2.

## 5. Modelo de datos propuesto (esquema `ui_text`, módulo nuevo del modelo)

Nombres son propuesta; el generador DDL del modelo manda al implementar.

- `ui_text_keys` — catálogo sincronizado desde el código. `id`, `key` (mismo patrón `^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$` y tope 160 que `ui_visibility_elements`), `app` (`WEB|MOBILE|BOTH`), `surface` (`PUBLIC|AUTH`), `risk_class` (`LOW|REGULATED`), `default_text_es`, `placeholders_json` (nombres permitidos, p. ej. `{name}`), `max_length`, `source` (`CODE|ADMIN`), `status` (`ACTIVE|RETIRED`), auditoría estándar y `row_version`.
- `ui_text_values` — una fila por `(key_id, language_concept_id, tenant_id NULL)` publicada. Si se acepta alcance por organización: `tenant_id` nullable (NULL = plataforma). `text`, `version_no`, `status` (`DRAFT|PENDING_APPROVAL|PUBLISHED|SUPERSEDED|WITHDRAWN`), `valid_from`, `reason` obligatorio (mismo mínimo 10 / máx 500 que reglas), `four_eyes_request_id` nullable, `published_by_user_id`, `published_at`. Única parcial: un solo `PUBLISHED` por `(key, idioma, tenant)`.
- `ui_text_values_history` — siguiendo el patrón `*_history` del módulo 10 (`revision_no, data_snapshot, changed_by_user_id, change_reason`).
- `ui_text_bundle_versions` — contador monotónico por `(app, idioma, tenant)`; cada publicación incrementa. Es lo que usan ETag y la caché del cliente.
- Concepto nuevo `delegated_access:FOUR_EYES_KIND_UI_TEXT_CHANGE` (sembrar, sin DDL — mecanismo LEÍDO en el patch v4281).
- Vocabularios cerrados como CHECK, igual que `ui_visibility` (decisión previa del módulo: no sembrar en `catalog_concepts`).

Reglas de integridad: `key` debe existir y estar `ACTIVE`; el texto debe conservar exactamente los `placeholders_json` (ni más ni menos); `length ≤ max_length`; sin HTML ni markup (solo texto plano, ver §10).

## 6. Endpoints (API, módulo nuevo `ui_text`)

| Ruta | Acceso | Qué hace |
|---|---|---|
| `GET /ui-texts?app=&lang=` | Pública o autenticada (**DECISIÓN D4**) | Paquete `{ version, lang, texts: { key: string } }`. Solo **overrides** publicados, no los defaults |
| `GET /admin/ui-texts/keys` · `POST …/keys/sync` | `SECURITY_ADMIN`/`SUPERADMIN` | Catálogo; sincroniza desde el código (idempotente, lote vacío = 422) |
| `GET /admin/ui-texts/values?key=` | ídem | Versiones de una clave |
| `POST /admin/ui-texts/values` | rol editor (**D3**) | Crea borrador (201) |
| `PATCH /admin/ui-texts/values/:id` | ídem | `If-Match: <row_version>` (409 si cambió), solo en `DRAFT` |
| `POST /admin/ui-texts/values/:id/submit` | ídem | Pasa a `PENDING_APPROVAL` y abre `four_eyes_request` |
| `POST /admin/ui-texts/values/:id/publish` · `/withdraw` | aprobador | Publica o retira; retirar = vuelve al texto empaquetado |
| `GET /admin/ui-texts/preview?lang=&draftId=` | editor | Muestra el texto con placeholders resueltos de ejemplo |

Caché y consumo:
- `ETag` = `version` del paquete; `Cache-Control: max-age` corto (valor **DECISIÓN D8**) + `If-None-Match` → 304. **NO VERIFICADO** si el API tiene soporte reutilizable de ETag: el grep de `etag|cache-control` encuentra menciones en `src/common/http` y en muchos controllers, pero no leí ninguna.
- Si es pública, no devuelve nada de pacientes ni de usuarios: solo claves y cadenas. Debe pasar una prueba de «sin PII».
- SSR del front: el HTML renderizado puede quedar cacheado en CDN con el texto viejo; hay que definir qué se purga al publicar (**NO VERIFICADO** cómo se despliega/cachea el SSR; `angular.json` tiene `ssr` configurado).

## 7. Consumo en las apps y fallback

Principio: **el texto empaquetado siempre existe** y es el fallback. El servidor solo guarda **diferencias**.

- Cada app resuelve `t('key')` → override local si lo hay → texto empaquetado. Nunca falla ni queda en blanco.
- Arranque: usa la última copia guardada (almacenamiento local) sin esperar red; refresca en segundo plano; aplica en la **siguiente** pantalla/arranque (no a mitad de un formulario) salvo orden de retiro urgente (D7).
- Fallo de red o respuesta inválida: se conserva la copia previa; si no hay, empaquetado. Mismo criterio «abierto» que `UiVisibilityService`.
- Validación en el cliente: si el override pierde un placeholder o supera `max_length`, **se descarta ese texto** y se usa el empaquetado.
- Web: un servicio de textos en `core/` análogo a `UiVisibilityService`, más un pipe/directiva; encaja con el patrón `core/i18n` existente. Móvil: un equivalente en Flutter. **NO VERIFICADO**: cómo la app Flutter guarda hoy sus cadenas (si usa `gen_l10n`/ARB o literales), y si ya existe una caché local.
- Las pruebas del cliente deben simular tres cosas: sin red, paquete corrupto y placeholder faltante.

## 8. Versionado, auditoría y reversión

- Cada publicación = nueva fila `version_no` + incremento de la versión del paquete + fila en `*_history`.
- Reversión: «retirar» (vuelve al empaquetado) o «republicar versión anterior» (crea versión nueva copiando; nunca se edita la histórica).
- Auditoría mínima por cambio: quién, cuándo, valor anterior y nuevo, motivo, quién aprobó, solicitud `four_eyes` asociada. Para un texto regulado, el motivo debe poder citar la norma (campo libre; **D6** si se exige referencia).
- **NO VERIFICADO**: si el API ya escribe las tablas `*_history` por disparador o desde la aplicación; hay que leer cómo lo hace `message_templates_history` antes de copiar el patrón.

## 9. Quién edita (RBAC) y flujo de aprobación

Hoy, administrar visibilidad es `SECURITY_ADMIN` (`SUPERADMIN` por comodín) — LEÍDO. Para textos hay tres papeles, y **cuáles roles ocupan cada uno es decisión de negocio (D3)**:

| Papel | Puede | Propuesta de partida (a confirmar) |
|---|---|---|
| Redactor | Crear/editar borradores | Un rol nuevo de contenido, o `SECURITY_ADMIN` mientras tanto |
| Aprobador | Aprobar/rechazar; **no el mismo** que redactó (el motor `four_eyes` ya impone `not_self`) | `SUPERADMIN` / un rol de cumplimiento |
| Lector/auditor | Ver historial | `SECURITY_ADMIN` |

Flujo: `DRAFT → PENDING_APPROVAL → PUBLISHED`. Dos clases de clave:
- `LOW`: aprobación de un segundo ojo.
- `REGULATED` (consentimientos, avisos de salud, legales, precios): aprobación obligatoria y vista previa.
- **Camino de emergencia** (retiro urgente del texto prohibido): ¿se permite publicar de inmediato con un solo aprobador y revisión posterior? Es **DECISIÓN D5**; el diseño admite ambas, pero no la escojo yo.

Las claves protegidas (login, recuperación de contraseña, pantallas de administración de textos) **no pueden vaciarse** ni ocultarse: el mismo principio que `UI_PROTECTED_KEY_PREFIXES`.

## 10. Reglas de las tiendas — NO VERIFICADO contra el texto vigente

No consulté las guías de Apple ni de Google en esta sesión: lo siguiente es mi lectura de memoria y **una persona debe confirmarlo con el texto vigente antes de apoyarse en ello**.

- Cambiar **contenido o texto** desde un servidor es práctica común y distinta de descargar **código ejecutable** que cambie la funcionalidad (Apple App Review 2.5.2 / política de código dinámico de Google Play). Este diseño transporta solo cadenas de texto plano.
- Riesgo real: usar la vía remota para cambiar **significativamente** lo que la app hace o afirma después de la revisión (ocultar/activar funciones, afirmaciones de salud, precios, flujos de pago). Eso puede contradecir lo revisado (Apple 2.3.1 y, en salud, las secciones 1.4 / 5.1 sobre datos y afirmaciones médicas).
- Mitigaciones de diseño, sin esperar a la decisión legal: texto plano sin HTML/enlaces nuevos salvo lista blanca; `risk_class=REGULATED` con aprobación; sin claves que cambien precios, permisos o flujos; todo cambio con historial exportable por si una tienda lo pide.
- Textos que sí puede traer el binario de la tienda (permisos del sistema, `Info.plist` de iOS) **no** se editan por esta vía: se fijan en el build.

## 11. Idiomas (i18n)

- Hoy: la interfaz es `es` fijo; `uiLanguage` está declarado para `es/en/pt` pero nadie lo cambia; `LOCALE_ID = es-BO` (LEÍDO).
- Diseño: clave por `(key, language_concept_id)` con FK a concepto de idioma, igual que `field_definition_localizations` y `tenant_web_configs.primary_language_concept_id`.
- Cadena de resolución propuesta: `(tenant, idioma)` → `(plataforma, idioma)` → `default_text_es` empaquetado. No se traduce automáticamente: un idioma sin override cae al texto empaquetado de la app, que hoy es español.
- **D2** (¿se editan solo en español al inicio, o también `en`/`pt`?) es de negocio.

## 12. Migración desde los textos actuales

Se hace por franjas (`NO_BIG_BANG_REWRITE`), y siempre **sin cambiar lo que ve la persona** al comenzar: cada texto migrado queda idéntico, con una clave.

1. Inventario: contar y clasificar cadenas por riesgo. Web: 1 051 `.html` + 290 `template:` (LEÍDO por conteo; las cadenas dentro no se contaron). Móvil: NO VERIFICADO.
2. Elegir **primero** las superficies reguladas o de mayor riesgo (consentimientos, avisos legales, textos de salud, registro) — lista a cargo del cliente (**D1**).
3. Sustituir el literal por `t('clave')` con el texto original como default; el sincronizador publica el catálogo en el API.
4. Prueba de equivalencia por pantalla: con el paquete vacío, la pantalla es **igual** a la de antes (comparar capturas).
5. Los diccionarios de `core/i18n` (tipos societarios, documentos legales) se convierten en defaults de claves o se mantienen empaquetados; decidirlo al llegar a esa franja.
6. Una regla de lint/verificación que impida literales nuevos en las superficies migradas (siguiendo el estilo de los `scripts/check-*.mjs`).

## 13. Plan de pruebas

| Capa | Qué se prueba |
|---|---|
| Modelo | DDL desde el `.puml`, aplicado a BD real, deriva en verde; CHECK de estados y de placeholders |
| API (integración, BD real) | Ciclo completo borrador → aprobación → publicación → lectura; `If-Match` 409; autorización negativa (otra org, rol insuficiente, sin token); redactor ≠ aprobador; texto con placeholder faltante = 422; `GET /ui-texts` sin PII; ETag 304; reversión |
| Front web (Playwright) | Cambio en BD → recarga → la UI muestra el nuevo texto (`UI → request → response → persistencia → recarga → UI`); sin red → texto empaquetado; paquete corrupto → empaquetado; no `networkidle` |
| Móvil | Pruebas de widget con tres casos (override / sin red / inválido) + una corrida en simulador; **NO VERIFICADO** el estado de la suite Flutter |
| Equivalencia | Capturas antes/después por pantalla migrada con paquete vacío |
| Tiendas | Revisión humana de §10 con el texto oficial vigente |

## 14. Estimación honesta de esfuerzo

Son **órdenes de magnitud sin haber medido** el repo móvil ni las cadenas reales; sirven para decidir si empezar, no para comprometer fechas. Supuesto: una persona-día enfocada; no incluyen espera de revisión humana.

| Capa | (a) reutilizar | (b) tabla nueva | Notas |
|---|---|---|---|
| Modelo | 3–5 días | 5–8 días | (b) 4 tablas + historial + concepto + CHECK; (a) cambia además un CHECK existente |
| API | 8–12 días | 10–15 días | Módulo, sync, flujo de estados, `four_eyes`, ETag, pruebas de integración |
| Front web — mecanismo | 6–9 días | 6–9 días | Servicio, pipe, caché, fallback, pruebas |
| Front web — pantalla de admin | 5–8 días | 5–8 días | Lista, editor, vista previa, aprobación, historial |
| Front web — migración de cadenas | 1–2 días por cada 100 cadenas | igual | Depende del inventario (§12.1); es el costo que más crece |
| Móvil Flutter — mecanismo | 6–10 días | 6–10 días | **Muy incierto**: no leí el código; incluye caché local y pruebas |
| Móvil — migración de cadenas | similar a web | similar | Más un nuevo build **una sola vez** para incorporar el mecanismo |
| Total mecanismo + piloto (una superficie regulada) | ≈ 35–55 días | ≈ 40–65 días | Sin migrar toda la app |

Lectura: (a) ahorra unos 5–10 días, pero a costa de §4 (CHECK cerrado, contrato que no encaja). La diferencia no justifica el acoplamiento.

**Dato crítico:** el mecanismo mismo necesita **un build de Apple y de Google** para existir. Hasta entonces, el cliente no puede cambiar nada. Todo texto que aún no tenga clave en ese build seguirá dependiendo de otro build.

## 15. Riesgos

1. Falsa sensación de control: se cree que «todo es editable» y solo lo es lo migrado. Mitigación: la pantalla de administración muestra cobertura (claves migradas / total).
2. Abuso o error de edición en texto de salud o precios. Mitigación: aprobación, `REGULATED`, límites, historial.
3. Caché que mantiene el texto prohibido visible. Mitigación: versión de paquete y purga definidas (D8).
4. Rechazo de tienda por cambios materiales post-revisión (§10). Mitigación: política escrita de qué sí se cambia por esta vía.
5. Clave sin tipo o con placeholder roto en producción. Mitigación: validación en servidor **y** cliente, descarte al empaquetado.
6. Dispersión: mantener diccionarios de `core/i18n` y `ui_text` a la vez. Mitigación: decisión explícita por franja.

## 16. Recomendación

1. Primero, **comprobar** (esfuerzo bajo): si la app móvil consume `GET /me/ui-visibility` y si el texto del cliente tiene clave. Si ambas cosas son ciertas, hoy existe un freno de emergencia (ocultar el elemento) sin construir nada.
2. Construir **(b) `ui_text`** reutilizando sincronizador, `four_eyes`, historial y `FK` de idioma. No sobrecargar `ui_visibility`.
3. Entregar por fases: (F0) inventario de cadenas y respuestas a las decisiones; (F1) modelo + API; (F2) mecanismo en web y móvil con **una** superficie piloto y su build de tiendas; (F3) pantalla de administración; (F4) migración por franjas de riesgo.
4. No prometer al cliente «cambiar cualquier texto» hasta que F4 cubra su lista (D1).

`LARGO_PLAZO_O_NADA`: (b) con catálogo, aprobación y fallback sirve a largo plazo porque el costo de añadir un texto nuevo es una clave, no un build. (a) no, porque obliga a deformar un vocabulario cerrado cuyo contrato es «solo lo oculto».

## 17. Decisiones que debe tomar una persona (preguntas abiertas)

| # | Decisión | Quién decide (propuesto) |
|---|---|---|
| D1 | ¿Qué superficies/textos son el primer lote (lista del cliente)? ¿Está ya identificado el texto que prohíbe la norma, y en qué pantallas aparece? | Cliente / producto |
| D2 | ¿Idiomas al inicio: solo `es` o también `en`/`pt`? | Producto |
| D3 | ¿Qué roles redactan y cuáles aprueban? ¿Rol nuevo o `SECURITY_ADMIN`? ¿Por organización o solo plataforma? | Producto + seguridad |
| D4 | ¿El paquete es público (necesario para login/registro antes de iniciar sesión) o solo autenticado? | Seguridad |
| D5 | ¿Existe vía de emergencia con un solo aprobador y revisión posterior? ¿Quién la ejerce? | Cumplimiento / legal |
| D6 | ¿Se exige referencia a la norma en el motivo de cambio de textos regulados? | Legal |
| D7 | ¿Se aplica un retiro urgente aunque la persona esté a mitad de una pantalla? | Producto |
| D8 | Vigencia de caché (`max-age`) y qué se purga en CDN/SSR al publicar | Operaciones |
| D9 | Validación legal/compliance de §10 contra el texto vigente de Apple y Google | Legal |
| D10 | Mantener `core/i18n` como empaquetado o absorberlo en `ui_text` | Arquitectura |
| D11 | ¿Quién provee la estimación real de la app móvil (repo `mantra_core_health_mobile` no leído)? | Responsable móvil |

## 18. Lo que no verifiqué

- Código de la app Flutter (repo no presente): cómo guarda sus cadenas, su caché, si consume `/me/ui-visibility`.
- Texto vigente de las guías de Apple/Google.
- Si `src/common/http` ofrece soporte de ETag reutilizable; cómo se escriben las tablas `*_history`; cómo se cachea el SSR.
- Número real de cadenas visibles (solo conté archivos de plantilla).
- Nada se ejecutó: ni pruebas, ni build, ni migraciones. Este documento es diseño.
