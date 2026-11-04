import type {
  Disposition,
  EvidenceLevel,
  LegalHoldState,
  MutabilityEvidence,
  MutabilityFinding,
  WriteMode,
} from '../../data-access/admin-portal/mutability.types';

/* Tablas sintéticas de la taxonomía de mutabilidad (separadas de mutability.handlers.ts por el techo de 600 líneas). */

type Ev = MutabilityEvidence;
const ev = (
  kind: string,
  level: EvidenceLevel,
  supports: Ev['supports'],
  source: string,
  claim: string,
): Ev => ({ kind, level, supports, source, claim });

export interface Sintetica {
  readonly table: string;
  readonly writeMode: WriteMode;
  readonly writeModeLevel: EvidenceLevel;
  readonly disposition?: Disposition;
  readonly dispositionLevel?: EvidenceLevel;
  readonly retention?: { days: number | null; source: string | null };
  readonly legalHold?: LegalHoldState;
  readonly registered?: boolean;
  readonly evidence: readonly Ev[];
  readonly findings?: readonly MutabilityFinding[];
}

export const MODELO = 'simulado:modelo/sim.sql';

export const DISPARADOR = (t: string): Ev =>
  ev(
    'TRIGGER_BLOCK',
    'ENFORCED_DB',
    'WRITE_MODE',
    `${MODELO}:${t}`,
    'trg_sim → forbid_mutation: impide UPDATE + DELETE',
  );

