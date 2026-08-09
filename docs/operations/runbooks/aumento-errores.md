# Runbook 10 · Aumento de errores del navegador

**Síntoma.** Varias personas reportan fallos a la vez, o los reportes se
multiplican tras un despliegue.

**Impacto.** Variable.
**Severidad.** S1 o S2 según el flujo afectado.

---

## La limitación de partida

**No hay telemetría.** Este runbook no se dispara por una alerta: se dispara
porque **los reportes humanos aumentan**.

Consecuencia práctica: cuando llega acá, **el incidente lleva rato**.

Ver [reporte de errores](../../observability/error-reporting.md).

## El instrumento que sí hay: los estados del M34

Cada persona que reporta puede decir **qué estado vio**, y eso clasifica el
incidente de inmediato:

| Estado | Qué significa | Dueño |
|---|---|---|
| **S8 · Sin conexión** | La petición no llegó | **API o red** → [runbook 4](backend-no-disponible.md) |
| **S9 · Error inesperado** | La API respondió mal. **Hay código de soporte** | **API** |
| **S4 · Validación** | Datos rechazados. En masa = cambio de contrato | API |
| **S5 · Prohibido** | Permisos. En masa = cambio de roles | API |
| Pantalla en blanco | Fallo de render. **Sin código** | **Frontend** → [runbook 2](pantalla-en-blanco.md) |
| Vuelve al login | [Runbook 5](autenticacion-en-bucle.md) | Depende |

**La primera pregunta a quien reporta: «¿qué decía la pantalla?»** No «¿qué
hacías?».

## Diagnóstico

### 1 · Recoger los códigos de soporte

Cada S9 muestra uno copiable. **Con tres o cuatro, el equipo de la API puede
buscar el patrón en sus registros.**

Es lo que suple —parcialmente— la falta de telemetría.

### 2 · ¿Coincide con un despliegue?

| Del frontend | De la API |
|---|---|
| Predominan pantallas en blanco o chunks fallidos | Predominan S4, S5 o S9 |
| → **Revertir el frontend** | → **Escalar. Revertir el frontend no arregla nada** |

**Es la bifurcación más importante del runbook.**

### 3 · ¿Es general o segmentado?

| Segmento | Apunta a |
|---|---|
| Un navegador | Incompatibilidad |
| Una organización | Datos o permisos de ese tenant |
| Un rol | Permisos |
| Quien tenía la pestaña abierta | [Chunks](chunks-desactualizados.md) |
| Todo el mundo | Despliegue o API |

### 4 · Reproducir

```bash
git checkout <sha desplegado>
yarn install --immutable
yarn build && yarn serve:ssr:mantra-core-health
```

Contra la API real, si es posible: la mitad de estos incidentes no se reproducen
con datos sintéticos.

## Evidencia

- [ ] **Códigos de soporte** de varios reportes
- [ ] Qué estado vio cada persona
- [ ] Rutas afectadas
- [ ] Hora de inicio vs. hora del despliegue
- [ ] ¿Segmentado por navegador, organización o rol?
- [ ] Consolas, si alguien pudo capturarlas

## Mitigación

| Causa | Acción |
|---|---|
| Regresión del frontend | **Revertir** → [runbook 12](rollback-de-release.md) |
| API degradada | **Escalar.** No revertir el frontend |
| Chunks | Recargar; conservar artefactos anteriores |
| Desconocida y grave | **Revertir** — es reversible y barato |

## Escalamiento

| Situación | A quién |
|---|---|
| Predominan S8 | API + infraestructura |
| Predominan S9 con códigos | **API, con los códigos** |
| Predominan pantallas en blanco | Frontend |
| S4/S5 en masa | API — cambio de contrato o de permisos |

## Prevención

Todas apuntan a lo mismo:

| # | Qué | Estado |
|---|---|---|
| 1 | **Telemetría de errores** | **No existe** (`CRITICAL`) |
| 2 | Evento `estado_ux_mostrado` | No existe. **Un solo punto de instrumentación**: `ViewStateHost` |
| 3 | Alerta sobre picos de S8/S9 | No existe |
| 4 | Versionado del artefacto | **No existe** (`HIGH`) |
| 5 | Smoke tras el despliegue | No existe |

**El 2 es notable por lo barato que es**: `ViewStateHost` pinta los nueve estados
para todo el proyecto, así que hay **un solo lugar** donde poner el disparador.
Ver [eventos analíticos](../../observability/analytics-events.md).
