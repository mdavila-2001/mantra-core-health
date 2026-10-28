# Product Marketing Context

**Document version:** v1
**Last updated:** 2026-10-26
**Origen:** borrador automático desde el código y la documentación de este repositorio
(skill `product-marketing`). Todo lo que no se pudo verificar en el repo va marcado
**POR CONFIRMAR** y nadie debe usarlo como dato en una pieza publicada hasta que lo confirme
una persona del negocio.

> **Cómo lo leen las demás skills.** `copywriting`, `cro`, `seo-audit`, `schema`, `emails`,
> `programmatic-seo`, etc. leen este archivo antes de preguntar. Los cuatro módulos que
> se promocionan (Farmacia, Imagenología, Laboratorio, Organización médica) están en la sección
> **Módulos**; el resto de las secciones es común a la plataforma.

> **Reglas de la casa que aplican a cualquier pieza de marketing** (no son opcionales):
> 1. Prohibido inventar cifras, testimonios, logos, precios, acreditaciones o resultados
>    clínicos. Sin fuente en este archivo, la afirmación no se publica.
> 2. Ningún dato personal, de salud ni de pacientes en ejemplos, capturas, textos de anuncios,
>    segmentaciones ni eventos de analítica. Los ejemplos son sintéticos y se dicen sintéticos.
> 3. Nada de promesas médicas (diagnosticar, curar, «el mejor tratamiento»). El producto
>    conecta, ordena y comunica; no sustituye a un profesional.
> 4. No prometer una capacidad que la pantalla no cumple (ver «Estado real» de cada módulo).
> 5. Publicidad y mensajería de salud (medicamentos, estudios): revisión regulatoria humana
>    antes de publicar. Qué norma aplica en Bolivia: **POR CONFIRMAR** (responsable legal).

## Product Overview

**One-liner:** Mantra Core Health: el sistema médico del ecosistema ALOVIDA, que conecta
pacientes, profesionales, farmacias, laboratorios, centros de imagen y organizaciones de
salud en una sola plataforma. (Nombre de producto **provisional**; el definitivo está
pendiente. Fuente: `README.md`.)

**What it does:** Aplicación web (Angular 21 con SSR) con directorios públicos
(farmacias, clínicas, laboratorios), cuentas de paciente (pedidos de farmacia, órdenes y
resultados de estudios, historia clínica, turnos) y consolas de gestión para cada tipo de
organización. Multi-organización: una persona puede pertenecer a varias y elegir cuál activa.

**Product category:** Plataforma de salud / sistema de gestión médica multi-organización.
Cómo lo buscan: **POR CONFIRMAR** (ver «Customer Language»).

**Product type:** Plataforma web B2B2C (organizaciones de salud que sirven a pacientes).

**Business model:** **POR CONFIRMAR.** No hay precios, planes ni modelo comercial en el
repositorio. No redactar ninguna página de precios hasta tenerlo.

## Target Audience

**Target companies:** Organizaciones de salud en Bolivia (reclamo del código: «la red de salud
más grande de Bolivia», `register-patient.ts` — es una aspiración de copy, **no** una cifra
verificada): farmacias, laboratorios clínicos, centros de imagenología, clínicas y hospitales,
aseguradoras y laboratorios farmacéuticos. Tamaños y segmentos: **POR CONFIRMAR**.

**Decision-makers:** **POR CONFIRMAR** (administración/gerencia de cada organización). Roles
técnicos existentes en el producto: administrador de organización, gerente, representante
legal, personal de mostrador, visitador médico.

**Primary use case:** Que cada organización de salud sea encontrable, gestione su operación
(pedidos, catálogo, estudios, sedes, personal) y se comunique con pacientes y profesionales
desde un mismo sistema.

**Jobs to be done:**
- Que el paciente encuentre dónde conseguir lo de su receta o su orden y siga su estado.
- Que la organización muestre su oferta (medicamentos, estudios, servicios) y reciba demanda.
- Que la organización ordene su propia estructura (sedes, equipo, documentación legal).

**Use cases:** ver cada módulo.

## Personas

| Persona | Cares about | Challenge | Value we promise |
|---|---|---|---|
| Paciente | Encontrar y seguir sus pedidos, órdenes y resultados | Saber dónde está lo de su receta y cómo prepararse para un estudio | «Tu historia clínica, tus turnos y tus estudios, siempre con vos» (copy existente) |
| Administrador/gerente de farmacia | Pedidos entrantes, catálogo, promociones, papeles al día | Atender el mostrador y la demanda en línea a la vez | Bandeja de pedidos, ficha legal y campañas propias |
| Administrador de laboratorio / centro de imagen | Catálogo de estudios, tarifarios, personal, acreditaciones | Mostrar su oferta y operar la cola de trabajo | Consola del laboratorio con catálogo, sucursales y equipamiento |
| Dirección de clínica/hospital | Sedes, áreas, servicios, plantilla, legajo, inventario | Tener la estructura de la organización en un solo lugar | Consola de organización médica |
| Visitador médico / laboratorio farmacéutico | Visitas a doctores, material, regulatorio | Coordinar visitas y documentación | Módulo de laboratorio farmacéutico |

