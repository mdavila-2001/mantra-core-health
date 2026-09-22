import {
  conflict,
  notFound,
  reply,
  validation,
  type MockRequest,
  type MockRouter,
} from '../mock-router';

/* ============================================================================
    Backend simulado del portal administrativo (`/admin/catalog`,
    `/admin/analytics`, `/admin/qa`, `/admin/ops`).

    Reproduce las REGLAS del servidor, no sólo la forma de las respuestas:
    versión esperada al editar (409), texto de relleno rechazado (422), quien
    escribió una revisión no la aprueba (403), aprobación ligada al hash del
    plan, cobertura con UNKNOWN/N_A. Así una pantalla que ignore una regla se
    rompe también contra el simulador, no recién contra la API real.

    Los datos son sintéticos y rotulados como tales; ninguna fila de negocio.
    ========================================================================== */

const AUTOR_SEMBRADO = '00000000-0000-4000-8000-00000000a0a0';
const ahora = () => new Date().toISOString();
const haceHoras = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();
let contador = 0;
const nuevoId = () => {
  contador += 1;
  return `00000000-0000-4000-9000-${String(contador).padStart(12, '0')}`;
};

const RELLENO = /^(esta\s+tabla\s+)?(almacena|guarda|contiene|registra)\s+(los\s+|las\s+)?(datos|informaci[oó]n|registros)\b/i;

interface Ficha {
  id: string;
  targetKind: 'OBJECT';
  version: number;
  reviewStatus: string;
  origin: string;
  currentRevisionNo: number;
  approvedRevisionNo: number | null;
  approvedAt: string | null;
  updatedAt: string;
  autorRevision: string;
  content: Record<string, unknown>;
}

interface Objeto {
  id: string;
  schemaName: string;
  objectName: string;
  objectKind: string;
  observationStatus: string;
  columnas: { name: string; type: string; nullable: boolean; pk?: boolean; fk?: [string, string] }[];
  filas: string | null;
  ficha: Ficha | null;
  evidencia: Record<string, unknown>[];
  revisiones: Record<string, unknown>[];
  decisiones: Record<string, unknown>[];
}

const CONTENIDO_VACIO: Record<string, unknown> = {
  businessName: null,
  definition: null,
  purpose: null,
  existenceRationale: null,
  rowGrain: null,
  alternativesRationale: null,
  processSupported: null,
  sourceOfTruth: null,
  producers: [],
  consumers: [],
  deletionImpact: null,
  businessOwner: null,
  dataSteward: null,
  technicalOwner: null,
  unit: null,
  valueDomain: null,
  nullSemantics: null,
  sensitivity: 'UNKNOWN',
  openQuestions: [],
};

function objeto(
  schemaName: string,
  objectName: string,
  columnas: Objeto['columnas'],
  extra: Partial<Objeto> = {},
): Objeto {
  return {
    id: nuevoId(),
    schemaName,
    objectName,
    objectKind: 'TABLE',
    observationStatus: 'OBSERVED',
    columnas,
    filas: String(1000 + objectName.length * 137),
    ficha: null,
    evidencia: [],
    revisiones: [],
    decisiones: [],
    ...extra,
  };
}

function ficha(content: Record<string, unknown>, reviewStatus: string, approved = false): Ficha {
  return {
    id: nuevoId(),
    targetKind: 'OBJECT',
    version: approved ? 2 : 1,
    reviewStatus,
    origin: 'MANUAL',
    currentRevisionNo: 1,
    approvedRevisionNo: approved ? 1 : null,
    approvedAt: approved ? haceHoras(30) : null,
    updatedAt: haceHoras(40),
    autorRevision: AUTOR_SEMBRADO,
    content: { ...CONTENIDO_VACIO, ...content },
  };
}

function sembrarCatalogo(): Objeto[] {
  const base = [
    { name: 'id', type: 'uuid', nullable: false, pk: true },
    { name: 'created_at', type: 'timestamp with time zone', nullable: false },
    { name: 'updated_at', type: 'timestamp with time zone', nullable: false },
    { name: 'row_version', type: 'integer', nullable: false },
  ];
  const personas = objeto('profiles', 'persons', [
    ...base,
    { name: 'given_name', type: 'character varying', nullable: false },
    { name: 'family_name', type: 'character varying', nullable: false },
    { name: 'birth_date', type: 'date', nullable: true },
  ]);
  personas.ficha = ficha(
    {
      businessName: 'Persona',
      purpose: 'Identidad única de cada persona física con la que la red de salud tiene relación.',
      existenceRationale:
        'Sin una identidad común, el mismo paciente atendido en dos centros serían dos historias clínicas y dos deudas distintas.',
      rowGrain: 'Una fila por persona física, identificada por su id; los roles (paciente, médico) cuelgan de ella.',
      businessOwner: 'Dirección de admisión',
      sensitivity: 'PII',
    },
    'APPROVED',
    true,
  );
  personas.evidencia.push({
    id: nuevoId(),
    kind: 'VAULT_NOTE',
    reference: 'SALUD/Entidades/E profiles.persons.md',
    excerpt: null,
    sourceRevision: null,
    createdAt: haceHoras(48),
  });
  personas.revisiones.push({ revisionNo: 1, origin: 'MANUAL', submittedStatus: 'NEEDS_REVIEW', changeReason: 'Ficha inicial', authorUserId: AUTOR_SEMBRADO, createdAt: haceHoras(40) });
  personas.decisiones.push({ revisionNo: 1, decision: 'APPROVED', comment: null, reviewerUserId: '00000000-0000-4000-8000-00000000b0b0', decidedAt: haceHoras(30) });

  const citas = objeto('scheduling', 'appointments', [
    ...base,
    { name: 'patient_profile_id', type: 'uuid', nullable: false, fk: ['profiles', 'persons'] },
    { name: 'starts_at', type: 'timestamp with time zone', nullable: false },
    { name: 'status_concept_id', type: 'uuid', nullable: false },
  ]);
  citas.ficha = ficha(
    {
      businessName: 'Cita',
      purpose: 'Reserva de un horario de atención entre un paciente y un profesional.',
      existenceRationale:
        'La agenda necesita saber qué horarios están tomados antes de ofrecerlos; derivarlo de los encuentros llegaría tarde.',
      rowGrain: 'Una fila por reserva confirmada o cancelada de un horario.',
    },
    'NEEDS_REVIEW',
  );
  citas.revisiones.push({ revisionNo: 1, origin: 'MANUAL', submittedStatus: 'NEEDS_REVIEW', changeReason: null, authorUserId: AUTOR_SEMBRADO, createdAt: haceHoras(5) });

  const facturas = objeto('billing', 'invoices', [
    ...base,
    { name: 'appointment_id', type: 'uuid', nullable: true, fk: ['scheduling', 'appointments'] },
    { name: 'total_amount', type: 'numeric(14,2)', nullable: false },
  ]);
  facturas.ficha = ficha(
    {
      businessName: 'Factura',
      purpose: 'Documento de cobro emitido por un servicio prestado.',
      openQuestions: [{ field: 'existenceRationale', question: '¿Por qué no se reutiliza la factura del ERP contable?' }],
      rowGrain: 'Una fila por factura emitida.',
    },
    'DRAFT',
  );

  return [
    personas,
    citas,
    facturas,
    objeto('billing', 'payments', [...base, { name: 'invoice_id', type: 'uuid', nullable: false, fk: ['billing', 'invoices'] }]),
    objeto('clinical', 'encounters', [...base, { name: 'appointment_id', type: 'uuid', nullable: true, fk: ['scheduling', 'appointments'] }]),
    objeto('clinical', 'conditions', [...base, { name: 'code', type: 'character varying', nullable: false }]),
    objeto('iam', 'users', [...base, { name: 'email', type: 'character varying', nullable: false }]),
    objeto('terminology', 'catalog_concepts', [...base, { name: 'code', type: 'character varying', nullable: false }]),
    objeto('telemetry', 'user_activity_events', [...base, { name: 'event_name', type: 'character varying', nullable: false }]),
    objeto('reporting', 'v_daily_revenue', [{ name: 'day', type: 'date', nullable: true }], { objectKind: 'VIEW', filas: null }),
    objeto('archive', 'legacy_bookings', [...base], { observationStatus: 'NOT_OBSERVED' }),
  ];
}

