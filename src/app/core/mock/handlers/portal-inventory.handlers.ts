import { notFound, type MockRequest, type MockRouter } from '../mock-router';

/* ============================================================================
    Backend simulado del inventario del portal (`/admin/portal/*`).

    En la API, estas rutas sirven lo que `tools/inventario` generó leyendo el
    código, el contrato y el modelo. Acá hay un inventario chico y sintético
    —dos procesos, seis operaciones, tres tablas— con las mismas formas y los
    mismos filtros, para que las pantallas del portal se recorran en la maqueta
    sin caer en el 501 genérico. Ningún dato de pacientes: sólo metadatos.
    ========================================================================== */

type Row = Record<string, unknown>;

// Antes que `OPS`: `op()` la lee mientras se arma la lista.
const NAMES: Record<string, string> = { scheduling: 'Módulo 41 — Agenda', iam: 'Módulo 01 — Identidad y acceso' };

const OPS: readonly Row[] = [
  op('SchedulingController_listSlots', 'GET', '/scheduling/slots', 'Listar cupos', 'BAJO', ['PATIENT', 'PRACTITIONER'], ['scheduling.slots'], 'LEE', ['EVENTO']),
  op('SchedulingController_createSlot', 'POST', '/scheduling/slots', 'Crear un cupo', 'MEDIO', ['SCHEDULING_ADMIN'], ['scheduling.slots'], 'ESCRIBE', ['ESCRIBE', 'SIN_PRUEBAS']),
  op('SchedulingController_book', 'POST', '/scheduling/bookings', 'Reservar un cupo', 'ALTO', ['PATIENT'], ['scheduling.bookings', 'scheduling.slots'], 'ESCRIBE', ['ESCRIBE', 'MAQUINA_DE_ESTADOS']),
  op('SchedulingController_cancel', 'DELETE', '/scheduling/bookings/{id}', 'Cancelar una reserva', 'ALTO', [], ['scheduling.bookings'], 'BORRA', ['ESCRIBE_SIN_ROLES', 'SIN_PRUEBAS']),
  op('IamAuthController_login', 'POST', '/iam/auth/login', 'Iniciar sesión', 'ALTO', [], ['iam.users'], 'LEE', ['PUBLICA'], true),
  op('IamUsersController_me', 'GET', '/iam/users/me', null, 'BAJO', [], ['iam.users'], 'LEE', ['CONTRATO_AUSENTE'], false, 'CONTRATO_AUSENTE'),
];

function op(
  id: string, metodo: string, ruta: string, nombre: string | null, riesgo: string, roles: string[],
  tablas: string[], efecto: string, senales: string[], publica = false, origen = 'CONTRATO',
): Row {
  const moduleName = ruta.split('/')[1]!;
  const flow = moduleName === 'scheduling' ? 'scheduling' : 'iam';
  return {
    id, metodo, ruta, modulo: moduleName, nombre, origen, riesgo, publica, roles, tablas: tablas.length, senales,
    flujos: [{ codigo: flow, nombre: NAMES[flow], etapa: nombre ?? 'Sin etapa', agrupacion: 'CASO_DE_USO_README' }],
    _tablas: tablas.map((t) => ({ tabla: t, efecto })),
  };
}


const PROCESSES: readonly Row[] = [
  { codigo: 'scheduling', tipo: 'MODULO', nombre: NAMES['scheduling'], modulo: 'scheduling', bloque: 'Atención', agrupacion: 'CASO_DE_USO_README', actores: ['PATIENT', 'SCHEDULING_ADMIN'], operaciones: 4, etapas: 2, maquinas: ['booking'], revision: 'AUTO_DETECTADA' },
  { codigo: 'iam', tipo: 'CRITICO', nombre: NAMES['iam'], modulo: 'iam', bloque: 'Plataforma', agrupacion: 'AGRUPACION_POR_CONTROLADOR', actores: ['Cualquier sesión válida'], operaciones: 2, etapas: 1, maquinas: [], revision: 'AUTO_DETECTADA' },
];

