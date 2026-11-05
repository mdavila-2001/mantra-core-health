# Oportunidades de marketing y comunicación de AloVida

- **Fecha:** 2026-10-31.
- **Fuentes:**
  - Recorrido completo de la app ([../recorrido-app/README.md](../recorrido-app/README.md)).
  - Lectura del backend (`mantra-core-health-api`), de la app móvil y de `AlovidaAIService`.
  - [`.agents/product-marketing.md`](../../.agents/product-marketing.md).
- **Qué es y qué no es.** Inventario de lo que **ya existe** y de cómo usarlo para crecer.
  No es un plan aprobado.
- **Reglas de la casa** ([README.md](README.md)):
  - Sin cifras, testimonios ni precios inventados.
  - Sin datos de salud en segmentos, anuncios ni eventos.
  - Sin promesas clínicas.
  - Revisión legal antes de publicar publicidad de salud.
  - Todo lo marcado **POR CONFIRMAR** necesita una persona del negocio.

## Resumen: las 10 oportunidades con mejor relación impacto/esfuerzo

| # | Oportunidad | Por qué ahora | Qué ya existe | Qué falta | Esfuerzo |
|---|---|---|---|---|---|
| 1 | **SEO de búsquedas de salud locales**: páginas «dónde conseguir X en Santa Cruz», «cardiólogos en La Paz», «laboratorios con perfil lipídico en Cochabamba» | Es la intención de búsqueda más alta del público, y el buscador ya responde exactamente eso | `/search/*` y perfiles `/p` `/o` `/f` `/l` `/s` con **SSR**, `og:*` y JSON-LD | `sitemap.xml`, `robots.txt`, URLs indexables por ciudad y especialidad, y SSR para directorios y fichas (hoy solo cliente) | Medio |
| 2 | **Loop de reseñas**: encuesta post-consulta → «Dejar reseña pública» → la ficha del profesional sube en «Doctores en tendencia» | El circuito ya está armado de punta a punta en la UI | Encuestas con base CAHPS (`surveys`), reseñas (`community`), ranking en tendencia | Recordatorio de la encuesta (correo o push), métrica del embudo encuesta→reseña, y corregir el «★ 0 · 78 reseñas» (H-06) | Bajo |
| 3 | **Médicos como canal de adquisición de pacientes**: QR y enlace corto `/p/<slug>` del consultorio para «Pida su cita» | Cada profesional verificado trae a sus pacientes. El copy existente ya lo apoya («la cuenta hace falta para pedir cita, seguir a…») | Perfil público SSR, agenda con cupos, reserva como solicitud | Kit imprimible (QR y afiche) generado desde «Mi perfil», con enlace rastreado `/r/:code` (API `marketing`) | Bajo–medio |
| 4 | **Campañas preventivas aseguradora × laboratorio** como producto B2B pagado | Ya hay pantalla, estados y bonificación. Es valor medible para la aseguradora («no eroga por lo evitable») | `/administration/insurance-campaigns` (Activa, Borrador, Pausada, Vencida, con bonificación %) | Aviso al afiliado elegible (in-app o correo) con consentimiento. Hoy la campaña no le llega a nadie | Medio |
| 5 | **Vitrina de medicamentos y promociones de farmacia** | Mensaje diferencial ya escrito: «AloVida no vende medicamentos ni cobra comisión sobre estos precios» | `/search/medications` (precio «desde Bs», stock, distancia), `/my-account/promotions` por departamento, campañas de farmacia (Precio, Cantidad, Total, Combos, Puntos), puntos de fidelización | Persistencia de campañas de farmacia (hoy «DEMO… todavía no hay dónde guardarlas»), revisión regulatoria de promoción de medicamentos, y no promocionar los de venta con receta | Medio |
| 6 | **Landing B2B `/home` → embudo de ventas** | Ya existe la landing con CTA «Solicitar acceso» y el relato «siete momentos, un mismo hilo» | `/home`, módulo `crm` (leads → calificar → convertir, oportunidades) | Conectar «Solicitar acceso» con un lead del CRM, medirlo, y rotular como ilustrativas las cifras de la maqueta (H-17) | Bajo |
| 7 | **Orientación por síntomas como puerta de entrada** («¿A quién consulto?») | Sin cuenta y sin turno: responde una duda muy buscada y termina en «puede pedir la cita» | `/search/symptoms` (mapa corporal y texto libre) + `AlovidaAIService` (36 especialidades, alarma → emergencia) | Páginas indexables por síntoma o especialidad con contenido revisado por un médico. Medir síntoma→especialidad→registro **sin guardar el síntoma** | Medio |
| 8 | **Contenido de profesionales y comunidades** | Los médicos ya pueden publicar artículos firmados y hay grupos temáticos. Es contenido de autoridad gratuito | Artículos médicos (`/my-account/articles`), red social `/posts`, grupos y foros, glosario clínico | Moderación y revisión de afirmaciones clínicas, artículos públicos indexables, y una cadencia editorial | Medio |
| 9 | **Notificaciones de ciclo de vida** (cita, resultado listo, pedido, receta por renovar) | Son los mensajes que más se abren y no son «publicidad» | `messaging`: in-app, correo (Gmail API), **web push con VAPID**, preferencias por canal y categoría, horas de silencio. Tiene `public/push-sw.js` | Configurar VAPID y correo en producción. Plantillas sin datos clínicos en el texto («Tiene un resultado nuevo», no el estudio) | Bajo–medio |
| 10 | **Medición con consentimiento** | No se puede mejorar lo que no se mide, y la base ya está hecha | `telemetry` (embudos, sesiones, conversión, consentimiento por propósito con `permits_marketing_use`), pantalla `/superadmin/web-analytics`, adaptador GA4 apagado | Captura de UTM (hoy no hay ninguna en el front), eventos de embudo definidos, y decisión legal sobre GA4 o píxeles | Bajo |