function vistaFicha(f: Ficha | null) {
  if (!f) return null;
  const { autorRevision: _autor, ...rest } = f;
  return {
    ...rest,
    approvalIsCurrent: f.reviewStatus === 'APPROVED' && f.approvedRevisionNo === f.currentRevisionNo,
  };
}

function resumen(o: Objeto) {
  const c = o.ficha?.content;
  return {
    id: o.id,
    schemaName: o.schemaName,
    objectName: o.objectName,
    objectKind: o.objectKind,
    observationStatus: o.observationStatus,
    columnCount: o.columnas.length,
    statistics: { estimatedRows: o.filas, totalBytes: o.filas ? String(Number(o.filas) * 212) : null, isEstimate: true, observedAt: haceHoras(2) },
    lastSeenAt: haceHoras(2),
    annotation: o.ficha
      ? {
          id: o.ficha.id,
          businessName: c?.['businessName'] ?? null,
          reviewStatus: o.ficha.reviewStatus,
          hasPurpose: Boolean(c?.['purpose']),
          hasExistenceRationale: Boolean(c?.['existenceRationale']),
          hasRowGrain: Boolean(c?.['rowGrain']),
          owner: (c?.['businessOwner'] as string | null) ?? (c?.['dataSteward'] as string | null) ?? null,
          sensitivity: c?.['sensitivity'] ?? 'UNKNOWN',
        }
      : null,
  };
}

function cobertura(o: Objeto) {
  const c = o.ficha?.content ?? CONTENIDO_VACIO;
  const faltan = (['purpose', 'existenceRationale', 'rowGrain'] as const).filter((k) => !c[k]);
  const declaradas = new Set(((c['openQuestions'] as { field?: string }[]) ?? []).map((q) => q.field));
  const missingFields: string[] = [...faltan];
  const owner = Boolean(c['businessOwner'] || c['dataSteward']);
  if (!owner) missingFields.push('businessOwner');
  const sensible = c['sensitivity'] !== 'UNKNOWN';
  if (!sensible) missingFields.push('sensitivity');
  return {
    technical: 'COMPLETE',
    semantic: faltan.length === 0 ? 'COMPLETE' : faltan.every((f) => declaradas.has(f)) ? 'DECLARED_DEBT' : 'MISSING',
    ownership: owner ? 'COMPLETE' : 'MISSING',
    sensitivity: sensible ? 'KNOWN' : 'UNKNOWN',
    review: o.ficha?.reviewStatus === 'APPROVED' && o.ficha.approvedRevisionNo === o.ficha.currentRevisionNo ? 'APPROVED_CURRENT' : 'NOT_APPROVED',
    missingFields,
  };
}

