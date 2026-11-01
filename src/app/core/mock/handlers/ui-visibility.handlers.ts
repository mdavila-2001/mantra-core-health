import type {
  UiElement,
  UiElementDraft,
  UiElementKind,
  UiElementSyncResult,
  UiPreview,
  UiRuleEffect,
  UiRuleSubjectType,
  UiVisibilityRule,
} from '../../data-access/ui-visibility/ui-visibility.types';
import {
  MockRouter,
  reply,
  unauthorized,
  type MockReply,
} from '../mock-router';
import {
  IDS,
  TENANT_ASEGURADORA,
  TENANT_FARMACIA,
  TENANT_NAMES,
  TENANT_TYPES,
  usuarioPorId,
  type MockUser,
} from '../mock-session';
import { Coleccion, nuevoId, paginar } from '../mock-store';
import {
  ELEMENTOS_DE_FABRICA,
  idElemento,
  REGLAS_DE_FABRICA,
  type FilaElemento,
} from '../fixtures/ui-visibility';
import { reglaVigente, resolverVisibilidad, type SujetoDeResolucion } from './ui-visibility.resolver';
import {
  type CampoRechazado,
  claveDesconocida,
  cuerpoObjeto,
  esRespuesta,
  exigirAdmin,
  fallo,
  invalido,
  limiteDe,
  normal,
} from './ui-visibility.replies';

/* ============================================================================
    Backend simulado de la visibilidad de la interfaz
    (docs/trabajo/2026-10-31-visibilidad-rbac/CONTRATO.md).

    **SIMULADO · DATOS SINTÉTICOS.** El catálogo y las reglas de arranque son
    inventados: cada etiqueta lleva «(SIMULADO)» y ninguna clave sale del código
    real. Sirve todo el contrato —admin y `GET /me/ui-visibility`— con estado en
    memoria (sobrevive al F5 de la pestaña, como `Coleccion`).

    **Lo que cumple, igual que la API:**
    - el rol `SECURITY_ADMIN` (o `SUPERADMIN`) para `/admin/ui-visibility/*`; el resto 403;
    - una regla sólo existe sobre un elemento del catálogo (404 `UI_ELEMENT_NOT_FOUND`)
      y activo (409 `UI_ELEMENT_RETIRED`);
    - misma terna elemento+sujeto vigente: 409 `UI_RULE_DUPLICATE`;
    - sujeto incoherente (ALL con id, USER sin id, id con mala forma): 422 `UI_RULE_INVALID_SUBJECT`;
    - `PATCH` exige `If-Match` y una versión distinta es 409 `UI_RULE_VERSION_MISMATCH`;
    - las reglas no se borran: se terminan (`validTo = ahora`);
    - el sync es idempotente por `key` y retira (`RETIRED`) lo `CODE` que ya no llega.

    **El resolutor** ({@link resolverVisibilidad}) es el del contrato: especificidad
    USER > TENANT > ROLE > ORG_TYPE > ALL, HIDE gana el empate, sin regla manda
    `defaultVisible` y oculto un ancestro, oculto el descendiente (cascada).

    Los códigos estables viajan en `reason` (y `details.reason`) con el `code`
    genérico de la API (`CONFLICT`, `NOT_FOUND`…), que es lo que `readApiError` sabe leer.
    ========================================================================== */

const MAX_ELEMENTOS_SYNC = 2000;

const KINDS: readonly UiElementKind[] = [
  'MODULE',
  'MENU_SECTION',
  'SCREEN',
  'SECTION',
  'WIDGET',
  'FIELD',
  'ACTION',
];
const EFFECTS: readonly UiRuleEffect[] = ['SHOW', 'HIDE'];
const SUBJECT_TYPES: readonly UiRuleSubjectType[] = ['USER', 'TENANT', 'ROLE', 'ORG_TYPE', 'ALL'];

const RE_KEY = /^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)*$/;
const RE_MODULO = /^[a-z][a-z0-9-]{1,39}$/;
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RE_CODIGO = /^[A-Z][A-Z0-9_]{1,63}$/;