Las personas son las del producto; sus motivaciones y objeciones reales: **POR CONFIRMAR**
con entrevistas (skill `customer-research`).

## Problems & Pain Points

**Core problem:** **POR CONFIRMAR** con clientes. Hipótesis a validar, no a publicar:
información de salud dispersa entre farmacias, laboratorios y clínicas; pacientes que no
saben dónde está lo de su receta ni cómo prepararse para un estudio.

**Why alternatives fall short:** POR CONFIRMAR.
**What it costs them:** POR CONFIRMAR (sin cifras inventadas).
**Emotional tension:** POR CONFIRMAR.

## Competitive Landscape

**Direct / Secondary / Indirect:** **POR CONFIRMAR.** No hay investigación competitiva en el
repo. Usar la skill `competitor-profiling` con URLs que aporte el negocio antes de crear
páginas «vs» (`competitors`).

## Differentiation

**Key differentiators** (verificables en el código, sujetos a confirmación comercial):
- Una sola cuenta con varias organizaciones y cambio de contexto explícito.
- Directorios públicos de farmacias, clínicas y laboratorios, con detalle por sucursal.
- Estados de interfaz contractuales (cargando, vacío, error accionable, sin permiso…),
  accesibilidad documentada con WCAG 2.2 como referencia (`docs/accessibility/`).
- Verificación de identidad y de matrícula profesional.

**How we do it differently / Why that's better / Why customers choose us:** POR CONFIRMAR.

## Objections

| Objection | Response |
|---|---|
| POR CONFIRMAR (recoger en ventas) | — |

**Anti-persona:** POR CONFIRMAR. Hoy el alta pública crea cuentas de paciente, médico y
aseguradora; ver «Estado real» de cada módulo antes de captar a farmacias, laboratorios o
centros de imagen.

## Switching Dynamics

**Push / Pull / Habit / Anxiety:** POR CONFIRMAR con entrevistas (`customer-research`).

## Customer Language

**How they describe the problem:** POR CONFIRMAR (verbatim de clientes; ninguno en el repo).
**How they describe us:** POR CONFIRMAR.

**Words to use** (vocabulario ya fijado en `docs/business/glossary.md` y en la interfaz):
«organización» (nunca «tenant»), «ficha», «pedido», «orden», «resultado», «sucursal», «sede».
**Words to avoid:** «tenant», uuids, jerga de administración en superficies de cara al
paciente; promesas de resultado clínico; superlativos sin fuente («el mejor», «el más grande»).

**Glossary:** ver `docs/business/glossary.md`.

## Brand Voice

Voz observable en el copy actual de la interfaz (español rioplatense con voseo): cercana,
concreta, sin rodeos. Ejemplos reales: «¿Cuál tiene lo de tu receta?», «Todavía no hay
resultados», «No tenés órdenes pendientes».

| Attribute | Means | Doesn't mean | Example line |
|---|---|---|---|
| Directa | Dice qué pasó y qué hacer | Alarmista | «No pudimos traer tus órdenes» |
| Cálida | Habla de «tu» salud, «tus» estudios | Infantil | «Tu salud, conectada» |
| Concreta | Nombra la acción | Genérica | «Armá una campaña con productos de tu catálogo» |

**Tone by context:** Support/errores: claro y accionable. Launch y ventas: por definir.
**Ojo:** el voseo es el de la interfaz actual; si el mercado de marketing usa «usted» o «tú»,
**POR CONFIRMAR** antes de escribir campañas.
**Terms we own:** POR CONFIRMAR. **Never use:** ver «Words to avoid».

## Proof Points

**Metrics:** ninguna verificada. **No publicar** «la red más grande», ni cifras de
farmacias, laboratorios o usuarios, hasta tener la fuente.
**Customers / Testimonials:** ninguno en el repo.

| Theme | Proof |
|---|---|
| Accesibilidad y claridad de estados | Reglas del repo (`CLAUDE.md`, ADR-0005) — interno, no es prueba de cara al cliente |

## Goals

**Business goal:** POR CONFIRMAR.
**Conversion action:** hoy existen altas de paciente, médico, aseguradora y (con
limitaciones, ver módulos) laboratorio e imagenología.
**Current metrics:** POR CONFIRMAR. Hay una vista de analítica web en administración
(`admin/web-analytics`); eventos y consentimiento de analítica: POR CONFIRMAR antes de medir.

## Paid Ads

No aplica por ahora: sin presupuesto, CPA objetivo ni cuentas declaradas. **El agente no
puede lanzar, pausar ni cambiar campañas.** Cualquier pieza de anuncio de salud exige
revisión regulatoria humana (ver reglas arriba).

---

## Módulos

### 1. Farmacia

**Qué existe hoy (verificable en el código):**
- Directorio público de farmacias, filtro por departamento y ficha por farmacia con sucursales
  y medicamentos/precios con filtros (grupo terapéutico, disponibilidad, «con stock»,
  «sin receta»). Ruta `pharmacies-directory`, `public-directories/pharmacy-detail`.
