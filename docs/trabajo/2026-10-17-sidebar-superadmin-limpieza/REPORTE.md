# Reporte — Limpieza y aplanado del sidebar de Superadministración

- Fecha: 2026-10-17 · Plan: [PLAN.md](./PLAN.md) · Rama(s): mockup
- Peldaño de evidencia alcanzado: `REGRESSION_VERIFIED`
- Avance: 5 / 5 (100%)

## Completado
| ID | Qué se logró | Comando | Resultado |
|---|---|---|---|
| H1.S1.M1 | Configuración de `fueraDelMenuPara` con `'SUPERADMIN'` en `navigation.map.ts` para ítems circulados (general, atención, facturación, mi cuenta, aseguradora, mi organización, mis productos) | `yarn test --include='src/app/core/navigation/navigation.map.spec.ts'` | 43 passed (43), exit 0 |
| H1.S1.M2 | Exclusión de `'SUPERADMIN'` de la vitrina de `Herramientas` (`/design-system`) en `shell-layout.ts` | `yarn test --include='src/app/features/shell-layout/shell-layout.spec.ts'` | 88 passed (88), exit 0 |
| H1.S1.M3 | Batería de pruebas unitarias en `navigation.service.spec.ts` certificando la estructura completa del menú lateral para `SUPERADMIN` | `yarn test --include='src/app/core/navigation/navigation.service.spec.ts'` | 45 passed (45), exit 0 |
| H2.S1.M1 | Extensión de `seAplanaElGrupo` en `navigation.subgroups.ts` para aceptar `roles` y retornar `true` si contiene `'SUPERADMIN'` | `yarn test --include='src/app/core/navigation/navigation.subgroups.spec.ts'` | 12 passed (12), exit 0 |
| H2.S1.M2 | Propagación de `roles` a `seAplanaElGrupo` en `navigation.service.ts` y test unitario validando que todos los grupos de superadmin son planos | `yarn test --include='src/app/core/navigation/navigation.service.spec.ts'` | 45 passed (45), exit 0 |

## A medias
ninguna

## Pendiente
ninguna

## Evidencia

### 1. `yarn test --include="src/app/core/navigation/navigation.map.spec.ts"`
```
 ✓  mantra-core-health  src/app/core/navigation/navigation.map.spec.ts (43 tests) 203ms

 Test Files  1 passed (1)
      Tests  43 passed (43)
```

### 2. `yarn test --include="src/app/core/navigation/navigation.subgroups.spec.ts"`
```
 ✓  mantra-core-health  src/app/core/navigation/navigation.subgroups.spec.ts (12 tests) 9ms

 Test Files  1 passed (1)
      Tests  12 passed (12)
```

### 3. `yarn test --include="src/app/core/navigation/navigation.service.spec.ts"`
```
 ✓  mantra-core-health  src/app/core/navigation/navigation.service.spec.ts (45 tests) 124ms

 Test Files  1 passed (1)
      Tests  45 passed (45)
```

### 4. `yarn test --include="src/app/features/shell-layout/shell-layout.spec.ts"`
```
 ✓  mantra-core-health  src/app/features/shell-layout/shell-layout.spec.ts (88 tests) 4039ms

 Test Files  1 passed (1)
      Tests  88 passed (88)
```

### 5. `yarn typecheck`
```
✓ src/app/features/component-stock/component-index.generated.ts
  625 componentes · 3 otros · 375 pantallas · 138 maquetas · 23 atomos · 48 moleculas · 38 organismos
  209 con algo que mirar
  relaciones: 2801 template-instantiates · 5 imports-available sin instanciar · 71 type-only · 236 dynamic-loads
  nivel: 0 declarado · 625 por-ruta · 5 unresolvedEvidence en 5 componentes
  acreditación: descubiertos 625/625 · con escenario 3/625 · verificados visualmente 3/625 · bloqueados 85/625 · montó e interactuó: se miden en el banco (runtime)
Done in 26.54s.
```

## No cubierto
- Validación interactiva en navegador con sesión activa y servidor dev levantado (las pruebas unitarias mockean y renderizan el servicio de navegación y el componente `ShellLayout` con TestBed).

## Desvíos del plan
- Se añadió `exclusiveRoles: true` en `psychological-help` dentro de `navigation.map.ts` para satisfacer el contrato de integridad de `navigation.map.spec.ts` que requería exclusividad de roles en esa sección.

## Riesgos residuales
ninguno

## Decisiones y ambigüedades
- Se utilizó la propiedad declarativa `fueraDelMenuPara: ['SUPERADMIN']` en `navigation.map.ts` para que las rutas sigan siendo accesibles para un superadmin vía URL o consola en caso de emergencia técnica, pero queden limpias y ausentes del sidebar de navegación.
- Las secciones de aseguradora (`/administration/insurance`, `/administration/brokers`, etc.) y las organizaciones personales (`/administration/my-organization`) quedaron retiradas para superadmin, preservando `/administration/organizations` (Gestión de todas las organizaciones de la plataforma), `/administration/users`, `/administration/patients`, etc.
