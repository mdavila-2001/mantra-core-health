import type {
  Arbol,
  DerivaCatalogo,
  Grafo,
  HallazgoDetalle,
  HallazgoResumen,
  Linaje,
  LinajeTabla,
  MapaFila,
  OperacionDetalle,
  OperacionResumen,
  PortalPage,
  ProcesoDetalle,
  ProcesoResumen,
  TablaFicha,
  TablaResumen,
  TerminoGlosario,
} from '../../../core/data-access/admin-portal/portal.types';

/* Datos de prueba de las pantallas del portal: pocos, pero con las formas reales del inventario. */

export function page<T>(items: readonly T[], nextCursor: string | null = null): PortalPage<T> {
  return { items, nextCursor, limit: 25, total: items.length };
}

export function operation(over: Partial<OperacionResumen> = {}): OperacionResumen {
  return {
    id: 'SchedulingController_listSlots',
    metodo: 'GET',
    ruta: '/scheduling/slots',
    modulo: 'scheduling',
    nombre: 'Listar cupos',
    origen: 'CONTRATO',
    riesgo: 'BAJO',
    publica: false,
    roles: ['SCHEDULING_ADMIN', 'PRACTITIONER'],
    tablas: 2,
    flujos: [{ codigo: 'scheduling', nombre: 'Agenda', etapa: 'Consultar', agrupacion: 'CASO_DE_USO_README' }],
    senales: ['SIN_PRUEBAS', 'EVENTO'],
    ...over,
  };
}

export function operationDetail(over: Partial<OperacionDetalle> = {}): OperacionDetalle {
  return {
    ...operation(),
    bloque: 'Agenda',
    codigo: 'src/modules/scheduling/scheduling.controller.ts:40',
    negocio: { texto: 'Muestra los cupos libres de una agenda.', estado: 'DOCUMENTADO', fuentes: [] },
    sistema: 'Lee los cupos con su capacidad.',
    razonesDeRiesgo: ['Sólo lee'],
    requerimientos: [
      { tipo: 'AUTENTICACION', detalle: 'JWT Bearer', fuente: 'contrato (security)' },
      { tipo: 'ROL', detalle: 'Alguno de: SCHEDULING_ADMIN', fuente: 'scheduling.controller.ts:40' },
      { tipo: 'TENANT', detalle: 'Tenant por cabecera X-Tenant-Id o por la membresía única del actor; 403 si es ambiguo o no le pertenece', fuente: 'src/app.module.ts:282' },
      { tipo: 'RATE_LIMIT', detalle: '300 solicitudes cada 60 s (límite global)', fuente: 'src/app.module.ts:149' },
    ],
    parametros: [{ nombre: 'from', en: 'query', obligatorio: true, tipo: 'string', descripcion: 'Desde' }],
    cuerpo: null,
    respuesta: { tipoRetorno: 'SlotPage', dto: 'SlotPageDto', httpCode: '200', campos: [] },
    respuestasPosibles: [
      { estado: 200, codigo: null, causas: ['Éxito'] },
      { estado: 401, codigo: 'UNAUTHENTICATED', causas: ['Hay una sesión válida (JWT)'] },
      { estado: 403, codigo: 'FORBIDDEN', causas: ['El rol está permitido', 'El tenant se resuelve y pertenece al actor'] },
    ],
    // Dos caminos de lectura a la misma tabla y una escritura: la pestaña debe contar una tabla, no tres filas.
    datos: [
      {
        schema: 'scheduling',
        tabla: 'slots',
        operacion: 'LEE',
        detalle: 'LEE',
        confianza: 'DIRECTA',
        via: ['SchedulingController.listSlots', 'SlotsService.list', 'SlotsRepository.find'],
        fuente: 'slots.repository.ts:12',
        catalogada: true,
      },
      {
        schema: 'scheduling',
        tabla: 'slots',
        operacion: 'LEE',
        detalle: 'LEE',
        confianza: 'POR_SQL',
        via: ['SchedulingController.listSlots', 'SlotsService.list', 'SlotsRepository.countByDay'],
        fuente: 'slots.repository.ts:40',
        catalogada: true,
      },
      {
        schema: 'scheduling',
        tabla: 'slot_views',
        operacion: 'ESCRIBE',
        detalle: 'CREA',
        confianza: 'POR_TIPO',
        via: ['SchedulingController.listSlots', 'SlotsService.list', 'SlotViewsRepository.record'],
        fuente: 'slot-views.repository.ts:8',
        catalogada: true,
      },
    ],
    eventos: ['scheduling.slots.viewed'],
    trabajos: [],
    noResuelto: [],
    sinTablas: null,
    pruebas: [{ tipo: 'UNITARIA', archivo: 'scheduling.controller.spec.ts', linea: 10 }],
    revision: 'AUTO_DETECTADA',
    datosPersonales: 'SIN_FUENTE',
    ...over,
  };
}

