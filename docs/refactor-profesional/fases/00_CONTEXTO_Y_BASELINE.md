# Fase 00 — contexto real, inventario y baseline

> Ejecutar tarea por tarea. Aplicar las restricciones de la especificación objetivo. No sustituir observación con suposiciones sobre el framework.

**Objetivo:** conocer qué existe, cómo funciona y qué se preservará. **Arquitectura:** inspección primero, sin reestructura prematura. **Stack:** por descubrir. **Spec:** [especificación objetivo](../ESPECIFICACION_OBJETIVO.md).

## Entradas y archivos

Consumir repositorio, instrucciones existentes, documentación y acceso local permitido. Leer manifiestos, lockfiles, router, punto de entrada, estilos, componentes, tests y contratos. Crear `trabajo/CONTEXTO_REAL.md`, `INVENTARIO.md`, `BASELINE.md`, `PLAN_SITUADO.md` y `ESTADO.md` dentro de la copia del kit.

Las rutas de producto a editar se determinan aquí. Los nombres propuestos en otros documentos no prueban que un archivo exista.

## F00.1 — identificar producto y alcance

- [ ] Leer instrucciones aplicables y estado del checkout; conservar cambios existentes.
- [ ] Registrar propósito del producto, usuarios conocidos, roles, datos sensibles, tareas principales y limitaciones del encargo.
- [ ] Marcar cada dato como observado, documentado, supuesto o desconocido.
- [ ] Identificar si el producto es principalmente informativo, transaccional o de trabajo recurrente. Puede tener zonas distintas.

**Aceptación:** una persona ajena entiende qué hace la app y qué no se conoce todavía. No se inventa audiencia, misión ni métricas.

## F00.2 — mapear el entorno ejecutable

- [ ] Descubrir gestor de paquetes por lockfile y documentación; no crear otro lockfile.
- [ ] Enumerar comandos reales de instalación, desarrollo, build, pruebas y calidad. Comprobar versiones requeridas.
- [ ] Identificar variables de entorno por nombre y propósito sin copiar secretos al informe.
- [ ] Arrancar con el procedimiento existente cuando sea posible; registrar URL local y resultado.

**Aceptación:** arranque demostrado o bloqueo reproducible documentado. Una instalación fallida no se reporta como defecto de UX.

## F00.3 — inventariar superficies y contratos

- [ ] Enumerar rutas, layouts, roles y accesos profundos; detectar páginas huérfanas y rutas duplicadas.
- [ ] Recorrer tres tareas candidatas: la principal, una frecuente de consulta y una de recuperación o edición.
- [ ] Mapear componentes repetidos, estilos globales, dependencias de UI/movimiento y patrones de datos.
- [ ] Listar funciones que deben preservarse y contratos de API relevantes.

**Aceptación:** cada ruta del alcance tiene propósito y estado de inspección. Los permisos observados se distinguen de supuestos.

## F00.4 — capturar el punto de partida

- [ ] Guardar capturas de escritorio/móvil con viewport, tema, rol y datos de prueba.
- [ ] Ejecutar los checks existentes pertinentes; registrar comando y resultado exactos.
- [ ] Medir una carga y un flujo de interacción con configuración descrita; no inventar métricas si faltan herramientas.
- [ ] Documentar defectos preexistentes que puedan confundirse con regresiones futuras.

**Aceptación:** hay evidencia comparable. Los datos de laboratorio se etiquetan como tales.

## F00.5 — situar el plan

- [ ] Crear tabla tarea → archivos reales → resultado → prueba → riesgo → reversión.
- [ ] Elegir alcance inicial y exclusiones; ordenar incógnitas por impacto.
- [ ] Continuar con supuestos reversibles cuando no afecten permisos o reglas críticas.

**Salida:** la fase 01 consume el inventario y baseline, no una lista genérica de gustos.

## Gate y recuperación

Gate: contexto suficiente, comandos comprobados, rutas mapeadas y limitaciones registradas. Si la ejecución está bloqueada, avanzar con auditoría estática y marcar qué criterios requieren navegador. No reemplazar la app con un mock para ocultar el bloqueo. Esta fase no necesita cambios productivos; revertir cualquier ajuste auxiliar que impida el arranque original.