## 1. Inventario: lo que ya existe y sirve para marketing

### Superficies públicas (adquisición)

| Activo | Ruta | Estado | Uso de marketing |
|---|---|---|---|
| Buscador general | `/search` | SSR | SEO y destino de campañas |
| Profesionales | `/search/practitioners`, `/directory`, `/p/:slug` | SSR en `/search` y `/p` | SEO local por especialidad y ciudad, y enlace del médico |
| Medicamentos | `/search/medications` | SSR | SEO «precio / dónde conseguir», comparador |
| Hospitales, laboratorios e imagen, aseguradoras | `/search/hospitals|diagnostics|insurers`, fichas `/o` `/l` `/s` | SSR | SEO local y B2B (la ficha es el «escaparate» de cada organización) |
| Farmacias | `/pharmacies-directory/:slug`, `/f/:slug` | `/f` SSR, directorio en cliente | Ficha de la farmacia, promociones y sucursales |
| Cerca mío | `/search/map` | Cliente | Momento de urgencia, para campañas geolocalizadas |
| Síntomas | `/search/symptoms` | Cliente | Entrada de alto volumen de búsqueda |
| Red social | `/posts` (portada actual) | Cliente | Contenido y **espacio pagado** («ESPACIO PAGADO»: hoy hay una clínica anunciada) |
| Promoción | `/promotions/:campaignId` | Cliente | Destino de campañas de farmacia |
| Landing B2B | `/home` | Cliente | Ventas a hospitales, clínicas, aseguradoras y redes municipales |
| Emergencia | Botón rojo en todas las pantallas, números 168/160/110/119… | — | Confianza y utilidad pública (no es para promocionar) |

### Dentro de la cuenta (activación y retención)

- **Paciente:**
  - Tutorial «Conozca AloVida en 1 minuto».
  - Mapa corporal hacia la especialidad.
  - Citas, recetas → «dónde comprar» → carrito → pedido, resultados y gastos.
  - Promociones de farmacias y **puntos de fidelización** (`features/account/loyalty`, con canje
    de código).
  - Encuestas → **reseña pública**.
  - Chats con la farmacia y con profesionales.
- **Profesional:**
  - Vitrina pública, artículos firmados y grupos médicos.
  - Servicios con arancel, cotizaciones y agenda.
- **Farmacia:** catálogo (CSV), bandeja de pedidos con alarma, promociones de cinco tipos,
  sucursales y chat como farmacia.
- **Aseguradora:** productos, solicitudes, siniestralidad, pacientes y **campañas preventivas**.
- **Laboratorio farmacéutico:** visitadores, visitas a médicos y material (marco regulatorio
  propio, ver riesgos).

### Capacidades de backend que el front todavía no explota

Detalle con archivos en `mantra-core-health-api/src/modules/*/README.md`.

