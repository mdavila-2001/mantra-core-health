import type {
  AdminCatalogPage,
  AdminGlossaryTerm,
  AdminServiceItem,
  GlossaryAudience,
  ServiceScopes,
} from '../../data-access/admin-portal/catalog-editor.types';
import {
  forbidden,
  isMockReply,
  notFound,
  precondition,
  reply,
  unauthorized,
  type MockReply,
  type MockRequest,
  type MockRouter,
} from '../mock-router';

/* ============================================================================
    Backend simulado del editor de catálogos (`/admin/catalogs/*`).

    **SIMULADO · DATOS SINTÉTICOS.** Ningún servicio, precio ni término es real.
    Cumple el contrato `contratos/H3-catalogos.md` (§2, §3 y su adenda §7):

    - Servicios: lectura `SECURITY_ADMIN`/`SUPERADMIN`; escritura igual.
    - Glosario: lectura `SECURITY_ADMIN`/`SUPERADMIN`; **escritura sólo `SUPERADMIN`**.
    - Sin token 401; rol insuficiente 403; recurso inexistente (o de otra
      organización) 404 igual que uno inexistente.
    - `PATCH`/`deactivate`/`reactivate` exigen `expectedRowVersion`; si no es la
      vigente, 409 con `details:{expected, actual}` y NADA cambia.
    - Altas idempotentes: repetir el mismo cuerpo devuelve 200 y el mismo id; el
      mismo código con datos distintos, 409.
    - Lista blanca de campos: uno no declarado es 400.
    - Precios como cadena decimal exacta; nunca `number`.
    - Sin `DELETE`: desactivar conserva el registro.
    ========================================================================== */

const ROLES_LECTURA = ['SUPERADMIN', 'SECURITY_ADMIN'] as const;
const ROLES_ESCRITURA_GLOSARIO = ['SUPERADMIN'] as const;
const SEMILLA_ACTUALIZADA = '2026-10-31T10:00:00.000Z';
const PAGINA = 50;
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PRECIO = /^\d+(?:\.\d{1,2})?$/;

const ALCANCE: ServiceScopes = {
  types: [
    { conceptId: 'tipo-clinica', code: 'PR_TYPE_CLINIC', display: 'Clínica (SIMULADO)' },
    { conceptId: 'tipo-consultorio', code: 'PR_TYPE_OFFICE', display: 'Consultorio (SIMULADO)' },
    { conceptId: 'tipo-laboratorio', code: 'PR_TYPE_LAB', display: 'Laboratorio (SIMULADO)' },
    { conceptId: 'tipo-farmacia', code: 'PR_TYPE_PHARMACY', display: 'Farmacia (SIMULADO)' },
  ],
  practices: [
    { id: 'pr-clinica-1', name: 'Clínica Demo Sur (SIMULADO)', typeConceptId: 'tipo-clinica' },
    { id: 'pr-clinica-2', name: 'Clínica Demo Norte (SIMULADO)', typeConceptId: 'tipo-clinica' },
    { id: 'pr-consultorio-1', name: 'Consultorio Demo (SIMULADO)', typeConceptId: 'tipo-consultorio' },
    { id: 'pr-lab-1', name: 'Laboratorio Demo (SIMULADO)', typeConceptId: 'tipo-laboratorio' },
  ],
  currencies: [
    { conceptId: 'moneda-bob', code: 'BOB' },
    { conceptId: 'moneda-usd', code: 'USD' },
  ],
};

function servicioInicial(
  n: number,
  practiceId: string,
  code: string,
  name: string,
  defaultPrice: string,
  isActive = true,
): AdminServiceItem {
  const practica = ALCANCE.practices.find((p) => p.id === practiceId)!;
  return {
    id: `srv-${n}`,
    practiceId,
    practiceTypeConceptId: practica.typeConceptId,
    code,
    name,
    descriptionText: null,
    termsText: null,
    serviceConceptId: null,
    defaultPrice,
    currencyConceptId: 'moneda-bob',
    currencyCode: 'BOB',
    isActive,
    rowVersion: 1,
    updatedAt: SEMILLA_ACTUALIZADA,
    updatedByUserId: null,
  };
}

