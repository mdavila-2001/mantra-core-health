---
name: ui-states-recovery
description: Use when designing form submission, loading, empty, error, conflict, or recovery states so an application reports real outcomes accurately.
---

# Estados completos y recuperación honesta

Modelar lo que el sistema sabe y las acciones seguras disponibles. Consultar [decisiones de estado](references/decisiones.md) para operaciones de lectura y escritura.

## Procedimiento

1. Identificar operación, contrato, permisos y garantías reales del backend.
2. Separar estados visuales de interacción y estados de la operación.
3. Diseñar carga, datos, vacío inicial, sin resultados y errores pertinentes.
4. Para escritura, distinguir enviando, confirmado, rechazado, conflicto y resultado desconocido. Conservar borrador cuando corresponda.
5. Definir recuperación segura. La cancelación o el timeout del cliente no demuestra que no hubo efecto en servidor.
6. Probar error, respuesta tardía, doble pulsación y recuperación con datos controlados. Verificar el resultado real donde se afirme persistencia.

## Salida

Entregar matriz de estados, transiciones, microcopy, acciones disponibles, garantías y limitaciones del contrato, más evidencias o pruebas pendientes identificadas.

## Límites

No simular éxito para mejorar percepción. No reintentar automáticamente una escritura ambigua sin garantías adecuadas. No anunciar idempotencia porque el botón está deshabilitado. No reemplazar errores de carga por ceros o vacíos engañosos.
