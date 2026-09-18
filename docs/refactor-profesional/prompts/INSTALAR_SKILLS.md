# Usar las skills del kit en Claude Code y Codex

## Fuente canónica

Las carpetas bajo `skills/` son portables y autocontenidas. Cada una incluye un `SKILL.md` con nombre y descripción, más una referencia de decisiones. El agente puede leerlas directamente sin instalación. Este ZIP no instala skills personales ni cambia configuraciones globales.

## Uso por proyecto

| Entorno | Destino documentado | Ejemplo de invocación local |
|---|---|---|
| Claude Code | `.claude/skills/<nombre>/SKILL.md` | `/ui-audit-and-reorder` si la versión la descubre |
| Codex | `.agents/skills/<nombre>/SKILL.md` | `$ui-audit-and-reorder` si la versión la descubre |
| Chat sin ejecución | Adjuntar los archivos pertinentes | Pedir aplicar las instrucciones por nombre y contenido |

Verificar descubrimiento en la versión real. Fuentes: [Claude Code](https://code.claude.com/docs/en/skills), [Codex](https://learn.chatgpt.com/docs/build-skills) y [especificación Agent Skills](https://agentskills.io/specification).

## Procedimiento seguro y concreto

1. Seleccionar solo las skills que usarás. Inspeccionar si ya hay carpetas o nombres equivalentes.
2. Copiar la carpeta completa, incluidas referencias, al destino del proyecto. No copiar únicamente `SKILL.md`.
3. Conservar `skills/` del kit como fuente canónica o trasladar esa función explícitamente a una sola ubicación. Evitar editar dos copias independientemente.
4. Comprobar frontmatter, nombre de carpeta, enlaces internos y contenido de referencias.
5. Pedir al agente que indique qué skill descubrió y su propósito, o leerla por ruta si el entorno no ofrece descubrimiento.
6. Ejecutar un escenario real acotado y evaluar resultado. Que el archivo aparezca en una lista no prueba que la skill mejore decisiones.
7. Versionar cambios con el proyecto según su flujo existente. Si hay dos copias para Claude y Codex, comparar contenido tras cada modificación.

No proporcionar un instalador que sobrescriba silenciosamente skills existentes. Si el entorno exige otro directorio, seguir su documentación; el formato portable no garantiza que todos los productos lean el mismo lugar.

## Catálogo

| Skill | Cuándo cargar |
|---|---|
| `ui-audit-and-reorder` | Auditoría, navegación o reubicación de funciones |
| `ui-visual-system` | Dirección visual, tokens y consistencia |
| `ui-atomic-solid` | Contratos y refactor de componentes |
| `ui-motion-feedback` | Transiciones y respuesta interactiva |
| `ui-states-recovery` | Cargas, errores, formularios y persistencia |
| `ui-quality-gate` | Revisión y evidencia antes de cerrar un incremento |

## Crear nuevas skills de diseño

Crear una skill cuando exista una tarea repetible con decisiones no triviales. Mantener corto el disparador y cargar el detalle desde referencias cuando sea necesario. El contrato de salida debe facilitar comprobar el resultado; no acumular adjetivos como “perfecto”, “élite” o “increíble”.

Una nueva skill necesita al menos un escenario de uso, uno de límite de alcance y uno con información faltante. Evaluar si el agente conserva el producto, declara incertidumbre y produce el artefacto requerido. Si la evaluación base ya hace lo correcto, no atribuir a la skill una mejora causal que no se ha demostrado. Puede aportar estandarización y trazabilidad sin “corregir” un fallo previo.