export const FILAS: readonly Sintetica[] = [
  {
    table: 'bitacora_inmutable',
    writeMode: 'APPEND_ONLY',
    writeModeLevel: 'ENFORCED_DB',
    registered: true,
    evidence: [
      DISPARADOR('12'),
      ev(
        'STEREOTYPE',
        'DECLARED_MODEL',
        'WRITE_MODE',
        'simulado:diagrama.puml:20',
        'Diagrama: <<IMMUTABLE>>',
      ),
    ],
  },
  {
    table: 'eventos_de_acceso',
    writeMode: 'APPEND_ONLY_PURGEABLE',
    writeModeLevel: 'ENFORCED_DB',
    disposition: 'PURGE_BY_RETENTION',
    dispositionLevel: 'ENFORCED_CODE',
    legalHold: 'HOLD_CAPABLE_NOT_ENFORCED',
    registered: true,
    retention: { days: 90, source: 'simulado:matriz.md:7' },
    evidence: [
      ev(
        'TRIGGER_BLOCK',
        'ENFORCED_DB',
        'WRITE_MODE',
        `${MODELO}:31`,
        'trg_sim → forbid_mutation: impide UPDATE',
      ),
      ev(
        'CODE_PURGE_PATH',
        'ENFORCED_CODE',
        'DISPOSITION',
        'simulado:src/purga.ts:40',
        'El repositorio borra filas anteriores a una fecha de corte',
      ),
      ev(
        'RETENTION_DECLARED',
        'DECLARED_MODEL',
        'DISPOSITION',
        'simulado:matriz.md:7',
        'Matriz de integridad: RETENTION 90 days',
      ),
      ev(
        'CODE_NO_HOLD_SWEEP',
        'ENFORCED_CODE',
        'LEGAL_HOLD',
        'simulado:src/modulo.ts:79',
        'Ningún barrido genérico consulta legal_holds',
      ),
    ],
  },
  {
    table: 'revisiones_de_politica',
    writeMode: 'LIFECYCLE_ONLY',
    writeModeLevel: 'ENFORCED_DB',
    registered: true,
    evidence: [
      ev(
        'LIFECYCLE_GUARD',
        'ENFORCED_DB',
        'WRITE_MODE',
        `${MODELO}:55`,
        'guarda de ciclo de vida: impide UPDATE parcial + DELETE',
      ),
    ],
    findings: [
      {
        kind: 'CONTRADICTION',
        code: 'ENFORCED_WITHOUT_DECLARATION',
        severity: 'MEDIUM',
        summary:
          'Hay una barrera física en la base de datos, pero ni el diagrama, ni la matriz de integridad ni el README la declaran: el modelo se contradice a sí mismo.',
        a: ev(
          'LIFECYCLE_GUARD',
          'ENFORCED_DB',
          'WRITE_MODE',
          `${MODELO}:55`,
          'guarda de ciclo de vida: impide UPDATE parcial + DELETE',
        ),
      },
    ],
  },
  {
    table: 'firmas_de_nota',
    writeMode: 'APPEND_ONLY',
    writeModeLevel: 'DECLARED_MODEL',
    registered: false,
    evidence: [
      ev(
        'STEREOTYPE',
        'DECLARED_MODEL',
        'WRITE_MODE',
        'simulado:diagrama.puml:88',
        'Diagrama: <<IMMUTABLE>>',
      ),
      ev(
        'CODE_UPDATE',
        'ENFORCED_CODE',
        'WRITE_MODE',
        'simulado:src/notas.ts:558',
        'Inventario de endpoints: ACTUALIZA (confianza DIRECTA)',
      ),
    ],
    findings: [
      {
        kind: 'CONTRADICTION',
        code: 'DECLARED_VS_CODE_UPDATE',
        severity: 'HIGH',
        summary:
          'Declaración del modelo impide UPDATE, pero el inventario de código registra ACTUALIZA (1 observación(es); confianza DIRECTA). No se resuelve: decide el dueño del dominio.',
        a: ev(
          'STEREOTYPE',
          'DECLARED_MODEL',
          'WRITE_MODE',
          'simulado:diagrama.puml:88',
          'Diagrama: <<IMMUTABLE>>',
        ),
        b: ev(
          'CODE_UPDATE',
          'ENFORCED_CODE',
          'WRITE_MODE',
          'simulado:src/notas.ts:558',
          'Inventario de endpoints: ACTUALIZA (confianza DIRECTA)',
        ),
      },
    ],
  },
  {
    table: 'versiones_de_informe',
    writeMode: 'APPEND_ONLY',
    writeModeLevel: 'DECLARED_MODEL',
    registered: false,
    evidence: [
      ev(
        'STEREOTYPE',
        'DECLARED_MODEL',
        'WRITE_MODE',
        'simulado:diagrama.puml:101',
        'Diagrama: <<IMMUTABLE>>',
      ),
      ev(
        'CODE_UPDATE',
        'INFERRED',
        'WRITE_MODE',
        'simulado:src/informes.ts:190',
        'Inventario de endpoints: ACTUALIZA (confianza POR_TIPO, inferida por tipo de endpoint: no prueba la sentencia)',
      ),
    ],
    findings: [
      {
        kind: 'CONTRADICTION',
        code: 'DECLARED_VS_CODE_UPDATE',
        severity: 'LOW',
        summary:
          'Declaración del modelo impide UPDATE, pero el inventario de código registra ACTUALIZA (1 observación(es); confianza POR_TIPO: inferida, no probada). No se resuelve: decide el dueño del dominio.',
        a: ev(
          'STEREOTYPE',
          'DECLARED_MODEL',
          'WRITE_MODE',
          'simulado:diagrama.puml:101',
          'Diagrama: <<IMMUTABLE>>',
        ),
        b: ev(
          'CODE_UPDATE',
          'INFERRED',
          'WRITE_MODE',
          'simulado:src/informes.ts:190',
          'Inventario de endpoints: ACTUALIZA (confianza POR_TIPO)',
        ),
      },
    ],
  },
  {
    table: 'historial_declarado',
    writeMode: 'APPEND_ONLY',
    writeModeLevel: 'DECLARED_DOC',
    registered: true,
    evidence: [
      ev(
        'README_DECLARATION',
        'DECLARED_DOC',
        'WRITE_MODE',
        'simulado:README.md:93',
        'README del módulo la lista como append-only',
      ),
    ],
    findings: [
      {
        kind: 'GAP',
        code: 'DECLARED_NOT_ENFORCED',
        severity: 'LOW',
        summary:
          'Está declarada append-only/inmutable pero no hay disparador ni REVOKE que lo impida: es una intención sin imponer.',
        a: ev(
          'README_DECLARATION',
          'DECLARED_DOC',
          'WRITE_MODE',
          'simulado:README.md:93',
          'README del módulo la lista como append-only',
        ),
      },
    ],
  },
  {
    table: 'resultados_verificados',
    writeMode: 'APPEND_ONLY',
    writeModeLevel: 'DECLARED_MODEL',
    registered: true,
    evidence: [
      ev(
        'STEREOTYPE',
        'DECLARED_MODEL',
        'WRITE_MODE',
        'simulado:diagrama.puml:140',
        'Diagrama: <<IMMUTABLE>>',
      ),
    ],
    findings: [
      {
        kind: 'GAP',
        code: 'DECLARED_NOT_ENFORCED',
        severity: 'MEDIUM',
        summary:
          'Está declarada append-only/inmutable pero no hay disparador ni REVOKE que lo impida: es una intención sin imponer.',
        a: ev(
          'STEREOTYPE',
          'DECLARED_MODEL',
          'WRITE_MODE',
          'simulado:diagrama.puml:140',
          'Diagrama: <<IMMUTABLE>>',
        ),
      },
    ],
  },
  {
    table: 'archivos_adjuntos',
    writeMode: 'UPDATABLE_DELETABLE',
    writeModeLevel: 'ENFORCED_CODE',
    disposition: 'PURGE_BY_RETENTION',
    dispositionLevel: 'ENFORCED_CODE',
    legalHold: 'HOLD_AWARE',
    registered: true,
    retention: { days: null, source: null },
    evidence: [
      ev(
        'CODE_DELETE',
        'ENFORCED_CODE',
        'WRITE_MODE',
        'simulado:src/disposicion.ts:124',
        'Inventario de endpoints: BORRA (confianza POR_SQL)',
      ),
      ev(
        'CODE_HOLD_RESOLVER',
        'ENFORCED_CODE',
        'LEGAL_HOLD',
        'simulado:src/holds.ts:30',
        'Un resolvedor único combina holds antes de disponer',
      ),
    ],
  },
  {
    table: 'catalogo_editable',
    writeMode: 'UPDATABLE',
    writeModeLevel: 'ENFORCED_CODE',
    registered: true,
    evidence: [
      ev(
        'CODE_UPDATE',
        'ENFORCED_CODE',
        'WRITE_MODE',
        'simulado:src/catalogo.ts:77',
        'Inventario de endpoints: ACTUALIZA (confianza DIRECTA)',
      ),
    ],
  },
  {
    table: 'mensajes_directos',
    writeMode: 'SOFT_DELETE',
    writeModeLevel: 'INFERRED',
    registered: false,
    evidence: [
      ev(
        'COLUMN_SOFT_DELETE',
        'INFERRED',
        'WRITE_MODE',
        'simulado:modelo/sim.sql:210',
        'Columna deleted_at: pista de borrado lógico (no prueba que se use)',
      ),
    ],
  },
  {
    table: 'perfil_con_version',
    writeMode: 'UPDATABLE',
    writeModeLevel: 'INFERRED',
    registered: false,
    evidence: [
      ev(
        'COLUMN_VERSIONING',
        'INFERRED',
        'WRITE_MODE',
        'simulado:modelo/sim.sql:240',
        'Columna row_version, updated_at: la fila se actualiza (pista estructural)',
      ),
    ],
  },
  {
    table: 'tabla_sin_evidencia',
    writeMode: 'UNKNOWN',
    writeModeLevel: 'UNKNOWN',
    registered: false,
    evidence: [
      ev(
        'STRUCTURE_HINT',
        'INFERRED',
        'CONTEXT',
        'simulado:modelo/sim.sql:260',
        'Sin updated_at, row_version ni deleted_at: candidata a append-only o derivada. NO decidida.',
      ),
    ],
  },
  {
    table: 'otra_sin_evidencia',
    writeMode: 'UNKNOWN',
    writeModeLevel: 'UNKNOWN',
    registered: false,
    evidence: [],
  },
];