const TABLES: readonly Row[] = [
  { id: 'iam.users', schema: 'iam', tabla: 'users', dominio: 'Identidad', columnas: 12, indices: 4, operaciones: 2, orm: 'COINCIDE', appendOnly: false },
  { id: 'scheduling.bookings', schema: 'scheduling', tabla: 'bookings', dominio: 'Agenda', columnas: 9, indices: 3, operaciones: 2, orm: 'DIVERGE', appendOnly: false },
  { id: 'scheduling.slots', schema: 'scheduling', tabla: 'slots', dominio: 'Agenda', columnas: 8, indices: 2, operaciones: 3, orm: 'COINCIDE', appendOnly: false },
];

const FINDINGS: readonly Row[] = [
  { id: 'FLU-02', severidad: 'ALTA', titulo: 'Escriben sin declarar roles', queHacer: 'Declarar @Roles en el controlador o justificar por qué es abierta.', items: [{ operacion: 'SchedulingController_cancel', metodo: 'DELETE', ruta: '/scheduling/bookings/{id}', modulo: 'scheduling', detalle: 'borra y el controlador no declara roles', fuente: 'src/modules/scheduling/scheduling.controller.ts:88' }] },
  { id: 'FLU-04', severidad: 'MEDIA', titulo: 'Operaciones sin pruebas', queHacer: 'Escribir al menos una prueba que la mencione.', items: ['SchedulingController_createSlot', 'SchedulingController_cancel'].map((id) => ({ operacion: id, metodo: 'POST', ruta: OPS.find((o) => o['id'] === id)!['ruta'], detalle: 'ninguna prueba la menciona', fuente: null })) },
];

const GLOSSARY: readonly Row[] = [
  { termino: 'Cupo', definicion: 'Franja de una agenda que se puede reservar.', fuente: 'docs/business/glossary.md:12', tablasRelacionadas: ['scheduling.slots'] },
  { termino: 'PHI', definicion: 'Dato de salud identificable: exige rol y alcance clínico vigente.', fuente: 'docs/business/glossary.md:7', tablasRelacionadas: [] },
  { termino: 'Tenant', definicion: 'La organización en cuyo nombre actúa una sesión.', fuente: 'docs/business/glossary.md:20', tablasRelacionadas: ['iam.users'] },
];

function contains(q: string | null, ...fields: unknown[]): boolean {
  if (!q) return true;
  const n = q.toLowerCase();
  return fields.some((f) => typeof f === 'string' && f.toLowerCase().includes(n));
}

function paginate(items: readonly Row[], req: MockRequest): Row {
  const limit = Math.min(Number(req.query.get('limit') ?? 50) || 50, 200);
  const offset = Number(req.query.get('cursor') ?? 0) || 0;
  const slice = items.slice(offset, offset + limit).map(({ _tablas, ...rest }) => rest);
  return { items: slice, nextCursor: offset + limit < items.length ? String(offset + limit) : null, limit, total: items.length };
}

function byFilters(rows: readonly Row[], req: MockRequest, keys: readonly string[]): readonly Row[] {
  return rows.filter((r) =>
    keys.every((k) => {
      const v = req.query.get(k);
      if (!v) return true;
      if (k === 'senal') return (r['senales'] as string[]).includes(v);
      if (k === 'flujo') return (r['flujos'] as Row[]).some((f) => f['codigo'] === v);
      if (k === 'appendOnly') return String(r[k]) === v;
      return r[k] === v;
    }),
  );
}