| Módulo | Qué permite | Estado |
|---|---|---|
| `marketing` | Segmentos, campañas multicanal, plantillas versionadas, journeys (enviar, esperar, ramificar), **enlaces rastreados `GET /r/:code`**, touchpoints y atribución multi-touch | Solo escritura (POST): **sin listados ni UI**. El envío lo delega a `messaging` |
| `promotions` | Cupones en lote, validación, aplicar descuento en el checkout, **fidelización por niveles y puntos**, **programas de referidos** (bloquea la autorreferencia) | API completa. En el front hay UI de puntos, **no de referidos** |
| `crm` | Cuentas 360, leads (calificar o convertir), oportunidades, alianzas, casos, opt-in por canal de contacto | Sin UI |
| `ads` | Cuentas publicitarias, campañas, segmentación, «firewall» de datos de eventos, conversiones offline, experimentos, formularios de leads | No exporta a Meta ni Google |
| `community` | Perfiles, seguir, guardar, posts, grupos, encuestas, **reseñas**, insignias de verificación, búsqueda pública | Muchas funciones sociales de la API no tienen UI (brecha AG-23) |
| `surveys` | Plantillas, invitaciones, respuestas, `GET /surveys/insights`, ítems CAHPS | En uso (encuestas de paciente) |
| `education` | Cursos, cohortes, certificados y **créditos CME** para profesionales | Sin UI: es un gancho de adquisición de médicos |
| `messaging` | In-app, correo (Gmail API OAuth2), web push (VAPID), preferencias y horas de silencio, recibos de proveedor | **Sin SMS, sin WhatsApp, sin push nativo** |
| `telemetry` | Eventos de actividad, web vitals, conversiones, embudos, onboarding funnel y mapa de calor, consentimientos de tracking por propósito | En uso parcial (`/superadmin/web-analytics`) |
| `scheduling` | Recordatorios de cita (concepto SMS o correo), lista de espera, reglas de confirmación | Recordatorio en estado: la entrega depende de `messaging` |
| `AlovidaAIService` | Triage por texto, asistente clínico con citas, glosario | Público, 30 por minuto, no guarda el texto |

Además, el modelo de datos tiene listo un portal **«AloVida Insights»**:

- Parche: `mantra-core-health-model/SQL/patches/2026-10-30_v4269_marketing_insights.sql`, con 22
  tablas `marketing.insights_*`.
- Seeds de demo con campañas «Registro Médicos», «Abran paso», «Ahorro en medicamentos» e
  «Historial de salud».
- Las fuentes previstas son YouTube, Meta, Google, TikTok, app y web.
- **No tiene endpoints ni pantalla todavía.** Sus cifras son de demostración: **no son datos
  reales**.

## 2. Oportunidades por objetivo

### A. Adquisición orgánica (SEO y búsqueda con IA)

1. **Estructura indexable por ciudad × especialidad, medicamento y estudio** (`programmatic-seo`).
   - Los datos ya están en el directorio. Falta convertir filtros en URLs estables con SSR, por
     ejemplo `/search/practitioners?esp=cardiologia&ciudad=santa-cruz` hacia una URL limpia.
   - Solo con datos reales y con base legal para exponerlos.
2. **`sitemap.xml` y `robots.txt`.** Hoy no existen en `public/`. Sin ellos Google descubre las
   fichas por azar.
3. **SSR para directorios y fichas.** `clinics-directory/:slug`, `pharmacies-directory/:slug`,
   `laboratory-directory/:unitId` y `directory/:profileId` se pintan solo en el cliente.
   - Hay que unificar con los perfiles cortos `/o`, `/f`, `/l`, `/p`, que **sí** son SSR, con una
     URL canónica por entidad.
4. **JSON-LD en todas las fichas.** Hoy solo lo tiene `public-profile` (`public-profile.jsonld.ts`).
   - Faltan los tipos `Physician`, `Pharmacy`, `MedicalClinic`, `DiagnosticLab`,
     `InsuranceAgency` y `MedicalWebPage` en artículos (`schema`).
5. **Búsqueda con IA** (`ai-seo`).
   - Que ChatGPT, Gemini o Perplexity citen a AloVida cuando alguien pregunta «¿dónde consigo
     losartán barato en Santa Cruz?».
   - Requiere fichas SSR, datos con fecha («cada ficha dice cuándo la actualizó») y un
     `llms.txt`.
6. **Glosario clínico y artículos firmados como contenido de autoridad.**
   - Revisión médica obligatoria.
   - Sin promesas de diagnóstico: copiar el tono de «Esto no es un diagnóstico».

### B. Crecimiento desde el producto (loops)