interface TerminoGuardado {
  slug: string;
  display: string;
  nameEs: string;
  state: 'active' | 'retired';
  texts: Record<GlossaryAudience, string | null>;
  rowVersion: number;
  updatedAt: string;
}

function terminoInicial(slug: string, display: string, llano: string, clinico: string, state: 'active' | 'retired' = 'active'): TerminoGuardado {
  return { slug, display, nameEs: display, state, texts: { patient: llano, professional: clinico }, rowVersion: 1, updatedAt: SEMILLA_ACTUALIZADA };
}

function violaciones(...campos: readonly { field: string; message: string; constraint: string }[]): MockReply {
  return reply(400, {
    statusCode: 400,
    code: 'VALIDATION_FAILED',
    message: 'Validation failed',
    error: 'Bad Request',
    reason: 'VALIDATION_PIPE_REJECTED',
    details: {
      violations: campos.map((c) => `${c.field} ${c.message}`),
      fields: campos.map((c) => ({ field: c.field, constraints: [c.constraint], messages: [c.message] })),
    },
  });
}

function conflicto(message: string, reason: string, details: Record<string, unknown> = {}): MockReply {
  return reply(409, { statusCode: 409, code: 'CONFLICT', message, reason, error: 'Conflict', details: { reason, ...details } });
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Lista blanca: un campo que el contrato no declara es 400, no se ignora. */
function noDeclarados(cuerpo: Record<string, unknown>, permitidos: readonly string[]): MockReply | null {
  const extra = Object.keys(cuerpo).find((k) => !permitidos.includes(k));
  return extra === undefined ? null : violaciones({ field: extra, message: 'property should not exist', constraint: 'whitelistValidation' });
}

function versionEsperada(cuerpo: Record<string, unknown>): number | MockReply {
  const v = cuerpo['expectedRowVersion'];
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) {
    return violaciones({ field: 'expectedRowVersion', message: 'expectedRowVersion must be an integer number not less than 1', constraint: 'min' });
  }
  return v;
}

function pagina<T>(todos: readonly T[], req: MockRequest): AdminCatalogPage<T> | MockReply {
  const limite = Number(req.query.get('limit') ?? PAGINA);
  if (!Number.isInteger(limite) || limite < 1 || limite > 200) {
    return violaciones({ field: 'limit', message: 'limit must not be greater than 200', constraint: 'max' });
  }
  const cursor = req.query.get('cursor');
  const desde = cursor === null ? 0 : Number(cursor);
  if (!Number.isInteger(desde) || desde < 0) {
    return violaciones({ field: 'cursor', message: 'cursor is not valid', constraint: 'isCursor' });
  }
  const items = todos.slice(desde, desde + limite);
  const siguiente = desde + limite < todos.length ? String(desde + limite) : null;
  return { items, count: items.length, limit: limite, nextCursor: siguiente };
}

