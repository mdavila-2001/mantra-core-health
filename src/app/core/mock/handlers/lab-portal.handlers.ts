import { ESTUDIO, displayDe } from '../fixtures/conceptos';
import { precioInlasaDe } from '../fixtures/inlasa';
import { PROFESIONALES, pacientePorId } from '../fixtures/personas';
import {
  conflict,
  forbidden,
  noContent,
  notFound,
  reply,
  validation,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { TENANT_LABORATORIO, TENANT_NAMES, TENANT_TYPES } from '../mock-session';
import { ahora, Coleccion, contiene, cuerpo, iso, nuevoId, texto, uuid } from '../mock-store';
import { labInboxOrders } from './diagnostics.handlers';
import { pdfMinimo } from './files.handlers';
import { emitirNotificacion } from './notifications.handlers';
import type {
  LabActivityKind,
  LabImportMode,
  LabImportRow,
  LabImportRowResult,
  LabResultKind,
  LabServiceDraft,
  LabServiceStatus,
} from '../../data-access/lab-portal/lab-portal.types';

/* ============================================================================
    El portal de la cuenta de laboratorio (30/09/2026) — P52.

    Espejo del portal de la farmacia (`pharmacy.handlers.ts`, P47) adaptado a
    un laboratorio: servicios en vez de productos, disponibilidad «se hace / no
    se hace» en vez de existencias, y los **resultados**: archivos de cualquier
    formato y de cualquier tamaño que el laboratorio sube por partes.

    Todo se acota al tenant del contexto (`X-Tenant-Id`, o el primero de la
    sesión) y sólo lo abre una organización `DIAGNOSTIC_CENTER`: la misma
    regla con la que la API abre la recepción de muestras (`LabStaffGuard`).
    ========================================================================== */

/* ---- quién pregunta ------------------------------------------------------ */

/** El laboratorio del contexto, o `null` si quien pregunta no es personal de uno. */
function laboratorioDe(request: MockRequest): string | null {
  const tenantId = request.headers.get('X-Tenant-Id') ?? request.user?.tenants[0] ?? null;
  if (tenantId === null || request.user === null) return null;
  if (!request.user.tenants.includes(tenantId) && !request.user.roles.includes('SUPERADMIN')) {
    return null;
  }
  return TENANT_TYPES[tenantId] === 'DIAGNOSTIC_CENTER' ? tenantId : null;
}

/* ---- categorías y servicios --------------------------------------------- */

interface CategoriaSimulada {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
}

interface ServicioSimulado {
  readonly id: string;
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly categoryId: string | null;
  readonly sampleType: string | null;
  readonly preparation: string | null;
  readonly description: string | null;
  readonly turnaroundHours: number | null;
  readonly requiresMedicalOrder: boolean;
  readonly homeCollection: boolean;
  readonly price: string;
  readonly alovidaDiscountPercent: number | null;
  readonly status: LabServiceStatus;
  readonly available: boolean;
  readonly updatedAt: string;
}

const CATEGORIAS_INICIALES = [
  'Hematología',
  'Química sanguínea',
  'Hormonas',
  'Orina',
  'Coagulación',
  'Microbiología y parasitología',
] as const;

function idDeCategoria(tenantId: string, nombre: string): string {
  return uuid(`lab-category-${tenantId}-${nombre}`);
}

export const categoriasDeLaboratorio = new Coleccion<CategoriaSimulada>(
  CATEGORIAS_INICIALES.map((name) => ({
    id: idDeCategoria(TENANT_LABORATORIO, name),
    tenantId: TENANT_LABORATORIO,
    name,
  })),
);

/**
 * El catálogo sembrado de Laboratorio Central: los mismos trece estudios que el
 * directorio público le muestra al paciente (`ESTUDIOS_POR_TIPO.LABORATORY` en
 * `diagnostics.handlers.ts`), con el mismo precio —el de referencia de INLASA
 * 2026, ver `fixtures/inlasa.ts`—, para que la cuenta y la vitrina no digan dos
 * cosas distintas del mismo laboratorio. La preparación queda en `null`: las
 * indicaciones al paciente las escribe el laboratorio, no la maqueta.
 */
const ESTUDIOS_SEMBRADOS: readonly {
  readonly code: keyof typeof ESTUDIO;
  readonly categoria: (typeof CATEGORIAS_INICIALES)[number];
  readonly muestra: string;
  readonly preparacion: string | null;
  readonly horas: number;
}[] = [
  { code: 'STUDY-HEMOGRAMA', categoria: 'Hematología', muestra: 'Sangre venosa', preparacion: null, horas: 4 },
  { code: 'STUDY-GLUCOSA', categoria: 'Química sanguínea', muestra: 'Sangre venosa', preparacion: null, horas: 4 },
  { code: 'STUDY-PERFIL-LIPIDICO', categoria: 'Química sanguínea', muestra: 'Sangre venosa', preparacion: null, horas: 6 },
  { code: 'STUDY-TSH', categoria: 'Hormonas', muestra: 'Sangre venosa', preparacion: null, horas: 24 },
  { code: 'STUDY-ORINA', categoria: 'Orina', muestra: 'Orina (primera de la mañana)', preparacion: null, horas: 4 },
  { code: 'STUDY-CREATININA', categoria: 'Química sanguínea', muestra: 'Sangre venosa', preparacion: null, horas: 4 },
  { code: 'STUDY-UREA', categoria: 'Química sanguínea', muestra: 'Sangre venosa', preparacion: null, horas: 4 },
  { code: 'STUDY-HBA1C', categoria: 'Química sanguínea', muestra: 'Sangre venosa', preparacion: null, horas: 24 },
  { code: 'STUDY-COAGULACION', categoria: 'Coagulación', muestra: 'Sangre venosa (tubo celeste)', preparacion: null, horas: 6 },
  { code: 'STUDY-HEPATICO', categoria: 'Química sanguínea', muestra: 'Sangre venosa', preparacion: null, horas: 6 },
  { code: 'STUDY-COPROLOGICO', categoria: 'Microbiología y parasitología', muestra: 'Heces', preparacion: null, horas: 24 },
  { code: 'STUDY-CULTIVO', categoria: 'Microbiología y parasitología', muestra: 'Orina (frasco estéril)', preparacion: null, horas: 72 },
  { code: 'STUDY-VITAMINA-D', categoria: 'Hormonas', muestra: 'Sangre venosa', preparacion: null, horas: 48 },
];

export const serviciosDeLaboratorio = new Coleccion<ServicioSimulado>(
  ESTUDIOS_SEMBRADOS.map((e, i) => ({
    id: uuid(`lab-service-${TENANT_LABORATORIO}-${e.code}`),
    tenantId: TENANT_LABORATORIO,
    code: e.code.replace('STUDY-', ''),
    name: displayDe(ESTUDIO[e.code]!),
    categoryId: idDeCategoria(TENANT_LABORATORIO, e.categoria),
    sampleType: e.muestra,
    preparation: e.preparacion,
    description: null,
    turnaroundHours: e.horas,
    requiresMedicalOrder: i > 1,
    homeCollection: e.muestra.startsWith('Sangre'),
    // El precio de referencia de INLASA para ese análisis: el mismo que muestra
    // la ficha pública (`diagnostics.handlers.ts`), y no una fórmula.
    price: precioInlasaDe(e.code),
    alovidaDiscountPercent: 10,
    // Uno en borrador y uno sin reactivo, para que los filtros tengan qué
    // mostrar desde el primer ingreso.
    status: i === 12 ? 'DRAFT' : 'PUBLISHED',
    available: i !== 8,
    updatedAt: iso(-(20 - i)),
  })),
);

function precioAloVida(s: ServicioSimulado): string {
  const descuento = s.alovidaDiscountPercent ?? 0;
  return ((Number(s.price) * (100 - descuento)) / 100).toFixed(2);
}

function servicioDeRespuesta(s: ServicioSimulado) {
  const { tenantId: _t, ...resto } = s;
  return {
    ...resto,
    categoryName:
      s.categoryId === null ? null : (categoriasDeLaboratorio.get(s.categoryId)?.name ?? null),
    alovidaPrice: precioAloVida(s),
    currency: 'BOB' as const,
  };
}

function categoriaDeRespuesta(c: CategoriaSimulada) {
  return {
    id: c.id,
    name: c.name,
    serviceCount: serviciosDeLaboratorio.filtrar(
      (s) => s.tenantId === c.tenantId && s.categoryId === c.id && s.status !== 'WITHDRAWN',
    ).length,
  };
}

const ESTADOS: readonly LabServiceStatus[] = ['PUBLISHED', 'DRAFT', 'WITHDRAWN'];

/**
 * Valida un alta o un cambio. Devuelve el problema en palabras de persona, o
 * `null` si está bien. `parcial` es para el PATCH: lo que no viene no se mira.
 */
function problemaDe(
  tenantId: string,
  datos: Partial<LabServiceDraft> & { readonly status?: LabServiceStatus },
  parcial: boolean,
  propioId: string | null,
): string | null {
  if (!parcial || datos.code !== undefined) {
    const code = (datos.code ?? '').trim();
    if (code === '') return 'Falta el código del servicio.';
    if (code.length > 40) return 'El código no puede pasar de 40 caracteres.';
    const repetido = serviciosDeLaboratorio.filtrar(
      (s) => s.tenantId === tenantId && s.code.toLowerCase() === code.toLowerCase() && s.id !== propioId,
    );
    if (repetido.length > 0) return `Ya tiene un servicio con el código «${code}».`;
  }
  if (!parcial || datos.name !== undefined) {
    if ((datos.name ?? '').trim() === '') return 'Falta el nombre del servicio.';
  }
  if (!parcial || datos.price !== undefined) {
    const precio = Number(datos.price);
    if (datos.price === undefined || !Number.isFinite(precio) || precio < 0) {
      return 'El precio tiene que ser un número mayor o igual a cero.';
    }
  }
  if (datos.alovidaDiscountPercent !== undefined && datos.alovidaDiscountPercent !== null) {
    const d = datos.alovidaDiscountPercent;
    if (!Number.isFinite(d) || d < 0 || d > 100) return 'El descuento va de 0 a 100 %.';
  }
  if (datos.turnaroundHours !== undefined && datos.turnaroundHours !== null) {
    const h = datos.turnaroundHours;
    if (!Number.isInteger(h) || h < 0) return 'El tiempo de entrega va en horas enteras.';
  }
  if (datos.categoryId !== undefined && datos.categoryId !== null) {
    const categoria = categoriasDeLaboratorio.get(datos.categoryId);
    if (categoria === undefined || categoria.tenantId !== tenantId) return 'La categoría no existe.';
  }
  if (datos.status !== undefined && !ESTADOS.includes(datos.status)) return 'Estado desconocido.';
  return null;
}

function limpio(valor: string | null | undefined): string | null {
  const t = (valor ?? '').trim();
  return t === '' ? null : t;
}

function servicioNuevo(tenantId: string, d: LabServiceDraft): ServicioSimulado {
  return {
    id: nuevoId('lab-service'),
    tenantId,
    code: d.code.trim(),
    name: d.name.trim(),
    categoryId: d.categoryId ?? null,
    sampleType: limpio(d.sampleType),
    preparation: limpio(d.preparation),
    description: limpio(d.description),
    turnaroundHours: d.turnaroundHours ?? null,
    requiresMedicalOrder: d.requiresMedicalOrder ?? false,
    homeCollection: d.homeCollection ?? false,
    price: Number(d.price).toFixed(2),
    alovidaDiscountPercent: d.alovidaDiscountPercent ?? null,
    status: d.status ?? 'PUBLISHED',
    available: d.available ?? true,
    updatedAt: ahora(),
  };
}

/** Los cambios de un PATCH ya normalizados, sin las claves que no vinieron. */
function cambiosDe(d: Partial<LabServiceDraft> & { readonly status?: LabServiceStatus }): Partial<ServicioSimulado> {
  const cambios: Record<string, unknown> = {};
  if (d.code !== undefined) cambios['code'] = d.code.trim();
  if (d.name !== undefined) cambios['name'] = d.name.trim();
  if (d.categoryId !== undefined) cambios['categoryId'] = d.categoryId;
  if (d.sampleType !== undefined) cambios['sampleType'] = limpio(d.sampleType);
  if (d.preparation !== undefined) cambios['preparation'] = limpio(d.preparation);
  if (d.description !== undefined) cambios['description'] = limpio(d.description);
  if (d.turnaroundHours !== undefined) cambios['turnaroundHours'] = d.turnaroundHours;
  if (d.requiresMedicalOrder !== undefined) cambios['requiresMedicalOrder'] = d.requiresMedicalOrder;
  if (d.homeCollection !== undefined) cambios['homeCollection'] = d.homeCollection;
  if (d.price !== undefined) cambios['price'] = Number(d.price).toFixed(2);
  if (d.alovidaDiscountPercent !== undefined) cambios['alovidaDiscountPercent'] = d.alovidaDiscountPercent;
  if (d.status !== undefined) cambios['status'] = d.status;
  if (d.available !== undefined) cambios['available'] = d.available;
  return cambios as Partial<ServicioSimulado>;
}

/** Si aplicar `cambios` dejaría el servicio igual que está. */
function sinCambios(s: ServicioSimulado, cambios: Partial<ServicioSimulado>): boolean {
  return Object.entries(cambios).every(
    ([clave, valor]) => (s as unknown as Record<string, unknown>)[clave] === valor,
  );
}

/* ---- actividad ----------------------------------------------------------- */

interface ActividadSimulada {
  readonly id: string;
  readonly tenantId: string;
  readonly at: string;
  readonly kind: LabActivityKind;
  readonly text: string;
}

const actividad = new Coleccion<ActividadSimulada>([]);

function anotar(tenantId: string, kind: LabActivityKind, text: string): void {
  actividad.agregar({ id: nuevoId('lab-activity'), tenantId, at: ahora(), kind, text });
}

/* ---- resultados ---------------------------------------------------------- */

interface ResultadoSimulado {
  readonly id: string;
  readonly tenantId: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly kind: LabResultKind;
  readonly uploadedAt: string;
  readonly uploadedBy: string;
  readonly orderId: string | null;
  readonly note: string | null;
  readonly notified: boolean;
  readonly status: 'AVAILABLE' | 'WITHDRAWN';
  readonly withdrawnReason: string | null;
  /** Sólo los sembrados: con qué armar sus bytes cuando alguien los pide. */
  readonly semilla?: string;
}

const EXTENSIONES: Readonly<Record<Exclude<LabResultKind, 'OTHER'>, readonly string[]>> = {
  PDF: ['pdf'],
  IMAGE: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif'],
  VIDEO: ['mp4', 'webm', 'ogv', 'mov', 'm4v'],
  AUDIO: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac'],
  TEXT: ['txt', 'csv', 'tsv', 'json', 'xml', 'hl7', 'md', 'log'],
  DICOM: ['dcm', 'dicom'],
};

/**
 * Cómo se puede mirar un archivo. Primero la extensión —el navegador suele
 * mandar `application/octet-stream` para lo que no conoce— y después el MIME.
 */
export function tipoDeResultado(fileName: string, contentType: string): LabResultKind {
  const extension = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : '';
  for (const [tipo, extensiones] of Object.entries(EXTENSIONES)) {
    if (extensiones.includes(extension)) return tipo as LabResultKind;
  }
  const mime = contentType.toLowerCase();
  if (mime === 'application/pdf') return 'PDF';
  if (mime === 'application/dicom') return 'DICOM';
  if (mime.startsWith('image/') && mime !== 'image/tiff') return 'IMAGE';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('audio/')) return 'AUDIO';
  if (mime.startsWith('text/') || mime === 'application/json' || mime === 'application/xml') {
    return 'TEXT';
  }
  return 'OTHER';
}