function registrarCatalogo(router: MockRouter): void {
  const objetos = sembrarCatalogo();
  const escaneos: Record<string, unknown>[] = [
    {
      id: nuevoId(),
      sourceCode: 'primary',
      mode: 'FULL',
      status: 'SUCCEEDED',
      requestedAt: haceHoras(3),
      startedAt: haceHoras(3),
      finishedAt: haceHoras(3),
      attempt: 1,
      connectorVersion: 'pg-introspector/1',
      engineVersion: '18.0',
      snapshotHash: 'a3f1c9e0b7d24c6e8f0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60',
      counters: { objectsObserved: 10, columnsObserved: 58, objectsAdded: 0, objectsChanged: 1, objectsNotObserved: 1, objectsReappeared: 0, columnsAdded: 2, columnsChanged: 0, columnsNotObserved: 0 },
      excludedSchemas: ['pg_catalog', 'information_schema'],
      limitations: [
        { code: 'STATS_ARE_ESTIMATES', detail: 'Filas estimadas desde pg_class.reltuples; no es un conteo.' },
        { code: 'APP_CONNECTION_READ_ONLY_TX', detail: 'La introspección usa la conexión de la API en transacción READ ONLY.' },
      ],
      error: null,
    },
  ];
  const buscar = (id: string) => objetos.find((o) => o.id === id);

  router.get('/admin/catalog/schemas', () => {
    const porSchema = new Map<string, Objeto[]>();
    for (const o of objetos) porSchema.set(o.schemaName, [...(porSchema.get(o.schemaName) ?? []), o]);
    return [...porSchema.entries()].sort().map(([schemaName, lista]) => ({
      schemaName,
      objects: lista.filter((o) => o.observationStatus === 'OBSERVED').length,
      notObserved: lista.filter((o) => o.observationStatus === 'NOT_OBSERVED').length,
      annotated: lista.filter((o) => o.ficha).length,
      approved: lista.filter((o) => cobertura(o).review === 'APPROVED_CURRENT').length,
    }));
  });

  router.get('/admin/catalog/objects', (req: MockRequest) => {
    const q = (req.query.get('q') ?? '').toLowerCase();
    const schema = req.query.get('schema');
    const review = req.query.get('reviewStatus');
    const status = req.query.get('observationStatus');
    const missing = req.query.get('missing');
    const limit = Number(req.query.get('limit') ?? 50);
    const offset = Number(req.query.get('cursor') ?? 0);
    const filtrados = objetos
      .filter((o) => !schema || o.schemaName === schema)
      .filter((o) => !status || o.observationStatus === status)
      .filter((o) => !review || (review === 'NONE' ? !o.ficha : o.ficha?.reviewStatus === review))
      .filter((o) => !q || `${o.schemaName}.${o.objectName}`.includes(q) || String(o.ficha?.content['businessName'] ?? '').toLowerCase().includes(q))
      .filter((o) => !missing || !(missing === 'businessOwner' ? o.ficha?.content['businessOwner'] || o.ficha?.content['dataSteward'] : o.ficha?.content[missing]))
      .sort((a, b) => `${a.schemaName}.${a.objectName}`.localeCompare(`${b.schemaName}.${b.objectName}`));
    const pagina = filtrados.slice(offset, offset + limit);
    return {
      items: pagina.map(resumen),
      nextCursor: offset + limit < filtrados.length ? String(offset + limit) : null,
      limit,
    };
  });

  router.get('/admin/catalog/objects/:id', (req: MockRequest) => {
    const o = buscar(req.params['id']);
    if (!o) return notFound('Objeto de catálogo no encontrado');
    return {
      id: o.id,
      technical: {
        sourceCode: 'primary',
        schemaName: o.schemaName,
        objectName: o.objectName,
        objectKind: o.objectKind,
        comment: null,
        columnCount: o.columnas.length,
        primaryKey: o.columnas.filter((c) => c.pk).map((c) => c.name),
        statistics: { estimatedRows: o.filas, totalBytes: null, method: 'pg_class.reltuples / pg_total_relation_size', isEstimate: true, observedAt: haceHoras(2) },
      },
      observation: { status: o.observationStatus, lastSeenAt: haceHoras(2), notObservedSince: o.observationStatus === 'NOT_OBSERVED' ? haceHoras(3) : null, lastScanEngineVersion: '18.0' },
      annotation: vistaFicha(o.ficha),
      coverage: cobertura(o),
      governance: o.schemaName === 'profiles' ? { entityRegistryId: nuevoId(), ownerTeam: 'Admisión', containsPii: true, containsPhi: false, isAppendOnly: false, isSoftDelete: true, hasHistory: true } : null,
      evidenceCount: o.evidencia.length,
    };
  });

  router.get('/admin/catalog/objects/:id/columns', (req: MockRequest) => {
    const o = buscar(req.params['id']);
    if (!o) return notFound('Objeto de catálogo no encontrado');
    return {
      objectId: o.id,
      items: o.columnas.map((c, i) => ({
        id: `${o.id}-${c.name}`,
        columnName: c.name,
        ordinal: i + 1,
        nativeType: c.type,
        isNullable: c.nullable,
        defaultExpression: c.name.endsWith('_at') ? 'now()' : null,
        isIdentity: false,
        isGenerated: false,
        isPrimaryKey: Boolean(c.pk),
        isUnique: Boolean(c.pk),
        foreignKey: c.fk ? { constraintName: `fk_${o.objectName}_${c.name}`, sourceColumns: [c.name], targetSchema: c.fk[0], targetTable: c.fk[1], targetColumns: ['id'] } : null,
        comment: null,
        observationStatus: 'OBSERVED',
        lastSeenAt: haceHoras(2),
        annotation: null,
      })),
    };
  });

  router.get('/admin/catalog/objects/:id/evidence', (req: MockRequest) => buscar(req.params['id'])?.evidencia ?? notFound());
  router.post('/admin/catalog/objects/:id/evidence', (req: MockRequest) => {
    const o = buscar(req.params['id']);
    if (!o) return notFound();
    const body = req.body as Record<string, unknown>;
    if (!body['reference'] || String(body['reference']).trim().length < 3) {
      return validation('La referencia es obligatoria');
    }
    const item = { id: nuevoId(), objectId: o.id, columnId: null, kind: body['kind'], reference: body['reference'], excerpt: body['excerpt'] ?? null, sourceRevision: body['sourceRevision'] ?? null, addedByUserId: req.user?.id ?? null, createdAt: ahora() };
    o.evidencia.unshift(item);
    return reply(201, item);
  });

  router.get('/admin/catalog/objects/:id/history', (req: MockRequest) => {
    const o = buscar(req.params['id']);
    if (!o) return notFound();
    return { annotation: vistaFicha(o.ficha), revisions: [...o.revisiones].reverse(), decisions: [...o.decisiones].reverse() };
  });

  router.get('/admin/catalog/objects/:id/changes', (req: MockRequest) => {
    const o = buscar(req.params['id']);
    if (!o) return notFound();
    return {
      items: [
        { id: nuevoId(), scanRunId: escaneos[0]?.['id'], objectId: o.id, object: `${o.schemaName}.${o.objectName}`, columnId: null, column: null, changeKind: 'ADDED', before: null, after: { kind: o.objectKind, columnCount: o.columnas.length }, detectedAt: haceHoras(72) },
      ],
      nextCursor: null,
      limit: 50,
    };
  });

  router.get('/admin/catalog/objects/:id/impact', (req: MockRequest) => {
    const raiz = buscar(req.params['id']);
    if (!raiz) return notFound();
    const direccion = req.query.get('direction') ?? 'both';
    const aristas = objetos.flatMap((o) =>
      o.columnas
        .filter((c) => c.fk)
        .map((c) => {
          const destino = objetos.find((t) => t.schemaName === c.fk![0] && t.objectName === c.fk![1]);
          return destino ? { fromObjectId: o.id, toObjectId: destino.id, constraintName: `fk_${o.objectName}_${c.name}`, fromColumns: [c.name], toColumns: ['id'], kind: 'REFERENCES', provenance: 'STRUCTURAL_FK_OBSERVED' } : null;
        })
        .filter((e): e is NonNullable<typeof e> => e !== null),
    );
    const vistos = new Map<string, number>([[raiz.id, 0]]);
    let frontera = [raiz.id];
    for (let d = 1; d <= Number(req.query.get('depth') ?? 2) && frontera.length; d++) {
      const sig: string[] = [];
      for (const actual of frontera) {
        for (const e of aristas) {
          const otro =
            direccion !== 'upstream' && e.toObjectId === actual ? e.fromObjectId : direccion !== 'downstream' && e.fromObjectId === actual ? e.toObjectId : null;
          if (otro && !vistos.has(otro)) {
            vistos.set(otro, d);
            sig.push(otro);
          }
        }
      }
      frontera = sig;
    }
    return {
      root: raiz.id,
      direction: direccion,
      maxDepth: Number(req.query.get('depth') ?? 2),
      nodes: [...vistos.entries()].map(([id, depth]) => {
        const o = buscar(id)!;
        return { objectId: id, depth, schemaName: o.schemaName, objectName: o.objectName, objectKind: o.objectKind, reviewStatus: o.ficha?.reviewStatus ?? null, owner: (o.ficha?.content['businessOwner'] as string) ?? null };
      }),
      edges: aristas.filter((e) => vistos.has(e.fromObjectId) && vistos.has(e.toObjectId)),
      truncated: frontera.length > 0,
      truncatedReason: frontera.length > 0 ? 'MAX_DEPTH' : null,
      scope: 'Sólo claves foráneas observadas en la base. No incluye dependencias por código, vistas, jobs, reportes ni integraciones: la ausencia de aristas no prueba ausencia de impacto.',
    };
  });

  router.put('/admin/catalog/objects/:id/annotation', (req: MockRequest) => {
    const o = buscar(req.params['id']);
    if (!o) return notFound();
    const body = req.body as Record<string, unknown>;
    const actual = o.ficha?.version ?? 0;
    if (body['expectedVersion'] !== actual) {
      return reply(409, { statusCode: 409, code: 'CONCURRENCY_CONFLICT', message: 'La ficha cambió desde que se leyó', details: { expectedVersion: body['expectedVersion'], latestVersion: actual } });
    }
    const { expectedVersion: _v, submit, changeReason, ...patch } = body;
    const contenido: Record<string, unknown> = { ...(o.ficha?.content ?? CONTENIDO_VACIO), ...patch };
    if (submit) {
      const violaciones: { field: string; reason: string; message: string }[] = [];
      const declaradas = new Set(((contenido['openQuestions'] as { field?: string }[]) ?? []).map((q) => q.field));
      for (const campo of ['purpose', 'existenceRationale', 'rowGrain']) {
        const valor = contenido[campo];
        if (!valor && !declaradas.has(campo)) violaciones.push({ field: campo, reason: 'REQUIRED_OR_OPEN_QUESTION', message: `"${campo}" debe responderse o registrarse como pregunta abierta` });
        else if (typeof valor === 'string' && (valor.length < 30 || RELLENO.test(valor))) violaciones.push({ field: campo, reason: 'FILLER_TEXT', message: `"${campo}" no explica nada que el nombre técnico no diga ya` });
      }
      if (violaciones.length) {
        return reply(422, { statusCode: 422, code: 'VALIDATION_FAILED', message: 'La ficha no puede enviarse a revisión todavía', details: { violations: violaciones } });
      }
    }
    const f = o.ficha ?? ficha({}, 'DRAFT');
    f.content = contenido;
    f.version = actual + 1;
    f.currentRevisionNo += o.ficha ? 1 : 0;
    f.reviewStatus = submit ? 'NEEDS_REVIEW' : 'DRAFT';
    f.autorRevision = req.user?.id ?? 'anon';
    f.updatedAt = ahora();
    o.ficha = f;
    o.revisiones.push({ revisionNo: f.currentRevisionNo, origin: 'MANUAL', submittedStatus: f.reviewStatus, changeReason: changeReason ?? null, authorUserId: f.autorRevision, createdAt: ahora() });
    return vistaFicha(f);
  });

  router.post('/admin/catalog/annotations/:id/review', (req: MockRequest) => {
    const o = objetos.find((x) => x.ficha?.id === req.params['id']);
    if (!o?.ficha) return notFound('Ficha no encontrada');
    const f = o.ficha;
    const body = req.body as { decision: string; expectedRevisionNo: number; comment?: string };
    if (body.expectedRevisionNo !== f.currentRevisionNo) {
      return reply(409, { statusCode: 409, code: 'CONCURRENCY_CONFLICT', message: 'La ficha tiene una revisión más reciente que la revisada', details: {} });
    }
    if (f.reviewStatus !== 'NEEDS_REVIEW') return reply(422, { statusCode: 422, code: 'PRECONDITION_FAILED', message: 'Sólo se revisa una ficha en revisión', details: {} });
    if (f.autorRevision === req.user?.id) {
      // Igual que la API: el 403 de segregación lleva la violación SELF_REVIEW.
      return reply(403, {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Quien escribió la revisión no puede decidir sobre ella',
        details: { violations: [{ field: 'reviewer', reason: 'SELF_REVIEW', message: 'Quien escribió la revisión no puede decidir sobre ella' }] },
      });
    }
    if (body.decision === 'REJECTED' && (body.comment ?? '').trim().length < 10) return validation('Un rechazo debe explicar qué falta o qué está mal');
    if (body.decision === 'APPROVED' && o.evidencia.length === 0) {
      return reply(422, { statusCode: 422, code: 'PRECONDITION_FAILED', message: 'No se aprueba una ficha sin al menos una evidencia enlazada', details: {} });
    }
    f.reviewStatus = body.decision;
    if (body.decision === 'APPROVED') {
      f.approvedRevisionNo = f.currentRevisionNo;
      f.approvedAt = ahora();
    }
    f.version += 1;
    o.decisiones.push({ revisionNo: f.currentRevisionNo, decision: body.decision, comment: body.comment ?? null, reviewerUserId: req.user?.id ?? 'anon', decidedAt: ahora() });
    return vistaFicha(f);
  });

  router.get('/admin/catalog/coverage', (req: MockRequest) => {
    const schema = req.query.get('schema');
    const alcance = objetos.filter((o) => o.observationStatus === 'OBSERVED' && (!schema || o.schemaName === schema));
    const cs = alcance.map(cobertura);
    const dim = (n: number) => ({
      status: alcance.length ? 'MEASURED' : 'NOT_APPLICABLE',
      covered: n,
      denominator: alcance.length,
      ratio: alcance.length ? Math.round((n / alcance.length) * 10_000) / 10_000 : null,
    });
    return {
      scope: { sourceCode: 'primary', schema },
      lastScan: { scanId: escaneos[0]?.['id'], finishedAt: haceHoras(3), limitations: [] },
      modelVersion: 'catalog-coverage/v1',
      denominator: alcance.length,
      dimensions: {
        technical: dim(cs.filter((c) => c.technical === 'COMPLETE').length),
        semantic: dim(cs.filter((c) => c.semantic === 'COMPLETE').length),
        ownership: dim(cs.filter((c) => c.ownership === 'COMPLETE').length),
        sensitivity: dim(cs.filter((c) => c.sensitivity === 'KNOWN').length),
        review: dim(cs.filter((c) => c.review === 'APPROVED_CURRENT').length),
      },
      declaredDebt: cs.filter((c) => c.semantic === 'DECLARED_DEBT').length,
    };
  });

  router.get('/admin/catalog/scans', () => ({ items: escaneos, nextCursor: null, limit: 50 }));
  router.post('/admin/catalog/scans', () => {
    if (escaneos.some((s) => s['status'] === 'QUEUED' || s['status'] === 'RUNNING')) {
      return conflict('Ya hay un escaneo en curso de esta fuente');
    }
    const escaneo = { ...escaneos[0], id: nuevoId(), status: 'QUEUED', requestedAt: ahora(), startedAt: null, finishedAt: null, counters: null, snapshotHash: null };
    escaneos.unshift(escaneo);
    // Simula al worker: a los pocos segundos la corrida termina.
    setTimeout(() => Object.assign(escaneo, { ...escaneos[1], id: escaneo['id'], requestedAt: escaneo['requestedAt'], status: 'SUCCEEDED', finishedAt: ahora() }), 4000);
    return reply(202, { scanId: escaneo['id'], status: 'QUEUED', acceptedAt: escaneo['requestedAt'], statusUrl: `/admin/catalog/scans/${String(escaneo['id'])}`, created: true });
  });
}

