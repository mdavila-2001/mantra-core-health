# Plan — Motor de reportería y dashboard comercial de Alovida

- Fecha: 2026-10-30 · Repos afectados: `mantra-core-health-model` (fuente de verdad del esquema), `mantra-core-health-api`, `mantra-core-health` (frontend) · Predecesor: ninguno
- **Peldaño de evidencia (regla 30): `DISCOVERED`.** Todo lo de §1 está localizado en código con ruta. Nada de lo propuesto en §3 en adelante existe, se escribió ni se ejecutó. Las columnas de las tablas candidatas **no se leyeron todas**: están marcadas «a verificar».
- Resultado observable buscado: un admin entra, elige «Portal de administración» o «Portal de reportería», y en este último —un panel integral cuyo centro son los reportes, con un asistente de chat plegable como una pieza más— ve un **grid de reportes**; abre el **Dashboard comercial** con pestañas por vertical (suscripciones de doctores, publicidad push/pauteo, comisiones a actores) con números que salen del mayor y de las tablas de pagos, no de sumas ad-hoc.
- Kill-test: abrir el dashboard con una organización sin ventas y con un periodo sin datos. Si algún KPI muestra `0` en vez de «sin dato», o si un admin de la organización A ve una fila de la B, el trabajo **no** está hecho.

---

## 0. Cómo leer este documento

| Sección | Qué responde |
|---|---|
| §1 | Qué hay hoy en el código (hechos con ruta) y qué falta |
| §2 | Los puntos centrales de un motor de reportería de nivel Power BI, con el estado de Alovida en cada uno |
| §3 | Dashboard comercial por pestañas, KPI por KPI, con su fuente candidata |
| §4 | Arquitectura acoplada a lo existente (sin servicio nuevo) |
| §5 | Selector de portal y grid de reportes |
| §6 | Hitos, subtareas y criterios de cierre |
| §7 | Ambigüedades que necesito que confirmes, riesgos y lo no cubierto |

---

## 1. Lo que hay hoy (DISCOVERED)

### 1.1 Backend — `mantra-core-health-api`

| Pieza | Dónde | Lo que hace hoy | Lo que NO hace |
|---|---|---|---|
| **Módulo `reporting`** (módulo 39) | `src/modules/reporting/README.md` | 12 entidades: fuentes gobernadas, definiciones versionadas con parámetros y columnas, corridas, snapshots, programación, distribución, suscripciones, tableros y widgets. Roles `REPORTING_ADMIN`, `DATA_STEWARD`, `REPORT_AUTHOR`, `REPORT_VIEWER`, `SYSTEM` | **Las 12 rutas son `POST`: no hay ninguna lectura** (ni listar reportes, ni leer un snapshot, ni leer un tablero). **No ejecuta SQL**: «el worker que la ejecuta llama a `/snapshot` con el artefacto ya en el almacén». No resuelve cron, no envía, no filtra por consentimiento, no limpia por retención |
| **Revisión ALOVIDA del propio README** | misma ruta, última línea | — | «Las rutas por UUID no comparan el tenant activo con definición, ejecución o programación.» Es un hueco de autorización por objeto (regla 90.1.3). **Bloquea construir encima.** |
| **Worker de reportes** | `src/worker-reporting.ts` | Existe el entrypoint | No leí su contenido: **desconocido** si ejecuta consultas |
| **`payments`** (módulo 42) | `src/modules/payments/README.md` | Intents, transacciones, reembolsos, `fee_schedules`, `payment_splits`, `gateway_settlements`, `payouts`/`payout_items` (neto de comisiones), conciliación. Dinero con `BigInt` sobre decimal (`payment-money.ts`) | Sin integración real con proveedor; los payouts no ejecutan adaptador |
| **Suscripciones** | `src/modules/payments/entities/`: `subscription_plans`, `plan_prices`, `plan_features`, `plan_quotas`, `plan_eligibility_rules`, `subscriptions`, `subscription_usage_counters` | El modelo existe: plan con nivel, intervalo, `trial_days`, `setup_fee`, precios por moneda/región con vigencia; suscripción con `subscriber_type_concept_id` + `subscriber_ref_id`, método de pago, mandato; consumo por métrica y periodo | **Ningún controller expone estas tablas** (el módulo tiene 14 rutas, todas de cobro). **El frontend no las consume.** `subscriber_type` es genérico: **no está confirmado** que hoy se venda un plan «Doctor» |
| **Publicidad** (`ads`, módulo 43) | `src/modules/ads/README.md` | 73 entidades estilo gestor de anuncios: cuentas, campañas, conjuntos, creativos, `placements`, `insights_daily`, `insight_fact_rows`, conversiones, experimentos, reglas, moderación, facturas (`ad_invoices`, `ad_invoice_lines`), `amount_spent` por cuenta | 18 rutas, todas `POST`. **No hay ninguna noción de «push» propia**: es un modelo tipo Meta Ads (plataformas externas). «Pauteo push» dentro de Alovida **no está definido** |
| **Marketing** (módulo 50) | `src/modules/marketing/README.md` | `marketing_campaigns`, `campaign_dispatches`, `campaign_dispatch_recipients`, segmentos, journeys, `attribution_touches`, `tracked_links` | No leí si hay canal push; en el modelo no encontré el concepto `PUSH` |
| **Comisiones** | `insurance.broker_commission_statements`; `payments.payment_splits`, `payouts`, `fee_schedules`; `promotions.member_referrals`, `referral_programs`, `points_ledger_entries` | Hay tres mecanismos separados: comisión de **corredor de seguros**, **reparto multi-parte** de un cobro, y **referidos/puntos** | **No existe una entidad «comisión» unificada ni un catálogo de actores comisionables.** «Visitador» aparece como cuenta mock (`visitador@alovida.mock`) pero **no encontré su esquema de comisión** |
| **Contabilidad** | `accounting` (45 entidades), `billing` (SIAT simulado) | Libros, cockpit | Sin verificar si las ventas de las tres verticales generan asientos con cuenta propia |
| **Plataforma de datos** | `read_models` (13 ent.), `lakehouse` (18), `time_series` (12), `data_catalog` (13) | `read_models` ya tiene `portal_surfaces`, `read_model_definitions`, `frontend_view_kpis`, `frontend_view_filters`, `read_model_refresh_runs` | Sin leer a fondo; son candidatos naturales para la capa semántica |

