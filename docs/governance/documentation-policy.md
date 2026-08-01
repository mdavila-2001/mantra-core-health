# Política de documentación

Las reglas que gobiernan esta documentación, y las comprobaciones que las hacen
cumplir.

---

## Los tres principios

### 1 · Se documenta lo que hay, no lo que se planea

> *«No documentar pantallas, flujos, permisos o integraciones inexistentes como
> si estuvieran implementados.»*

Hay **8 pantallas de las 81 del modelo**. Esta documentación cubre el 100 % de
lo implementado y dice explícitamente qué falta. Las once operaciones de API sin
consumidor se documentan **como lo que son**: capa de datos por delante de la
interfaz.

### 2 · Toda afirmación se rastrea a evidencia

Código, configuración, ejecución o documento normativo. Cuando algo no se pudo
verificar, se dice — como en
[la auditoría de accesibilidad](../accessibility/audit-report.md#limitaciones-de-esta-auditoría),
que **no declara conformidad AA** porque no hubo verificación ejecutada.

### 3 · Documentar no autoriza a cambiar

Tres tipos de trabajo, separados:

| Tipo | Qué es |
|---|---|
| `DOCUMENTAL` | No altera ejecución ni comportamiento |
| `INSTRUMENTACIÓN SEGURA` | Verificadores y generadores que no tocan el producto |
| `CAMBIO DE PRODUCTO` | **Requiere autorización explícita** |

Cuando la documentación y el código difieren, **se describe el comportamiento
real y se registra la brecha**. Ver
[la deriva D1](../reports/graphify-audit.md#d1--un-comentario-de-logints-contradice-al-propio-código):
un comentario de `login.ts` contradice al propio código, y lo que se documentó es
lo que el código hace.

## Qué se genera y qué se escribe

| Se **genera** | Se **escribe** |
|---|---|
| `docs/reports/generated/**` | Todo lo demás |
| Inventario de rutas | Por qué existe cada ruta |
| Inventario de componentes | Cómo se componen y por qué |
| Inventario de API | Qué significa cada contrato |
| Grafo de módulos | Qué implica la centralidad |

Lo generado lleva su aviso:

```markdown
<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->
```

**Un inventario a mano se desactualiza; una interpretación generada no existe.**

## Verificaciones automáticas

Seis, ninguna con dependencias nuevas:

| Orden | Qué verifica | Falla si |
|---|---|---|
| `generate-inventory.mjs --check` | Los inventarios reflejan el código | Se agregó código y no se regeneró |
| `check-architecture.mjs` | Ciclos, capas y superficie de red | Aparece un ciclo, un import contra las capas o un `this.http` fuera de `core/data-access/` |
| `check-doc-links.mjs` | Enlaces y anclas internos | Hay un destino o un ancla inexistente |
| `check-doc-coverage.mjs` | Rutas, organismos y servicios documentados; sin marcadores | Falta cobertura o queda un `TODO` |
| `check-api-contract-drift.mjs` | Los endpoints del código coinciden con los declarados | Se agregó una llamada sin documentarla |
| `check-bundle-budget.mjs` | El artefacto contra los presupuestos | Supera el umbral de error |

```bash
node scripts/generate-doc-report.mjs   # corre las seis
```

### Lo que estas verificaciones **no** pueden hacer

Declarado, para que nadie confíe de más:

- **No verifican que el backend cumpla su contrato.** Su OpenAPI no es
  alcanzable desde acá.
- **No verifican que un texto sea cierto**, solo que las referencias existan.
- **No detectan una regresión visual ni de contraste.**
- **No sustituyen a MkDocs**: `check-doc-links.mjs` hace lo que la construcción
  estricta haría con los enlaces, pero no genera el sitio.

## Estilo

| Regla | |
|---|---|
| Español técnico | El del proyecto y el de sus comentarios |
| Términos consistentes con la interfaz real | «organización», no «tenant», en texto de producto |
| Los códigos del M34 (S1…S9) son vocabulario compartido | |
| **Separar comportamiento actual, decisión, riesgo y recomendación** | |
| Sin texto de relleno | `check-doc-coverage` marca las páginas de menos de 200 caracteres |
| Sin capturas con datos personales, tokens ni entornos internos | Hoy no hay capturas |
| Diagramas con propósito | Mermaid para secuencias, Structurizr para C4 |
| Tablas en el estilo del repositorio | `\|---\|---\|`, como `docs/auditoria/` y `ESTADO-FRONTEND.md` |

### La regla de las citas

Este proyecto tiene comentarios inusualmente buenos. **Cuando el código explica
el porqué mejor de lo que lo haría una paráfrasis, se cita**:

> *«Esconder un ítem no protege nada —la autoridad es la API, que valida en cada
> petición—; es no ofrecer una puerta que va a estar cerrada.»*

Citar en vez de reescribir mantiene la trazabilidad y evita que la documentación
diga algo distinto del código.

## Métricas

| Métrica | Objetivo | Estado |
|---|---|---|
| Rutas documentadas | 100 % | ✅ 11/11 |
| Organismos documentados | 100 % | ✅ 14/14 |
| Servicios documentados | 100 % | ✅ 15/15 |
| Integraciones trazadas | 100 % | ✅ 20/20 |
| Enlaces internos válidos | 100 % | ✅ verificado |
| Marcadores provisionales (`TODO`, `TBD`, …) | 0 | ✅ verificado |
| Runbooks críticos | 100 % | ✅ 12/12 |
| ADR de decisiones relevantes | — | ✅ 10 |
| **Regresiones visuales no aprobadas** | 0 | ⚠️ **no verificable: no hay instrumento** |
| **Incumplimientos críticos de accesibilidad** | 0 | ⚠️ **0 conocidos, sin auditoría automatizada** |

Las dos últimas se declaran como **no verificables**, no como cumplidas. Es la
diferencia entre no encontrar problemas y no haber buscado.

## Ciclo de vida

| Evento | Acción |
|---|---|
| Ruta nueva | Ficha en `docs/routes/` + regenerar inventarios |
| Componente compartido nuevo | Regenerar inventarios; si es organismo, mencionarlo |
| Operación de API nueva | Declararla en `backend-api.md` |
| Decisión de arquitectura | **ADR** |
| Cambio en un nodo de alta centralidad | Actualizar su página + revisión explícita |
| Brecha cerrada | Actualizar `documentation-gap-analysis.md` |

Ver [gestión del cambio](change-management.md).

## Lo preexistente no se toca

`docs/auditoria/` es trabajo previo del equipo y **se conserva sin modificar**.
Igual que `README.md`, `ESTADO-FRONTEND.md`, `AVANCE-FRONTEND-*.md`,
`COORDINACION-AGENTES.md` y `PENDIENTES-BACKEND.md`, que esta documentación
**cita pero no reemplaza**.