/** Los resultados que ya estaban subidos al arrancar la maqueta. */
function resultadosSembrados(): ResultadoSimulado[] {
  const ordenes = labInboxOrders.filtrar((o) => o.performerTenantId === TENANT_LABORATORIO);
  const siembra = [
    { orden: 0, nombre: 'hemograma-completo.pdf', tipo: 'application/pdf', semilla: 'pdf', dias: -6 },
    { orden: 0, nombre: 'frotis-de-sangre.svg', tipo: 'image/svg+xml', semilla: 'imagen', dias: -6 },
    { orden: 1, nombre: 'glucosa-en-ayunas.pdf', tipo: 'application/pdf', semilla: 'pdf', dias: -5 },
    { orden: 2, nombre: 'perfil-lipidico.csv', tipo: 'text/csv', semilla: 'csv', dias: -4 },
    { orden: 3, nombre: 'tsh-informe.hl7', tipo: 'application/octet-stream', semilla: 'hl7', dias: -3 },
    { orden: 4, nombre: 'orina-sedimento.dcm', tipo: 'application/dicom', semilla: 'binario', dias: -2 },
  ] as const;
  return siembra.flatMap((s, i) => {
    const orden = ordenes[s.orden];
    if (orden === undefined) return [];
    const bytes = bytesSembrados({ semilla: s.semilla, fileName: s.nombre, orderId: orden.id });
    return [
      {
        id: uuid(`lab-result-${orden.id}-${s.nombre}`),
        tenantId: TENANT_LABORATORIO,
        fileName: s.nombre,
        contentType: s.tipo,
        sizeBytes: bytes.size,
        kind: tipoDeResultado(s.nombre, s.tipo),
        uploadedAt: iso(s.dias, 10 + i, 20),
        uploadedBy: 'Rocío Villarroel',
        orderId: orden.id,
        note: i === 0 ? 'Valores dentro de rango.' : null,
        notified: true,
        status: 'AVAILABLE' as const,
        withdrawnReason: null,
        semilla: s.semilla,
      },
    ];
  });
}