const elementos = new Coleccion<FilaElemento>(ELEMENTOS_DE_FABRICA, 'mock-ui-visibility-elements');
const reglas = new Coleccion<UiVisibilityRule>(REGLAS_DE_FABRICA, 'mock-ui-visibility-rules');

/** Para las pruebas: vuelve al catálogo y las reglas de fábrica. */
export function reiniciarVisibilidad(): void {
  elementos.reiniciar();
  reglas.reiniciar();
}

/* ---- elementos ------------------------------------------------------------- */

function conConteo(f: FilaElemento, ahora: Date): UiElement {
  const { createdAt: _createdAt, ...elemento } = f;
  return {
    ...elemento,
    activeRuleCount: reglas.todos().filter((r) => r.elementKey === f.key && reglaVigente(r, ahora)).length,
  };
}

const todosLosElementos = (): UiElement[] => {
  const ahora = new Date();
  return elementos.todos().map((f) => conConteo(f, ahora));
};

/** Valida un borrador como lo hace el DTO; devuelve los campos rechazados. */
function validarBorrador(d: Record<string, unknown>): CampoRechazado[] {
  const malos: CampoRechazado[] = [];
  const key = d['key'];
  const modulo = d['moduleCode'];
  if (typeof key !== 'string' || !RE_KEY.test(key) || key.length > 120) {
    malos.push({ field: 'key', messages: ['La clave va en minúsculas con puntos: modulo.pantalla.elemento.'] });
  }
  if (typeof modulo !== 'string' || !RE_MODULO.test(modulo)) {
    malos.push({ field: 'moduleCode', messages: ['El módulo va en minúsculas (2 a 40 caracteres).'] });
  } else if (typeof key === 'string' && key !== modulo && !key.startsWith(`${modulo}.`)) {
    malos.push({ field: 'key', messages: ['La clave debe empezar por el código del módulo.'] });
  }
  if (!KINDS.includes(d['kind'] as UiElementKind)) {
    malos.push({ field: 'kind', messages: ['El tipo no es uno de los permitidos.'] });
  }
  const etiqueta = d['label'];
  if (typeof etiqueta !== 'string' || etiqueta.trim().length === 0 || etiqueta.length > 120) {
    malos.push({ field: 'label', messages: ['El nombre es obligatorio (hasta 120 caracteres).'] });
  }
  const descripcion = d['description'];
  if (descripcion !== null && descripcion !== undefined && (typeof descripcion !== 'string' || descripcion.length > 300)) {
    malos.push({ field: 'description', messages: ['La descripción admite hasta 300 caracteres.'] });
  }
  const padre = d['parentKey'];
  if (padre !== null && padre !== undefined && typeof padre !== 'string') {
    malos.push({ field: 'parentKey', messages: ['El padre debe ser una clave.'] });
  }
  if (typeof d['defaultVisible'] !== 'boolean') {
    malos.push({ field: 'defaultVisible', messages: ['Indique si se muestra por omisión.'] });
  }
  return malos;
}

const CLAVES_BORRADOR = ['key', 'kind', 'moduleCode', 'parentKey', 'label', 'description', 'defaultVisible'];

const comoBorrador = (d: Record<string, unknown>): UiElementDraft => ({
  key: d['key'] as string,
  kind: d['kind'] as UiElementKind,
  moduleCode: d['moduleCode'] as string,
  parentKey: (d['parentKey'] as string | null | undefined) ?? null,
  label: (d['label'] as string).trim(),
  description: (d['description'] as string | null | undefined) ?? null,
  defaultVisible: d['defaultVisible'] as boolean,
});

