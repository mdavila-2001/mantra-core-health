# Mantra Core Health — documentación del frontend

Aplicación web del **ecosistema REDESA**. Angular 21 con renderizado en servidor,
sistema de diseño propio y nueve estados de interfaz contractuales.

- **Versión documentada:** commit `ba2efd9` + trabajo concurrente del 2026-08-01
- **Estado productivo:** **NO APTO** — ver
  [el informe de preparación](reports/production-readiness.md)

---

## El stack, verificado

| Elemento | Valor |
|---|---|
| Framework | **Angular 21.2**, todo standalone, señales |
| Renderizado | **SSR** con 4 rutas prerenderizadas |
| Lenguaje | TypeScript 5.9 `strict` + `strictTemplates` |
| Estilos | CSS plano con 188 custom properties |
| Estado | Señales en servicios `providedIn: 'root'`. **Sin store externo** |
| Formularios | Reactive Forms |
| Pruebas | **Vitest 4** — 807 pruebas en 71 archivos |
| Paquetes | **Yarn 4.18.0** en modo PnP |
| **Dependencias externas en ejecución** | **10, todas de Angular** |

Nada de esta tabla es supuesto: sale de `package.json`, `angular.json` y la
ejecución real. Ver [la línea base](reports/baseline.md).

## Empezar

| | |
|---|---|
| [Requisitos previos](getting-started/prerequisites.md) | Node 24, Yarn 4, y por qué el modo PnP importa |
| [Instalación local](getting-started/local-setup.md) | Host o Docker, y cómo levantar el sistema completo |
| [Órdenes](getting-started/commands.md) | Las que existen, y las que **no** |
| [Variables de entorno](getting-started/environment-variables.md) | Cuatro, y solo una llega al navegador |
| [Ejecutar las pruebas](getting-started/running-tests.md) | Y por qué el total global no es la métrica |
| [Solución de problemas](getting-started/troubleshooting.md) | Problemas reales de este repositorio |

## Las cinco cosas que hay que entender antes de tocar nada

### 1 · Nueve estados de interfaz son contrato

El modelo del proyecto (M34) declara nueve estados obligatorios, y
`ViewState<T>` los codifica de forma que **las reglas no se puedan incumplir por
olvido**: S3 exige una próxima acción, S7 exige la antigüedad del dato, S9 exige
el identificador de la petición. → [ADR-0005](adr/ADR-0005-view-state-m34.md)

### 2 · El servidor no ve la sesión

El refresh token vive en `localStorage` y el access token en memoria. De ahí sale
**toda** la estrategia de renderizado: lo público se prerenderiza, lo que tiene
sesión se pinta en el cliente. → [ADR-0002](adr/ADR-0002-ssr-prerenderizado-selectivo.md)

### 3 · La autoridad es la API

> *«Esconder un ítem no protege nada —la autoridad es la API, que valida en cada
> petición—; es no ofrecer una puerta que va a estar cerrada.»*

El frontend no autoriza y **no verifica la firma del token**. →
[seguridad frontend](security/frontend-security.md)

### 4 · Las fronteras de capa son código

`@core`, `@shared`, `@features`: tres alias de `tsconfig.json`. **Cero
dependencias circulares** sobre 590 importaciones, y `check-architecture.mjs` lo
verifica. → [ADR-0007](adr/ADR-0007-fronteras-por-alias.md)

### 5 · No se filtra existencia

