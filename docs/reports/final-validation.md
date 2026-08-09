# Informe final de documentación del frontend

- **Fecha:** 2026-08-01
- **Repositorio:** `mantra-core-health` · rama `dev` · commit base `ba2efd9`
- **Veredicto de producto (al cierre de este trabajo):** **NO APTO PARA
  PRODUCCIÓN**
- **Veredicto del trabajo documental:** **completo, con cinco limitaciones
  declaradas**

---

> ### ⚠️ Este informe es el acta de un trabajo cerrado
>
> Documenta la fase de documentación, que se hizo **sin tocar un solo archivo de
> `src/`**, y su veredicto corresponde a ese momento.
>
> Después se concedió autorización para cambiar producto, y los siete
> bloqueantes de la §20 se cerraron. **El veredicto vigente está en
> [el informe de preparación productiva](production-readiness.md): APTO A NIVEL
> DE CÓDIGO.**
>
> Este documento se conserva sin reescribir porque es el registro de qué se
> encontró, con qué evidencia y en qué estado estaba el repositorio antes.

---

## 1 · Resumen ejecutivo

Se documentó el frontend completo: 150 páginas, cuatro inventarios generados
desde el código, un modelo C4, diez ADR, doce runbooks, un modelo de amenazas
STRIDE y una matriz de trazabilidad con dos excepciones formales.

**Sin tocar un solo archivo de `src/`.**

Los hallazgos se resumen en tres frases:

1. **El código está en muy buen estado.** Arquitectura verificada, 807 pruebas,
   cero ciclos, diez dependencias, decisiones de seguridad y privacidad
   explícitas y bien razonadas.
2. **Lo que falta no está en `src/`**: no hay despliegue, ni telemetría, ni CSP,
   ni CI. La brecha es operativa.
3. **Cinco tipos de verificación no se pudieron ejecutar** por falta de
   instrumento, y se declaran como no verificables en vez de darse por
   cumplidas.

## 2 · Alcance y política de cero regresiones

| Tipo de trabajo | Qué |
|---|---|
| `DOCUMENTAL` | `docs/**` (excepto `docs/auditoria/`) |
| `INSTRUMENTACIÓN SEGURA` | 8 archivos en `scripts/`, `structurizr/`, `mkdocs.yml` |
| `CAMBIO DE PRODUCTO` | **Ninguno** |

**Cero archivos de `src/`, `public/`, `angular.json`, `tsconfig*`,
`eslint.config.js`, `vitest.config.ts` o `yarn.lock` modificados por este
trabajo.** Ver [validación de regresiones](regression-validation.md).

## 3 · Estado inicial

`git status` al empezar: un `.env` vacío, sin seguimiento.

**Durante la Fase 0 apareció trabajo concurrente** —la incorporación de un
generador de entorno público— que se preservó íntegro y obligó a **repetir la
batería completa**. Los números publicados son los de la segunda pasada.