function operationDetail(o: Row): Row {
  const touched = o['_tablas'] as { tabla: string; efecto: string }[];
  const { _tablas, ...summary } = o;
  return {
    ...summary, bloque: 'Atención', codigo: `src/modules/${o['modulo']}/controller.ts:40`,
    negocio: { texto: o['nombre'] ? `${o['nombre']} (texto sintético de la maqueta).` : null, estado: o['nombre'] ? 'DOCUMENTADO' : 'SIN_FUENTE', fuentes: [] },
    sistema: 'Generado por la maqueta.', razonesDeRiesgo: [`Riesgo ${String(o['riesgo']).toLowerCase()} por lo que escribe`],
    requerimientos: (o['roles'] as string[]).length ? [{ tipo: 'ROL', detalle: `Alguno de: ${(o['roles'] as string[]).join(', ')}`, fuente: 'controller.ts:40' }] : [],
    parametros: [], cuerpo: null, respuesta: { tipoRetorno: null, dto: null, httpCode: '200', campos: [] },
    respuestasPosibles: [{ estado: 200, codigo: null, causas: ['Éxito'] }, { estado: 403, codigo: 'FORBIDDEN', causas: ['El rol no alcanza'] }],
    datos: touched.map(({ tabla, efecto }) => ({ schema: tabla.split('.')[0], tabla: tabla.split('.')[1], operacion: efecto, detalle: efecto, confianza: 'DIRECTA', via: [], fuente: 'repository.ts:12', catalogada: true })),
    eventos: [], trabajos: [], noResuelto: [], sinTablas: null, pruebas: [], revision: 'AUTO_DETECTADA', datosPersonales: 'SIN_FUENTE',
  };
}

function graphOf(codigo: string): Row {
  const ops = OPS.filter((o) => (o['flujos'] as Row[])[0]!['codigo'] === codigo);
  const tables = [...new Set(ops.flatMap((o) => (o['_tablas'] as { tabla: string }[]).map((t) => t.tabla)))];
  return {
    proceso: codigo, nombre: NAMES[codigo], roles: [...new Set(ops.flatMap((o) => o['roles'] as string[]))],
    nodos: [
      { id: `etapa:${codigo}`, tipo: 'ETAPA', etiqueta: 'Operaciones del módulo' },
      ...ops.map((o) => ({ id: `op:${o['id']}`, tipo: 'OPERACION', etiqueta: `${o['metodo']} ${o['ruta']}`, operacionId: o['id'], riesgo: o['riesgo'], etapa: codigo })),
      ...tables.map((t) => ({ id: `tabla:${t}`, tipo: 'TABLA', etiqueta: t })),
    ],
    aristas: ops.flatMap((o) => [
      { de: `etapa:${codigo}`, a: `op:${o['id']}`, tipo: 'CONTIENE' },
      ...(o['_tablas'] as { tabla: string; efecto: string }[]).map((t) => ({ de: `op:${o['id']}`, a: `tabla:${t.tabla}`, tipo: t.efecto })),
    ]),
  };
}

function processDetail(p: Row): Row {
  const ops = OPS.filter((o) => (o['flujos'] as Row[])[0]!['codigo'] === p['codigo']);
  return {
    ...p, paraQueSirve: `Qué resuelve ${p['nombre']} (texto sintético de la maqueta).`, paraQueSirveFuente: `src/modules/${p['modulo']}/README.md`, flujoGeneral: null,
    detalleDeEtapas: [{ codigo: 'principal', nombre: 'Operaciones del módulo', fuente: null, operaciones: ops.map((o) => ({ operacionId: o['id'], metodo: o['metodo'], ruta: o['ruta'], quienActua: (o['roles'] as string[]).join(' · ') || 'Cualquier sesión válida', queHace: o['nombre'] ?? 'Sin descripción', riesgo: o['riesgo'], efectos: { tablas: (o['_tablas'] as { tabla: string; efecto: string }[]).map((t) => ({ tabla: t.tabla, operacion: t.efecto, detalle: t.efecto })), eventos: [], trabajos: [] } })) }],
    maquinasDeEstado: (p['maquinas'] as string[]).map((codigo) => ({ codigo, fuente: 'booking.state.ts:1', estados: ['REQUESTED', 'CONFIRMED', 'CANCELLED'], transiciones: [{ de: 'REQUESTED', a: 'CONFIRMED' }, { de: 'REQUESTED', a: 'CANCELLED' }], iniciales: ['REQUESTED'], terminales: ['CONFIRMED', 'CANCELLED'], operaciones: [] })),
    fuentes: [`src/modules/${p['modulo']}/README.md`],
  };
}