function registrarAnalitica(router: MockRouter): void {
  const ventana = (req: MockRequest) => ({
    from: req.query.get('from') ?? haceHoras(24 * 7),
    to: req.query.get('to') ?? ahora(),
    interval: (req.query.get('interval') as 'hour' | 'day') ?? 'day',
    timezone: 'UTC',
    portal: req.query.get('portal'),
  });
  router.get('/admin/analytics/overview', (req: MockRequest) => ({
    window: ventana(req),
    totals: { events: 18432, sessions: 2210, pseudonymousSubjects: 1304, pageViews: 9120, lastEventAt: haceHoras(0.1) },
    definitions: {
      sessions: 'session_id distintos con al menos un evento en la ventana',
      pseudonymousSubjects: 'analytics_subject_id distintos: sujetos seudónimos con consentimiento, no usuarios únicos',
      pageViews: 'eventos con event_name = page_view',
    },
    topRoutes: [
      { route: '/search', events: 4210, sessions: 1320 },
      { route: '/schedule/book/:slotId', events: 2604, sessions: 811 },
      { route: '/my-account/appointments', events: 1990, sessions: 702 },
      { route: '/directory/:profileId', events: 1450, sessions: 640 },
    ],
    topEvents: [
      { eventName: 'page_view', events: 9120, sessions: 2210 },
      { eventName: 'search_performed', events: 3102, sessions: 1203 },
      { eventName: 'booking_started', events: 1011, sessions: 880 },
      { eventName: 'booking_confirmed', events: 402, sessions: 398 },
    ],
  }));
  router.get('/admin/analytics/timeseries', (req: MockRequest) => {
    const w = ventana(req);
    const dias = 7;
    return {
      window: w,
      points: Array.from({ length: dias }, (_, i) => ({
        bucket: new Date(Date.now() - (dias - 1 - i) * 86_400_000).toISOString().slice(0, 10) + 'T00:00:00.000Z',
        events: [2410, 2980, 2605, 3120, 2890, 1980, 2447][i],
        sessions: [301, 352, 318, 380, 344, 240, 275][i],
      })),
      note: 'Las sesiones por cubo no se suman: una sesión que cruza dos cubos cuenta en ambos.',
    };
  });
  router.get('/admin/analytics/web-vitals', (req: MockRequest) => ({
    window: ventana(req),
    route: null,
    method: 'percentile_cont sobre todas las muestras de la ventana (no promedio de percentiles)',
    metrics: [
      { metric: 'LCP', unit: 'ms', samples: 1820, p50: 1840, p75: 2380, p95: 4120, ratings: { GOOD: 1310, NEEDS_IMPROVEMENT: 380, POOR: 130 }, deprecated: null },
      { metric: 'INP', unit: 'ms', samples: 1450, p50: 96, p75: 180, p95: 420, ratings: { GOOD: 1190, NEEDS_IMPROVEMENT: 210, POOR: 50 }, deprecated: null },
      { metric: 'CLS', unit: 'score', samples: 1790, p50: 0.02, p75: 0.07, p95: 0.21, ratings: { GOOD: 1580, NEEDS_IMPROVEMENT: 160, POOR: 50 }, deprecated: null },
    ],
    byRoute: null,
  }));
  const embudo = { id: '00000000-0000-4000-9100-000000000001', code: 'booking', name: 'Reserva de cita', version: 2, portal: 'WEB', steps: [{ stepNumber: 1, eventName: 'search_performed', eventSchemaDefinitionId: 'x1' }, { stepNumber: 2, eventName: 'booking_started', eventSchemaDefinitionId: 'x2' }, { stepNumber: 3, eventName: 'booking_confirmed', eventSchemaDefinitionId: 'x3' }] };
  router.get('/admin/analytics/funnels', () => [embudo]);
  router.get('/admin/analytics/funnels/:id/report', (req: MockRequest) =>
    req.params['id'] !== embudo.id
      ? notFound('Embudo no encontrado')
      : {
          funnel: { id: embudo.id, code: embudo.code, name: embudo.name, version: embudo.version },
          window: ventana(req),
          unit: 'session',
          denominator: 1203,
          completed: 398,
          overallConversion: 0.3308,
          steps: [
            { stepNumber: 1, eventName: 'search_performed', reached: 1203, conversionFromStart: 1, conversionFromPrevious: null, droppedFromPrevious: null },
            { stepNumber: 2, eventName: 'booking_started', reached: 880, conversionFromStart: 0.7315, conversionFromPrevious: 0.7315, droppedFromPrevious: 323 },
            { stepNumber: 3, eventName: 'booking_confirmed', reached: 398, conversionFromStart: 0.3308, conversionFromPrevious: 0.4523, droppedFromPrevious: 482 },
          ],
          rules: { order: 'estricto: cada paso en o después del anterior, dentro de la ventana', conversionWindow: 'la ventana de la consulta', repeats: 'cuenta una vez por sesión' },
          serverConfirmedConversions: 391,
        },
  );
  router.get('/admin/analytics/pipeline-health', (req: MockRequest) => ({
    window: ventana(req),
    measured: { accepted: 18432, lastReceivedAt: haceHoras(0.05), freshnessSeconds: 180, ingestLagSeconds: { p50: 0.8, p95: 4.2 }, clockSkewFuture: 3, lateOver24h: 12, withoutSession: 41, clientContexts: 2230, bots: 18, botUnknown: 140 },
    notMeasured: [
      { metric: 'duplicates', reason: 'La ingesta descarta duplicados por clave de idempotencia sin persistirlos; sólo los cuenta en la respuesta.' },
      { metric: 'consentDropped', reason: 'Los eventos sin consentimiento vigente se descartan antes de persistir; no queda registro agregable.' },
      { metric: 'rejected', reason: 'Un lote inválido se rechaza entero con 4xx; no hay contador de rechazos.' },
    ],
  }));
  const sesiones = Array.from({ length: 8 }, (_, i) => ({ id: `00000000-0000-4000-9200-00000000000${i}`, portal: 'WEB', status: i === 0 ? 'OPEN' : 'CLOSED', startedAt: haceHoras(i * 3 + 1), endedAt: i === 0 ? null : haceHoras(i * 3 + 0.8), durationSeconds: i === 0 ? null : 720 - i * 30, eventCount: 12 - i, hasPseudonymousSubject: i % 2 === 0 }));
  router.get('/admin/analytics/sessions', (req: MockRequest) => ({ window: ventana(req), items: sesiones, nextCursor: null, limit: 50 }));
  router.get('/admin/analytics/sessions/:id', (req: MockRequest) => {
    const s = sesiones.find((x) => x.id === req.params['id']);
    if (!s) return notFound('Sesión no encontrada');
    return {
      ...s,
      events: [
        { id: nuevoId(), eventName: 'page_view', routeTemplate: '/search', occurredAt: s.startedAt, receivedAt: s.startedAt, propertyNames: ['query_length'] },
        { id: nuevoId(), eventName: 'search_performed', routeTemplate: '/search', occurredAt: s.startedAt, receivedAt: s.startedAt, propertyNames: ['result_count', 'specialty'] },
        { id: nuevoId(), eventName: 'booking_started', routeTemplate: '/schedule/book/:slotId', occurredAt: s.startedAt, receivedAt: s.startedAt, propertyNames: [] },
      ],
      truncated: false,
    };
  });
}