function sincronizar(borradores: readonly UiElementDraft[]): UiElementSyncResult {
  const llegan = new Set(borradores.map((b) => b.key));
  let created = 0;
  let updated = 0;
  let unchanged = 0;
  let retired = 0;
  for (const b of borradores) {
    const actual = elementos.todos().find((e) => e.key === b.key);
    if (actual === undefined) {
      elementos.agregar({
        ...b,
        id: idElemento(b.key),
        source: 'CODE',
        status: 'ACTIVE',
        activeRuleCount: 0,
        createdAt: new Date().toISOString(),
      });
      created += 1;
    } else if (actual.source === 'ADMIN') {
      unchanged += 1; // lo creó una persona: el código no lo pisa
    } else {
      const igual =
        actual.status === 'ACTIVE' &&
        actual.kind === b.kind &&
        actual.moduleCode === b.moduleCode &&
        actual.parentKey === b.parentKey &&
        actual.label === b.label &&
        actual.description === b.description &&
        actual.defaultVisible === b.defaultVisible;
      if (igual) unchanged += 1;
      else {
        elementos.actualizar(actual.id, { ...b, status: 'ACTIVE' });
        updated += 1;
      }
    }
  }
  for (const e of elementos.todos()) {
    if (e.source === 'CODE' && e.status === 'ACTIVE' && !llegan.has(e.key)) {
      elementos.actualizar(e.id, { status: 'RETIRED' });
      retired += 1;
    }
  }
  return { created, updated, retired, unchanged };
}

/* ---- reglas ---------------------------------------------------------------- */

function etiquetaDeSujeto(tipo: UiRuleSubjectType, id: string | null): string | null {
  if (tipo === 'ALL') return 'Todos';
  if (id === null) return null;
  if (tipo === 'USER') return usuarioPorId(id)?.displayName ?? null;
  if (tipo === 'TENANT') return TENANT_NAMES[id] ?? null;
  return id;
}

const conEtiqueta = (r: UiVisibilityRule): UiVisibilityRule => ({
  ...r,
  subjectLabel: r.subjectLabel ?? etiquetaDeSujeto(r.subjectType, r.subjectId),
});

function sujetoInvalido(tipo: UiRuleSubjectType, id: unknown): MockReply | null {
  const campo: CampoRechazado[] = [];
  if (tipo === 'ALL') {
    if (id !== null && id !== undefined) campo.push({ field: 'subjectId', messages: ['«Todos» no lleva identificador.'] });
  } else if (typeof id !== 'string' || id === '') {
    campo.push({ field: 'subjectId', messages: ['Indique a quién se aplica.'] });
  } else if ((tipo === 'USER' || tipo === 'TENANT') && !RE_UUID.test(id)) {
    campo.push({ field: 'subjectId', messages: ['Debe ser un identificador válido (uuid).'] });
  } else if ((tipo === 'ROLE' || tipo === 'ORG_TYPE') && !RE_CODIGO.test(id)) {
    campo.push({ field: 'subjectId', messages: ['Debe ser un código en mayúsculas, p. ej. PHARMACY_STAFF.'] });
  }
  return campo.length === 0
    ? null
    : fallo(422, 'PRECONDITION_FAILED', 'UI_RULE_INVALID_SUBJECT', 'El sujeto de la regla no es válido.', campo);
}

function fechasInvalidas(b: Record<string, unknown>, desdeActual: string | null): MockReply | null {
  const campos: CampoRechazado[] = [];
  const valor = (k: 'validFrom' | 'validTo'): string | null | 'MAL' => {
    const v = b[k];
    if (v === undefined) return k === 'validFrom' ? desdeActual : null;
    if (v === null) return null;
    return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : 'MAL';
  };
  const desde = valor('validFrom');
  const hasta = b['validTo'] === undefined ? null : valor('validTo');
  if (desde === 'MAL') campos.push({ field: 'validFrom', messages: ['La fecha de inicio no es válida.'] });
  if (hasta === 'MAL') campos.push({ field: 'validTo', messages: ['La fecha de fin no es válida.'] });
  if (desde !== 'MAL' && hasta !== 'MAL' && desde !== null && hasta !== null && Date.parse(hasta) <= Date.parse(desde)) {
    campos.push({ field: 'validTo', messages: ['El fin debe ser posterior al inicio.'] });
  }
  return campos.length === 0 ? null : fallo(400, 'VALIDATION_FAILED', null, 'Error de validación', campos);
}

