/* ============================================================================
    Gobierno de accesos: barril de tipos.

    Formas tomadas del **código** de la API (`delegated_access/dto/*.dto.ts`,
    `services/*.ts`) y, donde el código aún no la fija, de `CONTRATO-GOBIERNO.md` §6 y §8.
    Las fechas viajan como texto ISO 8601. Los motivos de error estables (`reason`) están
    en `access-errors.ts`.

    - `governance-rules.types.ts`   reglas L1, ajustes, normalizar, SoD, banderas de pacientes;
    - `access-reviews.types.ts`     cuatro ojos (aprobaciones) y campañas de certificación;
    - `governance-reports.types.ts` tablero, matriz, informes, anomalías, exportación;
    - `access-lifecycle.types.ts`   ciclo de vida, traspaso, administración delegada y paso extra;
    - `access-explain.types.ts`     explicar, simular y catálogo;
    - `conditions.types.ts`         el JSON de condiciones v1.
   ========================================================================== */
export * from './governance-rules.types';
export * from './access-reviews.types';
export * from './governance-reports.types';
export * from './access-lifecycle.types';