Ver [línea base §1.1](baseline.md#11--trabajo-concurrente-durante-la-medición).

## 4 · Hallazgos de la auditoría de estructura

Graphify **no existe en este repositorio**. Se sustituyó por un análisis estático
reproducible (`scripts/lib/scan.mjs`), con la limitación declarada.

| Métrica | Valor |
|---|---:|
| Archivos TypeScript | 212 |
| Importaciones internas | 590 |
| **Dependencias circulares** | **0** |
| Archivos sin importadores | 2, **ambos explicados** |
| Paquetes externos | **10, todos de Angular** |

**Los dos nodos que gobiernan el sistema no son pantallas**: `view-state.types.ts`
(14 importadores) y `form-control.context.ts` (19). La arquitectura está
organizada alrededor de contratos.

**Cinco derivas registradas.** Dos (D2 y D3) las resolvió el trabajo concurrente,
no éste.

## 5 · Inventario de rutas y journeys

| Elemento | Cantidad | Documentado |
|---|---:|---|
| Rutas | 11 | **100 %** |
| Pantallas navegables | 8 | 100 % |
| Journeys | 6 + 3 flujos del armazón | 100 % |
| Operaciones HTTP | 20 | 100 % |
| — con pantalla que las use | 9 | |

**8 pantallas de las 81 del modelo.** Lo planificado y no construido **no se
documenta como si existiera**.

## 6 · Arquitectura documentada

Tres niveles C4 en `structurizr/workspace.dsl`, más once páginas de arquitectura.
Las decisiones estructurales quedaron en diez ADR **con su evidencia**, incluido
uno —[ADR-0010](../adr/ADR-0010-css-critico-en-linea.md)— cuyo motivo **no se
pudo recuperar**, y así se declara.

## 7 · Componentes y sistema de diseño

48 componentes en tres niveles, 188 tokens, dos temas. Catalogados, con
inventario regenerable.

Prácticas destacables: `<dialog>` nativo para la trampa de foco, `aria-disabled`
en vez del atributo nativo, contrato de accesibilidad por inyección, ids
deterministas para la hidratación, y **doce pruebas que leen `styles.css` del
disco** para vigilar las tres duplicaciones necesarias.

## 8 · Datos, estado y formularios

Señales, sin store externo, **sin caché**. Los nueve estados del M34 codificados
de forma que sus reglas no se puedan incumplir por olvido.

## 9 · Contratos e integraciones

20 operaciones, una sola integración externa (la API), **cero scripts de
terceros**. `check-api-contract-drift.mjs` verifica el código contra la
documentación; **el contrato del backend no se puede verificar** — excepción E2.

## 10 · Accesibilidad

WCAG 2.2 AA. **14 hallazgos: 0 bloqueantes, 2 altos, 8 medios, 4 bajos.**

**Este informe no declara conformidad AA**: no hubo auditoría automatizada ni
prueba con lector de pantalla.

## 11 · Rendimiento

Paquete inicial **518,95 kB** (~132 kB en tránsito), **18,95 kB sobre el umbral
de aviso**. **56,76 kB son código propio**; el resto es Angular.

**Sin Core Web Vitals medidos.** La recomendación número uno —Lighthouse con
`npx`— no requiere instalar nada.

## 12 · Seguridad y privacidad

Modelo STRIDE completo. **8 riesgos residuales**, los dos primeros de la misma
familia: sin CSP y sin cabeceras.

Y cuatro propiedades que conviene no perder: cero terceros, cero `innerHTML`,
secretos imposibles por construcción, y S6 que no filtra existencia.

**El marco normativo no está declarado**, así que la documentación de privacidad
describe buenas prácticas y **no puede afirmar cumplimiento**.

## 13 · Observabilidad y analítica

**No existe ninguna.** Ni registros remotos, ni errores, ni Web Vitals, ni
eventos.

Consecuencia: **la detección de incidentes depende de que alguien reporte**.

El catálogo de eventos propuesto señala el más barato y el más valioso:
`estado_ux_mostrado`, con **un solo punto de instrumentación** porque
`ViewStateHost` pinta los nueve estados para todo el proyecto.

## 14 · Pruebas y CI/CD

**807 pruebas en 71 archivos, 0 fallos.** Umbrales por área cumplidos.

Cinco capas faltan: E2E, contrato, visual, accesibilidad y rendimiento. **No hay
CI.**

Las seis verificaciones documentales existen y **ninguna añade dependencias**.

## 15 · Operación y despliegue

**No existe despliegue de producción.** Es el `BLOCKER`.

Sí existen: 12 runbooks, procedimiento de reversión, y la documentación de
entornos, build, configuración y caché.

## 16 · Validación de regresiones

**Cero regresiones atribuibles a este trabajo.** Evidencia comparable
antes/después en [su informe](regression-validation.md).

## 17 · Métricas finales

| Métrica del plan | Objetivo | Resultado |
|---|---|---|
| Rutas registradas documentadas | 100 % | ✅ **11/11** |
| Journeys críticos documentados | 100 % | ✅ **9/9** |
| Pantallas con estados documentados | 100 % | ✅ **8/8** |
| Componentes compartidos críticos catalogados | 100 % | ✅ **48/48** |
| Integraciones críticas trazadas | 100 % | ✅ **20/20** |
| Stores/providers críticos documentados | 100 % | ✅ **15/15** |
| Flujos críticos con prueba | 100 % o excepción formal | ✅ **excepción E1** |
| Incumplimientos críticos de accesibilidad abiertos | 0 | ⚠️ **0 conocidos, sin auditoría automatizada** |
| Riesgos críticos de seguridad abiertos | 0 | ❌ **2 (C-01, C-02)** |
| Regresiones nuevas de build, tipos, lint o pruebas | 0 | ✅ **0** |
| Regresiones visuales no aprobadas | 0 | ⚠️ **no verificable: sin instrumento** |
| Drift contractual crítico sin registrar | 0 | ✅ **0** (con excepción E2 declarada) |
| Enlaces internos válidos | 100 % | ✅ **verificado** |
| Errores de compilación documental | 0 | ✅ **0** |
| Marcadores provisionales | 0 | ✅ **0, verificado** |
| Runbooks críticos disponibles | 100 % | ✅ **12/12** |

**Trece de dieciséis cumplidas. Dos no verificables. Una incumplida.**

## 18 · Evidencia de órdenes

```text
yarn install --immutable        OK · lockfile intacto
yarn lint                       OK · sin hallazgos
yarn tsc --noEmit               OK · sin errores
yarn build                      OK · 4 rutas prerenderizadas · 518,95 kB
                                     ▲ aviso de presupuesto (preexistente)
yarn test:coverage              OK · 71 archivos · 807 pruebas · 0 fallos
                                     core 87,37 % · shared 94,22 % · features 74,74 %
yarn npm audit --recursive      1 moderada de desarrollo · 0 altas · 0 críticas

node scripts/generate-doc-report.mjs
  ✓ inventarios al día
  ✓ arquitectura       212 archivos · 590 importaciones · 0 ciclos
  ✓ enlaces documentales
  ✓ cobertura documental
  ✓ deriva de contrato de API   20 operaciones
  ✓ presupuesto de bundle       (con el aviso preexistente)
```

## 19 · Riesgos residuales

| # | Riesgo | Severidad |
|---|---|---|
| 1 | **Sin despliegue de producción** | **BLOCKER** |
| 2 | **Dominio de la API sin decidir** | **BLOCKER** |
| 3 | **Sin captura remota de errores** | **CRITICAL** |
| 4 | **Sin CSP ni cabeceras de seguridad** | **CRITICAL** |
| 5 | Sin versión ni identificador de build | HIGH |
| 6 | Sin E2E ni pruebas de contrato | HIGH |
| 7 | `Dashboard` y `ShellLayout` sin prueba | HIGH |
| 8 | `IDENTITY_VERIFICATION_ROUTE` no lleva a ninguna parte | HIGH |
| 9 | Sin monitoreo ni alertas | HIGH |
| 10 | Sin CI | HIGH |
| 11 | Dominio de los enlaces del correo sin coordinar | HIGH |
| 12 | 22 hallazgos MEDIUM y 10 LOW | — |

Detalle en [el análisis de brechas](documentation-gap-analysis.md).

## 20 · Declaración

### Del producto — al cierre de este trabajo

> ## ❌ NO APTO PARA PRODUCCIÓN

**Requisitos bloqueantes**, en orden, y en qué quedaron:

| # | Bloqueante | Estado hoy |
|---|---|---|
| 1 | Decidir si la API va detrás del mismo dominio (B-02) | ✅ **Va detrás.** `deploy/nginx.conf` |
| 2 | Imagen de producción, destino y pipeline (B-01) | ✅ Imagen y pipeline · **el destino sigue siendo de infraestructura** |
| 3 | Versionar el artefacto (H-01) | ✅ `buildInfo` con commit y fecha |
| 4 | Cabeceras de seguridad y CSP (C-02) | ✅ Seis cabeceras, CSP por hash |
| 5 | Telemetría de errores (C-01) | ⚠️ **Parcial**: el código de soporte existe; **falta el destino** |
| 6 | Monitoreo de disponibilidad y alertas | ❌ Depende de que exista un despliegue |
| 7 | Smoke posterior al despliegue | ✅ Checklist escrito · pendiente de ejecutarse |

Veredicto vigente en
[el informe de preparación productiva](production-readiness.md).

### Del trabajo documental

> ## ✅ COMPLETO, con cinco limitaciones declaradas

**Entregado:** los 20 entregables del plan, 150 páginas, 4 inventarios
generados, modelo C4, 10 ADR, 12 runbooks, modelo STRIDE, matriz de trazabilidad
y 8 scripts de verificación sin dependencias nuevas.

**Cinco limitaciones**, todas por falta de instrumento y ninguna disimulada:

| # | Limitación | Consecuencia |
|---|---|---|
| 1 | Graphify no existe | Sustituido por análisis estático; sin detección de comunidades |
| 2 | Sin auditoría automatizada de accesibilidad | **No se declara conformidad AA** |
| 3 | Sin regresión visual | La métrica correspondiente **no es verificable** |
| 4 | Sin OpenAPI del backend alcanzable | El contrato **no se puede verificar** — excepción E2 |
| 5 | MkDocs no instalado | El portal no se construye; `check-doc-links.mjs` cubre los enlaces |

**Cero regresiones atribuibles a este trabajo.**
