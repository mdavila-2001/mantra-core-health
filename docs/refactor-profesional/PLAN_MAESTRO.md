# Plan maestro de refactorización UX/UI

> Para ejecución con agentes: trabajar tarea por tarea, conservar el estado en documentos y revisar cada incremento. Se puede ejecutar con un solo agente; no depende de plugins ni de delegación.

**Objetivo:** transformar una aplicación existente en una experiencia profesional, manteniendo su integridad funcional y haciendo verificables las mejoras.

**Arquitectura:** refactorización incremental por funcionalidades, con un sistema visual compartido y contratos estables. Atomic Design organiza la composición de la interfaz; los módulos de producto conservan reglas, casos de uso y adaptadores donde aporten separación real.

**Stack:** se descubre en fase 00 y se conserva por defecto. **Especificación:** [ESPECIFICACION_OBJETIVO.md](ESPECIFICACION_OBJETIVO.md).

## Secuencia y dependencias

| Fase | Trabajo | Entrada | Gate de salida |
|---|---|---|---|
| [00](fases/00_CONTEXTO_Y_BASELINE.md) | Contexto y baseline | Repositorio y alcance | Entorno comprendido; comandos y rutas reales |
| [01](fases/01_AUDITORIA_Y_PRIORIZACION.md) | Auditoría y prioridad | Baseline | Problemas trazables, severidad y flujos piloto |
| [02](fases/02_UX_Y_ARQUITECTURA_INFORMACION.md) | UX y arquitectura de información | Hallazgos | Propuesta de navegación y tareas validables |
| [03](fases/03_DIRECCION_VISUAL_Y_TOKENS.md) | Dirección visual y tokens | Flujos y contenidos | Pantalla patrón y sistema inicial coherentes |
| [04](fases/04_ARQUITECTURA_Y_CONTRATOS.md) | Arquitectura y contratos | Inventario de dependencias | Primer seam verificable y plan de migración |
| [05](fases/05_COMPONENTES_Y_SKILLS.md) | Componentes y skills | Contratos y tokens | Componentes del piloto con estados completos |
| [06](fases/06_FLUJO_VERTICAL_PILOTO.md) | Flujo vertical piloto | Componentes iniciales | Una tarea real funciona de principio a fin |
| [07](fases/07_MOVIMIENTO_Y_FEEDBACK.md) | Movimiento y respuesta | Flujo funcional | Transiciones, reducción de movimiento y medición |
| [08](fases/08_MIGRACION_DEL_PRODUCTO.md) | Extensión al producto | Piloto demostrado | Rutas, roles y estados en alcance migrados |
| [09](fases/09_ACCESIBILIDAD_Y_RENDIMIENTO.md) | Accesibilidad y rendimiento | Producto migrado | Riesgos críticos resueltos; limitaciones explícitas |
| [10](fases/10_QA_Y_REGRESION.md) | QA y regresión | Gates anteriores | Evidencias reproducibles y diferencias revisadas |
| [11](fases/11_ENTREGA_Y_GOBIERNO.md) | Entrega y mantenimiento | Candidato verificado | Handoff, reversión y deuda residual documentados |

Accesibilidad, rendimiento y pruebas empiezan desde el baseline. Las fases 09 y 10 consolidan la evaluación, no posponen su aplicación. Diseño y arquitectura se ajustan mutuamente; un hallazgo del piloto puede devolver una decisión a fases 02–05 sin rehacer lo que sigue siendo válido.

## Unidades de trabajo

Cada tarea del plan situado debe tener ID, resultado observable, archivos verificados, entradas, cambios, prueba, aceptación y recuperación. Dividir por resultados revisables: “el error conserva el formulario y permite reintentar” es una unidad; “crear todas las carpetas” no demuestra una mejora del producto.

Una tarea puede requerir varias acciones pequeñas. Evitar estimaciones de minutos ficticias antes de inspeccionar el código. Usar tamaños relativos S/M/L, incertidumbre baja/media/alta y dependencias reales. Partir tareas L que mezclen navegación, API y cinco pantallas sin un criterio de aceptación común.