/** Los bytes de un resultado sembrado, armados a pedido: no se guardan. */
function bytesSembrados(r: { readonly semilla: string; readonly fileName: string; readonly orderId: string | null }): Blob {
  const destino = r.orderId === null ? undefined : destinoDeOrden(r.orderId);
  const titulo = destino === undefined ? r.fileName : `${destino.studyName} - ${destino.patientName}`;
  switch (r.semilla) {
    case 'pdf':
      return new Blob([pdfMinimo(`Laboratorio Central - ${titulo}`)], { type: 'application/pdf' });
    case 'imagen': {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600"><rect width="960" height="600" fill="#fdf2f8"/>${Array.from({ length: 36 }, (_, k) => `<circle cx="${60 + ((k * 137) % 860)}" cy="${60 + ((k * 89) % 480)}" r="${18 + (k % 4) * 4}" fill="#be123c" opacity="0.55"/>`).join('')}<text x="480" y="570" font-family="Arial" font-size="24" fill="#831843" text-anchor="middle">${titulo} · 100x</text></svg>`;
      return new Blob([svg], { type: 'image/svg+xml' });
    }
    case 'csv':
      return new Blob(
        [
          'analito,resultado,unidad,rango de referencia\n' +
            'Colesterol total,182,mg/dL,< 200\n' +
            'HDL,48,mg/dL,> 40\n' +
            'LDL,108,mg/dL,< 130\n' +
            'Triglicéridos,131,mg/dL,< 150\n',
        ],
        { type: 'text/csv' },
      );
    case 'hl7':
      return new Blob(
        [
          'MSH|^~\\&|LABCEN|LABORATORIO CENTRAL|ALOVIDA|ALOVIDA|20260927||ORU^R01|0001|P|2.5\r' +
            `PID|1||${r.orderId ?? ''}||${titulo}\r` +
            'OBX|1|NM|3016-3^TSH^LN||2.1|mUI/L|0.4-4.0|N|||F\r',
        ],
        { type: 'text/plain' },
      );
    default:
      return new Blob([new Uint8Array(Array.from({ length: 2048 }, (_, k) => (k * 31) % 256))], {
        type: 'application/dicom',
      });
  }
}

