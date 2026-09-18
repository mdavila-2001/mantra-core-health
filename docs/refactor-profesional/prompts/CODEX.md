# Adaptador para Codex

Usar con el prompt maestro y acceso al repositorio. El plan es independiente de un nombre de modelo y no necesita flags que reduzcan las protecciones del entorno.

```text
Adapta el plan de refactorización a Codex y a este repositorio.

Lee las instrucciones AGENTS.md aplicables antes de editar; conserva su alcance y cualquier instrucción más específica. Si agregas una sección para el refactor, hazlo de forma acotada y sin reemplazar reglas del proyecto. No modifiques la configuración global del usuario para ejecutar este paquete.

Localiza el kit en docs/refactor-profesional/. Usa las skills por ruta o, si se solicita instalación local, sitúa las carpetas autocontenidas seleccionadas en .agents/skills/. Comprueba colisiones y documentación de la versión real de Codex. No dupliques la misma skill en varios niveles de descubrimiento sin necesidad.

Antes de modificar código, inspecciona estado de Git, estructura, scripts, lockfiles y convenciones. Registra las rutas reales y comandos en trabajo/PLAN_SITUADO.md. Mantén cambios pequeños y coherentes. No reviertas trabajo que no hayas creado.

Ejecuta por fases con criterio de aceptación y evidencia. Usa las herramientas de navegador, pruebas y capturas disponibles para verificar la aplicación. Si falta una capacidad, realiza las comprobaciones que sí están disponibles y registra exactamente qué no se pudo comprobar.

Actualiza trabajo/ESTADO.md y EVIDENCIAS.md tras incrementos significativos. Antes de afirmar que algo funciona, ejecuta el comando o recorrido correspondiente sobre el candidato actual. Mantén las limitaciones separadas de los resultados aprobados.

Continúa con las acciones locales reversibles ya autorizadas. Para una operación externa, respeta el alcance y los permisos existentes; prepara una propuesta concreta si requiere una decisión adicional. No uses loops indefinidos ni repitas una operación fallida sin nueva evidencia que justifique el intento.

Si se cambia de agente a Claude Code, entrega el mismo estado verificable del repositorio y la siguiente tarea concreta. Ningún agente debe empezar de nuevo a partir de una interpretación estética distinta sin revisar decisiones y evidencia.
```

## Fragmento opcional para AGENTS.md

```markdown
## Refactorización profesional UX/UI

Especificación: docs/refactor-profesional/ESPECIFICACION_OBJETIVO.md.
Plan: docs/refactor-profesional/PLAN_MAESTRO.md.
Estado: docs/refactor-profesional/trabajo/ESTADO.md.
Conservar contratos de negocio, semántica accesible y funcionalidad sin animaciones.
Validar cada incremento con evidencia del candidato real; no inventar resultados.
```

Fuentes oficiales: [skills locales de Codex](https://learn.chatgpt.com/docs/build-skills) y [instrucciones con AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md). Las rutas de instalación son específicas del entorno; los archivos del kit pueden leerse directamente sin instalación.
