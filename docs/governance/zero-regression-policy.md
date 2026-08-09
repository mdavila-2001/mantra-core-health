# Política de cero regresiones

Cómo se aplicó en este trabajo documental, y cómo aplicarla en el siguiente.

---

## La regla

> **Documentar primero. Proponer por separado. Modificar únicamente con
> autorización. Validar siempre antes y después.**

Y la prohibición que la sostiene:

> *«Queda prohibido declarar "sin impacto" sin evidencia comparable antes/después.»*

## Los tres tipos de trabajo

| Tipo | Qué es | Autorización |
|---|---|---|
| `DOCUMENTAL` | No altera ejecución ni comportamiento | No |
| `INSTRUMENTACIÓN SEGURA` | Añade verificación o generación documental sin afectar al producto | No |
| `CAMBIO DE PRODUCTO` | Modifica comportamiento, interfaz, contrato, dependencia o arquitectura | **Sí, explícita** |

### Qué se hizo en este trabajo

| Tipo | Qué |
|---|---|
| `DOCUMENTAL` | `docs/**` (salvo `docs/auditoria/`, preexistente) |
| `INSTRUMENTACIÓN SEGURA` | `scripts/lib/scan.mjs`, `scripts/generate-inventory.mjs`, `scripts/check-*.mjs`, `scripts/generate-doc-report.mjs`, `structurizr/workspace.dsl`, `mkdocs.yml` |
| `CAMBIO DE PRODUCTO` | **Ninguno** |

**Ni un archivo de `src/`, `public/`, `package.json`, `angular.json`,
`tsconfig*.json`, `eslint.config.js`, `vitest.config.ts` ni `yarn.lock` fue
modificado por este trabajo.** La comprobación está en
[la validación de regresiones](../reports/regression-validation.md).

## Antes de tocar cualquier archivo ejecutable

1. Registrar el estado de Git y los cambios preexistentes.
2. Identificar los archivos exactos que se pretenden modificar.
3. `yarn install --immutable` — sin tocar el lockfile.
4. Ejecutar build, lint, tipos y pruebas.
5. Registrar las rutas y flujos que funcionan.
6. Capturar evidencia visual, si hay herramienta. **Acá no la hay.**
7. Verificar los contratos consumidos del backend.
8. Definir cómo revertir **exclusivamente** los cambios propios.

## Después de cada modificación autorizada

1. Repetir la misma batería.
2. Comparar con la línea base.
3. Ejecutar regresión sobre los flujos afectados.
4. Revisar diferencias visuales, intencionales y no.
5. Verificar que el bundle y las métricas no empeoraron fuera del presupuesto.
6. **Si aparece una regresión: detener, aislar y restaurar solo el cambio
   propio.**

## El caso real de este trabajo: trabajo concurrente

Durante la Fase 0, **otro trabajo modificó el repositorio**: se incorporó un
generador de entorno público que tocó `package.json`,
`src/environments/**`, `Dockerfile.dev`, `docker-compose.yml`, `.dockerignore`,
`.gitignore` y `.env.example`.

Lo que se hizo, en orden:

1. **Se preservó íntegro.** No se editó ninguno de esos archivos.
2. **Se repitió la batería completa** sobre el estado nuevo.
3. **Los números publicados son los de la segunda pasada.**
4. Las conclusiones que la primera había sacado de los archivos viejos **se
   corrigieron**: dos derivas (D2 y D3) quedaron resueltas por ese trabajo ajeno
   y así se anotan.

Es la regla 11 del plan aplicada literalmente: *«Preservar cambios existentes del
usuario y no sobrescribir trabajo ajeno.»*

Ver [la línea base §1.1](../reports/baseline.md#11--trabajo-concurrente-durante-la-medición).

## Comparación antes/después

| Medición | Antes | Después | Δ |
|---|---|---|---|
| `yarn install --immutable` | OK | OK | — |
| `yarn lint` | Limpio | Limpio | — |
| `yarn tsc --noEmit` | Limpio | Limpio | — |
| `yarn build` | OK, con el aviso conocido | OK, con el aviso conocido | — |
| Archivos de prueba | 71 | 71 | — |
| Pruebas | 804 | 804 | — |
| Cobertura `core/` | 87,37 % | 87,37 % | — |
| Cobertura `shared/` | 94,21 % | 94,21 % | — |
| Cobertura `features/` | 74,74 % | 74,74 % | — |

**Ninguna diferencia es atribuible a la documentación.** El detalle está en
[la validación de regresiones](../reports/regression-validation.md).

## Cómo revertir este trabajo

```bash
git status --porcelain            # confirmar que no hay nada más
rm -rf structurizr mkdocs.yml
git clean -nd docs scripts        # revisar ANTES de borrar
```

`docs/auditoria/` y `scripts/generate-env.mjs` son de otros trabajos y **no se
tocan**.

## Lo que esta política no puede garantizar hoy

Honesto, porque un checklist que promete lo que no puede verificar es peor que
ninguno:

| Regresión | Verificable |
|---|---|
| Compilación, tipos, lint | ✅ |
| Pruebas y cobertura | ✅ |
| Arquitectura (ciclos, capas, red) | ✅ |
| Documentación (enlaces, cobertura, deriva de API) | ✅ |
| Tamaño del paquete | ✅ |
| **Visual** | ❌ **sin instrumento** |
| **Accesibilidad** | ❌ **sin instrumento** |
| **Contraste** | ❌ **sin instrumento** |
| **De punta a punta** | ❌ **sin instrumento** |
| **Rendimiento en el navegador** | ❌ **sin instrumento** |

**Las cinco últimas no se declaran cumplidas: se declaran no verificables.** Es
la diferencia entre no encontrar problemas y no haber buscado, y está reflejada
en [el informe final](../reports/final-validation.md).