function motivoInvalido(motivo: unknown): MockReply | null {
  if (typeof motivo !== 'string' || motivo.trim().length < 10 || motivo.trim().length > 500) {
    return invalido('reason', 'El motivo es obligatorio: de 10 a 500 caracteres.');
  }
  return null;
}

/** Una terminada (`validTo` ya pasó) no ocupa su terna: se puede volver a reglar. */
const ocupaLaTerna = (r: UiVisibilityRule, ahora: Date): boolean =>
  r.validTo === null || new Date(r.validTo).getTime() > ahora.getTime();

/* ---- quién es el sujeto ---------------------------------------------------- */

function sujetoDeUsuario(u: MockUser): SujetoDeResolucion {
  const alcance = Object.values(u.scopedRoles ?? {}).flat();
  return {
    userId: u.id,
    tenantIds: u.tenants,
    roleCodes: [...new Set([...u.roles, ...alcance])],
    orgTypes: [...new Set(u.tenants.map((t) => TENANT_TYPES[t]).filter((t): t is NonNullable<typeof t> => t !== undefined))],
  };
}

function versionDe(ocultos: readonly string[]): string {
  let h = 5381;
  for (const c of ocultos.join('|')) h = (Math.imul(h, 33) ^ c.charCodeAt(0)) >>> 0;
  return `v${h.toString(16).padStart(8, '0')}`;
}

/* ---- el registro ----------------------------------------------------------- */