| Loop | Recorrido | Pieza a construir |
|---|---|---|
| **Médico → pacientes** | El médico comparte `/p/su-slug` o un QR del consultorio → el paciente pide cita → el paciente crea su cuenta | Kit QR en «Mi perfil» y enlace rastreado `/r/:code` |
| **Reseña → visibilidad → pacientes** | Consulta → encuesta → reseña pública → «Doctores en tendencia» → más reservas | Recordatorio de la encuesta; mostrar las reseñas en la ficha SSR |
| **Paciente → paciente** (referidos) | «Invite a un familiar»: los dependientes ya existen | UI sobre `promotions` / `referral-programs` (la API ya bloquea la autorreferencia) |
| **Farmacia → pacientes** | La farmacia publica una promoción → se ve en la ficha y en el pedido → el paciente la comparte | Botón «Compartir» en `/promotions/:campaignId` con previsualización `og:*` (hoy es solo cliente) |
| **Contenido → seguidores** | Artículo o post → «Recomendar / Compartir» → seguir al profesional | Ya existe en `/posts`. Falta página pública indexable del post (`/p/:slug/post/:postId` no se alcanzó con enlaces) |

### C. Ventas B2B (organizaciones)

- **Segmentos que la landing ya nombra:** hospitales de tercer nivel, seguros de corto plazo,
  redes municipales, clínicas privadas, farmacias y laboratorios, centros de primer nivel.
- **Argumentos verificables en el producto** (para `sales-enablement`):
  - Una cuenta con varias organizaciones.
  - Trazabilidad de cada acceso clínico (quién, cuándo, con qué motivo).
  - Importación del padrón con detección de duplicados (`/administration/patients/merge`).
  - Puesta en marcha por etapas (`/administration/getting-started`).
  - Directorio público verificado.
- **Una pieza comercial por vertical:**

  | Vertical | Qué mostrar |
  |---|---|
  | Farmacia | Bandeja de pedidos, catálogo CSV, promociones, chat |
  | Laboratorio | Recepción, cola, resultados, precios |
  | Aseguradora | Siniestralidad, campañas preventivas, red de prestadores |
  | Clínica | Agenda, historia, sedes, plantilla |

- **Co-marketing** (`co-marketing`): las campañas preventivas ya juntan aseguradora +
  laboratorio + importadora. Son el caso de alianza natural y se pueden vender como paquete.
- **Prerrequisito:** el alta pública de farmacias, laboratorios e imagenología hoy deja una
  **solicitud**. El copy no puede prometer «cree su cuenta en minutos».

### D. Ingresos por publicidad y espacios (con cuidado)

- **«ESPACIO PAGADO»:** ya hay un espacio rotulado en la portada `/posts`. Es inventario
  vendible a clínicas, laboratorios y aseguradoras.
  - Requiere una política de anuncios.
  - Prohibido promocionar medicamentos con receta al público.
  - Hay que separar con claridad lo pago de lo orgánico. El rótulo ya existe.
- **Visitadores y laboratorio farmacéutico:** comunicación B2B hacia médicos con su propio
  marco regulatorio. **POR CONFIRMAR** con legal antes de cualquier uso.
- **Módulo `ads` de la API:** tiene firewall de datos de eventos y conversiones offline. Sirve
  para medir campañas pagas **sin enviar datos de salud** a Meta o Google.

### E. Ciclo de vida, retención y comunicación

**Mensajes transaccionales** (no requieren consentimiento de marketing, pero sí cuidado con el
contenido):

| Momento | Canal disponible | Texto seguro (ejemplo) |
|---|---|---|
| Cita solicitada, confirmada, recordatorio | In-app, correo, web push | «Su cita del martes está confirmada» |
| Resultado listo | In-app, web push | «Tiene un resultado nuevo en AloVida» (**sin** nombrar el estudio) |
| Pedido de farmacia listo para retirar | In-app, web push, chat de la farmacia | «Su pedido está listo para retirar» |
| Encuesta post-consulta | In-app, correo | «¿Cómo le fue en su consulta?» |
| Cuenta sin confirmar | Correo | «Confirme su correo para entrar» (hoy el login dice «credenciales no válidas», H-08) |

**Mensajes de marketing** (requieren opt-in por canal y categoría, que `messaging` ya modela):

- Campañas preventivas de la aseguradora.
- Promociones de la farmacia elegida.
- Novedades de los profesionales que la persona sigue.
- Reactivación de pacientes que no vuelven.

**Canales que faltan.** El estudio de costos `mensajeria-whatsapp-vs-sms-costos-2026-08-07.md`
recomienda una cascada in-app → **WhatsApp** (Meta Cloud API) → SMS. Puntos a tener en cuenta:

- WhatsApp es el canal dominante en Bolivia (**POR CONFIRMAR** con datos de mercado).
- Meta **no firma acuerdo de datos de salud**, y reclasifica plantillas como «marketing», lo que
  cambia su costo.
- Decisión legal previa.

**App móvil.** Hoy es solo un andamiaje. Mientras tanto, la web ya tiene web push
(`public/push-sw.js`) y es responsive. La alternativa rápida es una PWA instalable.

### F. Medición