### 1.2 Esquema — `mantra-core-health-model`

- `SQL/39_reporting/`, `SQL/42_payments/`, `SQL/43_ads/`, `SQL/50_marketing/`, `SQL/51_promotions/`, `SQL/26_insurance/`, `SQL/30_read_models/` son la **fuente de verdad**. Las entidades del API se generan por introspección (`gen_entities.py`, no se editan a mano). Regla 97.1: el cambio fluye modelo → DDL → entidades.
- Los seeds de `42_payments` no traen planes de suscripción identificables (los busqué por nombre de concepto): **no hay evidencia de planes reales sembrados**.

### 1.3 Frontend — `mantra-core-health`

- Angular 21 standalone con señales, SSR, 188 tokens de diseño, `ViewState<T>` de nueve estados (contrato, ADR-0005).
- Admin vive bajo `/administration/*` (`src/app/app.routes.ts`, rutas diferidas). Ya hay: `accounting/cockpit`, `insurance-analytics`, `insurance-campaigns`, `brokers`, `admin/web-analytics` (RUM y embudos de onboarding).
- `admin/portal` **no es de reportes comerciales**: es el portal de catálogo técnico (tablas, linaje, drift, procesos). No lo reutilizo como destino.
- **Post-login**: `login.ts › destinoDespuesDeEntrar()` decide `TENANT_SELECTION_ROUTE` / `GETTING_STARTED_ROUTE` / `MY_ORGANIZATIONS_ROUTE` / `HOME_ROUTE`. **No hay selector de portal.** Ese es el punto de inserción.
- Roles con etiqueta en `core/auth/role-labels.ts`: `SUPERADMIN`, `PLATFORM_ADMIN`, `BUSINESS_ADMIN`, `PAYMENTS_ADMIN`, `DATA_PLATFORM_ADMIN`, `GOVERNANCE_ADMIN`… **No encontré** `REPORTING_ADMIN`/`REPORT_VIEWER`/`REPORT_AUTHOR` en el frontend.
- **No hay librería de gráficos** en `package.json` ni componente de gráfico en `shared/components`. Regla 95.1.4: introducir una exige decisión registrada (ADR).
- Capa de datos: `core/data-access/<dominio>/` con un cliente por dominio. **No existe** `reporting`, `subscriptions` ni `commissions`.

### 1.4 Referencia de patrón (no se acopla): `AtlasDashboardsBackend`

Otro producto de la casa resolvió el mismo problema. Lo útil, no el código: **catálogo de KPI como código** con numerador, denominador, fuente y estado (`disponible` / `sql_nuevo` / `cambio_hermano` / `no_existe` / `manual`); `null` ≠ `0` con `reason`; toda tasa con numerador y denominador y `minSample`; **serie diaria desde `kpi_value`, no desde las vistas** (`docs/PLAN.md`, ADR 0003 y 0004). Lo adopto como convención; no creo un servicio hermano (regla 98.7: un módulo, no un servicio).

---

## 2. Puntos centrales de un motor de reportería (estándar Power BI)

Lo que hace que Power BI sea un motor y no un conjunto de gráficos. Estado = lo que encontré en Alovida.