export function registrarVisibilidad(router: MockRouter): void {
  router.get('/admin/ui-visibility/elements', (req) => {
    const denegado = exigirAdmin(req);
    if (denegado) return denegado;
    const limit = limiteDe(req.query);
    if (typeof limit !== 'number') return limit;
    const kind = req.query.get('kind');
    if (kind !== null && kind !== '' && !KINDS.includes(kind as UiElementKind)) return invalido('kind', 'Tipo desconocido.');
    const status = req.query.get('status');
    if (status !== null && status !== '' && status !== 'ACTIVE' && status !== 'RETIRED') return invalido('status', 'Estado desconocido.');
    const modulo = req.query.get('module') ?? '';
    const q = normal(req.query.get('q') ?? '').trim();
    const filtrados = todosLosElementos()
      .filter(
        (e) =>
          (modulo === '' || e.moduleCode === modulo) &&
          (kind === null || kind === '' || e.kind === kind) &&
          (status === null || status === '' || e.status === status) &&
          (q === '' || normal(`${e.key} ${e.label}`).includes(q)),
      )
      .sort((a, b) => (a.moduleCode === b.moduleCode ? a.key.localeCompare(b.key) : a.moduleCode.localeCompare(b.moduleCode)));
    const pagina = paginar(filtrados, req.query, limit);
    return { items: pagina.items, nextCursor: pagina.nextCursor, total: pagina.count };
  });

  router.post('/admin/ui-visibility/elements', (req) => {
    const denegado = exigirAdmin(req);
    if (denegado) return denegado;
    const b = cuerpoObjeto(req);
    if (esRespuesta(b)) return b;
    const extra = claveDesconocida(b, CLAVES_BORRADOR);
    if (extra) return extra;
    const malos = validarBorrador(b);
    if (malos.length > 0) return fallo(400, 'VALIDATION_FAILED', null, 'Error de validación', malos);
    const borrador = comoBorrador(b);
    if (elementos.todos().some((e) => e.key === borrador.key)) {
      return fallo(409, 'CONFLICT', null, 'Ya existe un elemento con esa clave.', [
        { field: 'key', messages: ['Ya existe un elemento con esa clave.'] },
      ]);
    }
    if (borrador.parentKey !== null) {
      const padre = elementos.todos().find((e) => e.key === borrador.parentKey);
      if (padre === undefined) {
        return fallo(422, 'PRECONDITION_FAILED', 'UI_ELEMENT_NOT_FOUND', 'El elemento padre no está en el catálogo.', [
          { field: 'parentKey', messages: ['El elemento padre no está en el catálogo.'] },
        ]);
      }
      if (padre.status === 'RETIRED') {
        return fallo(409, 'CONFLICT', 'UI_ELEMENT_RETIRED', 'El elemento padre está retirado del código.', [
          { field: 'parentKey', messages: ['El elemento padre está retirado.'] },
        ]);
      }
    }
    const fila: FilaElemento = {
      ...borrador,
      id: idElemento(borrador.key),
      source: 'ADMIN',
      status: 'ACTIVE',
      activeRuleCount: 0,
      createdAt: new Date().toISOString(),
    };
    elementos.agregar(fila);
    return reply(201, conConteo(fila, new Date()));
  });

  router.post('/admin/ui-visibility/elements/sync', (req) => {
    const denegado = exigirAdmin(req);
    if (denegado) return denegado;
    const b = cuerpoObjeto(req);
    if (esRespuesta(b)) return b;
    const extra = claveDesconocida(b, ['elements']);
    if (extra) return extra;
    const lista = b['elements'];
    if (!Array.isArray(lista) || lista.length > MAX_ELEMENTOS_SYNC) {
      return invalido('elements', `Se espera una lista de hasta ${MAX_ELEMENTOS_SYNC} elementos.`);
    }
    const malos: CampoRechazado[] = [];
    const vistas = new Set<string>();
    lista.forEach((raw, i) => {
      if (typeof raw !== 'object' || raw === null) {
        malos.push({ field: `elements.${i}`, messages: ['Cada elemento debe ser un objeto.'] });
        return;
      }
      const d = raw as Record<string, unknown>;
      for (const m of validarBorrador(d)) malos.push({ field: `elements.${i}.${m.field}`, messages: m.messages });
      if (typeof d['key'] === 'string') {
        if (vistas.has(d['key'])) malos.push({ field: `elements.${i}.key`, messages: ['La clave está repetida en el envío.'] });
        vistas.add(d['key']);
      }
    });
    if (malos.length > 0) return fallo(400, 'VALIDATION_FAILED', null, 'Error de validación', malos);
    return sincronizar((lista as Record<string, unknown>[]).map(comoBorrador));
  });

  router.get('/admin/ui-visibility/rules', (req) => {
    const denegado = exigirAdmin(req);
    if (denegado) return denegado;
    const limit = limiteDe(req.query);
    if (typeof limit !== 'number') return limit;
    const tipo = req.query.get('subjectType');
    if (tipo !== null && tipo !== '' && !SUBJECT_TYPES.includes(tipo as UiRuleSubjectType)) return invalido('subjectType', 'Tipo de sujeto desconocido.');
    const activa = req.query.get('active');
    if (activa !== null && activa !== '' && activa !== 'true' && activa !== 'false') return invalido('active', 'active es true o false.');
    const clave = req.query.get('elementKey') ?? '';
    const sujeto = req.query.get('subjectId') ?? '';
    const ahora = new Date();
    const filtradas = reglas
      .todos()
      .filter(
        (r) =>
          (clave === '' || r.elementKey === clave) &&
          (tipo === null || tipo === '' || r.subjectType === tipo) &&
          (sujeto === '' || r.subjectId === sujeto) &&
          (activa === null || activa === '' || ocupaLaTerna(r, ahora) === (activa === 'true')),
      )
      .sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : b.createdAt.localeCompare(a.createdAt)))
      .map(conEtiqueta);
    const pagina = paginar(filtradas, req.query, limit);
    return { items: pagina.items, nextCursor: pagina.nextCursor, total: pagina.count };
  });

  router.post('/admin/ui-visibility/rules', (req) => {
    const denegado = exigirAdmin(req);
    if (denegado) return denegado;
    const b = cuerpoObjeto(req);
    if (esRespuesta(b)) return b;
    const extra = claveDesconocida(b, ['elementKey', 'effect', 'subjectType', 'subjectId', 'validFrom', 'validTo', 'reason']);
    if (extra) return extra;
    if (!EFFECTS.includes(b['effect'] as UiRuleEffect)) return invalido('effect', 'El efecto es SHOW o HIDE.');
    if (!SUBJECT_TYPES.includes(b['subjectType'] as UiRuleSubjectType)) return invalido('subjectType', 'Tipo de sujeto desconocido.');
    const mal = motivoInvalido(b['reason']) ?? fechasInvalidas(b, null);
    if (mal) return mal;
    const tipo = b['subjectType'] as UiRuleSubjectType;
    const sujetoMal = sujetoInvalido(tipo, b['subjectId']);
    if (sujetoMal) return sujetoMal;
    const elemento = elementos.todos().find((e) => e.key === b['elementKey']);
    if (elemento === undefined) {
      return fallo(404, 'NOT_FOUND', 'UI_ELEMENT_NOT_FOUND', 'El elemento no está en el catálogo.', [
        { field: 'elementKey', messages: ['El elemento no está en el catálogo.'] },
      ]);
    }
    if (elemento.status === 'RETIRED') {
      return fallo(409, 'CONFLICT', 'UI_ELEMENT_RETIRED', 'El elemento está retirado del código: no admite reglas nuevas.', [
        { field: 'elementKey', messages: ['El elemento está retirado.'] },
      ]);
    }
    const subjectId = tipo === 'ALL' ? null : (b['subjectId'] as string);
    const ahora = new Date();
    const repetida = reglas
      .todos()
      .some((r) => r.elementKey === elemento.key && r.subjectType === tipo && r.subjectId === subjectId && ocupaLaTerna(r, ahora));
    if (repetida) {
      return fallo(409, 'CONFLICT', 'UI_RULE_DUPLICATE', 'Ya hay una regla vigente para ese elemento y ese sujeto.');
    }
    const nueva: UiVisibilityRule = conEtiqueta({
      id: nuevoId('ui-rule'),
      elementKey: elemento.key,
      effect: b['effect'] as UiRuleEffect,
      subjectType: tipo,
      subjectId,
      subjectLabel: null,
      validFrom: (b['validFrom'] as string | null | undefined) ?? null,
      validTo: (b['validTo'] as string | null | undefined) ?? null,
      reason: (b['reason'] as string).trim(),
      version: 1,
      createdAt: ahora.toISOString(),
      createdByLabel: req.user?.displayName ?? null,
    });
    reglas.agregar(nueva);
    return reply(201, nueva);
  });

  router.patch('/admin/ui-visibility/rules/:id', (req) => {
    const denegado = exigirAdmin(req);
    if (denegado) return denegado;
    const actual = reglas.get(req.params['id'] ?? '');
    if (actual === undefined) return fallo(404, 'NOT_FOUND', null, 'La regla no existe.');
    const enviada = req.headers.get('If-Match');
    if (enviada === null) {
      return fallo(428, 'PRECONDITION_FAILED', 'IF_MATCH_REQUIRED', 'Falta la cabecera If-Match con la versión de la regla.');
    }
    if (Number(enviada) !== actual.version) {
      return fallo(409, 'CONFLICT', 'UI_RULE_VERSION_MISMATCH', 'La regla cambió mientras la editaba.', [], {
        currentVersion: actual.version,
      });
    }
    const b = cuerpoObjeto(req);
    if (esRespuesta(b)) return b;
    const extra = claveDesconocida(b, ['effect', 'validFrom', 'validTo', 'reason']);
    if (extra) return extra;
    if (Object.keys(b).length === 0) return invalido('body', 'No hay nada que cambiar.');
    if (b['effect'] !== undefined && !EFFECTS.includes(b['effect'] as UiRuleEffect)) return invalido('effect', 'El efecto es SHOW o HIDE.');
    const mal = (b['reason'] === undefined ? null : motivoInvalido(b['reason'])) ?? fechasInvalidas(b, actual.validFrom);
    if (mal) return mal;
    if (!ocupaLaTerna(actual, new Date())) {
      return fallo(409, 'CONFLICT', 'UI_RULE_ENDED', 'La regla ya terminó: cree una nueva en lugar de editarla.');
    }
    const cambios: Partial<UiVisibilityRule> = {
      ...(b['effect'] === undefined ? {} : { effect: b['effect'] as UiRuleEffect }),
      ...(b['validFrom'] === undefined ? {} : { validFrom: b['validFrom'] as string | null }),
      ...(b['validTo'] === undefined ? {} : { validTo: b['validTo'] as string | null }),
      ...(b['reason'] === undefined ? {} : { reason: (b['reason'] as string).trim() }),
      version: actual.version + 1,
    };
    return conEtiqueta(reglas.actualizar(actual.id, cambios)!);
  });

  router.post('/admin/ui-visibility/rules/:id/end', (req) => {
    const denegado = exigirAdmin(req);
    if (denegado) return denegado;
    const actual = reglas.get(req.params['id'] ?? '');
    if (actual === undefined) return fallo(404, 'NOT_FOUND', null, 'La regla no existe.');
    const ahora = new Date();
    if (!ocupaLaTerna(actual, ahora)) return conEtiqueta(actual); // terminar dos veces es lo mismo que una
    // Una programada que aún no empezó termina «antes de empezar»: nunca llega a regir.
    const fin = actual.validFrom !== null && new Date(actual.validFrom) > ahora ? actual.validFrom : ahora.toISOString();
    return conEtiqueta(reglas.actualizar(actual.id, { validTo: fin, version: actual.version + 1 })!);
  });

  router.get('/admin/ui-visibility/preview', (req) => {
    const denegado = exigirAdmin(req);
    if (denegado) return denegado;
    const userId = req.query.get('userId') ?? '';
    const roleCode = req.query.get('roleCode') ?? '';
    if ((userId === '') === (roleCode === '')) return invalido('userId', 'Indique userId o roleCode, uno solo.');
    let sujeto: SujetoDeResolucion;
    let cabecera: UiPreview['subject'];
    if (userId !== '') {
      const persona = usuarioPorId(userId);
      if (persona === undefined) return fallo(404, 'NOT_FOUND', null, 'No se encontró a la persona.');
      sujeto = sujetoDeUsuario(persona);
      cabecera = { type: 'USER', id: persona.id, label: persona.displayName };
    } else {
      if (!RE_CODIGO.test(roleCode)) return invalido('roleCode', 'Debe ser un código en mayúsculas, p. ej. PHARMACY_STAFF.');
      sujeto = { userId: null, tenantIds: [], roleCodes: [roleCode], orgTypes: [] };
      cabecera = { type: 'ROLE', id: roleCode, label: roleCode };
    }
    const entradas = resolverVisibilidad(todosLosElementos(), reglas.todos(), sujeto, new Date()).filter(
      (e) => e.hidden || e.winningRuleId !== null,
    );
    const preview: UiPreview = { subject: cabecera, entries: entradas };
    return preview;
  });

  router.get('/me/ui-visibility', (req) => {
    if (req.user === null) return unauthorized();
    const ocultos = resolverVisibilidad(todosLosElementos(), reglas.todos(), sujetoDeUsuario(req.user), new Date())
      .filter((e) => e.hidden)
      .map((e) => e.elementKey)
      .sort();
    return { hiddenKeys: ocultos, version: versionDe(ocultos), generatedAt: new Date().toISOString() };
  });
}

/** Sólo para las pruebas y para quien quiera apuntar a la farmacia / la aseguradora de la semilla. */
export const SUJETOS_DE_LA_SEMILLA = {
  farmaciaUserId: IDS.farmacia.userId,
  farmaciaTenantId: TENANT_FARMACIA,
  aseguradoraTenantId: TENANT_ASEGURADORA,
} as const;