export const resultadosDeLaboratorio = new Coleccion<ResultadoSimulado>(resultadosSembrados());

/**
 * Los bytes de lo subido en esta sesión.
 *
 * Se guardan las **referencias** a los trozos que mandó el navegador —`slice`
 * del `File` original, que el navegador respalda en disco—, no copias: por eso
 * un archivo de varios gigas no ocupa memoria en la maqueta. Además se copian a
 * IndexedDB en segundo plano para que sigan ahí después de un F5.
 */
const bytesEnMemoria = new Map<string, Blob>();

/** Las subidas abiertas: sus partes, por índice. */
interface SubidaAbierta {
  readonly tenantId: string;
  readonly userName: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly orderId: string | null;
  readonly note: string | null;
  readonly notify: boolean;
  readonly totalParts: number;
  readonly partes: Map<number, Blob>;
}

const subidas = new Map<string, SubidaAbierta>();

/** El tamaño de cada parte. 8 MiB: bajo el `client_max_body_size` de nginx (12M). */
export const TAMANO_DE_PARTE = 8 * 1024 * 1024;

function destinoDeOrden(orderId: string) {
  const orden = labInboxOrders.get(orderId);
  if (orden === undefined) return undefined;
  const paciente = pacientePorId(orden.patientProfileId);
  const medico = PROFESIONALES.find((p) => p.id === orden.requesterProfileId);
  return {
    orden,
    studyName: displayDe(orden.codeConceptId),
    patientName: paciente?.displayName ?? 'Paciente',
    patientUserId: paciente?.userId ?? null,
    requesterName: medico?.displayName ?? 'Médico solicitante',
    requesterUserId: medico?.userId ?? null,
  };
}

function resultadoDeRespuesta(r: ResultadoSimulado) {
  const { tenantId: _t, semilla: _s, ...resto } = r;
  const destino = r.orderId === null ? undefined : destinoDeOrden(r.orderId);
  return {
    ...resto,
    orderLabel: destino === undefined ? null : `${destino.studyName} · pedido por ${destino.requesterName}`,
    patientName: destino?.patientName ?? null,
  };
}

