---
name: ui-atomic-solid
description: Use when refactoring UI component responsibilities, public interfaces, or dependencies using Atomic Design and SOLID in an existing codebase.
---

# Composición visual y contratos mantenibles

Aplicar Atomic Design a presentación y SOLID a responsabilidades y contratos. Consultar [criterios y casos](references/decisiones.md) para evitar fragmentación artificial.

## Procedimiento

1. Mapear consumidores, presentación, reglas de negocio, estado y transporte del flujo afectado.
2. Clasificar átomos, moléculas, organismos, plantillas y páginas según responsabilidad. Mantener elementos específicos dentro de su funcionalidad cuando no sean compartidos.
3. Definir la interfaz de cada módulo afectado: entradas, salidas, invariantes, errores, efectos y responsabilidades excluidas.
4. Introducir una separación cuando localice complejidad o permita sustituir una dependencia real. Preferir composición sobre herencia obligatoria.
5. Migrar un consumidor con pruebas de contrato y comportamiento. Extender tras demostrar equivalencia y retirar compatibilidad antigua al dejar de necesitarla.

## Salida

Entregar mapa de dependencias, contratos, archivos reales afectados, prueba de comportamiento y plan de retirada del legado.

## Límites

No crear clases, microservicios ni una carpeta por abstracción para aparentar SOLID. Un Link conserva navegación y un Button conserva acción; compartir apariencia no los vuelve semánticamente intercambiables. No extraer componentes sin consumidores o necesidad de coherencia identificable.
