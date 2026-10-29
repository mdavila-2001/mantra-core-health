import type {
  CareSpaceDetail,
  CareSpaceNode,
  InfraConcept,
  RetireBlocker,
  SiteLicense,
  SiteSummary,
  SpaceAttributesInput,
  SpaceHistoryAction,
  SpaceHistoryChange,
  SpaceUnitAssignment,
} from '../../data-access/infrastructure/infrastructure.types';
import {
  BLOQUEOS_EXTERNOS,
  CAPACIDADES_SEMILLA,
  CATALOGO,
  c,
  ESPACIO_OTRO_TENANT,
  ESPACIOS_SEMILLA,
  ESTABLECIMIENTOS,
  HABILITACIONES_SEMILLA,
  REGULATORIOS,
  UNIDADES_SEMILLA,
  type EspacioSim,
  type HabilitacionSim,
} from '../fixtures/infrastructure.data';
import { reply, type MockReply, type MockRequest } from '../mock-router';
import { ahora, Coleccion, isoDia, nuevoId, uuid } from '../mock-store';

/* ============================================================================
    Estado y reglas del backend simulado de infraestructura (franja F1).

    Aquí viven las colecciones persistidas en `sessionStorage`, la conversión a
    los tipos del contrato, la validación de un espacio nuevo y el cálculo de
    los bloqueos de clausura y de la capacidad real. Las rutas están en
    `infrastructure.handlers.ts`. Todo recuento se **deriva** de lo que hay en el
    árbol cada vez que se pide; ninguna cifra está escrita.
    ========================================================================== */

export interface VinculoSim extends Record<string, unknown> {
  readonly id: string;
  readonly careSpaceId: string;
  readonly clinicalUnitId: string;
  readonly roleCode: string;
  readonly validFrom: string;
  validTo: string | null;
}

export interface HistorialSim extends Record<string, unknown> {
  readonly id: string;
  readonly spaceId: string;
  readonly revision: number;
  readonly action: SpaceHistoryAction;
  readonly changedAt: string;
  readonly changedBy: string | null;
  readonly reason: string | null;
  readonly requestId: string;
  readonly changes: readonly SpaceHistoryChange[];
}

export const espacios = new Coleccion<EspacioSim>(ESPACIOS_SEMILLA.map((e) => ({ ...e })));
export const vinculos = new Coleccion<VinculoSim>(
  ESPACIOS_SEMILLA.filter((e) => e.clinicalUnitId !== null).map((e) => ({
    id: uuid(`infra-vinculo-${e.id}`),
    careSpaceId: e.id,
    clinicalUnitId: e.clinicalUnitId!,
    roleCode: 'SPACE_UNIT_ROLE_OWNER',
    validFrom: e.validFrom ?? isoDia(-700),
    validTo: null,
  })),
);
export const historial = new Coleccion<HistorialSim>(
  ESPACIOS_SEMILLA.map((e) => ({
    id: uuid(`infra-hist-${e.id}-1`),
    spaceId: e.id,
    revision: 1,
    action: 'created' as const,
    changedAt: new Date(Date.now() - 700 * 86_400_000).toISOString(),
    changedBy: 'Soporte AloVida',
    reason: null,
    requestId: `req-seed-${e.code}`,
    changes: [],
  })),
);
export const regulatorios = new Coleccion(REGULATORIOS.map((r) => ({ ...r })));
export const habilitaciones = new Coleccion<HabilitacionSim>(HABILITACIONES_SEMILLA.map((h) => ({ ...h })));
export const capacidades = new Coleccion(CAPACIDADES_SEMILLA.map((x) => ({ ...x })));

espacios.persistirEn('mock.infra.espacios');
vinculos.persistirEn('mock.infra.vinculos');
historial.persistirEn('mock.infra.historial');
regulatorios.persistirEn('mock.infra.regulatorios');
habilitaciones.persistirEn('mock.infra.habilitaciones');
capacidades.persistirEn('mock.infra.capacidades');

/* ---- ayudas --------------------------------------------------------------- */