El estado S6 **descarta el mensaje y los detalles del error**, y su tipo no tiene
campos de datos. La recuperación de contraseña devuelve **siempre el mismo
acuse**. → [reglas de negocio](business/business-rules.md#reglas-de-privacidad--las-que-más-importan-en-este-dominio)

## Arquitectura

| | |
|---|---|
| [Visión general](architecture/overview.md) | Empezar por acá |
| [Contexto](architecture/system-context.md) · [Contenedores](architecture/containers.md) · [Capas](architecture/frontend-layers.md) | Los tres niveles C4 |
| [Dependencias entre módulos](architecture/module-dependencies.md) | El grafo medido |
| [Renderizado](architecture/rendering-strategy.md) · [Routing](architecture/routing-and-navigation.md) | |
| [Estado](architecture/state-management.md) · [Flujo de datos](architecture/data-flow.md) | |
| [Errores](architecture/error-boundaries.md) | **Y el hueco que tiene** |
| [Integraciones](architecture/integration-map.md) | Las 20 operaciones |
| [Decisiones (ADR)](adr/index.md) | Diez, con su evidencia |

## Producto

| | |
|---|---|
| [Contexto de negocio](business/business-context.md) · [Actores](business/actors-and-roles.md) · [Capacidades](business/capabilities.md) | |
| [Recorridos de usuario](business/user-journeys.md) | Seis journeys críticos |
| [Reglas de negocio](business/business-rules.md) | Con dónde se hace cumplir cada una |
| [Glosario](business/glossary.md) | Incluye **lo que los términos no significan** |
| [Catálogo de rutas](routes/route-catalog.md) | Las 8 pantallas, con ficha completa |

## Interfaz

| | |
|---|---|
| [Catálogo de componentes](components/catalog.md) | 48 en tres niveles |
| [Reglas de composición](components/composition-rules.md) · [Entradas y salidas](components/props-and-events.md) | |
| [Formularios](components/forms.md) · [Tablas](components/tables.md) · [Diálogos](components/modals-and-overlays.md) · [Avisos](components/notifications.md) | |
| [Sistema de diseño](design-system/principles.md) | REDSAT v1.0 |
| [Tokens](design-system/tokens.md) · [Colores](design-system/colors.md) · [Tipografía](design-system/typography.md) · [Temas](design-system/themes.md) | |

## Datos e integraciones

| | |
|---|---|
| [Estado de servidor](data-and-state/server-state.md) · [Estado de cliente](data-and-state/client-state.md) | |
| [Caché](data-and-state/caching.md) · [Persistencia](data-and-state/persistence.md) · [Invalidación](data-and-state/invalidation.md) | |
| [API de backend](integrations/backend-api.md) | El contrato declarado |
| [Autenticación](integrations/authentication.md) · [Archivos](integrations/file-storage.md) | |

## Calidad

| | |
|---|---|
| [Estrategia de pruebas](testing/strategy.md) | Y las cinco capas que faltan |
| [Accesibilidad](accessibility/standard-and-scope.md) · [Auditoría](accessibility/audit-report.md) | WCAG 2.2 AA |
| [Rendimiento](performance/budgets.md) · [Auditoría](reports/performance-audit.md) | |
| [Seguridad](security/frontend-security.md) · [Modelo de amenazas](security/threat-model.md) · [Privacidad](security/privacy.md) | |
| [Observabilidad](observability/error-reporting.md) | **Lo que no hay, y cuánto cuesta** |

## Operación

| | |
|---|---|
| [Entornos](operations/environments.md) · [Build](operations/build.md) · [Despliegue](operations/deployment.md) | |
| [Configuración](operations/configuration.md) · [Caché y CDN](operations/cache-and-cdn.md) · [Reversión](operations/rollback.md) | |
| [**Runbooks**](operations/runbooks/index.md) | **Doce, uno por síntoma** |

## Gobierno

| | |
|---|---|
| [Política de documentación](governance/documentation-policy.md) | Qué se genera y qué se escribe |
| [Revisión](governance/review-process.md) · [Gestión del cambio](governance/change-management.md) | |
| [Cero regresiones](governance/zero-regression-policy.md) | Cómo se aplicó acá |
| [Matriz de trazabilidad](governance/traceability-matrix.md) | Con dos excepciones formales |
| [Propiedad](governance/ownership.md) | |

## Informes

| | |
|---|---|
| [Línea base](reports/baseline.md) | El estado inicial, reproducible |
| [Auditoría de estructura](reports/graphify-audit.md) | El grafo, y las derivas |
| [Inventario funcional](reports/frontend-inventory.md) | |
| [**Análisis de brechas**](reports/documentation-gap-analysis.md) | **47 hallazgos, priorizados** |
| [Validación de regresiones](reports/regression-validation.md) | |
| [**Preparación productiva**](reports/production-readiness.md) | **El veredicto** |
| [Validación final](reports/final-validation.md) | |
| [Inventarios generados](reports/generated/route-inventory.md) | Regenerables desde el código |

## Lo previo, que se conserva

`docs/auditoria/` es trabajo del equipo y **no se modificó**:

- [Diagnóstico (fases 0–1)](auditoria/01-diagnostico.md)
- [Fases ejecutadas 2–6](auditoria/02-fases-ejecutadas.md)

Igual que `README.md`, `ESTADO-FRONTEND.md`, `AVANCE-FRONTEND-*.md`,
`COORDINACION-AGENTES.md` y `PENDIENTES-BACKEND.md`, que esta documentación
**cita pero no reemplaza**.

## Cómo se lee esta documentación

**Como archivos Markdown**, en el repositorio o en el navegador de GitHub. Los
enlaces internos están verificados:

```bash
node scripts/check-doc-links.mjs
```

**El portal MkDocs no se puede construir acá**: MkDocs no está instalado y
añadirlo sería una dependencia nueva sin autorización. `mkdocs.yml` existe con la
navegación completa, y quien tenga Python puede levantarlo:

```bash
pip install mkdocs-material   # NO instalado en este proyecto
mkdocs serve
```

Los diagramas C4 salen de [`structurizr/workspace.dsl`](../structurizr/workspace.dsl),
que tampoco requiere instalar nada en el proyecto:

```bash
docker run --rm -p 8080:8080 -v "$PWD/structurizr:/usr/local/structurizr" structurizr/lite
```

## Mantenerla vigente

```bash
node scripts/generate-doc-report.mjs
```

Corre las seis verificaciones: inventarios al día, arquitectura, enlaces,
cobertura documental, deriva de API y presupuestos. **Ninguna añade
dependencias.** Ver
[la política de documentación](governance/documentation-policy.md#verificaciones-automáticas).
