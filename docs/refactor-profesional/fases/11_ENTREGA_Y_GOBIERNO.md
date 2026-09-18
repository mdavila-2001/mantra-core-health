# Fase 11 — entrega, continuidad y mantenimiento

> Entregar un producto que pueda mantenerse, no solo una sesión de cambios difícil de continuar.

**Objetivo:** dejar cambios, evidencias y decisiones listos para revisión e integración. **Arquitectura:** documentación próxima al código y reglas proporcionales. **Stack:** el real del proyecto. **Spec:** [especificación objetivo](../ESPECIFICACION_OBJETIVO.md).

## Entradas y salidas

Consumir candidato verificado, QA final y decisiones. Crear `trabajo/ENTREGA.md`; actualizar documentación de componentes, convenciones de agentes y estado final. La publicación o integración externa se hace únicamente con autorización suficiente.

## F11.1 — resumir el resultado para producto

- [ ] Describir tareas mejoradas y cambios importantes de navegación.
- [ ] Adjuntar comparación antes/después con mismo contexto.
- [ ] Informar funciones conservadas, exclusiones y limitaciones conocidas.
- [ ] Evitar porcentajes de mejora sin método y muestra.

**Aceptación:** la explicación permite comprender el beneficio sin leer todos los diffs.

## F11.2 — documentar mantenimiento

- [ ] Explicar dónde viven tokens, componentes, reglas y adaptadores.
- [ ] Documentar cómo añadir una variante sin romper contratos.
- [ ] Registrar cómo ejecutar catálogo y checks reales.
- [ ] Actualizar skills y referencias que hayan quedado obsoletas.

**Aceptación:** un nuevo implementador puede realizar un cambio pequeño siguiendo el sistema sin reconstruirlo.

## F11.3 — gobernar excepciones

- [ ] Nombrar responsables de tokens, componentes y decisiones UX según el equipo real; no inventar personas.
- [ ] Establecer un proceso breve para proponer un patrón nuevo: necesidad, consumidores, estados, accesibilidad y coste.
- [ ] Mantener un registro de deprecaciones y condiciones de retirada.
- [ ] Separar deuda aceptada de defecto que bloquea entrega.

**Aceptación:** las reglas ayudan a decidir y no obligan a comités para correcciones pequeñas.

## F11.4 — preparar integración y reversión

- [ ] Presentar diff y descripción del cambio orientada al problema y resultado.
- [ ] Adjuntar pruebas y riesgos que un revisor necesita evaluar.
- [ ] Documentar mecanismo de reversión, verificación posterior y compatibilidad de datos.
- [ ] Si hay despliegue autorizado, preparar candidato y comprobar permisos antes de ejecutarlo; si no lo hay, dejarlo listo para revisión.

**Aceptación:** no se declara publicada una aplicación que solo se ejecutó localmente.

## F11.5 — cerrar estado y seguimiento

- [ ] Registrar última versión verificada y enlaces a evidencias.
- [ ] Listar pendientes concretos, responsable si existe y condición de cierre.
- [ ] Si se dispone de analítica autorizada, definir seguimiento de errores, éxito de tareas y rendimiento sin capturar datos innecesarios.
- [ ] Dejar prompt de continuación con primera acción exacta cuando quede trabajo.

**Gate:** R01–R14 trazados y entrega autocontenida. **Recuperación:** si una regresión aparece después, aplicar el plan documentado y conservar evidencia; no improvisar cambios destructivos para sostener la apariencia de éxito.

## Señales para futuras iteraciones

Reabrir decisiones cuando existan errores repetidos, abandono, nuevas tareas, cambios de dispositivos o desajustes de densidad. No rediseñar por calendario ni añadir tendencias visuales sin problema de producto. La disciplina consiste en conservar coherencia mientras se aprende de uso real.