export function tree(): Arbol {
  return {
    id: 'SchedulingController_listSlots',
    nodos: [
      { tipo: 'ACCESO', txt: 'Hay una sesión válida (JWT)', falla: { estado: 401, codigo: 'UNAUTHENTICATED' } },
      {
        tipo: 'SI',
        txt: 'La agenda existe',
        entonces: [{ tipo: 'RESPUESTA', estado: 200, txt: 'Responde con éxito' }],
        sino: [{ tipo: 'ERROR', estado: 404, codigo: 'NOT_FOUND', txt: 'Agenda inexistente' }],
      },
    ],
    respuestas: [{ estado: 200, codigo: null, causas: ['Éxito'] }],
    truncado: false,
  };
}

export function mapRow(over: Partial<MapaFila> = {}): MapaFila {
  return {
    id: 'SchedulingController_createSlot',
    metodo: 'POST',
    ruta: '/scheduling/slots',
    flujos: [{ codigo: 'scheduling', nombre: 'Agenda', etapa: 'Ofrecer cupos' }],
    modulo: 'scheduling',
    riesgo: 'ALTO',
    autorizacion: 'SCHEDULING_ADMIN',
    llamadaPor: [],
    senales: ['ESCRIBE_SIN_ROLES'],
    ...over,
  };
}

export function finding(over: Partial<HallazgoResumen> = {}): HallazgoResumen {
  return {
    id: 'FLU-02',
    severidad: 'ALTA',
    titulo: 'Escriben sin declarar roles',
    queHacer: 'Declarar @Roles en el controlador',
    cuenta: 1,
    ...over,
  };
}

export function findingDetail(nextCursor: string | null = null): HallazgoDetalle {
  return {
    ...finding(),
    items: [
      {
        operacion: 'AudioAssetsController_contentById',
        metodo: 'GET',
        ruta: '/audio-assets/{assetId}/content',
        detalle: 'escribe y el controlador no declara roles',
        fuente: 'audio-assets.controller.ts:39',
      },
    ],
    nextCursor,
    limit: 50,
  };
}

export function drift(): DerivaCatalogo {
  return {
    resumen: { tablas: 1230, orm: { COINCIDE: 1211, DIVERGE: 19 } },
    deriva: {
      entidadesSinTabla: [
        {
          tabla: 'payments.cash_registers',
          clase: 'CashRegisters',
          archivo: 'src/modules/payments/entities/cash_registers.entity.ts',
          ddl: { tipo: 'SIN_DDL', fuente: null },
        },
      ],
      tablasSinEntidad: [],
      nulabilidad: 24,
      esquemasSinDominio: ['audio_assets'],
    },
  };
}

export function processSummary(over: Partial<ProcesoResumen> = {}): ProcesoResumen {
  return {
    codigo: 'scheduling',
    tipo: 'MODULO',
    nombre: 'Módulo 41 — Agenda',
    modulo: 'scheduling',
    bloque: null,
    agrupacion: 'CASO_DE_USO_README',
    actores: ['PATIENT', 'PRACTITIONER'],
    operaciones: 58,
    etapas: 7,
    maquinas: ['booking'],
    revision: 'AUTO_DETECTADA',
    ...over,
  };
}

export function processDetail(): ProcesoDetalle {
  return {
    ...processSummary(),
    paraQueSirve: 'Ofrece y reserva cupos de atención.',
    paraQueSirveFuente: 'src/modules/scheduling/README.md',
    flujoGeneral: null,
    detalleDeEtapas: [
      {
        codigo: 'ofrecer',
        nombre: 'Ofrecer cupos',
        fuente: 'README.md:10',
        operaciones: [
          {
            operacionId: 'SchedulingController_createSlot',
            metodo: 'POST',
            ruta: '/scheduling/slots',
            quienActua: 'SCHEDULING_ADMIN',
            queHace: 'Crea un cupo',
            riesgo: 'MEDIO',
            efectos: { tablas: [{ tabla: 'scheduling.slots', operacion: 'ESCRIBE', detalle: 'CREA' }], eventos: [], trabajos: [] },
          },
        ],
      },
    ],
    maquinasDeEstado: [
      {
        codigo: 'booking',
        fuente: 'booking.state.ts:1',
        estados: ['REQUESTED', 'CONFIRMED'],
        transiciones: [{ de: 'REQUESTED', a: 'CONFIRMED' }],
        iniciales: ['REQUESTED'],
        terminales: ['CONFIRMED'],
        operaciones: [],
      },
    ],
    fuentes: ['src/modules/scheduling/README.md'],
  };
}

