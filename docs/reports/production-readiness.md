# Informe de preparación para producción

- **Fecha:** 2026-08-01
- **Alcance:** frontend `mantra-core-health`
- **Veredicto:** **NO APTO PARA PRODUCCIÓN**

---

## Declaración

> ## ❌ NO APTO PARA PRODUCCIÓN

**No por la calidad del código, que es alta.** Por dos bloqueantes operativos:

| # | Bloqueante | Por qué bloquea |
|---|---|---|
| **B-01** | **No existe despliegue de producción** | No hay imagen, ni destino, ni dominio, ni pipeline. **No hay dónde entregar** |
| **B-02** | **No está decidido si la API va detrás del mismo dominio** | Sin esa decisión no se puede construir la imagen, escribir la CSP ni saber si hace falta CORS |

Y por dos riesgos críticos que, aunque no impidan desplegar, **impiden operar**:

| # | Crítico | Por qué |
|---|---|---|
| **C-01** | **Sin captura remota de errores** | Una pantalla en blanco es invisible. **Nadie detecta un incidente** |
| **C-02** | **Sin CSP ni cabeceras de seguridad** | Segunda línea ausente frente a XSS, con el refresh token en `localStorage`. Y clickjacking posible |

**B-02 es el primero de la cadena**: desbloquea B-01 y C-02.

---

## Lo que sí está listo

Conviene decirlo antes que los huecos, porque es mucho:

| Área | Estado | Evidencia |
|---|---|---|
| **Compilación y tipos** | ✅ | `strict` + `strictTemplates`, limpio |
| **Lint** | ✅ | Sin hallazgos |
| **Pruebas** | ✅ | **807 pruebas, 0 fallos** |
| **Cobertura** | ✅ | `core` 87 % · `shared` 94 % · `features` 75 %, con umbrales **bloqueantes** |
| **Arquitectura** | ✅ | **0 ciclos** sobre 590 importaciones; capas verificadas |
| **Superficie de dependencias** | ✅ | **10 paquetes, todos de Angular.** Cero scripts de terceros |
| **Vulnerabilidades** | ✅ | 0 altas, 0 críticas. 1 moderada de desarrollo que **no llega al navegador** |
| **Build de producción** | ✅ | Artefacto completo, 4 rutas prerenderizadas |
| **Manejo de errores de la API** | ✅ | Los 9 estados del M34, con `requestId` obligatorio |
| **Sesión** | ✅ | Refresco único, rotación completa, cierre que limpia pase lo que pase |
| **Privacidad de diseño** | ✅ | S6 no filtra existencia; el acuse de recuperación no enumera cuentas |
| **Secretos** | ✅ | **Imposibles por construcción**: `generate-env.mjs` falla al compilar |
| **XSS** | ✅ | Cero `innerHTML`, cero `bypassSecurityTrust*`, cero terceros |
| **Enlaces externos** | ✅ | `noopener noreferrer` automático, con prueba |
| **Accesibilidad de base** | ✅ | Contrato de formularios, `<dialog>` nativo, salto y anuncio de ruta |
| **Documentación** | ✅ | 150 páginas, verificadas |

## Checklist del plan maestro

### Protección

