# ADR-0007: Fronteras de capa declaradas como alias de `tsconfig`

## Estado

**Aceptado** — con evidencia documental en el propio `tsconfig.json`.

## Contexto

El proyecto crece hacia 81 secciones. Sin fronteras explícitas, la primera
importación cruzada pasa inadvertida y a los seis meses el grafo es una red.

## Fuerzas y restricciones

- Un import que sube tres niveles con `../../../` deja de decir de dónde viene y
  se rompe al mover el archivo.
- La arquitectura tiene tres capas conceptuales; hacía falta que fueran también
  tres capas **comprobables**.

## Opciones consideradas

| Opción | Descartada porque |
|---|---|
| Convención de carpetas, sin más | No la hace cumplir nada |
| Un paquete por capa (monorepo) | Ceremonia desproporcionada |
| Regla de ESLint sobre rutas relativas | Complementaria, no sustituta |

## Decisión

**Tres alias en `tsconfig.json`, y su comentario declara que son la
arquitectura:**

```jsonc
"paths": {
  "@shared":     ["./src/app/shared/index.ts"],
  "@shared/*":   ["./src/app/shared/*"],
  "@core/*":     ["./src/app/core/*"],
  "@features/*": ["./src/app/features/*"]
}
```

> *«Estas tres claves son además las únicas fronteras que la arquitectura
> reconoce: lo que no entra en `@core`, `@shared` o `@features` no tiene lugar.»*

Más la regla que sostiene la jerarquía, en `shared/index.ts`:

> *«Regla inviolable: `shared/` NUNCA importa de `features/`.»*

## Consecuencias positivas

- **Cero dependencias circulares** sobre 587 importaciones internas.
- La dirección de las capas es unidireccional y comprobable.
- Mover una carpeta se paga una sola vez, en el barril.
- La comprobación está automatizada en `scripts/check-architecture.mjs`.

## Consecuencias negativas

- **El barril está infrautilizado**: `from '@shared'` a secas **no aparece en
  ninguna parte**. Los 21 archivos que usan el alias lo hacen por ruta profunda.
- Nada impide hoy importar algo interno de `shared/`.
- La mayoría de los features sigue usando rutas relativas
  (`../../shared/components/...`).

## Riesgos

| Riesgo | Estado |
|---|---|
| Que el barril quede como documentación muerta | **Materializado** — ver §Consecuencias |
| Que alguien salte una capa | **Mitigado**: `check-architecture.mjs` falla |
| Que la excepción de `core/dev/` se generalice | **Mitigado**: el script solo la admite ahí |

### La excepción declarada

`core/dev/` importa de `shared/` — **4 aristas sobre 587**. Es una herramienta de
desarrollo, está diferida y **no está montada en ninguna plantilla**.

`check-architecture.mjs` la trata como excepción y **falla si aparece una fuera
de `core/dev/`**.

## Evidencia

- `tsconfig.json`, con su comentario.
- `shared/index.ts`, con la regla inviolable.
- `scripts/lib/scan.mjs` → 0 ciclos, 587 aristas.
- 4 violaciones, todas en `core/dev/`.

## Plan de revisión

**Decidir el destino del barril** (adoptarlo, reducirlo o quitarlo). Ver
[reglas de composición](../components/composition-rules.md#el-barril-y-las-rutas-profundas).

Y revisar si aparece una cuarta capa candidata — por ejemplo, una capa de
dominio compartida con el backend.
