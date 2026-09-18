# Fase 04 — arquitectura, contratos y estrategia de migración

> Refactorizar las dependencias que dificultan el objetivo. Mantener responsabilidades comprensibles y una aplicación operativa.

**Objetivo:** habilitar el rediseño sin mezclar presentación y reglas del producto. **Arquitectura:** módulos por funcionalidad y composición visual compartida. **Stack:** conservar el actual salvo necesidad demostrada. **Spec:** [especificación objetivo](../ESPECIFICACION_OBJETIVO.md).

## Entradas y salidas

Consumir inventario de dependencias, flujo piloto y cambios UX. Crear `trabajo/ARQUITECTURA.md`, contratos y decisiones ADR. Leer [Atomic Design y SOLID](../especificaciones/04_ATOMIC_DESIGN_Y_SOLID.md). El plan situado debe nombrar rutas existentes para cada edición.

## F04.1 — mapear responsabilidades

- [ ] Localizar presentación, estado, reglas, transporte y transformación de datos del piloto.
- [ ] Dibujar dependencias reales y detectar ciclos o conocimiento duplicado.
- [ ] Identificar los cambios que requieren tocar varias capas por acoplamiento accidental.
- [ ] Seleccionar un problema concreto para introducir o mejorar un seam.

**Aceptación:** el refactor tiene una razón y un resultado esperado; no se crea una arquitectura de referencia completa sin consumidores.

## F04.2 — definir interfaces

- [ ] Especificar entradas, salidas, errores, cancelación y efectos de cada operación afectada.
- [ ] Separar estados de UI y estados de negocio.
- [ ] Documentar quién autoriza, valida, persiste e invalida datos.
- [ ] Identificar garantías que el backend ofrece y las que no ofrece.

**Aceptación:** timeout, conflicto y permiso denegado tienen significado definido. No se inventa idempotencia frontend.

## F04.3 — proteger comportamiento

- [ ] Crear o conservar pruebas que capturen invariantes del flujo existente correcto.
- [ ] Para un defecto conocido, reproducirlo antes de cambiar la lógica.
- [ ] Diseñar la prueba de la nueva interfaz usando resultados observables.
- [ ] Distinguir caracterización de conducta legítima y congelación de un error histórico.

**Aceptación:** se puede detectar la regresión relevante. No se exige una prueba por línea de código.

## F04.4 — migrar un consumidor

- [ ] Introducir el contrato y adaptador mínimo necesarios.
- [ ] Conectar una ruta piloto sin reescribir todos los consumidores.
- [ ] Ejecutar pruebas pertinentes y comprobar UI/datos en el flujo.
- [ ] Revisar si la interfaz realmente simplifica a sus consumidores.

**Aceptación:** comportamiento preservado y dependencia mejor localizada. Si la abstracción solo añade pasos de lectura, simplificarla.

## F04.5 — planificar retirada del legado

- [ ] Listar consumidores restantes, orden y compatibilidad temporal.
- [ ] Definir condición de eliminación del adaptador o componente antiguo.
- [ ] Registrar qué incremento puede revertirse y cómo se comprueba.
- [ ] Actualizar las convenciones de imports y límites de módulos.

**Gate:** piloto técnicamente preparado, contratos explícitos y migración reversible. **Recuperación:** revertir el consumidor migrado y su adaptación compatible si falla el contrato; no revertir datos ni cambios ajenos. Una migración de esquema o API incompatible requiere su propio análisis y alcance.