| | |
|---|---|
| ☑ Se registró el estado inicial del repositorio | [línea base](baseline.md) |
| ☑ Se preservaron los cambios preexistentes | Y el **trabajo concurrente** |
| ☑ No se modificó comportamiento sin autorización | **Cero archivos de `src/`** |
| ☑ Build, lint, tipos y pruebas iguales o mejores | 807 pruebas, cobertura igual o superior |
| ☐ Toda diferencia visual fue revisada y autorizada | **No verificable: sin instrumento.** No hubo cambios de UI |
| ☑ No se actualizaron dependencias ni lockfiles | Por este trabajo |
| ☑ Existe evidencia de reversión | [regresiones §5](regression-validation.md#5--cómo-revertir-exclusivamente-este-trabajo) |

### Graphify y arquitectura

| | |
|---|---|
| ☑ Se consultaron los artefactos relevantes | **No existen**; limitación documentada y sustituto justificado |
| ☑ Rutas, componentes y dependencias inventariados | Generados desde el código |
| ☑ Se revisaron ciclos, huérfanos y alta centralidad | 0 ciclos · 2 huérfanos explicados · 12 nodos de alta centralidad |
| ☑ Diagramas y código son coherentes | C4 en Structurizr, verificado contra el grafo |

### Producto y rutas

| | |
|---|---|
| ☑ El 100 % de rutas registradas está documentado | 11/11 |
| ☑ Journeys críticos documentados | 6 journeys + 3 flujos del armazón |
| ☑ Roles, permisos y redirecciones descritos | Y **por qué el frontend no autoriza** |
| ☑ Estados de carga, vacío, error y éxito cubiertos | Los 9 del M34 |

### Componentes y diseño

| | |
|---|---|
| ☑ Componentes compartidos críticos catalogados | 48, con inventario generado |
| ☑ Props, eventos, variantes y estados documentados | |
| ☑ Tokens y reglas responsivas documentados | 188 tokens |
| ☑ Componentes legados u obsoletos identificados | **Ninguno** |

### Integraciones y estado

| | |
|---|---|
| ☑ APIs consumidas trazadas | 20/20 |
| ☑ Drift contractual verificado | Contra la documentación. **No contra el backend** — excepción E2 |
| ☑ Stores, providers, caché e invalidación documentados | Incluida la **ausencia** de caché |
| ☑ Datos sensibles en storage identificados | Dos claves, ambas documentadas |

### Calidad

| | |
|---|---|
| ☑ Pruebas críticas pasan | 807/807 |
| ☑ Accesibilidad auditada | **De código.** 14 hallazgos, 0 bloqueantes |
| ☑ Rendimiento con línea base y presupuesto | De **artefacto**. **Sin Core Web Vitals** |
| ☐ Regresión visual revisada | **No verificable: sin instrumento** |
| ☑ Sin enlaces documentales rotos | Verificado |
| ☑ Sin páginas vacías ni marcadores | Verificado |

### Seguridad y operación

| | |
|---|---|
| ☑ Modelo de amenazas completado | STRIDE, 8 riesgos residuales |
| ☑ Tokens, almacenamiento y privacidad documentados | |
| ☐ **CSP documentada e implementada** | **Documentada. NO implementada** → C-02 |
| ☐ **Despliegue, caché y rollback documentados** | **Documentados. El despliegue NO existe** → B-01 |
| ☑ Runbooks críticos disponibles | 12/12 |
| ☐ **Observabilidad y correlación documentadas** | **Documentadas. La telemetría NO existe** → C-01 |

## Requisitos para declarar APTO

En orden, porque unos desbloquean a otros:

| # | Requisito | Bloquea a |
|---|---|---|
| 1 | **Decidir el dominio de la API** (B-02) | 2, 4 |
| 2 | **Imagen de producción, destino y pipeline** (B-01) | 3, 5, 6, 7 |
| 3 | **Versionar el artefacto** (H-01) | Rollback y diagnóstico |
| 4 | **Cabeceras de seguridad y CSP** (C-02) | — |
| 5 | **Telemetría de errores** (C-01) | 6 |
| 6 | **Monitoreo de disponibilidad y alerta de picos de S8/S9** | — |
| 7 | **Smoke posterior al despliegue** | — |
| 8 | **CI que corra la batería** (H-10) | — |

Los ocho son cambios de producto y necesitan autorización. **El 1 es solo una
decisión** y no cuesta nada más que tomarla.

### Recomendables antes de producción, no bloqueantes

| # | Qué | Por qué |
|---|---|---|
| 9 | **Probar `Dashboard` y `ShellLayout`** (H-04) | La única pantalla autenticada. **No requiere herramientas nuevas** |
| 10 | **Corregir `IDENTITY_VERIFICATION_ROUTE`** (H-05) | Hoy la puerta no lleva a ninguna parte |
| 11 | **Cerrar A11Y-01/03/04** con una directiva | Tres brechas de un golpe |
| 12 | **Lighthouse una vez** con `npx` | La primera línea base de rendimiento |
| 13 | **Decidir el presupuesto** (M-19) | Bajar o subir; no dejarlo avisando |

## Riesgos si se despliega igual

Para que la decisión, si se toma, se tome sabiendo:

| Riesgo | Probabilidad | Impacto |
|---|---|---|
| Un fallo de render deja pantallas en blanco **y nadie se entera** | **Alta** | Alto |
| La API cae y **nadie lo detecta** hasta que reporten | **Alta** | Alto |
| Un XSS lee el refresh token, **sin CSP que lo frene** | Baja | **Crítico** |
| La aplicación se mete en un iframe (clickjacking) | Baja | Alto |
| No se puede revertir: **no hay versión que identificar** | Media | Alto |
| Los enlaces del correo no llegan al frontend | **Media** | Alto — rompe dos journeys |
| Una regresión de contrato de la API pasa a producción | Media | Medio |

**Los dos primeros son los que convierten un incidente menor en uno largo.**

## Conclusión

**El código está en buen estado. La operación no existe todavía.**

Este frontend tiene una arquitectura verificada, 807 pruebas que pasan,
cobertura por encima de umbrales bloqueantes, cero dependencias circulares, diez
dependencias externas y decisiones de seguridad y privacidad que en muchos
proyectos maduros no se ven.

Lo que le falta no está en `src/`: está en **cómo se entrega, cómo se vigila y
cómo se recupera**.

> ## ❌ NO APTO PARA PRODUCCIÓN
>
> **Bloqueantes:** B-01 (sin despliegue) y B-02 (dominio de la API sin decidir).
> **Críticos:** C-01 (sin telemetría de errores) y C-02 (sin CSP ni cabeceras).
>
> Cerrados los cuatro, y con los puntos 3, 6 y 7 de la lista de requisitos, el
> veredicto cambia.

Detalle completo en [el análisis de brechas](documentation-gap-analysis.md).