| # | Capacidad | Qué exige un motor serio | Estado en Alovida |
|---|---|---|---|
| 1 | **Fuentes gobernadas** | Conectar sólo a fuentes registradas, con dueño, frescura y calidad | **Parcial.** `report_data_sources` existe (apunta a read model o vista nombrada). Sin lectura ni frescura visibles |
| 2 | **Capa semántica** | Modelo único de dimensiones, hechos, **medidas** definidas una vez (MRR, churn), jerarquías (país→ciudad→organización), relaciones | **Ausente.** Hay `read_model_definitions` y `frontend_view_kpis` pero no medidas versionadas con fórmula |
| 3 | **Inteligencia de tiempo** | Periodo vs periodo, YTD, rolling, calendario fiscal, zona horaria | **Ausente** |
| 4 | **Motor de consulta declarativo** | El cliente pide «medida X por dimensión Y filtrada por Z»; el servidor traduce. Nunca SQL libre | **Ausente.** El módulo declara «no hay consulta libre» pero tampoco hay consulta |
| 5 | **Rendimiento** | Agregados/materializados, snapshots diarios, caché por consulta, refresco incremental, límites y timeouts | **Parcial.** `read_model_refresh_runs`, snapshots por corrida; sin snapshot diario de KPI |
| 6 | **Visuales** | Catálogo cerrado: tarjeta KPI, línea, barras, apiladas, combinado, embudo, cohortes (heatmap), tabla, matriz, mapa, cascada, medidor | **Ausente** (sin librería de gráficos) |
| 7 | **Interactividad** | Filtros globales, segmentadores (slicers), cross-filter, drill-down, drill-through, tooltips, marcadores | **Ausente** |
| 8 | **Autoría** | Definiciones versionadas, plantillas, borrador→publicado→deprecado, tableros con widgets | **Presente en backend** (definiciones, versiones, tableros); **sin pantalla** |
| 9 | **Seguridad** | RLS por tenant y por fila, seguridad por objeto, mínimo privilegio, auditoría de lecturas | **Parcial y con un hueco declarado** (§1.1). PHI/PII: el dashboard comercial debe ser **agregado** |
| 10 | **Distribución** | Exportar CSV/XLSX/PDF, programación, suscripción por correo, alertas por umbral | **Parcial.** Programación y distribución modeladas; no envían; `pdf-export-button` existe en el front |
| 11 | **Gobierno** | Catálogo de KPI con definición legible, responsable, linaje, certificación, frescura | **Ausente para KPI.** `data_catalog` y el portal de linaje existen para tablas |
| 12 | **Calidad del dato** | Reglas, cuarentena, «sin dato» explícito, tamaño de muestra | **Ausente para reportes** |
| 13 | **Observabilidad del motor** | Tiempo por consulta, errores, reportes más usados, costo | **Parcial.** `web-analytics` mide el portal, no las consultas |
| 14 | **Experiencia** | Responsivo, tema claro/oscuro, accesible (WCAG 2.2 AA), formato de moneda/fecha, 9 estados | **Parcial.** El sistema de diseño lo cubre; falta aplicarlo a reportes |
| 15 | **Moneda y exactitud** | Importes exactos, moneda siempre al lado, sin sumar monedas distintas sin tipo de cambio | **Reglas existentes** (91.1, `payment-money.ts`); hay que aplicarlas al reporte |
| 16 | **Asistente conversacional integrado** | Preguntar en lenguaje natural sobre los reportes existentes y obtener el número, su definición y el reporte donde verlo | **Ausente.** Es una pieza del portal (§5.3), no su centro. Existe `AlovidaAIService` (asistente con citas, MedGemma local) como candidato, sin evaluar para este uso |

**Conclusión del cruce:** el *esqueleto de ciclo de vida* (definir → versionar → ejecutar → snapshot → distribuir) existe en el API; **faltan la capa semántica, el ejecutor de consultas, las lecturas, los visuales y toda la UI**. No hay que empezar de cero: hay que completar `reporting` y alimentarlo.

---

## 3. Dashboard comercial — «Comercial Alovida»

Principios de contenido (heredados de la casa):

1. **Cada KPI declara numerador, denominador, moneda, fuente y estado.** Un KPI cuya fuente no existe **no se dibuja con un 0**: muestra «sin dato» y el motivo.
2. **Importes** exactos, siempre con moneda; no se suman monedas sin tipo de cambio y fecha registrados.
3. **Los totales de dinero salen del mayor** (`accounting`) y de las tablas de cobro, no de un `SUM()` ad-hoc sobre una sola tabla.
4. **Agregado, sin PHI.** Nada de pacientes. De doctores y organizaciones, sólo identificador y nombre comercial; mínimo de muestra para cortes finos.
5. **Dos alcances:** *plataforma* (equipo Mantra, todas las organizaciones) y *organización* (cada admin ve lo suyo). Ver ambigüedad A-3.
6. Filtros globales: **periodo**, comparar con periodo anterior / mismo periodo del año pasado, **moneda**, país/ciudad, organización, especialidad, plan.

Leyenda de estado: **S** = fuente candidata localizada, columnas a verificar · **N** = habría que crear/exponer · **?** = depende de una decisión de negocio.

### Pestaña 1 — Resumen ejecutivo

| KPI | Definición | Fuente candidata | Est. |
|---|---|---|---|
| Ingreso reconocido total | Σ de las tres verticales en el periodo, por moneda | Mayor (`accounting`) | ? |
| Ingreso por vertical | Suscripciones / Publicidad / Comisiones (take rate de la plataforma) | las tres de abajo | ? |
| Mix de ingreso | % de cada vertical sobre el total | derivado | ? |
| MRR total y crecimiento | MRR del cierre vs periodo anterior | `payments.subscriptions` | S |
| Clientes activos pagantes | Doctores con suscripción vigente + anunciantes con gasto > 0 | `subscriptions`, `ad_accounts` | S |
| Concentración | % del ingreso en los 10 mayores clientes | derivado | S |
| Alertas | KPI fuera de umbral (churn, mora, conciliación) | `report_schedules` + umbrales | N |