1. **Embudos clave** (sin datos de salud en los eventos):

   | Embudo | Pasos |
   |---|---|
   | Búsqueda | `search_performed` → ficha → `booking_started` → reserva solicitada |
   | Alta | Alta iniciada → paso 1…5 → confirmación de correo → primer ingreso |
   | Farmacia | Vitrina → «dónde comprar» → pedido → retiro |
   | B2B | `/home` → «Solicitar acceso» → lead → demo |

2. **UTM y enlaces rastreados.** Hoy el front no lee ninguna UTM. La API ya tiene `tracked-links`
   (`/r/:code`) y `touchpoints`. Se pueden conectar sin herramientas de terceros.
3. **Consentimiento primero.** `telemetry` ya distingue propósitos con `permits_marketing_use`.
   El adaptador GA4 y cualquier píxel requieren decisión legal previa.

## 3. Mensajes y voz

- **Decidir una sola voz.** La interfaz habla de **usted**; las publicaciones y el contexto de
  marketing usan **voseo** (H-16). Para un público boliviano amplio, «usted» es la apuesta
  segura. **POR CONFIRMAR** con el negocio.
- **Frases del producto reutilizables** (verificables en pantalla):
  - «Su historia clínica, sus citas y sus estudios, siempre con usted.»
  - «Mire dónde conseguirlo, antes de salir de su casa.»
  - «AloVida no vende medicamentos ni cobra comisión sobre estos precios.»
  - «Sin cuenta y sin turno: describa lo que siente y le orientamos sobre a qué especialidad
    conviene consultar.»
  - «Toda la operación de su red de salud… en una sola historia.»
  - «Siete momentos, un mismo hilo.»
- **Evitar:**
  - Promesas clínicas.
  - «La red más grande de Bolivia» (sin fuente).
  - Las cifras de la maqueta de `/home` presentadas como reales (H-17).
  - Cualquier ejemplo con datos de pacientes reales.

## 4. Riesgos y límites

| Riesgo | Mitigación |
|---|---|
| Datos de salud en segmentos, eventos o textos de notificación | Segmentar por comportamiento en la plataforma (sigue a, vive en, eligió farmacia), nunca por diagnóstico o medicamento. Textos genéricos en notificaciones |
| Publicidad de medicamentos | Solo venta libre y con revisión legal. Los de receta no se promocionan al público |
| Promoción a médicos (laboratorio farmacéutico) | Marco regulatorio propio: **POR CONFIRMAR** |
| Promesas de capacidades que la pantalla no cumple | Las promociones de farmacia no persisten en el simulador; las altas de laboratorio e imagen dejan una solicitud; no hay SMS ni WhatsApp. Revisar el estado real en producción antes de cada pieza |
| Primeras impresiones con errores | Corregir H-01 a H-06 antes de llevar tráfico: «Mi perfil» vacío, «Algo salió mal» y «★ 0 · 78 reseñas» se ven en la primera visita |
| Proveedores sin acuerdo de datos de salud (Meta, Google) | Firewall de eventos (`ads`) y consentimiento por propósito (`telemetry`) |

## 5. Secuencia sugerida (30 / 60 / 90 días)

Es una propuesta: las fechas y los recursos son **POR CONFIRMAR**.

- **0–30 días: base.**
  - Corregir los hallazgos visibles (H-01 a H-06, H-08).
  - Decidir la voz de marca.
  - `sitemap.xml` y `robots.txt`.
  - Captura de UTM y embudos con consentimiento.
  - Conectar «Solicitar acceso» con el CRM.
  - Rotular las cifras de la landing.
- **31–60 días: loops.**
  - Kit QR y enlace del médico.
  - Recordatorio de encuesta → reseña.
  - Web push y correo de ciclo de vida en producción.
  - SSR en directorios y fichas con JSON-LD.
- **61–90 días: escala.**
  - Páginas por ciudad y especialidad o medicamento.
  - UI de referidos.
  - Campañas preventivas de aseguradora con aviso al afiliado.
  - Política de «espacio pagado».
  - Decisión sobre WhatsApp.

## 6. Decisiones que necesitan a una persona del negocio

1. Modelo comercial y precios. El catálogo de planes en el vault está marcado ‹SUPUESTO›.
2. Voz de marca: usted o voseo.
3. Responsable legal de la publicidad de salud y marco regulatorio boliviano aplicable.
4. Política de analítica y de píxeles de terceros.
5. Si WhatsApp entra como canal, y con qué proveedor.
6. Qué datos del directorio se pueden exponer públicamente y con qué base legal.
7. Competidores, para hacer páginas comparativas (`competitor-profiling`). No hay investigación
   en los repos.
