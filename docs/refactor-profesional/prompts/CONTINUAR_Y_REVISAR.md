# Prompts de continuidad, corrección y revisión

## Continuar sin reiniciar el trabajo

```text
Continúa la refactorización profesional de este repositorio.
Lee las instrucciones aplicables, docs/refactor-profesional/trabajo/ESTADO.md,
PLAN_SITUADO.md, DECISIONES.md y la evidencia de la última tarea completada.
Comprueba que el estado documentado coincide con el checkout y los archivos reales.
Identifica el último incremento verificado y ejecuta la siguiente tarea pendiente
cuyas dependencias estén satisfechas. Conserva decisiones válidas y cambios ajenos.
Si falta un documento, reconstruye solo lo necesario desde el repositorio y marca
la incertidumbre. No repitas fases completas sin una razón concreta.
Actualiza el estado y continúa hasta cerrar el alcance autorizado o encontrar
un bloqueo real que requiera información que no puedas obtener.
```

## Revisión crítica de un candidato

```text
Revisa el candidato actual frente a ESPECIFICACION_OBJETIVO.md y la fase ejecutada.
No asumas que los reportes prueban sus conclusiones: examina los cambios y verifica
una muestra de evidencia relevante. Busca pérdida de funcionalidad, estados falsos,
reglas de negocio alteradas, barreras de teclado, reubicaciones sin justificación,
contratos incoherentes, efectos costosos y tests que solo prueban mocks.
Entrega hallazgos por severidad con ruta, reproducción, consecuencia y criterio
de corrección. Separa hechos de sospechas. Si no hay hallazgos, indica el alcance
revisado y las limitaciones. No declares que el producto es perfecto.
No modifiques código en esta revisión salvo que se te haya encargado corregirlo.
```

## Corregir hallazgos confirmados

```text
Reproduce los hallazgos confirmados de la revisión y corrige sus causas dentro
del alcance del refactor. Si un hallazgo es incorrecto, explica la evidencia.
Preserva contratos y no cambies tests para ocultar una regresión. Verifica cada
corrección con el escenario que fallaba y con los checks afectados. Actualiza
documentación y evidencias. Continúa con los siguientes hallazgos resolubles.
```

## Auditoría visual final

```text
Evalúa las pantallas reales del candidato en los viewports y estados definidos.
Revisa jerarquía, alineamientos, espacio, tipografía, contraste, contenido largo,
foco, superposiciones y consistencia de acciones. Relaciona cada observación con
una regla o una tarea; evita opiniones vagas. Incluye estados de error, vacío,
carga y permisos. Comprueba que el movimiento explica cambios y que la versión
reducida conserva feedback. Devuelve una lista priorizada y evidencia visual.
```

## Cuando falte acceso o ejecución

```text
Con los archivos disponibles, realiza el diagnóstico estático y prepara los cambios
o el plan que sí puedas fundamentar. Enumera verificaciones no ejecutables y qué
acceso concreto las habilita. No simules resultados de navegador ni datos de campo.
Deja la siguiente acción exacta para que otro agente continúe en un entorno completo.
```