### Pestaña 2 — Suscripciones de doctores

| KPI | Definición | Fuente candidata | Est. |
|---|---|---|---|
| MRR / ARR | Σ precio normalizado a mes de suscripciones activas | `subscriptions` + `plan_prices` | S |
| Nuevas / canceladas / netas | Altas y bajas por periodo | `subscriptions` (+ `_history`) | S |
| **Churn de ingresos y de cuentas** | Bajas ÷ activas al inicio (numerador y denominador visibles) | `subscriptions_history` | S |
| Expansión y contracción | Upgrades/downgrades de plan | `subscriptions_history` | S |
| Conversión trial → pago | Pagantes ÷ trials iniciados | `subscription_plans.trial_days`, `subscriptions` | S |
| ARPU y LTV | MRR ÷ activos; LTV = ARPU ÷ churn (declarar fórmula y `minSample`) | derivado | S |
| Mix por plan / nivel | Activas por `tier_concept_id` | `subscription_plans` | S |
| Uso vs cuota | Consumo del periodo ÷ límite; candidatos a upgrade | `subscription_usage_counters`, `plan_quotas` | S |
| Mora y recuperación | Deuda abierta por suscripción; cobrados tras reintento | `payment_debts`, `payment_intents` | S |
| Renovaciones próximas | Vencen en 7/30/60 días | `subscriptions` | S |
| Cohortes de retención | Retención por mes de alta (heatmap) | `subscriptions_history` | S |
| Embudo de adquisición | Registro practitioner → verificado → trial → pago | `identity_assurance`, `onboarding`, `subscriptions` | ? |
| Cortes | Especialidad, ciudad, organización, canal de adquisición | `directory`, `profiles`, `marketing.attribution_touches` | ? |

### Pestaña 3 — Publicidad push y pauteo

> **Antes de construirla hay que definir el producto** (A-2): hoy `ads` es un gestor tipo Meta y no hay canal push propio. Lo que sigue es lo que se mide **si** el pauteo es «un anunciante paga por que Alovida entregue su mensaje a un segmento».

| KPI | Definición | Fuente candidata | Est. |
|---|---|---|---|
| Gasto / ingreso publicitario | Σ `amount_spent` y facturado | `ad_accounts`, `ad_invoices` | S |
| Entregas, aperturas, CTR | Push enviados, abiertos, clics ÷ entregados | `campaign_dispatch_recipients`, `insights_daily` | S/? |
| Conversiones, CPA, ROAS | Eventos atribuidos ÷ gasto | `conversion_attributions`, `attribution_touches` | S |
| Pacing | Gastado ÷ presupuesto esperado a la fecha | `campaigns`, `budget_schedules` | S |
| Ocupación de inventario | Plazas/placements vendidos ÷ disponibles | `ad_placements` | ? |
| Frecuencia y alcance | Entregas por usuario único | `insights_daily`, `frequency_caps` | S |
| Estado de campañas | Activas, en revisión, rechazadas | `campaigns`, `ads`, `ad_review_events` | S |
| Moderación | Tasa de rechazo, apelaciones ganadas | `ad_policy_violations`, `ad_policy_appeals` | S |
| Top anunciantes | Por gasto y por ROAS (doctor, clínica, farmacia, laboratorio, aseguradora) | `ad_accounts` + `directory` | S |
| Consentimiento | % de la audiencia alcanzable con consentimiento vigente | `consent` | ? |

### Pestaña 4 — Comisiones y actores

> Hoy son tres mecanismos separados (§1.1). El tablero tiene que **unificarlos en una vista de lectura** sin tocar sus reglas de cálculo.

| KPI | Definición | Fuente candidata | Est. |
|---|---|---|---|
| Comisión devengada / liquidada / pendiente | Por actor y periodo, con moneda | `broker_commission_statements`, `payment_splits`, `payouts`, `member_referrals` | S |
| Por actor | Corredores, referidores, visitadores, organizaciones, plataforma | las anteriores + `directory` | ? (A-4) |
| **Take rate** | Ingreso de la plataforma ÷ volumen transaccionado | `fee_schedules`, `payment_transactions` | S |
| Payouts | Emitidos, en proceso, fallidos; antigüedad | `payouts`, `payout_items` | S |
| Aging de lo pendiente | 0-30 / 31-60 / 61-90 / +90 días | `payouts`, `broker_commission_statements` | S |
| Retenciones y contracargos | Disputas que afectan comisiones | `payment_disputes`, `refunds` | S |
| Conciliación | Descuadres abiertos con el gateway | `reconciliation_exceptions` | S |
| Productividad del actor | Comisión ÷ clientes activos; top 10 | derivado | S |

### Pestaña 5 — Cobros y caja