function registrarQa(router: MockRouter): void {
  const entorno = { id: '00000000-0000-4000-9300-000000000001', code: 'STAGING', name: 'Staging', kind: 'ENV_STAGING', baseUrl: 'https://staging.api.alovida.test', isProductionSafe: false, state: 'ACTIVE' };
  const suite = { id: '00000000-0000-4000-9300-000000000010', code: 'AGENDA-SMOKE', name: 'Agenda · humo', description: null, version: 3, state: 'SUITE_ACTIVE', type: 'SMOKE', ownerTeam: 'Agenda', cases: 3, activeCases: 3, lastRun: { id: '00000000-0000-4000-9300-000000000020', runNumber: 'AGENDA-SMOKE-00012', status: 'RUN_FAILED_STATUS', finishedAt: haceHoras(6) } };
  const detalle = {
    id: suite.id, code: suite.code, name: suite.name, version: suite.version, state: suite.state,
    cases: [
      { id: 'c1', code: 'SLOTS', name: 'Listar horarios', type: 'HAPPY_PATH', method: 'GET', requestPath: '/api/scheduling/slots', expectedHttpStatus: 200, isCritical: true, state: 'CASE_ACTIVE', assertions: [{ id: 'a1', type: 'ASSERT_STATUS', path: null, operator: 'OP_EQ', expected: '200', tolerance: null }] },
      { id: 'c2', code: 'SLOT-DETAIL', name: 'Detalle de horario', type: 'HAPPY_PATH', method: 'GET', requestPath: '/api/scheduling/slots/1', expectedHttpStatus: 200, isCritical: false, state: 'CASE_ACTIVE', assertions: [{ id: 'a2', type: 'ASSERT_JSON', path: '$.data.id', operator: 'OP_EXISTS', expected: null, tolerance: null }] },
      { id: 'c3', code: 'SLOT-404', name: 'Horario inexistente', type: 'NEGATIVE', method: 'GET', requestPath: '/api/scheduling/slots/0', expectedHttpStatus: 404, isCritical: false, state: 'CASE_ACTIVE', assertions: [{ id: 'a3', type: 'ASSERT_STATUS', path: null, operator: 'OP_EQ', expected: '404', tolerance: null }] },
    ],
  };
  const limites = { maxRequests: 300, maxDurationSeconds: 60, requestTimeoutMs: 10000, minIntervalMs: 200 };
  const destino = { id: '00000000-0000-4000-9300-000000000030', environmentId: entorno.id, scheme: 'https', host: 'staging.api.alovida.test', port: 443, allowedPathPrefixes: ['/api'], allowPrivateNetwork: false, allowMutations: false, authSecretRef: 'QA_TARGET_STAGING_TOKEN', authSecretConfigured: true, limits: limites, status: 'ACTIVE', version: 1 };
  const pasos = detalle.cases.map((c) => ({ caseId: c.id, code: c.code, method: c.method, url: `https://staging.api.alovida.test${c.requestPath}`, mutating: false, bodyHash: 'e3b0c442' }));
  const HASH = '9f2c7a1e4b8d3f60a5c1e2d4b6f8a0c3e5d7b9f1a3c5e7d9b1f3a5c7e9d1b3f5';
  const planes: Record<string, unknown>[] = [
    {
      id: '00000000-0000-4000-9300-000000000040', runId: suite.lastRun.id, suiteId: suite.id, suiteVersion: 3, environmentId: entorno.id, planHash: HASH, status: 'FAILED', requiresApproval: false, approvalReasons: [], requestedByUserId: '00000000-0000-4000-8000-00000000c0c0', createdAt: haceHoras(6.1), startedAt: haceHoras(6.05), finishedAt: haceHoras(6), cancelRequestedAt: null,
      counters: { requestsSent: 3, casesPassed: 2, casesFailed: 1, casesNotRun: 0 }, error: null, steps: pasos, clamped: [], limits: limites, approvals: [],
      events: [
        { seq: 1, kind: 'PLAN_CREATED', caseId: null, detail: { status: 'QUEUED' }, at: haceHoras(6.1) },
        { seq: 2, kind: 'PLAN_STARTED', caseId: null, detail: { steps: 3 }, at: haceHoras(6.05) },
        { seq: 3, kind: 'CASE_PASSED', caseId: 'c1', detail: { httpStatus: 200, latencyMs: 142 }, at: haceHoras(6.04) },
        { seq: 4, kind: 'CASE_FAILED', caseId: 'c2', detail: { httpStatus: 200, latencyMs: 98, assertionsFailed: 1 }, at: haceHoras(6.03) },
        { seq: 5, kind: 'CASE_PASSED', caseId: 'c3', detail: { httpStatus: 404, latencyMs: 61 }, at: haceHoras(6.02) },
        { seq: 6, kind: 'PLAN_FINISHED', caseId: null, detail: { status: 'FAILED' }, at: haceHoras(6) },
      ],
    },
  ];
  const resumenPlan = (p: Record<string, unknown>) => {
    const { steps: _s, events: _e, approvals: _a, limits: _l, clamped: _c, ...rest } = p;
    return rest;
  };

  router.get('/admin/qa/environments', () => [entorno]);
  router.get('/admin/qa/suites', () => [suite]);
  router.get('/admin/qa/suites/:id', (req: MockRequest) => (req.params['id'] === suite.id ? detalle : notFound('Suite no encontrada')));
  router.get('/admin/qa/targets', () => [destino]);
  router.get('/admin/qa/runs', () => [{ id: suite.lastRun.id, runNumber: suite.lastRun.runNumber, suiteId: suite.id, environmentId: entorno.id, trigger: 'TRIGGER_MANUAL', status: 'RUN_FAILED_STATUS', startedAt: haceHoras(6.05), finishedAt: haceHoras(6), durationMs: 3100, totals: { cases: 3, passed: 2, failed: 1, skipped: 0 } }]);
  router.get('/admin/qa/runs/:id', (req: MockRequest) =>
    req.params['id'] !== suite.lastRun.id
      ? notFound('Corrida no encontrada')
      : {
          id: suite.lastRun.id, runNumber: suite.lastRun.runNumber, suiteId: suite.id, status: 'RUN_FAILED_STATUS', finishedAt: haceHoras(6), totals: { cases: 3, passed: 2, failed: 1, skipped: 0 },
          results: [
            { id: 'r1', caseCode: 'SLOTS', status: 'RESULT_PASSED', errorText: null, assertions: [{ passed: true, actualValue: '200', message: 'Igual al esperado' }] },
            { id: 'r2', caseCode: 'SLOT-DETAIL', status: 'RESULT_FAILED', errorText: null, assertions: [{ passed: false, actualValue: null, message: 'No existe en la respuesta' }] },
            { id: 'r3', caseCode: 'SLOT-404', status: 'RESULT_PASSED', errorText: null, assertions: [{ passed: true, actualValue: '404', message: 'Igual al esperado' }] },
          ],
        },
  );
  router.get('/admin/qa/defects', () => [{ id: nuevoId(), defectNumber: 'DEF-00007', testCaseId: 'c2', type: 'DEFECT_TYPE_BUG', severity: 'DEF_SEV_HIGH', status: 'DEFECT_OPEN', isFlaky: false, occurrences: 3, firstSeenAt: haceHoras(50), lastSeenAt: haceHoras(6), externalIssueRef: null, assignedToUserId: null }]);
  router.get('/admin/qa/plans', () => planes.map(resumenPlan));
  router.get('/admin/qa/plans/:id', (req: MockRequest) => planes.find((p) => p['id'] === req.params['id']) ?? notFound('Plan no encontrado'));
  router.post('/admin/qa/plans/preflight', (req: MockRequest) => {
    const body = req.body as { suiteId: string; environmentId: string };
    if (body.suiteId !== suite.id || body.environmentId !== entorno.id) return notFound('Suite o entorno no encontrado');
    return { suite: { id: suite.id, code: suite.code, version: 3 }, environment: { id: entorno.id, code: entorno.code, kind: 'STAGING' }, target: destino, executable: true, steps: pasos, limits: limites, hash: HASH, requiresApproval: false, approvalReasons: [], violations: [], clamped: [], concurrency: 1, loadTesting: 'NOT_SUPPORTED: el runner ejecuta pruebas funcionales secuenciales; carga/estrés quedan fuera' };
  });
  router.post('/admin/qa/plans', (req: MockRequest) => {
    const body = req.body as { suiteId: string; environmentId: string };
    if (body.suiteId !== suite.id) return notFound('Suite no encontrada');
    const plan = { ...planes[0], id: nuevoId(), runId: nuevoId(), status: 'QUEUED', requestedByUserId: req.user?.id ?? null, createdAt: ahora(), startedAt: null, finishedAt: null, counters: { requestsSent: 0, casesPassed: 0, casesFailed: 0, casesNotRun: 0 }, events: [{ seq: 1, kind: 'PLAN_CREATED', caseId: null, detail: { status: 'QUEUED' }, at: ahora() }] };
    planes.unshift(plan);
    return reply(202, { ...plan, created: true, statusUrl: `/admin/qa/plans/${String(plan['id'])}` });
  });
  router.post('/admin/qa/plans/:id/cancel', (req: MockRequest) => {
    const plan = planes.find((p) => p['id'] === req.params['id']);
    if (!plan) return notFound('Plan no encontrado');
    if (['PASSED', 'FAILED', 'CANCELLED', 'INFRA_ERROR', 'TIMED_OUT', 'REJECTED'].includes(String(plan['status']))) return conflict('El plan ya terminó');
    plan['status'] = 'CANCELLED';
    plan['finishedAt'] = ahora();
    return plan;
  });
  router.post('/admin/qa/plans/:id/approvals', (req: MockRequest) => {
    const plan = planes.find((p) => p['id'] === req.params['id']);
    if (!plan) return notFound('Plan no encontrado');
    if (plan['status'] !== 'PENDING_APPROVAL') return conflict('El plan no está esperando aprobación');
    if (plan['requestedByUserId'] === req.user?.id) {
      return reply(403, {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Quien pidió el plan no puede aprobarlo',
        details: { violations: [{ field: 'approver', reason: 'SELF_APPROVAL', message: 'Quien pidió el plan no puede aprobarlo' }] },
      });
    }
    return plan;
  });
}