function tamanoLegible(bytes: number): string {
  const unidades = ['B', 'KB', 'MB', 'GB', 'TB'];
  let valor = bytes;
  let i = 0;
  while (valor >= 1024 && i < unidades.length - 1) {
    valor /= 1024;
    i++;
  }
  return `${valor.toLocaleString('es-BO', { maximumFractionDigits: i === 0 ? 0 : 1 })} ${unidades[i]}`;
}

/* ---- IndexedDB: que lo subido sobreviva a un F5 -------------------------- */

const BASE = 'alovida-mock-resultados-de-laboratorio';
const ALMACEN = 'archivos';

function abrirBase(): Promise<IDBDatabase> | null {
  if (typeof indexedDB === 'undefined') return null;
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BASE, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(ALMACEN);
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

function guardarEnDisco(id: string, bytes: Blob): void {
  abrirBase()
    ?.then((base) => {
      const tx = base.transaction(ALMACEN, 'readwrite');
      tx.objectStore(ALMACEN).put(bytes, id);
      tx.oncomplete = () => base.close();
      tx.onerror = () => base.close();
    })
    .catch(() => undefined);
}

function leerDeDisco(id: string): Promise<Blob | undefined> {
  const base = abrirBase();
  if (base === null) return Promise.resolve(undefined);
  return base
    .then(
      (db) =>
        new Promise<Blob | undefined>((resolve) => {
          const pedido = db.transaction(ALMACEN, 'readonly').objectStore(ALMACEN).get(id);
          pedido.onsuccess = () => {
            db.close();
            resolve(pedido.result instanceof Blob ? pedido.result : undefined);
          };
          pedido.onerror = () => {
            db.close();
            resolve(undefined);
          };
        }),
    )
    .catch(() => undefined);
}

/* ---- rutas --------------------------------------------------------------- */

export function registrarPortalDeLaboratorio(router: MockRouter): void {
  /* servicios */

  router.get('/diagnostics/lab/services', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden('Sólo el personal de un laboratorio ve su catálogo.');
    const q = texto(request.query, 'q');
    const categoryId = texto(request.query, 'categoryId');
    const status = texto(request.query, 'status');
    const available = texto(request.query, 'available');
    const items = serviciosDeLaboratorio
      .filtrar((s) => s.tenantId === tenantId)
      .filter((s) => q === null || contiene(s.name, q) || contiene(s.code, q))
      .filter((s) => categoryId === null || s.categoryId === categoryId)
      .filter((s) => (status === null ? s.status !== 'WITHDRAWN' : s.status === status))
      .filter((s) => available === null || String(s.available) === available)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map(servicioDeRespuesta);
    return { items, count: items.length };
  });

  router.post('/diagnostics/lab/services', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const datos = cuerpo<LabServiceDraft>(request);
    const problema = problemaDe(tenantId, datos, false, null);
    if (problema !== null) return validation(problema);
    const nuevo = serviciosDeLaboratorio.agregar(servicioNuevo(tenantId, datos as LabServiceDraft));
    anotar(tenantId, 'SERVICE_CREATED', `Dio de alta «${nuevo.name}».`);
    return reply(201, servicioDeRespuesta(nuevo));
  });

  router.post('/diagnostics/lab/services/import', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const datos = cuerpo<{ mode: LabImportMode; rows: LabImportRow[] }>(request);
    const mode = datos.mode ?? 'CREATE_OR_UPDATE';
    const rows = datos.rows ?? [];
    if (rows.length === 0) return validation('El archivo no trae filas.');
    if (rows.length > 2000) return validation('Hasta 2000 filas por archivo.');
    const resultados: LabImportRowResult[] = [];
    const vistos = new Set<string>();
    for (const fila of rows) {
      const code = (fila.service?.code ?? '').trim();
      const rechazo = (reason: string) =>
        resultados.push({ line: fila.line, code, outcome: 'REJECTED', reason });
      if (vistos.has(code.toLowerCase())) {
        rechazo('El código se repite más arriba en el mismo archivo.');
        continue;
      }
      vistos.add(code.toLowerCase());
      const existente = serviciosDeLaboratorio.filtrar(
        (s) => s.tenantId === tenantId && s.code.toLowerCase() === code.toLowerCase(),
      )[0];
      if (existente === undefined) {
        if (mode === 'UPDATE_ONLY') {
          rechazo('No existe un servicio con ese código y el modo es «sólo actualizar».');
          continue;
        }
        const problema = problemaDe(tenantId, fila.service, false, null);
        if (problema !== null) {
          rechazo(problema);
          continue;
        }
        serviciosDeLaboratorio.agregar(servicioNuevo(tenantId, fila.service));
        resultados.push({ line: fila.line, code, outcome: 'CREATED', reason: null });
        continue;
      }
      const problema = problemaDe(tenantId, fila.service, true, existente.id);
      if (problema !== null) {
        rechazo(problema);
        continue;
      }
      const cambios = cambiosDe(fila.service);
      // Un retirado que vuelve en el archivo, vuelve publicado.
      if (existente.status === 'WITHDRAWN' && cambios.status === undefined) {
        (cambios as Record<string, unknown>)['status'] = 'PUBLISHED';
      }
      if (sinCambios(existente, cambios)) {
        resultados.push({ line: fila.line, code, outcome: 'UNCHANGED', reason: null });
        continue;
      }
      serviciosDeLaboratorio.actualizar(existente.id, { ...cambios, updatedAt: ahora() });
      resultados.push({ line: fila.line, code, outcome: 'UPDATED', reason: null });
    }
    const cuenta = (o: LabImportRowResult['outcome']) => resultados.filter((r) => r.outcome === o).length;
    const creados = cuenta('CREATED');
    const actualizados = cuenta('UPDATED');
    if (creados + actualizados > 0) {
      anotar(
        tenantId,
        'SERVICES_IMPORTED',
        `Importó un archivo: ${creados} servicios nuevos y ${actualizados} actualizados.`,
      );
    }
    return {
      created: creados,
      updated: actualizados,
      unchanged: cuenta('UNCHANGED'),
      rejected: cuenta('REJECTED'),
      rows: resultados,
    };
  });

  router.patch('/diagnostics/lab/services/:id', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const s = serviciosDeLaboratorio.get(request.params['id']!);
    if (s === undefined || s.tenantId !== tenantId) return notFound('Servicio no encontrado');
    const datos = cuerpo<LabServiceDraft & { status: LabServiceStatus }>(request);
    const problema = problemaDe(tenantId, datos, true, s.id);
    if (problema !== null) return validation(problema);
    const actualizado = serviciosDeLaboratorio.actualizar(s.id, { ...cambiosDe(datos), updatedAt: ahora() })!;
    anotar(tenantId, 'SERVICE_UPDATED', `Actualizó «${actualizado.name}».`);
    return servicioDeRespuesta(actualizado);
  });

  router.delete('/diagnostics/lab/services/:id', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const s = serviciosDeLaboratorio.get(request.params['id']!);
    if (s === undefined || s.tenantId !== tenantId) return notFound('Servicio no encontrado');
    const retirado = serviciosDeLaboratorio.actualizar(s.id, { status: 'WITHDRAWN', updatedAt: ahora() })!;
    anotar(tenantId, 'SERVICE_WITHDRAWN', `Retiró «${retirado.name}».`);
    return servicioDeRespuesta(retirado);
  });

  /* categorías */

  router.get('/diagnostics/lab/categories', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const items = categoriasDeLaboratorio
      .filtrar((c) => c.tenantId === tenantId)
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map(categoriaDeRespuesta);
    return { items, count: items.length };
  });

  function nombreValido(tenantId: string, nombre: string | undefined, propioId: string | null) {
    const n = (nombre ?? '').trim();
    if (n === '') return { problema: 'Falta el nombre de la categoría.' };
    if (n.length > 60) return { problema: 'El nombre no puede pasar de 60 caracteres.' };
    const repetida = categoriasDeLaboratorio.filtrar(
      (c) => c.tenantId === tenantId && c.id !== propioId && c.name.toLowerCase() === n.toLowerCase(),
    );
    if (repetida.length > 0) return { repetida: `Ya existe la categoría «${n}».` };
    return { nombre: n };
  }

  router.post('/diagnostics/lab/categories', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const r = nombreValido(tenantId, cuerpo<{ name: string }>(request).name, null);
    if (r.problema !== undefined) return validation(r.problema);
    if (r.repetida !== undefined) return conflict(r.repetida);
    const nueva = categoriasDeLaboratorio.agregar({ id: nuevoId('lab-category'), tenantId, name: r.nombre! });
    return reply(201, categoriaDeRespuesta(nueva));
  });

  router.patch('/diagnostics/lab/categories/:id', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const c = categoriasDeLaboratorio.get(request.params['id']!);
    if (c === undefined || c.tenantId !== tenantId) return notFound('Categoría no encontrada');
    const r = nombreValido(tenantId, cuerpo<{ name: string }>(request).name, c.id);
    if (r.problema !== undefined) return validation(r.problema);
    if (r.repetida !== undefined) return conflict(r.repetida);
    return categoriaDeRespuesta(categoriasDeLaboratorio.actualizar(c.id, { name: r.nombre! })!);
  });

  router.delete('/diagnostics/lab/categories/:id', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const c = categoriasDeLaboratorio.get(request.params['id']!);
    if (c === undefined || c.tenantId !== tenantId) return notFound('Categoría no encontrada');
    const enUso = categoriaDeRespuesta(c).serviceCount;
    if (enUso > 0) {
      return conflict(`«${c.name}» tiene ${enUso} servicios. Muévalos a otra categoría antes de borrarla.`);
    }
    categoriasDeLaboratorio.borrar(c.id);
    return { ok: true };
  });

  /* resumen */

  router.get('/diagnostics/lab/summary', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const servicios = serviciosDeLaboratorio.filtrar((s) => s.tenantId === tenantId);
    const vigentes = servicios.filter((s) => s.status !== 'WITHDRAWN');
    const archivos = resultadosDeLaboratorio.filtrar((r) => r.tenantId === tenantId && r.status === 'AVAILABLE');
    const conResultado = new Set(archivos.map((r) => r.orderId));
    const ordenes = labInboxOrders.filtrar((o) => o.performerTenantId === tenantId);
    const porCategoria = new Map<string, number>();
    for (const s of vigentes) {
      const nombre =
        s.categoryId === null ? 'Sin categoría' : (categoriasDeLaboratorio.get(s.categoryId)?.name ?? 'Sin categoría');
      porCategoria.set(nombre, (porCategoria.get(nombre) ?? 0) + 1);
    }
    const recientes = [
      ...actividad.filtrar((a) => a.tenantId === tenantId),
      // Lo subido también es actividad, incluidos los sembrados.
      ...resultadosDeLaboratorio
        .filtrar((r) => r.tenantId === tenantId)
        .map((r) => ({
          id: `upload-${r.id}`,
          tenantId,
          at: r.uploadedAt,
          kind: 'RESULT_UPLOADED' as const,
          text: `Se subió ${r.fileName} (${tamanoLegible(r.sizeBytes)}).`,
        })),
    ]
      // Desempate determinista por id: dos entradas del mismo milisegundo no
      // pueden cambiar de orden entre una lectura y la siguiente.
      .sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id))
      .slice(0, 8)
      .map(({ tenantId: _t, ...resto }) => resto);
    return {
      labName: TENANT_NAMES[tenantId] ?? 'Su laboratorio',
      published: servicios.filter((s) => s.status === 'PUBLISHED').length,
      drafts: servicios.filter((s) => s.status === 'DRAFT').length,
      withdrawn: servicios.filter((s) => s.status === 'WITHDRAWN').length,
      unavailable: vigentes.filter((s) => !s.available).length,
      ordersWithoutResults: ordenes.filter((o) => !conResultado.has(o.id)).length,
      resultFiles: archivos.length,
      resultBytes: archivos.reduce((total, r) => total + r.sizeBytes, 0),
      byCategory: [...porCategoria]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category, 'es')),
      recentActivity: recientes,
    };
  });

  /* resultados */

  router.get('/diagnostics/lab/result-targets', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const items = labInboxOrders
      .filtrar((o) => o.performerTenantId === tenantId)
      .map((o) => {
        const destino = destinoDeOrden(o.id)!;
        return {
          orderId: o.id,
          studyName: destino.studyName,
          patientName: destino.patientName,
          requesterName: destino.requesterName,
          requestedAt: o.requestedAt,
          fileCount: resultadosDeLaboratorio.filtrar((r) => r.orderId === o.id && r.status === 'AVAILABLE').length,
        };
      })
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
    return { items, count: items.length };
  });

  router.get('/diagnostics/lab/result-files', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden('Sólo el personal del laboratorio ve sus resultados.');
    const q = texto(request.query, 'q');
    const kind = texto(request.query, 'kind');
    const orderId = texto(request.query, 'orderId');
    const conRetirados = request.query.get('includeWithdrawn') === 'true';
    const items = resultadosDeLaboratorio
      .filtrar((r) => r.tenantId === tenantId)
      .filter((r) => conRetirados || r.status === 'AVAILABLE')
      .filter((r) => kind === null || r.kind === kind)
      .filter((r) => orderId === null || r.orderId === orderId)
      .map(resultadoDeRespuesta)
      .filter(
        (r) =>
          q === null ||
          contiene(r.fileName, q) ||
          contiene(r.patientName, q) ||
          contiene(r.orderLabel, q) ||
          contiene(r.note, q),
      )
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt) || a.id.localeCompare(b.id));
    return {
      items,
      count: items.length,
      totalBytes: items.reduce((total, r) => total + r.sizeBytes, 0),
    };
  });

  router.post('/diagnostics/lab/result-uploads', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const datos = cuerpo<{
      fileName: string;
      contentType: string;
      sizeBytes: number;
      orderId: string | null;
      note: string | null;
      notify: boolean;
    }>(request);
    const fileName = (datos.fileName ?? '').trim();
    if (fileName === '') return validation('Falta el nombre del archivo.');
    const size = datos.sizeBytes;
    // Sin tope de tamaño a propósito: el pedido del propietario es «sin
    // límites». Sólo se exige que sea un número de bytes con sentido.
    if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0) {
      return validation('El tamaño del archivo no es válido.');
    }
    const orderId = datos.orderId ?? null;
    if (orderId !== null) {
      const orden = labInboxOrders.get(orderId);
      if (orden === undefined || orden.performerTenantId !== tenantId) {
        return validation('La orden elegida no es de este laboratorio.');
      }
    }
    const uploadId = nuevoId('lab-upload');
    const totalParts = Math.max(1, Math.ceil(size / TAMANO_DE_PARTE));
    subidas.set(uploadId, {
      tenantId,
      userName: request.user?.displayName.split(' · ')[0] ?? 'Laboratorio',
      fileName,
      contentType: (datos.contentType ?? '').trim(),
      sizeBytes: size,
      orderId,
      note: limpio(datos.note),
      notify: datos.notify === true && orderId !== null,
      totalParts,
      partes: new Map(),
    });
    return reply(201, { uploadId, chunkSizeBytes: TAMANO_DE_PARTE, totalParts, receivedParts: [] });
  });

  router.put('/diagnostics/lab/result-uploads/:uploadId/parts/:index', (request) => {
    const subida = subidas.get(request.params['uploadId']!);
    if (subida === undefined || subida.tenantId !== laboratorioDe(request)) {
      return notFound('La subida no existe o ya se cerró.');
    }
    const index = Number(request.params['index']);
    if (!Number.isInteger(index) || index < 0 || index >= subida.totalParts) {
      return validation(`La parte ${request.params['index']} está fuera de rango.`);
    }
    const parte = request.body;
    if (typeof Blob === 'undefined' || !(parte instanceof Blob)) {
      return validation('La parte tiene que viajar como bytes.');
    }
    const esperado =
      index < subida.totalParts - 1
        ? TAMANO_DE_PARTE
        : subida.sizeBytes - TAMANO_DE_PARTE * (subida.totalParts - 1);
    if (parte.size !== esperado) {
      return validation(`La parte ${index} trae ${parte.size} bytes y se esperaban ${esperado}.`);
    }
    subida.partes.set(index, parte);
    return noContent();
  });

  router.post('/diagnostics/lab/result-uploads/:uploadId/complete', (request) => {
    const uploadId = request.params['uploadId']!;
    const subida = subidas.get(uploadId);
    if (subida === undefined || subida.tenantId !== laboratorioDe(request)) {
      return notFound('La subida no existe o ya se cerró.');
    }
    const faltan = Array.from({ length: subida.totalParts }, (_, i) => i).filter(
      (i) => !subida.partes.has(i) && subida.sizeBytes > 0,
    );
    if (faltan.length > 0) {
      return conflict(`Faltan ${faltan.length} partes del archivo.`, { missingParts: faltan });
    }
    const bytes = new Blob(
      Array.from({ length: subida.totalParts }, (_, i) => subida.partes.get(i)).filter(
        (p): p is Blob => p !== undefined,
      ),
      { type: subida.contentType || 'application/octet-stream' },
    );
    subidas.delete(uploadId);
    const nuevo = resultadosDeLaboratorio.agregar({
      id: nuevoId('lab-result'),
      tenantId: subida.tenantId,
      fileName: subida.fileName,
      contentType: subida.contentType,
      sizeBytes: bytes.size,
      kind: tipoDeResultado(subida.fileName, subida.contentType),
      uploadedAt: ahora(),
      uploadedBy: subida.userName,
      orderId: subida.orderId,
      note: subida.note,
      notified: subida.notify,
      status: 'AVAILABLE',
      withdrawnReason: null,
    });
    bytesEnMemoria.set(nuevo.id, bytes);
    guardarEnDisco(nuevo.id, bytes);
    if (subida.notify && subida.orderId !== null) {
      avisarResultado(subida.tenantId, subida.orderId, subida.fileName);
    }
    return reply(201, resultadoDeRespuesta(nuevo));
  });

  router.delete('/diagnostics/lab/result-uploads/:uploadId', (request) => {
    const uploadId = request.params['uploadId']!;
    const subida = subidas.get(uploadId);
    if (subida !== undefined && subida.tenantId === laboratorioDe(request)) {
      subidas.delete(uploadId);
    }
    return noContent();
  });

  router.get('/diagnostics/lab/result-files/:id/content', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const r = resultadosDeLaboratorio.get(request.params['id']!);
    if (r === undefined || r.tenantId !== tenantId) return notFound('Archivo no encontrado');
    const cabeceras = {
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(r.fileName)}`,
    };
    if (r.semilla !== undefined) {
      return { status: 200, body: bytesSembrados({ semilla: r.semilla, fileName: r.fileName, orderId: r.orderId }), headers: cabeceras };
    }
    const enMemoria = bytesEnMemoria.get(r.id);
    if (enMemoria !== undefined) return { status: 200, body: enMemoria, headers: cabeceras };
    // Después de un F5 la memoria está vacía: se busca la copia de IndexedDB.
    return leerDeDisco(r.id).then((guardado) => {
      if (guardado === undefined) {
        return notFound('Los bytes de este archivo no están en este navegador (la maqueta no tiene servidor).');
      }
      bytesEnMemoria.set(r.id, guardado);
      return { status: 200, body: guardado, headers: cabeceras };
    });
  });

  router.post('/diagnostics/lab/result-files/:id/withdrawal', (request) => {
    const tenantId = laboratorioDe(request);
    if (tenantId === null) return forbidden();
    const r = resultadosDeLaboratorio.get(request.params['id']!);
    if (r === undefined || r.tenantId !== tenantId) return notFound('Archivo no encontrado');
    const motivo = (cuerpo<{ reason: string }>(request).reason ?? '').trim();
    if (motivo === '') return validation('Cuente por qué retira el archivo.');
    if (r.status === 'WITHDRAWN') return conflict('El archivo ya estaba retirado.');
    const retirado = resultadosDeLaboratorio.actualizar(r.id, { status: 'WITHDRAWN', withdrawnReason: motivo })!;
    anotar(tenantId, 'RESULT_WITHDRAWN', `Retiró ${r.fileName}: ${motivo}`);
    return resultadoDeRespuesta(retirado);
  });
}

/** Avisa al médico que pidió el estudio y al paciente (registro de procesos §2.1.9). */
function avisarResultado(tenantId: string, orderId: string, fileName: string): void {
  const destino = destinoDeOrden(orderId);
  if (destino === undefined) return;
  const laboratorio = TENANT_NAMES[tenantId] ?? 'El laboratorio';
  if (destino.patientUserId !== null) {
    emitirNotificacion({
      userId: destino.patientUserId,
      category: 'CLINICAL',
      subject: `Su resultado de ${destino.studyName} está listo`,
      bodyText: `${laboratorio} subió ${fileName}. Ya lo puede ver en sus resultados.`,
      destination: { type: 'DIAGNOSTIC_ORDER', id: orderId },
    });
  }
  if (destino.requesterUserId !== null) {
    emitirNotificacion({
      userId: destino.requesterUserId,
      category: 'CLINICAL',
      subject: `Resultado de ${destino.studyName} de ${destino.patientName}`,
      bodyText: `${laboratorio} subió ${fileName} para la orden que pidió.`,
      destination: { type: 'DIAGNOSTIC_ORDER', id: orderId },
    });
  }
}

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. Los bytes
   de lo subido van aparte, en IndexedDB (ver `guardarEnDisco`). */
categoriasDeLaboratorio.persistirEn('mock.lab-portal.categorias');
serviciosDeLaboratorio.persistirEn('mock.lab-portal.servicios');
resultadosDeLaboratorio.persistirEn('mock.lab-portal.resultados');
actividad.persistirEn('mock.lab-portal.actividad');