let secuencia = 0;
export const requestId = (): string => `req-infra-${String(++secuencia).padStart(4, '0')}`;

export const ESTADOS_OPERATIVOS: Readonly<Record<string, string>> = {
  SPACE_OP_AVAILABLE: 'Disponible',
  SPACE_OP_MAINTENANCE: 'En mantenimiento',
  SPACE_OP_BLOCKED_CLINICAL: 'Bloqueo clínico',
  SPACE_OP_BLOCKED_ADMIN: 'Bloqueo administrativo',
  SPACE_OP_CLOSED: 'Cerrada',
};

export function concepto(lista: readonly InfraConcept[], code: string | null): InfraConcept | null {
  if (code === null) return null;
  return lista.find((x) => x.code === code) ?? c(code, code);
}

export function falla(status: number, code: string, reason: string, message: string, extra: Record<string, unknown> = {}): MockReply {
  return reply(status, {
    statusCode: status,
    code,
    message,
    error: status === 409 ? 'Conflict' : status === 412 ? 'Precondition Failed' : 'Unprocessable Entity',
    details: { reason, ...extra },
    correlationId: requestId(),
    timestamp: new Date().toISOString(),
    path: '',
  });
}

export const conflicto = (reason: string, message: string, extra?: Record<string, unknown>): MockReply =>
  falla(409, 'CONFLICT', reason, message, extra);
export const regla = (reason: string, message: string, extra?: Record<string, unknown>): MockReply =>
  falla(422, 'PRECONDITION_FAILED', reason, message, extra);

export function prohibido(): MockReply {
  return reply(403, {
    statusCode: 403,
    code: 'FORBIDDEN',
    message: 'Su rol no permite modificar la estructura.',
    error: 'Forbidden',
    correlationId: requestId(),
    timestamp: new Date().toISOString(),
    path: '',
  });
}

export function puedeEscribir(request: MockRequest): boolean {
  const roles = request.user?.roles ?? [];
  return roles.includes('SECURITY_ADMIN') || roles.includes('SUPERADMIN');
}