## Entregables que debe crear el agente ejecutor

| Documento en `trabajo/` | Contenido obligatorio | Momento |
|---|---|---|
| `CONTEXTO_REAL.md` | Producto, personas, stack, comandos y restricciones | 00 |
| `INVENTARIO.md` | Rutas, roles, acciones, componentes, dependencias | 00–01 |
| `BASELINE.md` | Evidencia inicial y configuración de medición | 00–01 |
| `HALLAZGOS.md` | Problema, impacto, evidencia, severidad y decisión | 01 |
| `MAPA_UX.md` | Tareas, navegación actual/propuesta y compatibilidad | 02 |
| `DIRECCION_VISUAL.md` | Pantalla patrón, composición, materiales y tokens | 03 |
| `ARQUITECTURA.md` | Módulos, interfaces y límites de dependencia | 04 |
| `PLAN_SITUADO.md` | Tareas con archivos existentes y comandos reales | Desde 00; precisado por fase |
| `ESTADO.md` | Última tarea verificada, bloqueos y siguiente acción | Todas |
| `EVIDENCIAS.md` | Pruebas, rutas de capturas, entorno y resultados | Todas |
| `DECISIONES.md` | ADR breves y decisiones de producto | Todas |
| `ENTREGA.md` | Cobertura, cambios, limitaciones y reversión | 11 |

Los documentos anteriores son salidas futuras; no están prellenados con hechos inventados en este ZIP. Las plantillas incluidas definen sus contratos y campos.

## Priorización

Primero preservar información y acceso: pérdida de datos, acciones equivocadas, barreras para completar tareas y autorizaciones rotas. Después resolver confusión estructural y estados incompletos. A continuación consolidar consistencia y legibilidad. Finalmente pulir movimiento y detalles de menor impacto.

No ordenar solo por “lo que luce más”. Un modal que pierde el foco puede impedir operar; un borde inconsistente rara vez tiene el mismo impacto. Una mejora de navegación con evidencia débil se prueba en un prototipo o incremento reversible antes de migrar todo el producto.

## Política de gates

- **Aprobado:** criterio demostrado con evidencia fechada y vinculada al incremento.
- **Parcial:** una parte demostrada y otra no; no habilita automáticamente tareas que dependan de la parte pendiente.
- **Bloqueado:** falta acceso, decisión o capacidad que impide esa verificación; detallar lo que desbloquea.
- **No aplica:** justificar por alcance o comportamiento real; no usar para ocultar un fallo.

No pasar un gate porque “ya se invirtió demasiado”. Cuando un criterio falla, corregir la causa o registrar una excepción concreta con responsable y alcance. Las decisiones internas reversibles no requieren una nueva ronda de autorización si ya están incluidas en el encargo.

## Gestión de cambios

Trabajar en rama o aislamiento compatible con el repositorio. Conservar el trabajo existente. Crear incrementos que puedan revertirse sin borrar datos ni deshacer cambios ajenos. Un feature flag solo se justifica si reduce riesgo de migración; asignarle condición de retirada para evitar dos productos permanentes.

Si el backend no ofrece una capacidad necesaria, distinguir: adaptación de UI posible; contrato a extender; operación fuera del alcance. No simular una garantía de persistencia, idempotencia o permiso mediante un cambio de frontend.

## Definición final de terminado

- Requisitos R01–R14 cubiertos, excluidos justificadamente o marcados como bloqueo real.
- Cero defectos conocidos P0/P1 abiertos en los flujos incluidos.
- Funciones previas conservadas o retiradas con decisión explícita; rutas históricas tratadas.
- Todos los controles incluidos tienen respuesta y los estados aplicables están implementados.
- Evidencias de QA, revisión visual, accesibilidad y rendimiento adjuntas con alcance.
- Documentación y skills reflejan el código entregado; deuda residual con responsables.
- Se conoce cómo revertir el incremento, qué datos conservar y cómo comprobar la recuperación.

Esta definición se aplica al producto en ejecución. La validación de este paquete documental no certifica esos resultados de una app todavía no inspeccionada.