function tableSheet(t: Row): Row {
  const touching = OPS.flatMap((o) => (o['_tablas'] as { tabla: string; efecto: string }[]).filter((x) => x.tabla === t['id']).map((x) => ({ operacionId: o['id'], metodo: o['metodo'], ruta: o['ruta'], operacion: x.efecto, detalle: x.efecto, confianza: 'DIRECTA' })));
  return {
    ...t, diagrama: `modules/diagram_${t['schema']}.puml`, ddl: `CREATE TABLE ${t['id']} (\n  id uuid PRIMARY KEY\n);`,
    proposito: `Para qué existe ${t['id']} (texto sintético de la maqueta).`, propositoEstado: 'DOMAIN_CURATED_DRAFT', propositoFuente: `modules/diagram_${t['schema']}.puml`,
    entidadOrm: String(t['tabla']), gobierno: { responsable: { estado: 'SIN_FUENTE' }, pii: { estado: 'SIN_FUENTE' }, appendOnly: { estado: 'NO_DECLARADO' } },
    columnas: [{ nombre: 'id', ordinal: 1, tipo: 'uuid', nulable: false, defecto: null, pk: true, fk: [], uk: [], restricciones: 'PRIMARY KEY', rol: ['Clave primaria'], descripcion: { texto: 'Identificador único.' }, clasificacion: { estado: 'SIN_FUENTE' }, orm: { estado: 'COINCIDE', propiedad: 'id' }, fuente: 'SQL/02_tables.sql' }],
    relaciones: { salientes: [], entrantes: [] }, indices: [], restricciones: [], operaciones: touching, deriva: {}, revision: 'AUTO_DETECTADA',
  };
}