/** Minutos de atraso que la sesión pide simular en `asOf` (captura del estado S7). */
export function atrasoDeLectura(): number {
  try {
    const crudo = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('mock:infra-antiguedad');
    const n = Number(crudo);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function sitioPropio(siteId: string) {
  const sitio = ESTABLECIMIENTOS.find((s) => s.id === siteId);
  return sitio === undefined || sitio.tenant === 'otro' ? undefined : sitio;
}

export function espacioPropio(id: string): EspacioSim | undefined {
  if (id === ESPACIO_OTRO_TENANT) return undefined;
  const e = espacios.get(id);
  return e === undefined || sitioPropio(e.siteId) === undefined ? undefined : e;
}

export const vigente = (e: EspacioSim): boolean => e.status !== 'SPACE_RETIRED';

export function hijosDe(id: string): EspacioSim[] {
  return espacios.filtrar((e) => e.parentId === id);
}

export function descendientes(id: string): EspacioSim[] {
  const salida: EspacioSim[] = [];
  const pendientes = [id];
  while (pendientes.length > 0) {
    for (const h of hijosDe(pendientes.pop()!)) {
      salida.push(h);
      pendientes.push(h.id);
    }
  }
  return salida;
}

export function nodo(e: EspacioSim): CareSpaceNode {
  return {
    id: e.id,
    parentId: e.parentId,
    code: e.code,
    name: e.name,
    form: concepto(CATALOGO.forms, e.form)!,
    function: c(e.function, CATALOGO.functions.find((f) => f.code === e.function)?.display ?? e.function),
    status: concepto(CATALOGO.lifecycle, e.status)!,
    operationalStatus: e.operational === null ? null : c(e.operational, ESTADOS_OPERATIVOS[e.operational] ?? e.operational),
    clinicalUnitId: vinculoPropietario(e.id)?.clinicalUnitId ?? null,
    capacity: e.capacity,
    rowVersion: e.rowVersion,
    childCount: hijosDe(e.id).filter(vigente).length,
  };
}

export const vinculoPropietario = (spaceId: string): VinculoSim | undefined =>
  vinculos.filtrar((v) => v.careSpaceId === spaceId && v.validTo === null && v.roleCode === 'SPACE_UNIT_ROLE_OWNER')[0];

export function asignacion(v: VinculoSim): SpaceUnitAssignment {
  return {
    id: v.id,
    careSpaceId: v.careSpaceId,
    clinicalUnitId: v.clinicalUnitId,
    role: concepto(CATALOGO.attributes.unitRole, v.roleCode)!,
    validFrom: v.validFrom,
    validTo: v.validTo,
  };
}

export function detalle(e: EspacioSim): CareSpaceDetail {
  const camas = descendientes(e.id).filter((d) => d.form === 'LOC_FORM_BED' && vigente(d));
  const camasPropias = e.form === 'LOC_FORM_BED' && vigente(e) ? [e] : [];
  const todas = [...camasPropias, ...camas];
  const ruta: CareSpaceDetail['path'][number][] = [];
  let actual = e.parentId === null ? undefined : espacios.get(e.parentId);
  while (actual !== undefined && ruta.length < 20) {
    ruta.unshift({ id: actual.id, code: actual.code, name: actual.name, form: concepto(CATALOGO.forms, actual.form)! });
    actual = actual.parentId === null ? undefined : espacios.get(actual.parentId);
  }
  return {
    ...nodo(e),
    siteId: e.siteId,
    description: e.description,
    floorNumber: e.floorNumber,
    areaM2: e.areaM2,
    asepsis: concepto(CATALOGO.attributes.asepsis, e.asepsis),
    pressure: concepto(CATALOGO.attributes.pressure, e.pressure),
    airChangesPerHour: e.airChangesPerHour,
    hvacValidatedOn: e.hvacValidatedOn,
    sexRestriction: concepto(CATALOGO.attributes.sex, e.sexRestriction),
    ageGroup: concepto(CATALOGO.attributes.ageGroup, e.ageGroup),
    bedCategory: concepto(CATALOGO.attributes.bedCategory, e.bedCategory),
    censable: e.censable,
    prepMinutes: e.prepMinutes,
    cleanupMinutes: e.cleanupMinutes,
    gln: e.gln,
    validFrom: e.validFrom,
    validTo: e.validTo,
    path: ruta,
    children: hijosDe(e.id).filter(vigente).map(nodo),
    assignments: vinculos.filtrar((v) => v.careSpaceId === e.id && v.validTo === null).map(asignacion),
    derived: {
      beds: todas.length,
      censableBeds: todas.filter((b) => b.status === 'SPACE_ACTIVE' && b.censable === true).length,
      activeChildren: hijosDe(e.id).filter((h) => h.status === 'SPACE_ACTIVE').length,
    },
  };
}

export function resumen(siteId: string, request: MockRequest): SiteSummary {
  const sitio = ESTABLECIMIENTOS.find((s) => s.id === siteId)!;
  const r = regulatorios.get(siteId);
  const escribe = puedeEscribir(request);
  return {
    id: sitio.id,
    code: sitio.code,
    name: sitio.name,
    branchId: null,
    status: c('SITE_ACTIVE', 'Activa'),
    regulatory: {
      snisCode: r?.snisCode ?? null,
      snisVerified: r?.snisVerified ?? false,
      subsector: concepto(CATALOGO.regulatory.subsector, r?.subsector ?? null),
      careLevel: concepto(CATALOGO.regulatory.careLevel, r?.careLevel ?? null),
      typology: concepto(CATALOGO.regulatory.typology, r?.typology ?? null),
      managingEntityName: r?.managingEntityName ?? null,
      healthNetworkName: r?.healthNetworkName ?? null,
      sedes: concepto(CATALOGO.regulatory.sedes, r?.sedes ?? null),
      municipalityName: r?.municipalityName ?? null,
    },
    rowVersion: r?.rowVersion ?? 1,
    viewer: { canWriteStructure: escribe, canEditRegulatory: escribe, canSeeHistory: escribe },
  };
}

export function versionDeIfMatch(request: MockRequest): number | null {
  const crudo = request.headers.get('If-Match');
  const n = crudo === null ? NaN : Number(crudo.replace(/"/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function versionVieja(actual: number, request: MockRequest): MockReply | null {
  const enviada = versionDeIfMatch(request);
  return enviada === actual
    ? null
    : falla(412, 'CONCURRENCY_CONFLICT', 'ROW_VERSION_MISMATCH', 'Otra persona cambió este dato mientras lo editaba.', {
        expectedVersion: enviada,
        latestVersion: actual,
      });
}

export function anotar(
  e: EspacioSim,
  action: SpaceHistoryAction,
  request: MockRequest,
  changes: readonly SpaceHistoryChange[],
  reason: string | null = null,
): void {
  const previas = historial.filtrar((h) => h.spaceId === e.id).length;
  historial.agregar({
    id: nuevoId('infra-hist'),
    spaceId: e.id,
    revision: previas + 1,
    action,
    changedAt: ahora(),
    changedBy: request.user?.displayName ?? null,
    reason,
    requestId: requestId(),
    changes,
  });
}

/* ---- validación de un espacio nuevo --------------------------------------- */

export interface Problema {
  readonly field: string;
  readonly reason: string;
  /** Razón del contrato, para mapear a un estado HTTP en el alta individual. */
  readonly code: 'SPACE_CODE_TAKEN' | 'SPACE_PARENT_RULE' | 'SPACE_FUNCTION_FORM' | 'TYPOLOGY_NOT_ALLOWED' | 'PARENT_NOT_ACTIVE' | 'INVALID';
}

export function funcionesPermitidas(typology: string | null): ReadonlySet<string> | null {
  const reglas = CATALOGO.typologyRules.filter((r) => r.typology === typology);
  return reglas.length === 0 ? null : new Set(reglas.map((r) => r.function));
}

export function validarNuevo(
  siteId: string,
  fila: { code?: string; name?: string; formCode?: string; functionCode?: string },
  padre: EspacioSim | null | 'inexistente',
  codigosDelLote: ReadonlySet<string>,
): Problema[] {
  const p: Problema[] = [];
  const code = (fila.code ?? '').trim();
  if (code === '') p.push({ field: 'code', reason: 'El código es obligatorio.', code: 'INVALID' });
  if ((fila.name ?? '').trim() === '') p.push({ field: 'name', reason: 'El nombre es obligatorio.', code: 'INVALID' });
  const forma = CATALOGO.forms.find((f) => f.code === fila.formCode);
  if (forma === undefined) p.push({ field: 'formCode', reason: `La forma «${fila.formCode ?? ''}» no existe en el catálogo.`, code: 'INVALID' });
  const perfil = CATALOGO.functions.find((f) => f.code === fila.functionCode);
  if (perfil === undefined) {
    p.push({ field: 'functionCode', reason: `La función «${fila.functionCode ?? ''}» no existe en el catálogo.`, code: 'INVALID' });
  } else if (forma !== undefined && !perfil.forms.includes(forma.code)) {
    p.push({ field: 'functionCode', reason: `«${perfil.display}» no se puede ubicar en un espacio de forma «${forma.display}».`, code: 'SPACE_FUNCTION_FORM' });
  }
  if (perfil !== undefined) {
    const admitidas = funcionesPermitidas(regulatorios.get(siteId)?.typology ?? null);
    if (admitidas !== null && !admitidas.has(perfil.code)) {
      p.push({ field: 'functionCode', reason: `La tipología del establecimiento no admite «${perfil.display}».`, code: 'TYPOLOGY_NOT_ALLOWED' });
    }
  }
  if (padre === 'inexistente') {
    p.push({ field: 'parentCode', reason: 'El padre indicado no existe en este establecimiento.', code: 'INVALID' });
  } else if (forma !== undefined) {
    const formaPadre = padre === null ? null : padre.form;
    const permitido = CATALOGO.parentRules.some((r) => r.parent === formaPadre && r.child === forma.code);
    if (!permitido) {
      const quien = padre === null ? 'la raíz' : `«${concepto(CATALOGO.forms, padre.form)!.display}»`;
      p.push({ field: 'formCode', reason: `Una forma «${forma.display}» no puede colgar de ${quien}.`, code: 'SPACE_PARENT_RULE' });
    }
    if (padre !== null && padre.status !== 'SPACE_ACTIVE' && padre.status !== 'SPACE_PLANNED') {
      p.push({ field: 'parentCode', reason: 'El padre está suspendido o clausurado: reactívelo primero.', code: 'PARENT_NOT_ACTIVE' });
    }
  }
  if (code !== '') {
    const repetido = codigosDelLote.has(code) || espacios.filtrar((e) => e.siteId === siteId && e.code === code).length > 0;
    if (repetido) {
      p.push({ field: 'code', reason: 'Ese código ya se usó en este establecimiento (no se reutiliza, ni el de un espacio clausurado).', code: 'SPACE_CODE_TAKEN' });
    }
  }
  return p;
}

export function atributos(a: SpaceAttributesInput & { clinicalUnitId?: string }): Partial<EspacioSim> {
  const salida: Partial<Record<keyof EspacioSim, unknown>> = {};
  const poner = (clave: keyof EspacioSim, valor: unknown): void => {
    if (valor !== undefined) salida[clave] = valor;
  };
  poner('description', a.description);
  poner('capacity', a.capacity);
  poner('floorNumber', a.floorNumber);
  poner('areaM2', a.areaM2);
  poner('asepsis', a.asepsisCode);
  poner('pressure', a.pressureCode);
  poner('airChangesPerHour', a.airChangesPerHour);
  poner('hvacValidatedOn', a.hvacValidatedOn);
  poner('sexRestriction', a.sexRestrictionCode);
  poner('ageGroup', a.ageGroupCode);
  poner('bedCategory', a.bedCategoryCode);
  poner('censable', a.censable);
  poner('prepMinutes', a.prepMinutes);
  poner('cleanupMinutes', a.cleanupMinutes);
  poner('gln', a.gln);
  return salida as Partial<EspacioSim>;
}

export function insertar(
  siteId: string,
  fila: { code: string; name: string; formCode: string; functionCode: string } & SpaceAttributesInput & { activate?: boolean; clinicalUnitId?: string },
  padre: EspacioSim | null,
  request: MockRequest,
): EspacioSim {
  const activo = fila.activate === true && (padre === null || padre.status === 'SPACE_ACTIVE');
  const nuevo: EspacioSim = {
    id: nuevoId('infra-space'),
    siteId,
    parentId: padre?.id ?? null,
    code: fila.code.trim(),
    name: fila.name.trim(),
    form: fila.formCode,
    function: fila.functionCode,
    status: activo ? 'SPACE_ACTIVE' : 'SPACE_PLANNED',
    operational: activo ? 'SPACE_OP_AVAILABLE' : null,
    clinicalUnitId: null,
    capacity: null,
    rowVersion: 1,
    description: null,
    floorNumber: null,
    areaM2: null,
    asepsis: null,
    pressure: null,
    airChangesPerHour: null,
    hvacValidatedOn: null,
    sexRestriction: null,
    ageGroup: null,
    bedCategory: null,
    censable: null,
    prepMinutes: null,
    cleanupMinutes: null,
    gln: null,
    validFrom: ahora(),
    validTo: null,
    ...atributos(fila),
  };
  espacios.agregar(nuevo);
  if (fila.clinicalUnitId !== undefined && UNIDADES_SEMILLA.some((u) => u.id === fila.clinicalUnitId)) {
    vinculos.agregar({
      id: nuevoId('infra-vinculo'),
      careSpaceId: nuevo.id,
      clinicalUnitId: fila.clinicalUnitId,
      roleCode: 'SPACE_UNIT_ROLE_OWNER',
      validFrom: ahora(),
      validTo: null,
    });
  }
  anotar(nuevo, 'created', request, []);
  return nuevo;
}

export function padreDe(siteId: string, parentSpaceId: string | undefined): EspacioSim | null | 'inexistente' {
  if (parentSpaceId === undefined || parentSpaceId === '') return null;
  const p = espacioPropio(parentSpaceId);
  return p === undefined || p.siteId !== siteId ? 'inexistente' : p;
}

/* ---- bloqueos de clausura ------------------------------------------------- */

export function bloqueos(raiz: EspacioSim): RetireBlocker[] {
  const subarbol = [raiz, ...descendientes(raiz.id)].filter(vigente);
  const salida: RetireBlocker[] = [];
  const hijos = hijosDe(raiz.id).filter(vigente);
  if (hijos.length > 0) {
    salida.push({
      kind: 'ACTIVE_CHILDREN',
      count: hijos.length,
      sampleIds: hijos.slice(0, 3).map((h) => h.id),
      nextAction: `Clausure o mueva ${hijos.length === 1 ? 'el espacio hijo' : `los ${hijos.length} espacios hijos`} (${hijos.slice(0, 3).map((h) => h.code).join(', ')}${hijos.length > 3 ? '…' : ''}).`,
    });
  }
  const externos = new Map<string, RetireBlocker>();
  for (const e of subarbol) {
    for (const b of BLOQUEOS_EXTERNOS[e.id] ?? []) {
      const previo = externos.get(b.kind);
      externos.set(
        b.kind,
        previo === undefined
          ? b
          : { ...previo, count: previo.count + b.count, sampleIds: [...previo.sampleIds, ...b.sampleIds].slice(0, 5) },
      );
    }
  }
  return [...salida, ...externos.values()];
}

/* ---- capacidad ------------------------------------------------------------ */

export function capacidadDerivada(siteId: string): { kindCode: string; quantity: number }[] {
  const activos = espacios.filtrar((e) => e.siteId === siteId && e.status === 'SPACE_ACTIVE');
  const camas = activos.filter((e) => e.form === 'LOC_FORM_BED');
  const cuenta = (f: string): number => activos.filter((e) => e.function === `SPACE_FN_${f}`).length;
  return [
    { kindCode: 'CAP_BEDS_CENSABLE', quantity: camas.filter((e) => e.censable === true).length },
    { kindCode: 'CAP_BEDS_NON_CENSABLE', quantity: camas.filter((e) => e.censable !== true).length },
    { kindCode: 'CAP_CONSULTING_ROOMS', quantity: cuenta('CONSULTING_ROOM') },
    { kindCode: 'CAP_OPERATING_ROOMS', quantity: cuenta('OPERATING_ROOM') },
    { kindCode: 'CAP_DELIVERY_ROOMS', quantity: cuenta('DELIVERY_ROOM') },
    { kindCode: 'CAP_EMERGENCY_BAYS', quantity: cuenta('EMERGENCY_BOX') },
    { kindCode: 'CAP_ICU_BEDS', quantity: camas.filter((e) => e.function === 'SPACE_FN_BED_ICU').length },
  ];
}

export function licencia(h: HabilitacionSim): SiteLicense {
  // «Vencida» se calcula al leer (INV-21): lo guardado puede decir «vigente».
  const vencida = h.expiresOn !== null && h.expiresOn < isoDia(0) && h.statusCode === 'LIC_VALID';
  return {
    id: h.id,
    authorityName: h.authorityName,
    resolutionNumber: h.resolutionNumber,
    issuedOn: h.issuedOn,
    expiresOn: h.expiresOn,
    status: concepto(CATALOGO.regulatory.licenseStatus, vencida ? 'LIC_EXPIRED' : h.statusCode)!,
    clinicalUnitId: h.clinicalUnitId,
    healthcareServiceId: null,
    documentFileId: null,
    notes: h.notes,
    rowVersion: h.rowVersion,
  };
}