export function graph(): Grafo {
  return {
    proceso: 'scheduling',
    nombre: 'Módulo 41 — Agenda',
    roles: ['SCHEDULING_ADMIN'],
    nodos: [
      { id: 'etapa:ofrecer', tipo: 'ETAPA', etiqueta: 'Ofrecer cupos' },
      { id: 'op:A', tipo: 'OPERACION', etiqueta: 'POST /scheduling/slots', operacionId: 'A', riesgo: 'MEDIO' },
      { id: 'op:B', tipo: 'OPERACION', etiqueta: 'GET /scheduling/slots', operacionId: 'B', riesgo: 'BAJO' },
      { id: 'actor:ADMIN', tipo: 'ACTOR', etiqueta: 'SCHEDULING_ADMIN' },
      { id: 'tabla:scheduling.slots', tipo: 'TABLA', etiqueta: 'scheduling.slots' },
    ],
    aristas: [
      { de: 'etapa:ofrecer', a: 'op:A', tipo: 'CONTIENE' },
      { de: 'actor:ADMIN', a: 'op:A', tipo: 'ACTUA' },
      { de: 'op:A', a: 'tabla:scheduling.slots', tipo: 'ESCRIBE' },
      { de: 'op:B', a: 'tabla:scheduling.slots', tipo: 'LEE' },
    ],
  };
}

export function tableSummary(over: Partial<TablaResumen> = {}): TablaResumen {
  return {
    id: 'scheduling.slots',
    schema: 'scheduling',
    tabla: 'slots',
    dominio: 'Agenda',
    columnas: 9,
    indices: 3,
    operaciones: 4,
    orm: 'COINCIDE',
    appendOnly: false,
    ...over,
  };
}

export function tableSheet(): TablaFicha {
  return {
    id: 'scheduling.slots',
    schema: 'scheduling',
    tabla: 'slots',
    dominio: 'Agenda',
    diagrama: 'modules/diagram_41_scheduling.puml',
    ddl: 'CREATE TABLE scheduling.slots (id uuid PRIMARY KEY);',
    proposito: 'Cupos de atención ofrecidos.',
    propositoEstado: 'DOMAIN_CURATED_DRAFT',
    propositoFuente: 'diagram_41_scheduling.puml',
    entidadOrm: 'Slots',
    gobierno: { pii: { estado: 'SIN_FUENTE' }, appendOnly: { estado: 'DECLARADO', valor: false } },
    columnas: [
      {
        nombre: 'resource_id',
        ordinal: 2,
        tipo: 'uuid',
        nulable: false,
        defecto: null,
        pk: false,
        fk: [{ constraint: 'fk_slots_resource', hacia: { schema: 'scheduling', tabla: 'resources', columna: 'id' } }],
        uk: [],
        restricciones: 'NOT NULL',
        rol: ['Clave foránea'],
        descripcion: { texto: 'Recurso que ofrece el cupo.' },
        clasificacion: { estado: 'SIN_FUENTE' },
        orm: { estado: 'COINCIDE', propiedad: 'resourceId' },
        fuente: 'SQL/41_scheduling/02_tables.sql',
      },
    ],
    relaciones: {
      salientes: [
        {
          constraint: 'fk_slots_resource',
          resolucion: 'DECLARED_FK',
          fuente: 'SQL/41_scheduling/03_fk_intra.sql',
          columnas: ['resource_id'],
          hacia: { schema: 'scheduling', tabla: 'resources', columnas: ['id'] },
        },
      ],
      entrantes: [],
    },
    indices: [],
    restricciones: [],
    operaciones: [
      {
        operacionId: 'SchedulingController_createSlot',
        metodo: 'POST',
        ruta: '/scheduling/slots',
        operacion: 'ESCRIBE',
        detalle: 'CREA',
        confianza: 'POR_TIPO',
      },
    ],
    deriva: {},
    revision: 'AUTO_DETECTADA',
  };
}

export function lineage(): Linaje {
  return {
    metricas: { tablas: 1230, rutas: 1456, tablasConPii: 'SIN_FUENTE' },
    dominios: [
      { id: 'dominio:agenda', etiqueta: 'Agenda', tablas: 12 },
      { id: 'dominio:finanzas', etiqueta: 'Financiero y ERP', tablas: 40 },
    ],
  };
}

export function tableLineage(): LinajeTabla {
  return {
    id: 'scheduling.slots',
    operaciones: [
      { operacion: 'GET /scheduling/slots', id: 'B', efecto: 'LEE' },
      { operacion: 'POST /scheduling/slots', id: 'A', efecto: 'ESCRIBE' },
    ],
    referencia: ['scheduling.resources'],
    referenciadaPor: [],
  };
}

export function term(over: Partial<TerminoGlosario> = {}): TerminoGlosario {
  return {
    termino: 'PHI',
    definicion: 'Dato de salud identificable.',
    fuente: 'docs/business/glossary.md:7',
    tablasRelacionadas: ['clinical.observations'],
    ...over,
  };
}