export function registrarEditorDeCatalogos(router: MockRouter): void {
  const servicios = new Map<string, AdminServiceItem>(
    [
      servicioInicial(1, 'pr-clinica-1', 'CONS-GEN', 'Consulta general', '150.00'),
      servicioInicial(2, 'pr-clinica-1', 'CONS-ESP', 'Consulta de especialidad', '220.00'),
      servicioInicial(3, 'pr-clinica-2', 'RX-TORAX', 'Radiografía de tórax', '310.50'),
      servicioInicial(4, 'pr-consultorio-1', 'CONS-GEN', 'Consulta general', '120.00'),
      servicioInicial(5, 'pr-consultorio-1', 'CURACION', 'Curación simple', '60.00', false),
      servicioInicial(6, 'pr-lab-1', 'HEMOGRAMA', 'Hemograma completo', '85.00'),
    ].map((s) => [s.id, s]),
  );
  let siguienteServicio = 7;

  const terminos = new Map<string, TerminoGuardado>(
    [
      terminoInicial('hipertension', 'Hipertensión', 'Presión de la sangre más alta de lo normal.', 'Elevación sostenida de la presión arterial sistólica y/o diastólica.'),
      terminoInicial('glucemia', 'Glucemia', 'Cantidad de azúcar en la sangre.', 'Concentración de glucosa en plasma o suero.'),
      terminoInicial('ayuno', 'Ayuno', 'Pasar un tiempo sin comer ni beber antes de un examen.', 'Abstinencia alimentaria previa a una determinación analítica.'),
      terminoInicial('termino-retirado', 'Término retirado', 'Ya no se usa.', 'Concepto retirado del glosario.', 'retired'),
    ].map((t) => [`gl-${t.slug}`, t]),
  );

  /* -- permisos --------------------------------------------------------- */

  const sinLectura = (req: MockRequest): MockReply | null => {
    if (req.user === null) return unauthorized();
    return req.user.roles.some((r) => (ROLES_LECTURA as readonly string[]).includes(r))
      ? null
      : forbidden('Hace falta administración de seguridad para los catálogos.');
  };
  const sinEscrituraGlosario = (req: MockRequest): MockReply | null => {
    const lectura = sinLectura(req);
    if (lectura !== null) return lectura;
    return req.user!.roles.some((r) => (ROLES_ESCRITURA_GLOSARIO as readonly string[]).includes(r))
      ? null
      : forbidden('El glosario llega a todas las organizaciones: sólo la superadministración lo edita.');
  };

  /* ====================== Servicios ====================== */

  const cuerpoDe = (req: MockRequest): Record<string, unknown> | MockReply =>
    esRegistro(req.body) ? req.body : violaciones({ field: 'body', message: 'body must be an object', constraint: 'isObject' });

  const servicioDe = (req: MockRequest): AdminServiceItem | MockReply =>
    servicios.get(req.params['id'] ?? '') ?? notFound('Servicio no encontrado');

  router.get('/admin/catalogs/services/scopes', (req) => sinLectura(req) ?? ALCANCE);

  router.get('/admin/catalogs/services', (req) => {
    const denegado = sinLectura(req);
    if (denegado) return denegado;
    const permitidas = ['practiceTypeConceptId', 'practiceId', 'isActive', 'q', 'cursor', 'limit'];
    const extra = [...req.query.keys()].find((k) => !permitidas.includes(k));
    if (extra !== undefined) return violaciones({ field: extra, message: 'property should not exist', constraint: 'whitelistValidation' });
    const tipo = req.query.get('practiceTypeConceptId');
    const practica = req.query.get('practiceId');
    if (practica !== null && !ALCANCE.practices.some((p) => p.id === practica)) return notFound('Práctica no encontrada');
    const activo = req.query.get('isActive');
    const q = (req.query.get('q') ?? '').trim().toLowerCase();
    const filtrados = [...servicios.values()]
      .filter((s) => tipo === null || s.practiceTypeConceptId === tipo)
      .filter((s) => practica === null || s.practiceId === practica)
      .filter((s) => activo === null || s.isActive === (activo === 'true' || activo === '1'))
      .filter((s) => q === '' || s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code) || a.id.localeCompare(b.id));
    return pagina(filtrados, req);
  });

  router.get('/admin/catalogs/services/:id', (req) => sinLectura(req) ?? servicioDe(req));

  router.post('/admin/catalogs/services', (req) => {
    const denegado = sinLectura(req);
    if (denegado) return denegado;
    const c = cuerpoDe(req);
    if (isMockReply(c)) return c;
    const extra = noDeclarados(c, ['practiceId', 'code', 'name', 'defaultPrice', 'descriptionText', 'serviceConceptId', 'currencyConceptId', 'isActive']);
    if (extra) return extra;
    const errores: { field: string; message: string; constraint: string }[] = [];
    const texto = (k: string, max: number) => {
      const v = c[k];
      if (typeof v !== 'string' || v.trim() === '') errores.push({ field: k, message: `${k} should not be empty`, constraint: 'isNotEmpty' });
      else if (v.length > max) errores.push({ field: k, message: `${k} must be shorter than or equal to ${max} characters`, constraint: 'maxLength' });
    };
    texto('practiceId', 80);
    texto('code', 120);
    texto('name', 200);
    if (typeof c['defaultPrice'] !== 'string' || !PRECIO.test(c['defaultPrice'])) {
      errores.push({ field: 'defaultPrice', message: 'defaultPrice must be a decimal string with up to 2 decimals', constraint: 'matches' });
    }
    if (errores.length > 0) return violaciones(...errores);
    const practica = ALCANCE.practices.find((p) => p.id === c['practiceId']);
    if (practica === undefined) return notFound('Práctica no encontrada');
    if (!(Number(c['defaultPrice']) > 0)) return precondition('El precio debe ser mayor que cero.', 'SERVICE_CATALOG_PRICE_NOT_POSITIVE');
    const moneda = ALCANCE.currencies.find((m) => m.conceptId === (c['currencyConceptId'] ?? 'moneda-bob'));
    if (moneda === undefined) return violaciones({ field: 'currencyConceptId', message: 'currencyConceptId is not a known currency', constraint: 'isIn' });

    const existente = [...servicios.values()].find((s) => s.practiceId === practica.id && s.code === c['code']);
    if (existente !== undefined) {
      const identico =
        existente.name === c['name'] &&
        existente.defaultPrice === c['defaultPrice'] &&
        (existente.descriptionText ?? undefined) === (c['descriptionText'] ?? undefined);
      return identico
        ? reply(200, existente)
        : conflicto('Ya existe un servicio con ese código en esa práctica.', 'SERVICE_CATALOG_CODE_ALREADY_EXISTS');
    }
    const nuevo: AdminServiceItem = {
      id: `srv-${siguienteServicio++}`,
      practiceId: practica.id,
      practiceTypeConceptId: practica.typeConceptId,
      code: c['code'] as string,
      name: c['name'] as string,
      descriptionText: typeof c['descriptionText'] === 'string' ? c['descriptionText'] : null,
      termsText: null,
      serviceConceptId: typeof c['serviceConceptId'] === 'string' ? c['serviceConceptId'] : null,
      defaultPrice: c['defaultPrice'] as string,
      currencyConceptId: moneda.conceptId,
      currencyCode: moneda.code,
      isActive: c['isActive'] !== false,
      rowVersion: 1,
      updatedAt: new Date().toISOString(),
      updatedByUserId: req.user!.id,
    };
    servicios.set(nuevo.id, nuevo);
    return reply(201, nuevo);
  });

  router.patch('/admin/catalogs/services/:id', (req) => {
    const denegado = sinLectura(req);
    if (denegado) return denegado;
    const actual = servicioDe(req);
    if (isMockReply(actual)) return actual;
    const c = cuerpoDe(req);
    if (isMockReply(c)) return c;
    const extra = noDeclarados(c, ['expectedRowVersion', 'name', 'descriptionText', 'termsText', 'serviceConceptId', 'defaultPrice', 'currencyConceptId']);
    if (extra) return extra;
    const esperada = versionEsperada(c);
    if (typeof esperada !== 'number') return esperada;
    if (c['name'] !== undefined && (typeof c['name'] !== 'string' || c['name'].trim() === '' || c['name'].length > 200)) {
      return violaciones({ field: 'name', message: 'name must be between 1 and 200 characters', constraint: 'length' });
    }
    if (c['defaultPrice'] !== undefined && (typeof c['defaultPrice'] !== 'string' || !PRECIO.test(c['defaultPrice']))) {
      return violaciones({ field: 'defaultPrice', message: 'defaultPrice must be a decimal string with up to 2 decimals', constraint: 'matches' });
    }
    if (esperada !== actual.rowVersion) {
      return conflicto('Otra persona modificó este servicio.', 'SERVICE_CATALOG_VERSION_MISMATCH', { expected: esperada, actual: actual.rowVersion });
    }
    if (c['defaultPrice'] !== undefined && !(Number(c['defaultPrice']) > 0)) {
      return precondition('El precio debe ser mayor que cero.', 'SERVICE_CATALOG_PRICE_NOT_POSITIVE');
    }
    const moneda = ALCANCE.currencies.find((m) => m.conceptId === c['currencyConceptId']);
    const limpiar = (v: unknown, previo: string | null | undefined) =>
      v === undefined ? (previo ?? null) : v === null || (typeof v === 'string' && v.trim() === '') ? null : (v as string);
    const nuevo: AdminServiceItem = {
      ...actual,
      name: (c['name'] as string | undefined) ?? actual.name,
      descriptionText: limpiar(c['descriptionText'], actual.descriptionText),
      termsText: limpiar(c['termsText'], actual.termsText),
      defaultPrice: (c['defaultPrice'] as string | undefined) ?? actual.defaultPrice,
      ...(c['defaultPrice'] !== undefined && moneda !== undefined ? { currencyConceptId: moneda.conceptId, currencyCode: moneda.code } : {}),
      rowVersion: actual.rowVersion + 1,
      updatedAt: new Date().toISOString(),
      updatedByUserId: req.user!.id,
    };
    servicios.set(nuevo.id, nuevo);
    return nuevo;
  });

  const alternarServicio = (activar: boolean) => (req: MockRequest) => {
    const denegado = sinLectura(req);
    if (denegado) return denegado;
    const actual = servicioDe(req);
    if (isMockReply(actual)) return actual;
    const c = cuerpoDe(req);
    if (isMockReply(c)) return c;
    const extra = noDeclarados(c, ['expectedRowVersion']);
    if (extra) return extra;
    const esperada = versionEsperada(c);
    if (typeof esperada !== 'number') return esperada;
    if (esperada !== actual.rowVersion) {
      return conflicto('Otra persona modificó este servicio.', 'SERVICE_CATALOG_VERSION_MISMATCH', { expected: esperada, actual: actual.rowVersion });
    }
    if (actual.isActive === activar) return actual; // idempotente: sin subir versión
    const nuevo = { ...actual, isActive: activar, rowVersion: actual.rowVersion + 1, updatedAt: new Date().toISOString(), updatedByUserId: req.user!.id };
    servicios.set(nuevo.id, nuevo);
    return nuevo;
  };
  router.post('/admin/catalogs/services/:id/deactivate', alternarServicio(false));
  router.post('/admin/catalogs/services/:id/reactivate', alternarServicio(true));

  /* ====================== Glosario ====================== */

  const audienciaDe = (req: MockRequest): GlossaryAudience | MockReply => {
    const a = req.query.get('audience');
    return a === 'patient' || a === 'professional'
      ? a
      : violaciones({ field: 'audience', message: 'audience must be one of the following values: patient, professional', constraint: 'isIn' });
  };

  const vista = (id: string, t: TerminoGuardado, audience: GlossaryAudience): AdminGlossaryTerm => {
    const es = t.texts[audience];
    return {
      conceptId: id,
      slug: t.slug,
      code: t.slug.toUpperCase().replaceAll('-', '_'),
      display: t.display,
      nameEs: t.nameEs,
      state: t.state,
      audience,
      text: es === null ? null : { es },
      rowVersion: t.rowVersion,
      updatedAt: t.updatedAt,
      updatedByUserId: null,
    };
  };

  const terminoDe = (req: MockRequest): [string, TerminoGuardado] | MockReply => {
    const id = req.params['conceptId'] ?? '';
    const t = terminos.get(id);
    return t === undefined ? reply(404, { statusCode: 404, code: 'NOT_FOUND', message: 'Término no encontrado', reason: 'GLOSSARY_TERM_NOT_FOUND', error: 'Not Found' }) : [id, t];
  };

  router.get('/admin/catalogs/glossary', (req) => {
    const denegado = sinLectura(req);
    if (denegado) return denegado;
    const audience = audienciaDe(req);
    if (typeof audience !== 'string') return audience;
    const estado = req.query.get('state');
    if (estado !== null && estado !== 'active' && estado !== 'retired') {
      return violaciones({ field: 'state', message: 'state must be one of the following values: active, retired', constraint: 'isIn' });
    }
    const q = (req.query.get('q') ?? '').trim().toLowerCase();
    const filtrados = [...terminos.entries()]
      .filter(([, t]) => estado === null || t.state === estado)
      .filter(([, t]) => q === '' || t.slug.includes(q) || t.display.toLowerCase().includes(q))
      .sort(([, a], [, b]) => a.slug.localeCompare(b.slug))
      .map(([id, t]) => vista(id, t, audience));
    return pagina(filtrados, req);
  });

  router.get('/admin/catalogs/glossary/:conceptId', (req) => {
    const denegado = sinLectura(req);
    if (denegado) return denegado;
    const audience = audienciaDe(req);
    if (typeof audience !== 'string') return audience;
    const t = terminoDe(req);
    return Array.isArray(t) ? vista(t[0], t[1], audience) : t;
  });

  const textoValido = (v: unknown): v is { es: string; en?: string } =>
    esRegistro(v) && typeof v['es'] === 'string' && v['es'].trim() !== '' && v['es'].length <= 4000 && (v['en'] === undefined || typeof v['en'] === 'string');

  router.post('/admin/catalogs/glossary', (req) => {
    const denegado = sinEscrituraGlosario(req);
    if (denegado) return denegado;
    const c = cuerpoDe(req);
    if (isMockReply(c)) return c;
    const extra = noDeclarados(c, ['slug', 'display', 'nameEs', 'audience', 'text']);
    if (extra) return extra;
    const errores: { field: string; message: string; constraint: string }[] = [];
    if (typeof c['slug'] !== 'string' || !KEBAB.test(c['slug']) || c['slug'].length > 80) {
      errores.push({ field: 'slug', message: 'slug must be kebab-case up to 80 characters', constraint: 'matches' });
    }
    for (const k of ['display', 'nameEs'] as const) {
      const v = c[k];
      if (typeof v !== 'string' || v.trim() === '' || v.length > 200) errores.push({ field: k, message: `${k} must be between 1 and 200 characters`, constraint: 'length' });
    }
    if (c['audience'] !== 'patient' && c['audience'] !== 'professional') {
      errores.push({ field: 'audience', message: 'audience must be one of the following values: patient, professional', constraint: 'isIn' });
    }
    if (!textoValido(c['text'])) errores.push({ field: 'text.es', message: 'text.es must be between 1 and 4000 characters', constraint: 'length' });
    if (errores.length > 0) return violaciones(...errores);
    const slug = c['slug'] as string;
    const audience = c['audience'] as GlossaryAudience;
    const es = (c['text'] as { es: string }).es;
    const id = `gl-${slug}`;
    const previo = terminos.get(id);
    if (previo !== undefined) {
      return previo.display === c['display'] && previo.nameEs === c['nameEs'] && previo.texts[audience] === es
        ? reply(200, vista(id, previo, audience))
        : conflicto('Ya existe un término con ese identificador.', 'GLOSSARY_TERM_ALREADY_EXISTS');
    }
    const nuevo: TerminoGuardado = {
      slug,
      display: c['display'] as string,
      nameEs: c['nameEs'] as string,
      state: 'active',
      texts: { patient: null, professional: null, [audience]: es },
      rowVersion: 1,
      updatedAt: new Date().toISOString(),
    };
    terminos.set(id, nuevo);
    return reply(201, vista(id, nuevo, audience));
  });

  router.patch('/admin/catalogs/glossary/:conceptId', (req) => {
    const denegado = sinEscrituraGlosario(req);
    if (denegado) return denegado;
    const t = terminoDe(req);
    if (!Array.isArray(t)) return t;
    const c = cuerpoDe(req);
    if (isMockReply(c)) return c;
    const extra = noDeclarados(c, ['expectedRowVersion', 'audience', 'text', 'nameEs']);
    if (extra) return extra;
    const esperada = versionEsperada(c);
    if (typeof esperada !== 'number') return esperada;
    if (c['audience'] !== 'patient' && c['audience'] !== 'professional') {
      return violaciones({ field: 'audience', message: 'audience must be one of the following values: patient, professional', constraint: 'isIn' });
    }
    if (c['text'] === undefined && c['nameEs'] === undefined) {
      return violaciones({ field: 'text', message: 'text or nameEs is required', constraint: 'isDefined' });
    }
    if (c['text'] !== undefined && !textoValido(c['text'])) {
      return violaciones({ field: 'text.es', message: 'text.es must be between 1 and 4000 characters', constraint: 'length' });
    }
    if (c['nameEs'] !== undefined && (typeof c['nameEs'] !== 'string' || c['nameEs'].trim() === '' || c['nameEs'].length > 200)) {
      return violaciones({ field: 'nameEs', message: 'nameEs must be between 1 and 200 characters', constraint: 'length' });
    }
    const [id, actual] = t;
    if (esperada !== actual.rowVersion) {
      return conflicto('Otra persona modificó este término.', 'GLOSSARY_TERM_VERSION_MISMATCH', { expected: esperada, actual: actual.rowVersion });
    }
    const audience = c['audience'];
    const nuevo: TerminoGuardado = {
      ...actual,
      nameEs: (c['nameEs'] as string | undefined) ?? actual.nameEs,
      texts: c['text'] === undefined ? actual.texts : { ...actual.texts, [audience]: (c['text'] as { es: string }).es },
      rowVersion: actual.rowVersion + 1,
      updatedAt: new Date().toISOString(),
    };
    terminos.set(id, nuevo);
    return vista(id, nuevo, audience);
  });

  const alternarTermino = (activar: boolean) => (req: MockRequest) => {
    const denegado = sinEscrituraGlosario(req);
    if (denegado) return denegado;
    const t = terminoDe(req);
    if (!Array.isArray(t)) return t;
    const c = cuerpoDe(req);
    if (isMockReply(c)) return c;
    const extra = noDeclarados(c, ['expectedRowVersion', 'audience']);
    if (extra) return extra;
    const esperada = versionEsperada(c);
    if (typeof esperada !== 'number') return esperada;
    if (c['audience'] !== 'patient' && c['audience'] !== 'professional') {
      return violaciones({ field: 'audience', message: 'audience must be one of the following values: patient, professional', constraint: 'isIn' });
    }
    const [id, actual] = t;
    if (esperada !== actual.rowVersion) {
      return conflicto('Otra persona modificó este término.', 'GLOSSARY_TERM_VERSION_MISMATCH', { expected: esperada, actual: actual.rowVersion });
    }
    const estado = activar ? 'active' : 'retired';
    if (actual.state === estado) return vista(id, actual, c['audience']); // idempotente: sin subir versión
    const nuevo: TerminoGuardado = { ...actual, state: estado, rowVersion: actual.rowVersion + 1, updatedAt: new Date().toISOString() };
    terminos.set(id, nuevo);
    return vista(id, nuevo, c['audience']);
  };
  router.post('/admin/catalogs/glossary/:conceptId/deactivate', alternarTermino(false));
  router.post('/admin/catalogs/glossary/:conceptId/reactivate', alternarTermino(true));
}