- «¿Cuál tiene lo de tu receta?»: el paciente ve qué sucursal cubre los medicamentos de su receta.
- Cuenta del paciente: «Mis pedidos» — «tus pedidos de farmacia, del envío al retiro, con su
  estado en palabras» (`my-account/pharmacy-orders`).
- Consola de la farmacia: «Pedidos de farmacia» (la bandeja del mostrador),
  «Ficha de la farmacia» (datos, carpeta legal, representante y gerentes) y
  «Promociones de mi farmacia» (campañas con productos del catálogo y vigencia).

**Estado real a respetar en el copy:** las promociones aparecen **apagadas en algunos
entornos** («Las promociones están apagadas en este entorno»). No anunciarlas como disponibles
sin confirmar el entorno de producción. El alta pública de farmacias: **POR CONFIRMAR**
(la pantalla de tipos de cuenta dice que el alta pública hoy crea aseguradoras; farmacias
«se amplía con el backend, no antes»).

**Audiencias:** paciente (encontrar y seguir su pedido); administrador/gerente de farmacia
(recibir pedidos, mostrar catálogo, promocionar).
**SEO/descubrimiento:** páginas de ficha por farmacia y sucursal (`programmatic-seo`, `schema`
con `Pharmacy`/`LocalBusiness`, `seo-audit`) — solo con datos reales y con base legal para
exponerlos.
**Cuidado regulatorio:** medicamentos con receta: sin publicidad al público de medicamentos
de venta con receta; precios y descuentos: POR CONFIRMAR con asesoría legal.

### 2. Imagenología

**Qué existe hoy:**
- Alta «Registrá tu centro de imagenología» (sucursales y datos del centro), separada de la
  de laboratorio porque son empresas distintas, con papeles y equipos distintos.
- Para el paciente: «Mis órdenes» (estudios de laboratorio e imagen que pidió un médico, con
  indicaciones para hacérselos) y «Mis resultados» (estudios e informes ya validados por un
  profesional).
- Cola de trabajo «Laboratorio e imagenología» en administración (`diagnostics`).

**Estado real a respetar en el copy:** el formulario de alta de imagenología **todavía no tiene
endpoint**: se recorre entero y cierra dejando una *solicitud*, no una cuenta. No prometer
«creá tu cuenta de centro de imagen en minutos». Catálogo de estudios y agenda propios de
imagenología: **POR CONFIRMAR** (la consola de catálogo existente es la del laboratorio).

**Audiencias:** centro de imagenología (captación a la solicitud de alta); paciente (qué hacer
con su orden, cómo prepararse).
**Cuidado:** nunca imágenes ni informes reales en materiales; ejemplos sintéticos.

### 3. Laboratorio

Dos cosas distintas con el mismo nombre; no mezclarlas en el copy:

**a) Laboratorio clínico** (análisis):
- Directorio público de laboratorios (`laboratory-directory`) con ficha de detalle.
- Alta «Registrar laboratorio» (misma limitación que imagenología: deja una solicitud).
- Consola «Laboratorio médico»: sucursales, equipamiento, catálogo de estudios (ofertas de
  estudio), personal y acreditaciones, y tarifarios.
- Cola de trabajo del laboratorio («qué hay pendiente y en qué estado») y, para el paciente,
  órdenes y resultados.

**b) Laboratorio farmacéutico** (módulo `pharma-lab`):
- Visitadores, catálogo de medicamentos, material informativo, farmacovigilancia y
  documentación regulatoria; vistas de visitas para visitador y doctor.
- Audiencia y mensajes distintos (B2B hacia médicos): la promoción de medicamentos a
  profesionales tiene su propio marco regulatorio — **POR CONFIRMAR** con legal.

**Estado real a respetar:** el alta de laboratorio no crea cuenta todavía (solicitud).

### 4. Organización médica (hospital, clínica, etc.)

**Qué existe hoy:**
- Directorio público de clínicas con ficha de detalle (`clinics-directory`).
- Consola de la organización médica (administración): «Sedes, áreas, infraestructura,
  servicios, plantilla, legajo e inventario».
- Panel «Tu organización» (datos, su gente, quiénes piden trabajar con ella, agenda) y
  «Mis organizaciones» (una cuenta, varias organizaciones, cambio de contexto).

**Estado real a respetar:** una organización nueva puede estar «todavía no aprobada» (el panel
lo dice). El alta pública hoy crea aseguradoras; el alta de clínicas/hospitales por sí solos:
**POR CONFIRMAR**.

**Audiencias:** dirección/administración de hospital o clínica; pacientes que buscan dónde
atenderse.

---

## Learnings

_(vacío; se llena a medida que se publique y mida trabajo de marketing)_

## Changelog

- **v1 · 2026-10-26** — borrador automático desde el código del repo (módulos de farmacia,
  imagenología, laboratorio y organización médica). Sin datos comerciales: precios,
  competidores, métricas y testimonios quedan POR CONFIRMAR.
