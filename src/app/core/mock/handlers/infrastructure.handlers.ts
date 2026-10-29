import type {
  CapacityGap,
  ImportRow,
  ImportRowError,
  SpaceAttributesInput,
  SpaceHistoryChange,
  TypologyConflict,
} from '../../data-access/infrastructure/infrastructure.types';
import { expandPattern } from '../../data-access/infrastructure/infrastructure.logic';
import {
  CAPACIDADES_SEMILLA,
  CATALOGO,
  c,
  UNIDADES_SEMILLA,
  type EspacioSim,
} from '../fixtures/infrastructure.data';
import { notFound, noContent, reply, type MockRouter } from '../mock-router';
import { OPS_CATALOG } from './infrastructure-ops.handlers';
import { ahora, cuerpo, isoDia, nuevoId } from '../mock-store';
import {
  anotar,
  asignacion,
  atributos,
  atrasoDeLectura,
  bloqueos,
  capacidadDerivada,
  capacidades,
  concepto,
  conflicto,
  descendientes,
  detalle,
  espacioPropio,
  espacios,
  funcionesPermitidas,
  habilitaciones,
  historial,
  insertar,
  licencia,
  nodo,
  padreDe,
  prohibido,
  puedeEscribir,
  regla,
  regulatorios,
  resumen,
  sitioPropio,
  validarNuevo,
  versionVieja,
  vigente,
  vinculos,
  type Problema,
  type VinculoSim,
} from './infrastructure.store';

/* ============================================================================
    Backend simulado de la infraestructura hospitalaria — franja F1.

    Contesta cada fila de la tabla del §3 de `CONTRATO-F0-F1.md` con su cuerpo y
    sus errores: 409 `SPACE_CODE_TAKEN`, 409 `SPACE_RETIRE_BLOCKED` con
    `blockers`, 422 `SPACE_IMMUTABLE_FIELD`, 422 `SPACE_CYCLE`, 422
    `PARENT_NOT_ACTIVE`, 409 `TYPOLOGY_CONFLICT`, 412 ante un `If-Match` viejo
    y 404 —igual que un id inexistente— ante un establecimiento o espacio de otro
    tenant. El `reason` viaja en `details.reason` y el `code` es uno de los del
    contrato de errores (`CONFLICT`, `PRECONDITION_FAILED`,
    `CONCURRENCY_CONFLICT`), que es lo que ramifica `errorToViewState`.

    ## Lo que NO es una invención

    Los recuentos (`childCount`, `derived`, capacidad real) se **derivan** de lo
    que hay en el árbol cada vez que se piden; ninguna cifra está escrita. Los
    ids de quirófano son los de `procedures.handlers.ts`. Todo sobrevive a F5
    (`sessionStorage`) para poder demostrar «crear → recargar → sigue ahí».

    ## Lo que es una simplificación del simulador

    - El tenant no se compara con `X-Tenant-Id`: la consola de organización
      lista todas las prácticas de la maqueta y compararlo dejaría sitios
      visibles que dan 404. Un establecimiento «de otro tenant» está sembrado
      aparte y responde 404.
    - Las cirugías futuras y los encuentros activos que bloquean una clausura son
      datos fijos por espacio (`BLOQUEOS_EXTERNOS`): sus módulos no están aquí.
    - Quién puede escribir sale de los roles del token (`SECURITY_ADMIN` /
      `SUPERADMIN`). La API real lo decide por membresía.
    ========================================================================== */

/* ---- rutas ----------------------------------------------------------------- */