| KPI | Fuente candidata | Est. |
|---|---|---|
| Tasa de éxito de pago, por método y gateway | `payment_transactions`, `payment_gateway_metric_series` | S |
| Reembolsos y disputas (%, monto) | `refunds`, `payment_disputes` | S |
| Rezago de liquidación (cobro → `settled`) | `gateway_settlements`, `settlement_lines` | S |
| Costo del gateway | `transaction_fees` | S |
| Facturación emitida / pendiente (SIAT) | `billing` | S |

### Pestaña 6 — Adquisición y cuentas

| KPI | Fuente candidata | Est. |
|---|---|---|
| Embudo lead → registro → activación | `crm`, `marketing`, `onboarding` | ? |
| Rendimiento por canal y campaña (CAC) | `marketing_campaigns`, `attribution_touches` | S |
| Cupones y promociones: canjes, descuento otorgado | `coupons`, `redemptions`, `promotions` | S |
| Salud de cuenta (uso, mora, tickets) | `subscription_usage_counters`, `payment_debts`, `feedback_tickets` | ? |

### Pestaña 7 — Calidad del dato y definiciones

Catálogo legible de cada KPI (fórmula, dueño, fuente, última actualización, estado), reglas de calidad y KPI en cuarentena. Sirve para que «MRR» signifique lo mismo en toda la empresa.

---

## 4. Arquitectura propuesta (acoplada a lo que hay)

```
Frontend (mantra-core-health)
  /portal-selector ── Portal de administración (/administration/*, sin cambios)
         └─────────── Portal de reportería (/reporting)  ← NUEVO, lazy, guard por rol
                        ├─ Grid de reportes (catálogo)
                        └─ Visor de reporte con pestañas

API (mantra-core-health-api) — se AMPLÍA el módulo `reporting`, no se crea servicio
  GET  /reporting/catalog                    ← lectura de reportes visibles para el rol
  GET  /reporting/definitions/:id            ← definición + KPI + parámetros
  POST /reporting/query                      ← consulta DECLARATIVA (medida × dimensiones × filtros)
  GET  /reporting/kpis · /kpis/:code/series  ← serie diaria desde kpi_value
  GET  /reporting/executions/:id/snapshot    ← lectura de artefacto
  Worker: ejecuta consultas, escribe kpi_value diario, refresca agregados

Esquema (mantra-core-health-model) — fuente de verdad
  39_reporting: + kpi_definitions, kpi_values (serie diaria), semantic_measures,
                  semantic_dimensions, report_catalog_entries (para el grid)
  vistas de lectura gobernadas (schema reporting_api) sobre payments/ads/marketing/insurance/promotions
```

Decisiones de diseño y su motivo:

1. **Un módulo, no un servicio nuevo** (regla 98.7). `reporting` ya es dueño del ciclo de vida; los datos ajenos se leen por **vistas de lectura declaradas**, no por `JOIN` entre schemas (98.1.1). Si leer `payments`/`ads` desde `reporting` cruza un límite que el repo no permite, se resuelve con **eventos o vistas** y se registra como ADR.
2. **Consulta declarativa, no SQL libre.** `POST /reporting/query` recibe `{ medida, dimensiones[], filtros[], periodo, comparar }` y rechaza todo lo que no esté en el catálogo semántico (lista blanca; ordenamiento también por lista blanca, 96.6.3).
3. **Serie diaria en `kpi_values`**, calculada por el worker; las vistas son la foto de hoy (patrón Atlas ADR-0003). Sin esto no hay churn, cohortes ni «mismo periodo del año pasado».
4. **`null` ≠ 0.** El contrato de respuesta lleva `value: null` + `reason` (`NO_SOURCE`, `NOT_ENOUGH_SAMPLE`, `STALE`). El front ya tiene los nueve estados `ViewState` para mostrarlo.
5. **Dinero:** decimal exacto en el borde (cadena), moneda al lado, sin `Number`. Se reutiliza la utilería de `payments`.
6. **Seguridad:** tenant del token, nunca del cuerpo; `row_security_json` de la fuente aplicado en el ejecutor; vista de plataforma sólo para roles de plataforma; toda lectura auditada (90.2.7).
7. **Frontend:** `core/data-access/reporting/` (cliente + tipos), `features/reporting/` (grid, visor, pestañas). Primitivas existentes: `Tabs`, `Card`, `Select`, `SegmentedControl`, `PageHeader`, `ViewStateHost`, `pdf-export-button`. **Falta** un componente de gráfico (A-5).
8. **Esquema:** todo cambio entra por `mantra-core-health-model`, luego `gen_entities.py`, y se cierra con verificación de deriva (97.2).

---

## 5. Selector de portal y grid de reportes

### 5.1 Selector (después del login)

- Aparece sólo a quien tenga rol de administración **y** acceso a reportería. Dos tarjetas: **Portal de administración** (`/administration/...`) y **Portal de reportería** (`/reports`). Quien tiene un solo acceso entra directo, sin pantalla extra.
- Se inserta en `destinoDespuesDeEntrar()` (`features/auth/login/login.ts`) **después** de la selección de organización y **respetando** `returnUrl` (que ya se valida contra redirección abierta). Recordar la última elección es una conveniencia, no una autorización.
- **Ocultar una tarjeta no es seguridad** (CLAUDE.md, punto 2): el guard de ruta y cada endpoint validan el rol por su cuenta.
- Hay un conmutador permanente en la cabecera para cambiar de portal sin cerrar sesión.

