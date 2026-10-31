import type { MockRouter } from '../mock-router';
import { registrarExplicar } from './support-access.explain.handlers';
import { registrarGobiernoAprobaciones } from './support-access.governance.approvals.handlers';
import { registrarGobiernoEquipo } from './support-access.governance.team.handlers';
import { registrarGobiernoCicloDeVida } from './support-access.governance.lifecycle.handlers';
import { registrarGobiernoInformes } from './support-access.governance.reports.handlers';
import { registrarGobiernoCampanas } from './support-access.governance.reviews.handlers';
import { registrarGobiernoReglas } from './support-access.governance.rules.handlers';
import { registrarGobiernoPermisos } from './support-access.governance.grants.handlers';

/* ============================================================================
    El backend simulado del **gobierno de accesos** (CONTRATO-GOBIERNO §8.3): las 84 rutas con la misma forma que la API.

    - `…rules`      catálogo, resúmenes, normalizar, reglas L1, ajustes, SoD y banderas de pacientes;
    - `…approvals`  cuatro ojos y paso extra;
    - `…reviews`    campañas de certificación y bandeja del revisor;
    - `…reports`    tablero, matriz, informes, anomalías y exportación;
    - `…lifecycle`  ingreso, cambio, baja con traspaso, suspensión y reactivación;
    - `…team`       administración delegada (`/org/team/*`);
    - `…grants`     permisos con átomos y condiciones (envuelve `/org/support-engagements/:id/grants`);
    - `support-access.explain.handlers.ts`  explicar y simular.

    Los fixtures son los del hospital piloto extendido (`support-hospital-governance.ts`). Va **después** de
    `registrarApoyo`: envuelve rutas que ya tienen dueño. **No reimplementa la política**: la semántica vive solo en la API.
   ========================================================================== */

export function registrarApoyoGobierno(router: MockRouter): void {
  registrarGobiernoReglas(router);
  registrarGobiernoAprobaciones(router);
  registrarGobiernoCampanas(router);
  registrarGobiernoInformes(router);
  registrarGobiernoCicloDeVida(router);
  registrarGobiernoEquipo(router);
  registrarExplicar(router);
  registrarGobiernoPermisos(router);
}
