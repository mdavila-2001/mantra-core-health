# Adaptador para Claude Code

Usar después del prompt maestro, con el repositorio abierto. No requiere un modelo específico ni un plugin comercial. Si Claude solo tiene acceso a archivos adjuntos, debe producir propuestas y marcar ejecución no disponible.

```text
Adapta el plan de refactorización a Claude Code y al repositorio actual.

Lee primero las instrucciones CLAUDE.md aplicables y las convenciones existentes. No sobrescribas archivos de instrucciones completos para añadir este plan. Si necesitas instrucciones persistentes, agrega una sección breve que apunte a docs/refactor-profesional/ y a trabajo/ESTADO.md, conservando las reglas previas.

Usa las skills del kit por ruta. Si se solicita instalación local de proyecto, copia cada carpeta autocontenida seleccionada en .claude/skills/ conservando SKILL.md y references/. Revisa posibles colisiones de nombres antes de escribir. Verifica en la documentación vigente de Claude Code cómo se descubren las skills en esta versión; no supongas que la instalación local también las instala en Claude web o en otro servicio.

Trabaja con contexto progresivo: prompt y especificación, fase actual, referencias necesarias y código relevante. Al cambiar de fase, resume decisiones y evidencia en trabajo/ESTADO.md. No comprimas los resultados hasta perder los comandos, archivos o bloqueos necesarios para retomar.

Si el entorno permite delegación y está autorizada, reserva tareas independientes con archivos y criterios de aceptación separados. Mantén un único escritor por archivo; integra resultados después de revisarlos. Si no hay delegación, ejecuta el mismo plan secuencialmente.

Para cambios de comportamiento, reproduce el problema o escribe una prueba significativa antes de modificar la lógica. Usa el navegador para comprobar apariencia y tareas cuando esté disponible. No presentes un plan o un mock como implementación terminada.

Al finalizar cada incremento, informa el resultado para el usuario, las pruebas reales y la siguiente acción. Continúa con el trabajo local autorizado. Una restricción de herramientas se registra como limitación concreta; no se oculta ni se convierte en una promesa de trabajo en segundo plano.
```

## Fragmento opcional para CLAUDE.md

Integrar con las instrucciones existentes:

```markdown
## Refactorización profesional UX/UI

El alcance y los criterios están en docs/refactor-profesional/ESPECIFICACION_OBJETIVO.md.
Consulta docs/refactor-profesional/trabajo/ESTADO.md antes de continuar.
Lee la fase vigente y sus referencias; conserva reglas de negocio y cambios ajenos.
Cada afirmación de validación debe enlazar evidencia real o indicar que no se ejecutó.
```

La ubicación `.claude/skills/<nombre>/SKILL.md` y su descubrimiento se documentan en [Extend Claude with skills](https://code.claude.com/docs/en/skills). Verificar la versión instalada cuando haya diferencias de comportamiento.