### 5.2 Grid de reportes

- Catálogo en tarjetas: nombre, vertical, descripción, última actualización y frescura, responsable, etiqueta «certificado».
- Filtros por vertical y búsqueda; «Favoritos» y «Recientes» por usuario.
- Sólo aparecen los reportes que el rol puede ver (`required_permission_id`, ya existente en la definición).
- Abrir una tarjeta lleva al visor con las pestañas de §3 y el filtro global arriba.
- Estados: cargando, vacío con orientación («aún no hay reportes publicados para tu rol»), error accionable, sin permiso, datos desactualizados, parcial.

### 5.3 El portal es un panel integral; el chat es una pieza dentro

Aclaración del pedido (2026-10-30): el «portal de reportería» es un **panel completo e integral** donde se ve todo lo que hay. Puede incluir un chat, pero **el centro son los reportes**.

Estructura del portal:

```
┌ cabecera: conmutador de portal · filtros globales (periodo, comparar, moneda, organización) · frescura ┐
├ navegación lateral ─┬ área central ─────────────────────────────┬ panel del asistente (plegable) ──┤
│ Inicio (grid)       │ Grid de reportes  /  Visor con pestañas    │ «Pregúntale a tus reportes»      │
│ Dashboard comercial │                                            │ historial · sugerencias          │
│ Favoritos/Recientes │                                            │                                  │
│ Programados         │                                            │                                  │
│ Catálogo de KPI     │                                            │                                  │
└─────────────────────┴────────────────────────────────────────────┴──────────────────────────────────┘
```

Reglas del asistente (para que no contradiga las reglas del resto del portal):

1. **Plegado por defecto**; el portal funciona entero sin él. Nunca es el único camino a un número.
2. **El modelo no escribe cifras.** Traduce la pregunta a una consulta declarativa sobre el catálogo semántico (`{ medida, dimensiones, filtros, periodo }`); el número lo calcula y entrega el motor (`POST /reporting/query`) con el **token del usuario**, así que hereda sus permisos y su tenant. Una pregunta fuera del catálogo se contesta «no tengo esa medida», no se inventa.
3. **Cada respuesta cita**: definición del KPI, fuente, frescura y botón «abrir en el reporte». `null` se dice como «sin dato» con su motivo, no como 0.
4. **Sin SQL generado.** Lista blanca de medidas y dimensiones, igual que cualquier otro cliente.
5. **Sin PHI y sin salir de la infraestructura:** los datos de filas no viajan a un modelo externo (regla 90.2.4); el modelo sólo ve nombres del catálogo y la pregunta. Si se reutiliza `AlovidaAIService`, queda por verificar que corra con autenticación (hoy sus rutas son públicas para el paciente) y que no guarde ni registre el texto.
6. **Acciones:** sólo lectura y navegación (abrir reporte, aplicar filtros, programar un envío con confirmación). No muta datos.
7. Todos los estados: cargando, sin respuesta, error accionable, sin permiso, modelo no disponible (el portal sigue operando).

---

## 6. Hitos

Formato regla 20. **Ninguno está iniciado.** Cada microtarea se cierra con su DoD ejecutado y salida pegada.

### H0 — Cimientos: seguridad y lectura del módulo `reporting`

**CA:** Dado un admin de la organización A, cuando pide una definición, ejecución o programación de la organización B por UUID, entonces recibe un 404 idéntico al de un UUID inexistente; y dado un `REPORT_VIEWER`, cuando lista reportes, entonces ve sólo los que su permiso habilita.
**DoD:** test de autorización negativa (otro usuario, otra organización, rol insuficiente, sin token) en verde contra PostgreSQL real · `corepack yarn test src/modules/reporting --runInBand` · verificación de deriva.

| ID | Microtarea | DoD |
|---|---|---|
| H0.S1.M1 | Cerrar el hueco de tenant por UUID en las rutas existentes (hallazgo del propio README) | test negativo entre tenants → 404 idéntico |
| H0.S1.M2 | `GET /reporting/catalog` filtrado por permiso y tenant | test de rol + paginación determinista |
| H0.S1.M3 | `GET /reporting/definitions/:id` y `GET /executions/:id/snapshot` | test de objeto-nivel |
| H0.S2.M1 | Registrar en el repo si el worker (`worker-reporting.ts`) ejecuta consultas (hoy desconocido) | nota con ruta y línea |

### H1 — Capa semántica y catálogo de KPI

**CA:** Dado el catálogo, cuando se pide el MRR del mes por plan, entonces la medida está definida **una sola vez** con fórmula, dueño y fuente, y un KPI sin fuente devuelve `null` con motivo.
**DoD:** DDL en `mantra-core-health-model` aplicado en una base descartable, deriva en verde, seed idempotente (segunda corrida sin inserts), test de «KPI declarado sin cálculo falla».