/** Registra el inventario simulado del portal. */
export function registerPortalInventory(router: MockRouter): void {
  router.get('/admin/portal/version', () => ({ hash: 'maqueta', operaciones: OPS.length, procesos: PROCESSES.length, tablas: TABLES.length, columnas: 29, origen: 'maqueta' }));
  router.get('/admin/portal/operaciones', (req: MockRequest) =>
    paginate(byFilters(OPS, req, ['modulo', 'riesgo', 'metodo', 'origen', 'senal', 'flujo']).filter((o) => contains(req.query.get('q'), o['ruta'], o['nombre'], o['id'])), req));
  router.get('/admin/portal/operaciones/:id', (req: MockRequest) => {
    const o = OPS.find((x) => x['id'] === req.params['id']);
    return o ? operationDetail(o) : notFound('Operación no encontrada en el inventario');
  });
  router.get('/admin/portal/operaciones/:id/arbol', (req: MockRequest) =>
    OPS.some((x) => x['id'] === req.params['id'])
      ? { id: req.params['id'], nodos: [{ tipo: 'ACCESO', txt: 'Hay una sesión válida (JWT)', falla: { estado: 401, codigo: 'UNAUTHENTICATED' } }, { tipo: 'RESPUESTA', estado: 200, txt: 'Responde con éxito' }], respuestas: [{ estado: 200, codigo: null, causas: ['Éxito'] }], truncado: false }
      : notFound('Operación no encontrada en el inventario'));
  router.get('/admin/portal/flujos/mapa', (req: MockRequest) =>
    paginate(byFilters(OPS, req, ['modulo', 'riesgo', 'metodo', 'senal', 'flujo']).filter((o) => contains(req.query.get('q'), o['ruta'], o['modulo'])).map((o) => ({ id: o['id'], metodo: o['metodo'], ruta: o['ruta'], flujos: o['flujos'], modulo: o['modulo'], riesgo: o['riesgo'], autorizacion: (o['roles'] as string[]).join(' · ') || (o['publica'] ? 'Pública' : 'Cualquier sesión válida'), llamadaPor: o['modulo'] === 'iam' ? ['IamClient'] : [], senales: o['senales'] })), req));
  router.get('/admin/portal/flujos/hallazgos', () => FINDINGS.map(({ items, ...h }) => ({ ...h, cuenta: (items as Row[]).length })));
  router.get('/admin/portal/flujos/hallazgos/:id', (req: MockRequest) => {
    const h = FINDINGS.find((x) => x['id'] === req.params['id']);
    if (!h) return notFound('Hallazgo no encontrado');
    const { items, ...rest } = h;
    const page = paginate(items as Row[], req);
    return { ...rest, cuenta: (items as Row[]).length, items: page['items'], nextCursor: page['nextCursor'], limit: page['limit'] };
  });
  router.get('/admin/portal/flujos', (req: MockRequest) =>
    paginate(byFilters(PROCESSES, req, ['tipo', 'modulo', 'agrupacion']).filter((p) => contains(req.query.get('q'), p['nombre'], p['codigo'])), req));
  router.get('/admin/portal/flujos/:codigo', (req: MockRequest) => {
    const p = PROCESSES.find((x) => x['codigo'] === req.params['codigo']);
    return p ? processDetail(p) : notFound('Proceso no encontrado en el inventario');
  });
  router.get('/admin/portal/flujos/:codigo/grafo', (req: MockRequest) =>
    PROCESSES.some((x) => x['codigo'] === req.params['codigo']) ? graphOf(req.params['codigo']!) : notFound('No existe ese proceso'));
  router.get('/admin/portal/catalogo/tablas', (req: MockRequest) =>
    paginate(byFilters(TABLES, req, ['schema', 'orm', 'appendOnly']).filter((t) => contains(req.query.get('q'), t['id'], t['dominio'])), req));
  router.get('/admin/portal/catalogo/tablas/:schema/:tabla', (req: MockRequest) => {
    const t = TABLES.find((x) => x['schema'] === req.params['schema'] && x['tabla'] === req.params['tabla']);
    return t ? tableSheet(t) : notFound('Tabla no encontrada en el catálogo');
  });
  router.get('/admin/portal/catalogo/deriva', () => ({
    resumen: { tablas: TABLES.length, orm: { COINCIDE: 2, DIVERGE: 1 } },
    deriva: { entidadesSinTabla: [{ tabla: 'payments.cash_registers', clase: 'CashRegisters', archivo: 'src/modules/payments/entities/cash_registers.entity.ts', ddl: { tipo: 'SIN_DDL', fuente: null } }], tablasSinEntidad: [], columnasAusentesEnOrm: 0, nulabilidad: 1, tipos: 0, esquemasSinDominio: ['audio_assets'] },
  }));
  router.get('/admin/portal/linaje', () => ({
    metricas: { dominios: 2, rutas: OPS.length, tablas: TABLES.length, tablasConPii: 'SIN_FUENTE', operacionATabla: 8, tablaATabla: 1 },
    dominios: [{ id: 'dominio:agenda', etiqueta: 'Agenda', tablas: 2 }, { id: 'dominio:identidad', etiqueta: 'Identidad', tablas: 1 }],
  }));
  router.get('/admin/portal/linaje/tablas/:schema/:tabla', (req: MockRequest) => {
    const id = `${req.params['schema']}.${req.params['tabla']}`;
    if (!TABLES.some((t) => t['id'] === id)) return notFound('Tabla no encontrada en el linaje');
    return {
      id,
      operaciones: OPS.flatMap((o) => (o['_tablas'] as { tabla: string; efecto: string }[]).filter((t) => t.tabla === id).map((t) => ({ operacion: `${o['metodo']} ${o['ruta']}`, id: o['id'], efecto: t.efecto }))),
      referencia: id === 'scheduling.bookings' ? ['scheduling.slots'] : [],
      referenciadaPor: id === 'scheduling.slots' ? ['scheduling.bookings'] : [],
    };
  });
  router.get('/admin/portal/glosario', (req: MockRequest) =>
    paginate(GLOSSARY.filter((g) => contains(req.query.get('q'), g['termino'], g['definicion'])), req));
}