function registrarOperacion(router: MockRouter): void {
  router.get('/admin/ops/readiness', () => ({
    modelVersion: 'release-readiness/v1',
    evaluatedAt: ahora(),
    status: 'NOT_READY',
    blockingFailures: ['QA_GATE'],
    blockingUnknown: ['SLO_ATTAINED'],
    controls: [
      { code: 'RESTORE_TESTED', title: 'Restauración probada, reciente y dentro de RPO/RTO', blocking: true, status: 'PASS', reason: '1 política(s) con restauración vigente', evidence: [{ ref: 'system_ops.restore_test_runs/7c1e', detail: 'dentro de objetivo', at: haceHoras(20) }], observedAt: haceHoras(20), staleAfterDays: 90 },
      { code: 'NO_OPEN_SEVERE_INCIDENTS', title: 'Sin incidentes críticos o altos abiertos', blocking: true, status: 'PASS', reason: 'Sin incidentes graves abiertos (1 abiertos de menor severidad)', evidence: [], observedAt: null, staleAfterDays: null },
      { code: 'SLO_ATTAINED', title: 'SLO medidos en los últimos 7 días y sin incumplimiento', blocking: true, status: 'UNKNOWN', reason: '1 SLO sin medición reciente', evidence: [], observedAt: null, staleAfterDays: 7 },
      { code: 'QA_GATE', title: 'Último plan de QA del servidor aprobado en cada suite activa', blocking: true, status: 'FAIL', reason: 'Suites sin aprobar: AGENDA-SMOKE (FAILED)', evidence: [{ ref: 'qa_execution.execution_plans/00000000-0000-4000-9300-000000000040', detail: 'AGENDA-SMOKE: FAILED', at: haceHoras(6) }], observedAt: haceHoras(6), staleAfterDays: 7 },
      { code: 'NO_OPEN_SEVERE_DEFECTS', title: 'Sin defectos críticos o altos abiertos', blocking: true, status: 'FAIL', reason: '1 defecto(s) grave(s) abiertos', evidence: [{ ref: 'qa_lab.test_defects/…', detail: 'DEF-00007 · DEF_SEV_HIGH · DEFECT_OPEN', at: null }], observedAt: null, staleAfterDays: null },
      { code: 'LAST_PRODUCTION_DEPLOYMENT', title: 'Último despliegue a producción', blocking: false, status: 'PASS', reason: 'DEP-00031: DEP_SUCCEEDED', evidence: [], observedAt: haceHoras(52), staleAfterDays: null },
      { code: 'DATA_CATALOG_REVIEWED', title: 'Tablas con justificación aprobada', blocking: false, status: 'FAIL', reason: '1/10 tablas con ficha aprobada vigente', evidence: [], observedAt: null, staleAfterDays: null },
    ],
    notImplemented: ['Excepciones con owner, motivo y vencimiento', 'Control de autorización/aislamiento (RLS efectivo): la API conecta como superusuario (ADR-0023)'],
  }));
  router.get('/admin/ops/incidents', () => [
    { id: nuevoId(), number: 'INC-0042', title: 'Demora en la confirmación de citas', severity: 'INC_SEV3', status: 'INC_ACK', component: { code: 'scheduling', name: 'Agenda' }, openedAt: haceHoras(9), acknowledgedAt: haceHoras(8), resolvedAt: null },
    { id: nuevoId(), number: 'INC-0041', title: 'Errores 502 en pagos', severity: 'INC_SEV1', status: 'INC_RESOLVED', component: { code: 'payments', name: 'Pagos' }, openedAt: haceHoras(80), acknowledgedAt: haceHoras(79.9), resolvedAt: haceHoras(77) },
  ]);
  router.get('/admin/ops/deployments', () => [
    { id: nuevoId(), number: 'DEP-00031', environment: 'OPS_ENV_PRD', status: 'DEP_SUCCEEDED', strategy: 'DEPLOY_ROLLING', gitRef: 'v4.2.18', component: 'api', startedAt: haceHoras(52.2), finishedAt: haceHoras(52), isCurrent: true, rollbackOf: null },
    { id: nuevoId(), number: 'DEP-00030', environment: 'OPS_ENV_STG', status: 'DEP_SUCCEEDED', strategy: 'DEPLOY_ROLLING', gitRef: 'v4.2.18', component: 'api', startedAt: haceHoras(60), finishedAt: haceHoras(59.8), isCurrent: true, rollbackOf: null },
  ]);
  router.get('/admin/ops/slos', () => [
    { id: nuevoId(), indicator: { code: 'availability', name: 'Disponibilidad de la API' }, target: 0.999, rollingWindowSeconds: 2592000, lastMeasurement: { measuredAt: haceHoras(24 * 9), status: 'SLO_PASS', attained: 0.9994, goodEvents: 999400, totalEvents: 1000000 } },
  ]);
  router.get('/admin/ops/backups', () => [
    { policyId: nuevoId(), rpoSeconds: 900, rtoSeconds: 14400, restoreTestFrequencyDays: 30, retentionDays: 35, lastRestoreTest: { id: nuevoId(), finishedAt: haceHoras(20), outcome: 'PASS', integrityCheckPassed: true, measuredRpoSeconds: 600, measuredRtoSeconds: 5400 } },
  ]);
}

/** Portal administrativo: catálogo, analítica, QA y operación. */
export function registrarPortalAdministrativo(router: MockRouter): void {
  registrarCatalogo(router);
  registrarAnalitica(router);
  registrarQa(router);
  registrarOperacion(router);
}