| ID | Microtarea | DoD |
|---|---|---|
| H1.S1.M1 | Tablas `kpi_definitions`, `kpi_values`, `semantic_measures`, `semantic_dimensions`, `report_catalog_entries` (índices con nombre explícito, `row_version`, tenant) | DDL + `apply_all.sql` sin error |
| H1.S1.M2 | Regenerar entidades y verificar deriva | salida pegada |
| H1.S2.M1 | Catálogo de KPI de §3 cargado con estado por KPI (**procedencia declarada**: son definiciones internas, no datos oficiales) | conteo por estado |
| H1.S2.M2 | Regla de contrato: respuesta con `value|null`, `reason`, `numerator`, `denominator`, `currency` | test de contrato |

### H2 — Motor de consulta y serie diaria

**CA:** Dado `{ medida, dimensiones, filtros, periodo, comparar }`, cuando se consulta, entonces devuelve la serie con comparativo; con una medida o dimensión fuera del catálogo devuelve 400 del contrato, no 500.
**DoD:** pruebas de lista blanca (incl. `ORDER BY`) · prueba de inyección rechazada · timeout y límite de filas explícitos · prueba de idempotencia del worker (dos corridas del mismo día = mismo `kpi_values`).

| ID | Microtarea | DoD |
|---|---|---|
| H2.S1.M1 | `POST /reporting/query` declarativo | tests de validación |
| H2.S1.M2 | Inteligencia de tiempo (vs periodo anterior, vs año anterior, rolling) | tests con fechas límite (fin de mes, año bisiesto, zona horaria) |
| H2.S2.M1 | Worker diario que escribe `kpi_values` | idempotencia demostrada |
| H2.S2.M2 | Vistas de lectura gobernadas por vertical | consulta de cuadre contra el mayor |

### H3 — Frontend: selector de portal, grid y visor

**CA:** Dado un admin con acceso a ambos portales, cuando inicia sesión, entonces elige portal; dado uno con un solo acceso, entra directo; y un usuario sin rol de reportería que escribe `/reports` es redirigido por el guard.
**DoD:** `yarn typecheck` · `yarn lint` · `yarn test` dirigido · Playwright sobre las rutas nuevas · matriz de roles (`fable-matriz-roles.spec.ts`) · **capturas en móvil, tablet y escritorio, claro y oscuro, y los estados de carga/vacío/error, miradas de verdad** (regla 95.7).

| ID | Microtarea | DoD |
|---|---|---|
| H3.S1.M1 | Ruta `/portal-selector` y cambio en `destinoDespuesDeEntrar()` | test del destino por perfil de rol |
| H3.S1.M2 | Guard y rutas diferidas `/reporting/**` | test del guard |
| H3.S2.M1 | Cliente `core/data-access/reporting` + tipos | test de contrato contra el fixture del API |
| H3.S2.M2 | Grid de reportes con filtros, favoritos y recientes | capturas + 9 estados |
| H3.S3.M1 | **Decisión (ADR) sobre librería de gráficos** y componente de gráfico accesible (alternativa tabular, no sólo color) | ADR + test |
| H3.S3.M2 | Visor con pestañas, filtros globales, comparativo, drill-down | e2e + capturas |

### H4 — Dashboard comercial (una pestaña por pasada, en orden de dependencia)

Orden: **Resumen** al final (depende de todas) → Suscripciones → Cobros y caja → Comisiones → Publicidad → Adquisición → Calidad.
**CA por pestaña:** Dado un periodo con datos conocidos (sintéticos y declarados como tales), cuando se abre la pestaña, entonces cada KPI coincide con el cuadre calculado desde el mayor/la tabla de origen; y con un periodo vacío muestra «sin dato», nunca `0`.
**DoD por pestaña:** consulta de cuadre pegada · caso de reversa (reembolso/contra-asiento) reflejado · caso de redondeo declarado · prueba de aislamiento entre organizaciones · capturas por viewport y tema.

### H5 — Distribución, alertas y exportación

**CA:** Dado un reporte programado semanal, cuando vence el tick, entonces se genera un snapshot y se entrega **una sola vez** por destinatario aunque el tick se repita; y dado un KPI fuera de umbral, entonces se avisa a quien corresponde.
**DoD:** prueba de duplicado (mismo tick dos veces) · exportes CSV/XLSX/PDF con importes exactos · sin PHI en el artefacto · prueba de caída del canal de envío.

### H6 — Gobierno, observabilidad y asistente integrado

Catálogo visible, linaje de KPI, métricas del motor (tiempo y error por consulta, reportes más abiertos), `correlationId` de punta a punta.