export function registerInfrastructure(router: MockRouter): void {
  router.get('/practice/infrastructure-catalog', () => ({ ...CATALOGO, ...OPS_CATALOG }));

  router.get('/sites/:siteId/structure', (request) => {
    const sitio = sitioPropio(request.params['siteId']!);
    if (sitio === undefined) return notFound();
    const atraso = atrasoDeLectura();
    return {
      site: resumen(sitio.id, request),
      spaces: espacios.filtrar((e) => e.siteId === sitio.id).map(nodo),
      units: UNIDADES_SEMILLA.filter((u) => u.siteId === sitio.id).map((u) => ({
        id: u.id,
        parentId: u.parentId,
        code: u.code,
        name: u.name,
        status: c(u.status, 'Activa'),
        rowVersion: u.rowVersion,
      })),
      assignments: vinculos
        .filtrar((v) => v.validTo === null && espacios.get(v.careSpaceId)?.siteId === sitio.id)
        .map(asignacion),
      asOf: new Date(Date.now() - atraso * 60_000).toISOString(),
    };
  });

  router.get('/sites/:siteId/clinical-units', (request) => {
    const sitio = sitioPropio(request.params['siteId']!);
    if (sitio === undefined) return notFound();
    return UNIDADES_SEMILLA.filter((u) => u.siteId === sitio.id).map((u) => ({
      id: u.id, parentId: u.parentId, code: u.code, name: u.name, status: c(u.status, 'Activa'), rowVersion: u.rowVersion,
    }));
  });

  router.get('/care-spaces/:id', (request) => {
    const e = espacioPropio(request.params['id']!);
    return e === undefined ? notFound() : detalle(e);
  });

  router.get('/care-spaces/:id/history', (request) => {
    const e = espacioPropio(request.params['id']!);
    if (e === undefined) return notFound();
    if (!puedeEscribir(request)) return prohibido();
    return {
      entries: historial
        .filtrar((h) => h.spaceId === e.id)
        .sort((a, b) => b.revision - a.revision)
        .map((h) => ({ revision: h.revision, action: h.action, changedAt: h.changedAt, changedBy: h.changedBy, reason: h.reason, requestId: h.requestId, changes: h.changes })),
      asOf: ahora(),
    };
  });

  router.post('/sites/:siteId/care-spaces', (request) => {
    const sitio = sitioPropio(request.params['siteId']!);
    if (sitio === undefined) return notFound();
    if (!puedeEscribir(request)) return prohibido();
    const datos = cuerpo<{ code: string; name: string; formCode: string; functionCode: string; parentSpaceId: string; clinicalUnitId: string; activate: boolean } & SpaceAttributesInput>(request);
    const padre = padreDe(sitio.id, datos.parentSpaceId);
    if (padre === 'inexistente') return notFound();
    const problemas = validarNuevo(sitio.id, datos, padre, new Set());
    const tomado = problemas.find((p) => p.code === 'SPACE_CODE_TAKEN');
    if (tomado !== undefined) return conflicto('SPACE_CODE_TAKEN', tomado.reason);
    if (problemas.length > 0) {
      const primero = problemas[0]!;
      return regla(primero.code === 'INVALID' ? 'VALIDATION' : primero.code, primero.reason, { fields: problemas.map((p) => ({ field: p.field, constraints: [p.code], messages: [p.reason] })) });
    }
    const nuevo = insertar(sitio.id, datos as Required<Pick<typeof datos, 'code' | 'name' | 'formCode' | 'functionCode'>> & typeof datos, padre, request);
    return reply(201, detalle(nuevo));
  });

  router.post('/sites/:siteId/care-spaces/bulk', (request) => {
    const sitio = sitioPropio(request.params['siteId']!);
    if (sitio === undefined) return notFound();
    if (!puedeEscribir(request)) return prohibido();
    const datos = cuerpo<{ parentSpaceId: string; formCode: string; functionCode: string; codePattern: string; namePattern: string } & SpaceAttributesInput>(request);
    const padre = padreDe(sitio.id, datos.parentSpaceId);
    if (padre === 'inexistente') return notFound();
    const expansion = expandPattern(datos.codePattern ?? '', datos.namePattern ?? '');
    if (!expansion.ok) return regla('BULK_PATTERN_INVALID', expansion.reason, { field: 'codePattern' });
    const lote = new Set<string>();
    const filas: { item: { code: string; name: string }; problemas: Problema[] }[] = expansion.items.map((item) => {
      const problemas = validarNuevo(sitio.id, { ...item, formCode: datos.formCode, functionCode: datos.functionCode }, padre, lote);
      lote.add(item.code);
      return { item, problemas };
    });
    const malas = filas.filter((f) => f.problemas.length > 0);
    if (malas.length > 0) {
      const hayTomado = malas.some((f) => f.problemas.some((p) => p.code === 'SPACE_CODE_TAKEN'));
      const detalleFilas = malas.map((f) => ({ code: f.item.code, errors: f.problemas.map((p) => ({ field: p.field, reason: p.reason })) }));
      return hayTomado
        ? conflicto('SPACE_CODE_TAKEN', `No se creó ninguna cama: ${malas.length} código(s) ya existen (${malas.slice(0, 3).map((f) => f.item.code).join(', ')}).`, { rows: detalleFilas })
        : regla('BULK_INVALID', malas[0]!.problemas[0]!.reason, { rows: detalleFilas });
    }
    const creados = filas.map((f) =>
      insertar(sitio.id, { ...datos, ...f.item, formCode: datos.formCode!, functionCode: datos.functionCode! }, padre, request),
    );
    return reply(201, { created: creados.map(detalle) });
  });

  router.post('/sites/:siteId/care-spaces/import', (request) => {
    const sitio = sitioPropio(request.params['siteId']!);
    if (sitio === undefined) return notFound();
    if (!puedeEscribir(request)) return prohibido();
    const dryRun = request.query.get('dryRun') !== 'false';
    const filas = (cuerpo<{ rows: ImportRow[] }>(request).rows ?? []) as ImportRow[];
    const porCodigo = new Map<string, EspacioSim | 'del-archivo'>();
    for (const e of espacios.filtrar((x) => x.siteId === sitio.id)) porCodigo.set(e.code, e);
    const lote = new Set<string>();
    const resultados = filas.map((fila, i) => {
      let padre: EspacioSim | null | 'inexistente' = null;
      if (fila.parentCode !== undefined && fila.parentCode !== '') {
        const p = porCodigo.get(fila.parentCode);
        padre = p === undefined ? 'inexistente' : p === 'del-archivo' ? null : p;
      }
      const problemas = validarNuevo(sitio.id, fila, padre, lote);
      if (fila.code) {
        lote.add(fila.code);
        if (!porCodigo.has(fila.code)) porCodigo.set(fila.code, 'del-archivo');
      }
      const errors: ImportRowError[] = problemas.map((p) => ({ field: p.field, reason: p.reason }));
      return { line: i + 2, status: errors.length === 0 ? ('ok' as const) : ('error' as const), errors };
    });
    const ok = resultados.every((r) => r.status === 'ok');
    if (dryRun || !ok) return { ok, rows: resultados };
    // Alta real: se resuelve el padre por código contra lo ya creado en este mismo lote.
    const creados = new Map<string, EspacioSim>();
    for (const fila of filas) {
      const p = fila.parentCode ? (creados.get(fila.parentCode) ?? espacios.filtrar((x) => x.siteId === sitio.id && x.code === fila.parentCode)[0] ?? null) : null;
      creados.set(fila.code, insertar(sitio.id, fila, p, request));
    }
    return { ok: true, rows: resultados, created: filas.length };
  });

  router.patch('/care-spaces/:id', (request) => {
    const e = espacioPropio(request.params['id']!);
    if (e === undefined) return notFound();
    if (!puedeEscribir(request)) return prohibido();
    const viejo = versionVieja(e.rowVersion, request);
    if (viejo !== null) return viejo;
    const datos = cuerpo<{ name: string; code: string; formCode: string; functionCode: string } & SpaceAttributesInput>(request);
    if (e.status !== 'SPACE_PLANNED' && ((datos.code !== undefined && datos.code !== e.code) || (datos.formCode !== undefined && datos.formCode !== e.form))) {
      return regla('SPACE_IMMUTABLE_FIELD', 'El código y la forma no se pueden cambiar cuando el espacio ya estuvo activo.');
    }
    if (datos.code !== undefined && datos.code !== e.code && espacios.filtrar((x) => x.siteId === e.siteId && x.code === datos.code).length > 0) {
      return conflicto('SPACE_CODE_TAKEN', 'Ese código ya se usó en este establecimiento.');
    }
    const cambios: Partial<EspacioSim> = {
      ...(datos.name === undefined ? {} : { name: datos.name.trim() }),
      ...(datos.code === undefined ? {} : { code: datos.code.trim() }),
      ...(datos.formCode === undefined ? {} : { form: datos.formCode }),
      ...(datos.functionCode === undefined ? {} : { function: datos.functionCode }),
      ...atributos(datos),
      rowVersion: e.rowVersion + 1,
    };
    const diferencias: SpaceHistoryChange[] = (Object.entries(cambios) as [keyof EspacioSim, unknown][])
      .filter(([k, v]) => k !== 'rowVersion' && e[k] !== v)
      .map(([k, v]) => ({ field: String(k), from: e[k] === null ? null : String(e[k]), to: v === null ? null : String(v) }));
    const nuevo = espacios.actualizar(e.id, cambios)!;
    anotar(nuevo, 'updated', request, diferencias);
    return detalle(nuevo);
  });

  router.post('/care-spaces/:id/move', (request) => {
    const e = espacioPropio(request.params['id']!);
    if (e === undefined) return notFound();
    if (!puedeEscribir(request)) return prohibido();
    const viejo = versionVieja(e.rowVersion, request);
    if (viejo !== null) return viejo;
    const destino = cuerpo<{ parentSpaceId: string | null }>(request).parentSpaceId ?? null;
    const padre = destino === null ? null : padreDe(e.siteId, destino);
    if (padre === 'inexistente') return notFound();
    if (padre !== null && (padre.id === e.id || descendientes(e.id).some((d) => d.id === padre.id))) {
      return regla('SPACE_CYCLE', 'Un espacio no puede moverse bajo sí mismo ni bajo uno de sus descendientes.');
    }
    const permitido = CATALOGO.parentRules.some((r) => r.parent === (padre === null ? null : padre.form) && r.child === e.form);
    if (!permitido) return regla('SPACE_PARENT_RULE', 'La forma de este espacio no puede colgar de ese padre.');
    const nuevo = espacios.actualizar(e.id, { parentId: padre?.id ?? null, rowVersion: e.rowVersion + 1 })!;
    anotar(nuevo, 'moved', request, [{ field: 'parentId', from: e.parentId, to: padre?.id ?? null }]);
    return detalle(nuevo);
  });

  router.get('/care-spaces/:id/retire-check', (request) => {
    const e = espacioPropio(request.params['id']!);
    if (e === undefined) return notFound();
    const atraso = atrasoDeLectura();
    return { blockers: bloqueos(e), asOf: new Date(Date.now() - atraso * 60_000).toISOString() };
  });

  router.post('/care-spaces/:id/lifecycle', (request) => {
    const e = espacioPropio(request.params['id']!);
    if (e === undefined) return notFound();
    if (!puedeEscribir(request)) return prohibido();
    const viejo = versionVieja(e.rowVersion, request);
    if (viejo !== null) return viejo;
    const { action, reason } = cuerpo<{ action: string; reason: string }>(request);
    const motivo = (reason ?? '').trim();
    const padre = e.parentId === null ? null : espacios.get(e.parentId);
    const desde = e.status;
    let hacia: string;
    switch (action) {
      case 'activate':
      case 'reactivate':
        if (desde !== (action === 'activate' ? 'SPACE_PLANNED' : 'SPACE_SUSPENDED')) {
          return regla('INVALID_TRANSITION', `No se puede ${action === 'activate' ? 'activar' : 'reactivar'} un espacio ${desde === 'SPACE_ACTIVE' ? 'activo' : 'en este estado'}.`);
        }
        if (padre !== null && padre !== undefined && padre.status !== 'SPACE_ACTIVE') {
          return regla('PARENT_NOT_ACTIVE', `El padre «${padre.name}» no está activo: actívelo o reactívelo primero.`, { parentId: padre.id });
        }
        hacia = 'SPACE_ACTIVE';
        break;
      case 'suspend':
        if (desde !== 'SPACE_ACTIVE') return regla('INVALID_TRANSITION', 'Sólo se suspende un espacio activo.');
        if (motivo === '') return regla('REASON_REQUIRED', 'Suspender exige un motivo.', { field: 'reason' });
        hacia = 'SPACE_SUSPENDED';
        break;
      case 'retire': {
        if (desde === 'SPACE_RETIRED') return regla('INVALID_TRANSITION', 'El espacio ya está clausurado.');
        if (motivo === '') return regla('REASON_REQUIRED', 'Clausurar exige un motivo.', { field: 'reason' });
        const lista = bloqueos(e);
        if (lista.length > 0) {
          return conflicto('SPACE_RETIRE_BLOCKED', 'No se puede clausurar: hay dependencias activas.', { blockers: lista });
        }
        hacia = 'SPACE_RETIRED';
        break;
      }
      default:
        return regla('INVALID_ACTION', 'Acción de ciclo de vida desconocida.');
    }
    const nuevo = espacios.actualizar(e.id, {
      status: hacia,
      operational: hacia === 'SPACE_ACTIVE' ? 'SPACE_OP_AVAILABLE' : null,
      validTo: hacia === 'SPACE_RETIRED' ? ahora() : null,
      rowVersion: e.rowVersion + 1,
    })!;
    anotar(nuevo, 'lifecycle_changed', request, [{ field: 'status', from: desde, to: hacia }], motivo === '' ? null : motivo);
    return detalle(nuevo);
  });

  router.post('/care-spaces/:id/unit-assignments', (request) => {
    const e = espacioPropio(request.params['id']!);
    if (e === undefined) return notFound();
    if (!puedeEscribir(request)) return prohibido();
    const { clinicalUnitId, roleCode } = cuerpo<{ clinicalUnitId: string; roleCode: string }>(request);
    const unidad = UNIDADES_SEMILLA.find((u) => u.id === clinicalUnitId && u.siteId === e.siteId);
    if (unidad === undefined) return notFound();
    const vigentes = vinculos.filtrar((v) => v.careSpaceId === e.id && v.validTo === null);
    if (vigentes.some((v) => v.clinicalUnitId === clinicalUnitId)) {
      return conflicto('ASSIGNMENT_EXISTS', 'Esa unidad ya está vinculada a este espacio.');
    }
    if (roleCode === 'SPACE_UNIT_ROLE_OWNER' && vigentes.some((v) => v.roleCode === roleCode)) {
      return conflicto('OWNER_EXISTS', 'Ya hay una unidad propietaria vigente: cierre ese vínculo primero.');
    }
    const nuevo: VinculoSim = { id: nuevoId('infra-vinculo'), careSpaceId: e.id, clinicalUnitId: clinicalUnitId!, roleCode: roleCode!, validFrom: ahora(), validTo: null };
    vinculos.agregar(nuevo);
    anotar(e, 'updated', request, [{ field: 'unitAssignment', from: null, to: `${unidad.code} (${roleCode})` }]);
    return reply(201, asignacion(nuevo));
  });

  router.delete('/care-spaces/:id/unit-assignments/:assignmentId', (request) => {
    const e = espacioPropio(request.params['id']!);
    if (e === undefined) return notFound();
    if (!puedeEscribir(request)) return prohibido();
    const v = vinculos.get(request.params['assignmentId']!);
    if (v === undefined || v.careSpaceId !== e.id) return notFound();
    // Se cierra la vigencia; la fila no se borra (INV-14).
    vinculos.actualizar(v.id, { validTo: ahora() });
    anotar(e, 'updated', request, [{ field: 'unitAssignment', from: v.clinicalUnitId, to: null }]);
    return noContent();
  });

  /* ---- regulatorio, habilitaciones, capacidad ---- */

  router.patch('/sites/:siteId/regulatory', (request) => {
    const sitio = sitioPropio(request.params['siteId']!);
    if (sitio === undefined) return notFound();
    if (!puedeEscribir(request)) return prohibido();
    const actual = regulatorios.get(sitio.id);
    if (actual === undefined) return notFound();
    const viejo = versionVieja(actual.rowVersion, request);
    if (viejo !== null) return viejo;
    const d = cuerpo<Record<string, string>>(request);
    if (d['snisCode'] !== undefined && d['snisCode'] !== actual.snisCode) {
      const ocupado = regulatorios.filtrar((r) => r.id !== sitio.id && r.snisVerified && r.snisCode === d['snisCode']);
      // Genérico a propósito: no dice de quién es ni si existe (Desvíos del modelo).
      if (ocupado.length > 0) return conflicto('SNIS_CODE_UNAVAILABLE', 'Ese código no está disponible.');
    }
    const nuevaTipologia = d['typologyCode'];
    if (nuevaTipologia !== undefined && nuevaTipologia !== actual.typology) {
      const admitidas = funcionesPermitidas(nuevaTipologia);
      const tipologia = concepto(CATALOGO.regulatory.typology, nuevaTipologia)!;
      const conflictos: TypologyConflict[] =
        admitidas === null
          ? []
          : espacios
              .filtrar((x) => x.siteId === sitio.id && vigente(x) && !admitidas.has(x.function))
              .map((x) => ({
                spaceId: x.id,
                code: x.code,
                name: x.name,
                functionCode: x.function,
                rule: `${tipologia.display} no admite «${CATALOGO.functions.find((f) => f.code === x.function)?.display ?? x.function}».`,
              }));
      if (conflictos.length > 0) {
        return conflicto('TYPOLOGY_CONFLICT', `${conflictos.length} espacio(s) incumplen la tipología elegida.`, { conflicts: conflictos });
      }
    }
    regulatorios.actualizar(sitio.id, {
      ...(d['snisCode'] === undefined ? {} : { snisCode: d['snisCode'] === '' ? null : d['snisCode'], snisVerified: d['snisCode'] === actual.snisCode ? actual.snisVerified : false }),
      ...(d['subsectorCode'] === undefined ? {} : { subsector: d['subsectorCode'] }),
      ...(d['careLevelCode'] === undefined ? {} : { careLevel: d['careLevelCode'] }),
      ...(d['typologyCode'] === undefined ? {} : { typology: d['typologyCode'] }),
      ...(d['managingEntityName'] === undefined ? {} : { managingEntityName: d['managingEntityName'] || null }),
      ...(d['healthNetworkName'] === undefined ? {} : { healthNetworkName: d['healthNetworkName'] || null }),
      ...(d['sedesCode'] === undefined ? {} : { sedes: d['sedesCode'] }),
      ...(d['municipalityName'] === undefined ? {} : { municipalityName: d['municipalityName'] || null }),
      rowVersion: actual.rowVersion + 1,
    });
    return resumen(sitio.id, request);
  });

  router.get('/sites/:siteId/licenses', (request) => {
    const sitio = sitioPropio(request.params['siteId']!);
    if (sitio === undefined) return notFound();
    return habilitaciones.filtrar((h) => h.siteId === sitio.id).map(licencia);
  });

  router.post('/sites/:siteId/licenses', (request) => {
    const sitio = sitioPropio(request.params['siteId']!);
    if (sitio === undefined) return notFound();
    if (!puedeEscribir(request)) return prohibido();
    const d = cuerpo<Record<string, string>>(request);
    if ((d['authorityName'] ?? '').trim() === '') return regla('VALIDATION', 'La autoridad es obligatoria.', { field: 'authorityName' });
    if (d['issuedOn'] && d['expiresOn'] && d['expiresOn'] < d['issuedOn']) {
      return regla('VALIDATION', 'El vencimiento no puede ser anterior a la emisión.', { field: 'expiresOn' });
    }
    const nueva = habilitaciones.agregar({
      id: nuevoId('infra-lic'),
      siteId: sitio.id,
      authorityName: d['authorityName']!.trim(),
      resolutionNumber: d['resolutionNumber'] || null,
      issuedOn: d['issuedOn'] || null,
      expiresOn: d['expiresOn'] || null,
      statusCode: d['statusCode'] || 'LIC_IN_PROCESS',
      clinicalUnitId: d['clinicalUnitId'] || null,
      notes: d['notes'] || null,
      rowVersion: 1,
    });
    return reply(201, licencia(nueva));
  });

  router.patch('/site-licenses/:id', (request) => {
    const h = habilitaciones.get(request.params['id']!);
    if (h === undefined || sitioPropio(h.siteId) === undefined) return notFound();
    if (!puedeEscribir(request)) return prohibido();
    const viejo = versionVieja(h.rowVersion, request);
    if (viejo !== null) return viejo;
    const d = cuerpo<Record<string, string>>(request);
    const nueva = habilitaciones.actualizar(h.id, {
      ...(d['authorityName'] === undefined ? {} : { authorityName: d['authorityName'] }),
      ...(d['resolutionNumber'] === undefined ? {} : { resolutionNumber: d['resolutionNumber'] || null }),
      ...(d['issuedOn'] === undefined ? {} : { issuedOn: d['issuedOn'] || null }),
      ...(d['expiresOn'] === undefined ? {} : { expiresOn: d['expiresOn'] || null }),
      ...(d['statusCode'] === undefined ? {} : { statusCode: d['statusCode'] }),
      ...(d['notes'] === undefined ? {} : { notes: d['notes'] || null }),
      rowVersion: h.rowVersion + 1,
    })!;
    return licencia(nueva);
  });

  router.get('/sites/:siteId/capacity', (request) => {
    const sitio = sitioPropio(request.params['siteId']!);
    if (sitio === undefined) return notFound();
    const derivada = capacidadDerivada(sitio.id);
    const ultimas = new Map<string, (typeof CAPACIDADES_SEMILLA)[number]>();
    for (const x of capacidades.filtrar((k) => k.siteId === sitio.id).sort((a, b) => (a.asOf < b.asOf ? -1 : 1))) {
      ultimas.set(x.kindCode, x);
    }
    const gaps: CapacityGap[] = [...ultimas.values()]
      .map((d) => ({ kindCode: d.kindCode, declared: d.quantity, derived: derivada.find((x) => x.kindCode === d.kindCode)?.quantity ?? 0 }))
      .filter((g) => g.declared !== g.derived);
    const atraso = atrasoDeLectura();
    return {
      declared: [...ultimas.values()].map((d) => ({ kindCode: d.kindCode, quantity: d.quantity, asOf: d.asOf, resolutionNumber: d.resolutionNumber })),
      derived: derivada,
      gaps,
      asOf: new Date(Date.now() - atraso * 60_000).toISOString(),
    };
  });

  router.post('/sites/:siteId/declared-capacities', (request) => {
    const sitio = sitioPropio(request.params['siteId']!);
    if (sitio === undefined) return notFound();
    if (!puedeEscribir(request)) return prohibido();
    const d = cuerpo<{ capacityKindCode: string; quantity: number; asOf: string; resolutionNumber: string }>(request);
    if (!CATALOGO.regulatory.capacityKind.some((k) => k.code === d.capacityKindCode)) {
      return regla('VALIDATION', 'El tipo de capacidad no existe.', { field: 'capacityKindCode' });
    }
    if (typeof d.quantity !== 'number' || d.quantity < 0) return regla('VALIDATION', 'La cantidad debe ser un número mayor o igual a cero.', { field: 'quantity' });
    capacidades.agregar({
      id: nuevoId('infra-cap'),
      siteId: sitio.id,
      kindCode: d.capacityKindCode!,
      quantity: d.quantity,
      asOf: d.asOf || isoDia(0),
      resolutionNumber: d.resolutionNumber || null,
    });
    return reply(201, {});
  });
}