**Asistente (§5.3).** Se construye **después** de H2 y de al menos dos pestañas de H4, porque sin catálogo ni datos no hay nada que preguntar.
**CA:** Dado el catálogo, cuando alguien pregunta «¿cuál fue el MRR de septiembre?», entonces el panel responde con el valor del motor, su definición, fuente y frescura y un enlace al reporte; con una pregunta fuera del catálogo responde que no tiene esa medida; y un usuario de la organización A no obtiene nunca una cifra de la B.
**DoD:** evaluación con banco de preguntas sintéticas declaradas (correctas, límite e inválidas: medida inexistente, periodo futuro, intento de pedir datos de pacientes, intento de inyección en la pregunta) · prueba de que la cifra mostrada coincide con la de `POST /reporting/query` · prueba de autorización negativa · prueba con el modelo apagado (el portal sigue operando) · capturas del panel plegado/abierto en los tres viewports y ambos temas.

| ID | Microtarea | DoD |
|---|---|---|
| H6.S1.M1 | Decisión (ADR): reutilizar `AlovidaAIService` con autenticación o servicio de mapeo propio dentro de `reporting` | ADR |
| H6.S1.M2 | Traductor pregunta → consulta declarativa (sólo nombres del catálogo) | banco de preguntas, salida pegada |
| H6.S2.M1 | Panel plegable en el portal + historial local con opción de borrarlo | e2e + capturas |
| H6.S2.M2 | Respuesta con cita (definición, fuente, frescura, enlace) y estados | test de contrato + capturas |

---

## 7. Ambigüedades, riesgos y lo no cubierto

### Ambigüedades (se registran, no se resuelven por conveniencia)

| ID | Pregunta | Supuesto tomado | A quién confirmar |
|---|---|---|---|
| ~~A-1~~ | ~~«Portal de reportería chat»~~ **RESUELTA 2026-10-30:** es un panel integral de reportería; el chat es una pieza dentro, no el centro | El asistente va plegable en el portal (§5.3) y se construye en H6 | Confirmado por el solicitante |
| **A-2** | **Publicidad push / pauteo**: ¿qué se vende exactamente? ¿Espacio dentro de la app, envíos push a un segmento, ambos? ¿Quién paga (doctor, clínica, farmacia, laboratorio, aseguradora)? ¿Cómo se cobra (CPM, CPC, tarifa plana)? | La pestaña 3 asume «anunciante paga por entrega a un segmento». No hay canal push en el modelo | Tú / negocio |
| **A-3** | **Alcance de los datos**: ¿el dashboard es de la **plataforma** (equipo Mantra ve todo) o cada **organización** ve lo suyo, o ambos? | Ambos, con rol distinto | Tú |
| **A-4** | **Comisiones → actores**: ¿qué actores cobran y cómo se calcula cada comisión (visitador, corredor, referidor, organización)? Las tasas no se infieren (regla 97.5.4) | Sólo se **reportan** los mecanismos que ya existen; no se crean reglas de cálculo | Negocio / cumplimiento |
| **A-5** | **Librería de gráficos**: no hay ninguna en el front | Se decide por ADR en H3.S3.M1 antes de escribir visuales | Tú / frontend |
| **A-6** | ¿Quién es «admin» para el selector? En el front hay `SUPERADMIN`, `PLATFORM_ADMIN`, `BUSINESS_ADMIN`…; en el API hay `REPORTING_ADMIN`, `REPORT_VIEWER`, `REPORT_AUTHOR` que el front no conoce | Acceso a reportería = rol de reportería del API; el selector aparece si además tiene rol de administración | Tú |
| **A-7** | ¿Hoy se cobra de verdad la suscripción a doctores? No hay planes sembrados ni UI | Se asume que el modelo es el destino y que los datos reales aún no existen; las pruebas usan datos sintéticos declarados | Negocio |

### Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Construir sobre `reporting` con el hueco de tenant | Un admin vería reportes de otra organización | H0.S1.M1 va **primero** y bloquea lo demás |
| Las tres verticales aún no generan datos reales | Dashboard bonito y vacío | El estado «sin dato» es de primera clase; no se rellena con ceros ni con ficticios |
| Tres mecanismos de comisión sin modelo unificado | KPI de comisiones que no cuadran | Vista de lectura que no toca las reglas; cuadre contra el mayor |
| Sumar monedas distintas | Cifras falsas | Un KPI por moneda hasta registrar tipo de cambio y fecha |
| Lectura cruzada entre schemas viola límites de módulo | Deuda arquitectónica | Vistas gobernadas / eventos y ADR |
| PHI en un reporte | Incidente de privacidad | Dashboard sólo agregado + `minSample`; gate de `data-privacy-financial` |

### No cubierto en esta revisión

- No leí a fondo las columnas de `ads`, `marketing`, `promotions`, `insurance`, `accounting` ni `read_models`: los KPI de §3 llevan **fuente candidata, no confirmada**.
- No leí `worker-reporting.ts`, `AlovidaAIService` más allá de su README, ni la app móvil (`mantra_core_health_mobile`): la app móvil queda **fuera de alcance** de este plan.
- No ejecuté ninguna prueba, build ni consulta contra base. No hay datos de volumen.
- No revisé `mantra_core_technologies_health_docs` ni los repos Atlas/Pasanaku más allá de usar `AtlasDashboards` como referencia de patrón.

### Siguiente paso

Confirmar A-2 a A-4 (son las que cambian el alcance). Con eso, H0 puede arrancar sin esperar al resto.
