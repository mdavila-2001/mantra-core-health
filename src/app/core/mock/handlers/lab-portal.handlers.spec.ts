import { HttpHeaders } from '@angular/common/http';

import { crearRouterSimulado } from './index';
import { labInboxOrders } from './diagnostics.handlers';
import { estadosDeOrden } from './lab-orders.handlers';
import { TAMANO_DE_PARTE, tipoDeResultado } from './lab-portal.handlers';
import { orderList } from '../fixtures/clinic';
import { ORDER_CATEGORY } from '../fixtures/concepts';
import { buscarUsuario, TENANT_LABORATORIO } from '../mock-session';
import { isMockReply, type MockMethod, type MockRequest } from '../mock-router';

/**
 * El simulador del portal del laboratorio (P52): los resultados se suben por
 * partes y sin tope de tamaño, se listan todos, se leen de vuelta byte a byte y
 * sólo los ve el personal del laboratorio.
 */
describe('handlers del portal de laboratorio', () => {
  const router = crearRouterSimulado();
  const laboratorio = buscarUsuario('laboratorio')!;
  const farmacia = buscarUsuario('farmacia')!;

  function pedir(
    method: MockMethod,
    path: string,
    body: unknown = {},
    user = laboratorio,
    query = new URLSearchParams(),
  ) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query,
      body,
      headers: new HttpHeaders({ 'X-Tenant-Id': user.tenants[0]! }),
      user,
    } satisfies MockRequest);
  }

  const estado = (r: unknown) => (isMockReply(r) ? r.status : 200);
  const cuerpo = <T>(r: unknown) => (isMockReply(r) ? r.body : r) as T;

  it('lista los resultados sembrados, con paciente y orden resueltos', () => {
    const page = cuerpo<{ items: { patientName: string | null; orderLabel: string | null }[]; count: number; totalBytes: number }>(
      pedir('GET', '/diagnostics/lab/result-files'),
    );
    expect(page.count).toBeGreaterThanOrEqual(6);
    expect(page.totalBytes).toBeGreaterThan(0);
    expect(page.items.every((i) => i.patientName !== null && i.orderLabel !== null)).toBe(true);
  });

  it('las órdenes se paginan como la API: count es el total y nextCursor lleva a la siguiente página', () => {
    interface Pagina {
      items: { orderId: string }[];
      count: number;
      nextCursor?: string;
    }
    const todas = cuerpo<Pagina>(pedir('GET', '/diagnostics/lab/orders'));
    expect(todas.nextCursor).toBeUndefined();
    expect(todas.count).toBe(todas.items.length);

    const primera = cuerpo<Pagina>(pedir('GET', '/diagnostics/lab/orders', {}, laboratorio, new URLSearchParams({ limit: '2' })));
    expect(primera.items).toHaveLength(2);
    expect(primera.count).toBe(todas.count);
    expect(primera.nextCursor).toBeDefined();

    const segunda = cuerpo<Pagina>(
      pedir('GET', '/diagnostics/lab/orders', {}, laboratorio, new URLSearchParams({ limit: '2', cursor: primera.nextCursor! })),
    );
    expect([...primera.items, ...segunda.items].map((o) => o.orderId)).toEqual(todas.items.slice(0, 4).map((o) => o.orderId));
  });

  it('una cuenta que no es de laboratorio no ve nada (403)', () => {
    expect(estado(pedir('GET', '/diagnostics/lab/result-files', {}, farmacia))).toBe(403);
    expect(estado(pedir('POST', '/diagnostics/lab/result-uploads', { fileName: 'x.pdf', contentType: '', sizeBytes: 1 }, farmacia))).toBe(403);
  });

  it('sube un archivo de más de una parte y lo devuelve entero', async () => {
    // Los resultados sólo se suben a una orden ya procesada (31/10/2026).
    const ordenes = cuerpo<{ items: { orderId: string; status: string }[] }>(pedir('GET', '/diagnostics/lab/orders'));
    const orderId = ordenes.items.find((o) => o.status === 'UPLOADED')!.orderId;
    // Within the API limit (10 MB), but larger than one part.
    const size = TAMANO_DE_PARTE + 1234;
    const datos = new Uint8Array(size).map((_, i) => i % 251);
    const archivo = new Blob([datos], { type: 'application/pdf' });

    const sesion = cuerpo<{ uploadId: string; totalParts: number; chunkSizeBytes: number }>(
      pedir('POST', '/diagnostics/lab/result-uploads', {
        fileName: 'ecografia.pdf',
        contentType: 'application/pdf',
        sizeBytes: size,
        orderId,
        notify: true,
      }),
    );
    expect(sesion.totalParts).toBe(2);

    // Completar antes de mandar todo es un conflicto: faltan partes.
    expect(estado(pedir('POST', `/diagnostics/lab/result-uploads/${sesion.uploadId}/complete`))).toBe(409);

    for (let i = 0; i < sesion.totalParts; i++) {
      const parte = archivo.slice(i * sesion.chunkSizeBytes, (i + 1) * sesion.chunkSizeBytes);
      expect(estado(pedir('PUT', `/diagnostics/lab/result-uploads/${sesion.uploadId}/parts/${i}`, parte))).toBe(204);
    }
    const hecho = pedir('POST', `/diagnostics/lab/result-uploads/${sesion.uploadId}/complete`);
    expect(estado(hecho)).toBe(201);
    const file = cuerpo<{ id: string; kind: string; sizeBytes: number; notified: boolean; orderId: string }>(hecho);
    // The API does not notify yet: `notified` is always false.
    expect(file).toMatchObject({ kind: 'PDF', sizeBytes: size, notified: false, orderId });

    const contenido = (pedir('GET', `/diagnostics/lab/result-files/${file.id}/content`) as { body: Blob }).body;
    const vuelta = new Uint8Array(await contenido.arrayBuffer());
    expect(vuelta.length).toBe(size);
    expect(vuelta[size - 1]).toBe(datos[size - 1]);

    const lista = cuerpo<{ items: { id: string }[] }>(pedir('GET', '/diagnostics/lab/result-files'));
    expect(lista.items[0]!.id).toBe(file.id);
  });

  it('como la API: sin orden, de más de 10 MB o de un tipo no admitido, no se sube', () => {
    const ordenes = cuerpo<{ items: { orderId: string; status: string }[] }>(pedir('GET', '/diagnostics/lab/orders'));
    const orderId = ordenes.items.find((o) => o.status === 'UPLOADED')!.orderId;
    const subir = (extra: object) =>
      pedir('POST', '/diagnostics/lab/result-uploads', { fileName: 'a.pdf', contentType: 'application/pdf', sizeBytes: 10, orderId, ...extra });
    expect(estado(subir({ orderId: undefined }))).toBe(400);
    expect(estado(subir({ sizeBytes: 10 * 1024 * 1024 + 1 }))).toBe(422);
    expect(estado(subir({ fileName: 'eco.mp4', contentType: 'video/mp4' }))).toBe(422);
    expect(estado(subir({ fileName: 'rx.dcm', contentType: 'application/dicom' }))).toBe(422);
    expect(estado(subir({}))).toBe(201);
  });

  it('la búsqueda por texto va por POST /search; en la URL es un 400', () => {
    expect(estado(pedir('GET', '/diagnostics/lab/result-files', {}, laboratorio, new URLSearchParams({ q: 'a' })))).toBe(400);
    const todos = cuerpo<{ count: number }>(pedir('GET', '/diagnostics/lab/result-files'));
    const nada = cuerpo<{ count: number }>(pedir('POST', '/diagnostics/lab/result-files/search', { q: 'no-existe-zzz' }));
    const sinTexto = cuerpo<{ count: number }>(pedir('POST', '/diagnostics/lab/result-files/search', {}));
    expect(nada.count).toBe(0);
    expect(sinTexto.count).toBe(todos.count);
  });

  it('rechaza una parte de tamaño equivocado o fuera de rango', () => {
    const ordenes = cuerpo<{ items: { orderId: string; status: string }[] }>(pedir('GET', '/diagnostics/lab/orders'));
    const orderId = ordenes.items.find((o) => o.status === 'UPLOADED')!.orderId;
    const sesion = cuerpo<{ uploadId: string }>(
      pedir('POST', '/diagnostics/lab/result-uploads', { fileName: 'a.txt', contentType: 'text/plain', sizeBytes: 10, orderId }),
    );
    expect(pedir('PUT', `/diagnostics/lab/result-uploads/${sesion.uploadId}/parts/0`, new Blob(['corto'])))
      .toMatchObject({
        status: 400,
        body: {
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          details: { violations: ['La parte 0 trae 5 bytes y se esperaban 10.'] },
        },
      });
    expect(pedir('PUT', `/diagnostics/lab/result-uploads/${sesion.uploadId}/parts/1`, new Blob(['0123456789'])))
      .toMatchObject({
        status: 400,
        body: {
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          details: { violations: ['La parte 1 está fuera de rango.'] },
        },
      });
    expect(estado(pedir('POST', `/diagnostics/lab/result-uploads/${sesion.uploadId}/complete`))).toBe(409);
  });

  it('retirar exige motivo, y el retirado sale de la lista salvo que se pida', () => {
    const [primero] = cuerpo<{ items: { id: string }[] }>(pedir('GET', '/diagnostics/lab/result-files')).items;
    const ruta = `/diagnostics/lab/result-files/${primero!.id}/withdrawal`;
    const before = pedir('GET', '/diagnostics/lab/result-files');
    expect(pedir('POST', ruta, { reason: '' })).toMatchObject({
      status: 400,
      body: {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        details: { violations: ['Cuente por qué retira el archivo.'] },
      },
    });
    expect(pedir('GET', '/diagnostics/lab/result-files')).toEqual(before);
    expect(estado(pedir('POST', ruta, { reason: 'Era de otro paciente' }))).toBe(200);
    const sinRetirados = cuerpo<{ items: { id: string }[] }>(pedir('GET', '/diagnostics/lab/result-files'));
    expect(sinRetirados.items.some((i) => i.id === primero!.id)).toBe(false);
    const conRetirados = cuerpo<{ items: { id: string }[] }>(
      pedir('GET', '/diagnostics/lab/result-files', {}, laboratorio, new URLSearchParams({ includeWithdrawn: 'true' })),
    );
    expect(conRetirados.items.some((i) => i.id === primero!.id)).toBe(true);
  });

  it('el resumen cuenta servicios y resultados del laboratorio', () => {
    const s = cuerpo<{ labName: string; published: number; resultFiles: number }>(pedir('GET', '/diagnostics/lab/summary'));
    expect(s.labName).toBe('Laboratorio Central');
    expect(s.published).toBeGreaterThan(0);
    expect(s.resultFiles).toBeGreaterThan(0);
    expect(TENANT_LABORATORIO).toBe(laboratorio.tenants[0]);
  });

  it('administra categorías y servicios con filtros, descuentos y retiro', () => {
    const categoryPath = '/diagnostics/lab/categories';
    const servicePath = '/diagnostics/lab/services';
    const category = cuerpo<{ id: string; name: string }>(
      pedir('POST', categoryPath, { name: '  Categoría de prueba  ' }),
    );
    expect(category.name).toBe('Categoría de prueba');
    expect(estado(pedir('POST', categoryPath, { name: 'categoría de prueba' }))).toBe(409);

    const draft = {
      code: 'QA-LAB-SERVICE',
      name: '  Estudio de prueba  ',
      categoryId: category.id,
      price: 120,
      alovidaDiscountPercent: 25,
      available: true,
    };
    const created = cuerpo<{ id: string; code: string; name: string; price: string; alovidaPrice: string; categoryName: string }>(
      pedir('POST', servicePath, draft),
    );
    expect(created).toMatchObject({
      code: draft.code,
      name: 'Estudio de prueba',
      price: '120.00',
      alovidaPrice: '90.00',
      categoryName: category.name,
    });
    expect(estado(pedir('POST', servicePath, { ...draft, code: draft.code.toLowerCase() }))).toBe(400);
    expect(estado(pedir('DELETE', `${categoryPath}/${category.id}`))).toBe(409);

    const filtered = cuerpo<{ items: { id: string }[]; count: number }>(
      pedir('GET', servicePath, {}, laboratorio, new URLSearchParams({
        q: 'estudio de prueba', categoryId: category.id, status: 'PUBLISHED', available: 'true',
      })),
    );
    expect(filtered).toMatchObject({ count: 1, items: [{ id: created.id }] });
    expect(cuerpo<{ count: number }>(
      pedir('GET', servicePath, {}, laboratorio, new URLSearchParams({ q: 'no existe' })),
    ).count).toBe(0);

    const updated = cuerpo<{ name: string; price: string; available: boolean; categoryName: string | null }>(
      pedir('PATCH', `${servicePath}/${created.id}`, {
        name: '  Estudio actualizado ', price: 100, available: false, categoryId: null,
        sampleType: ' Sangre ', preparation: '', description: ' Descripción ',
        turnaroundHours: 6, requiresMedicalOrder: true, homeCollection: true,
        alovidaDiscountPercent: null, status: 'DRAFT',
      }),
    );
    expect(updated).toMatchObject({ name: 'Estudio actualizado', price: '100.00', available: false, categoryName: null });
    expect(estado(pedir('DELETE', `${servicePath}/${created.id}`))).toBe(200);
    expect(cuerpo<{ items: { id: string }[] }>(pedir('GET', servicePath)).items.some((item) => item.id === created.id)).toBe(false);
    expect(cuerpo<{ items: { id: string }[] }>(
      pedir('GET', servicePath, {}, laboratorio, new URLSearchParams({ status: 'WITHDRAWN' })),
    ).items.some((item) => item.id === created.id)).toBe(true);
    expect(estado(pedir('DELETE', `${categoryPath}/${category.id}`))).toBe(200);
  });

  it('categorías como la API: duplicada 409, borrar con servicios 409 con serviceCount, y el resumen trae el categoryId', () => {
    const categoryPath = '/diagnostics/lab/categories';
    const categorias = cuerpo<{ items: { id: string; name: string; serviceCount: number }[] }>(pedir('GET', categoryPath)).items;
    const conServicios = categorias.find((c) => c.serviceCount > 0)!;

    const repetida = pedir('POST', categoryPath, { name: conServicios.name });
    expect(estado(repetida)).toBe(409);
    expect(cuerpo<{ message: string }>(repetida).message).toBe(`Ya existe la categoría «${conServicios.name}».`);

    const borrar = pedir('DELETE', `${categoryPath}/${conServicios.id}`);
    expect(estado(borrar)).toBe(409);
    expect(cuerpo<{ message: string; details: { serviceCount: number } }>(borrar)).toMatchObject({
      message: `«${conServicios.name}» tiene ${conServicios.serviceCount} servicios. Muévalos a otra categoría antes de borrarla.`,
      details: { serviceCount: conServicios.serviceCount },
    });

    const { byCategory } = cuerpo<{ byCategory: { category: string; categoryId: string | null; count: number }[] }>(pedir('GET', '/diagnostics/lab/summary'));
    expect(byCategory.find((row) => row.category === conServicios.name)?.categoryId).toBe(conServicios.id);
    expect(byCategory.every((row) => row.categoryId === null || categorias.some((c) => c.id === row.categoryId))).toBe(true);
  });

  it('un servicio no disponible hoy se guarda tal cual (sin 422) y el tipo de muestra es texto libre', () => {
    const path = '/diagnostics/lab/services';
    const creado = cuerpo<{ id: string; available: boolean; sampleType: string | null }>(
      pedir('POST', path, { code: 'QA-NO-HOY', name: 'Estudio que hoy no se hace', price: 10, available: false, sampleType: 'Líquido pleural (tubo especial)' }),
    );
    expect(creado).toMatchObject({ available: false, sampleType: 'Líquido pleural (tubo especial)' });
    const vuelto = cuerpo<{ available: boolean }>(pedir('PATCH', `${path}/${creado.id}`, { available: true }));
    expect(vuelto.available).toBe(true);
    expect(estado(pedir('DELETE', `${path}/${creado.id}`))).toBe(200);
  });

  it('rechaza datos inválidos y acceso ajeno sin mutar el catálogo', () => {
    const path = '/diagnostics/lab/services';
    const draft = { code: 'QA-LAB-INVALID', name: 'Estudio sintético', price: 10 };
    const invalid = [
      { ...draft, code: '' },
      { ...draft, code: 'X'.repeat(41) },
      { ...draft, name: ' ' },
      { ...draft, price: 'no-price' },
      { ...draft, price: -1 },
      { ...draft, alovidaDiscountPercent: -1 },
      { ...draft, alovidaDiscountPercent: 101 },
      { ...draft, turnaroundHours: 1.5 },
      { ...draft, turnaroundHours: -1 },
      { ...draft, status: 'UNKNOWN' },
    ];
    for (const body of invalid) {
      expect(estado(pedir('POST', path, body))).toBe(400);
    }
    // A category that is not this lab's is a 422 with the API's message (the old simulator said 400).
    const foranea = pedir('POST', path, { ...draft, categoryId: 'missing-category' });
    expect(estado(foranea)).toBe(422);
    expect(cuerpo<{ message: string }>(foranea).message).toBe('La categoría no existe.');
    expect(estado(pedir('POST', path, draft, farmacia))).toBe(403);
    expect(estado(pedir('GET', '/diagnostics/lab/categories', {}, farmacia))).toBe(403);
    expect(estado(pedir('PATCH', `${path}/missing`, draft))).toBe(404);
    expect(estado(pedir('DELETE', `${path}/missing`))).toBe(404);
    expect(estado(pedir('PATCH', '/diagnostics/lab/categories/missing', { name: 'No existe' }))).toBe(404);
    expect(estado(pedir('DELETE', '/diagnostics/lab/categories/missing'))).toBe(404);
    expect(cuerpo<{ items: { code: string }[] }>(pedir('GET', path)).items.some((item) => item.code === draft.code)).toBe(false);
  });

  it('importa CSV con filas creadas, actualizadas, iguales y rechazadas', () => {
    const path = '/diagnostics/lab/services';
    const importPath = `${path}/import`;
    const draft = { code: 'QA-LAB-CSV', name: 'Servicio CSV', price: 42 };
    expect(estado(pedir('POST', importPath, { rows: [] }))).toBe(400);
    expect(estado(pedir('POST', importPath, { rows: Array(2001).fill({ line: 1, service: draft }) }))).toBe(400);
    expect(estado(pedir('POST', importPath, { mode: 'UPDATE_ONLY', rows: [{ line: 2, service: draft }] }))).toBe(200);

    const first = cuerpo<{ created: number; rejected: number; rows: { outcome: string }[] }>(
      pedir('POST', importPath, { rows: [
        { line: 2, service: draft },
        { line: 3, service: { ...draft, code: draft.code.toLowerCase() } },
        { line: 4, service: { code: 'QA-LAB-BAD', name: '', price: 5 } },
      ] }),
    );
    expect(first).toMatchObject({ created: 1, rejected: 2 });
    expect(first.rows.map((row) => row.outcome)).toEqual(['CREATED', 'REJECTED', 'REJECTED']);

    const unchanged = cuerpo<{ unchanged: number }>(
      pedir('POST', importPath, { rows: [{ line: 2, service: { code: draft.code } }] }),
    );
    expect(unchanged.unchanged).toBe(1);
    const updated = cuerpo<{ updated: number }>(
      pedir('POST', importPath, { rows: [{ line: 2, service: { code: draft.code, price: 55 } }] }),
    );
    expect(updated.updated).toBe(1);
    const created = cuerpo<{ items: { id: string; code: string; price: string }[] }>(
      pedir('GET', path, {}, laboratorio, new URLSearchParams({ q: draft.code })),
    ).items[0]!;
    expect(created.price).toBe('55.00');
    expect(estado(pedir('DELETE', `${path}/${created.id}`))).toBe(200);
    const restored = cuerpo<{ updated: number }>(
      pedir('POST', importPath, { rows: [{ line: 2, service: { code: draft.code } }] }),
    );
    expect(restored.updated).toBe(1);
    expect(cuerpo<{ items: { id: string }[] }>(pedir('GET', path)).items.some((item) => item.id === created.id)).toBe(true);
  });

  describe('órdenes: Borrador → Recibida → Procesada → Subidos', () => {
    interface Orden {
      orderId: string;
      status: string;
      reason: string | null;
      canReject?: boolean;
      files: { id: string; fileName: string }[];
    }
    const listar = () => cuerpo<{ items: Orden[]; count: number }>(pedir('GET', '/diagnostics/lab/orders'));
    const paso = (orderId: string, action: string, reason?: string, user = laboratorio) =>
      pedir('POST', `/diagnostics/lab/orders/${orderId}/transitions`, { action, reason }, user);
    const estadoDe = (orderId: string) => listar().items.find((o) => o.orderId === orderId)!.status;

    /** Una orden sin archivos, puesta en el estado que la prueba necesita: cada prueba arma el suyo. */
    function ordenEn(status: 'DRAFT' | 'RECEIVED' | 'PROCESSED' | 'CANCELLED', indice: number): string {
      const libres = listar().items.filter((o) => o.files.length === 0 || o.status !== 'UPLOADED');
      const orden = libres[indice]!;
      estadosDeOrden.agregar({ id: orden.orderId, status, reason: null });
      return orden.orderId;
    }

    it('lista las órdenes con su estado, y la procesada con archivos figura como subida', () => {
      const { items, count } = listar();
      expect(count).toBe(items.length);
      expect(items.some((o) => o.status === 'UPLOADED')).toBe(true);
      for (const orden of items.filter((o) => o.status === 'UPLOADED')) {
        expect(orden.files.length).toBeGreaterThan(0);
      }
      for (const orden of items.filter((o) => o.status !== 'UPLOADED')) {
        expect(orden.files).toEqual([]);
      }
    });

    it('recibe y procesa una orden, y los dos pasos quedan al releer la lista', () => {
      const id = ordenEn('DRAFT', 0);

      expect(cuerpo<Orden>(paso(id, 'RECEIVE')).status).toBe('RECEIVED');
      expect(estadoDe(id)).toBe('RECEIVED');

      expect(cuerpo<Orden>(paso(id, 'PROCESS')).status).toBe('PROCESSED');
      expect(estadoDe(id)).toBe('PROCESSED');
    });

    it('un paso fuera de orden responde 409 y no cambia el estado', () => {
      const borrador = ordenEn('DRAFT', 0);
      const cancelada = ordenEn('CANCELLED', 1);

      expect(estado(paso(borrador, 'PROCESS'))).toBe(409);
      expect(estado(paso(cancelada, 'RECEIVE'))).toBe(409);
      expect(estado(paso(borrador, 'REJECT', 'Muestra insuficiente'))).toBe(409);
      expect(estadoDe(borrador)).toBe('DRAFT');
      expect(estadoDe(cancelada)).toBe('CANCELLED');
    });

    it('una orden sin procesar no admite resultados (409), y una procesada sí', () => {
      const subir = (orderId: string) =>
        pedir('POST', '/diagnostics/lab/result-uploads', {
          fileName: 'informe.pdf',
          contentType: 'application/pdf',
          sizeBytes: 3,
          orderId,
        });
      const id = ordenEn('RECEIVED', 0);
      expect(estado(subir(id))).toBe(409);

      expect(cuerpo<Orden>(paso(id, 'PROCESS')).status).toBe('PROCESSED');
      const sesion = cuerpo<{ uploadId: string }>(subir(id));
      expect(estado(pedir('PUT', `/diagnostics/lab/result-uploads/${sesion.uploadId}/parts/0`, new Blob(['abc'])))).toBe(204);
      expect(estado(pedir('POST', `/diagnostics/lab/result-uploads/${sesion.uploadId}/complete`))).toBe(201);
      expect(estadoDe(id)).toBe('UPLOADED');
    });

    /** A laboratory order of the sample data (they all are), left in `status`. */
    function ordenDeLaboratorio(status: 'DRAFT' | 'RECEIVED' | 'PROCESSED'): string {
      const orden = listar().items.find((o) => o.files.length === 0 || o.status !== 'UPLOADED')!;
      estadosDeOrden.agregar({ id: orden.orderId, status, reason: null });
      return orden.orderId;
    }

    it('rechazar una orden recibida con muestra funciona, con el motivo guardado, y deja de ofrecerse', () => {
      const id = ordenDeLaboratorio('RECEIVED');
      const rechazada = cuerpo<Orden>(paso(id, 'REJECT', 'Muestra insuficiente'));
      expect(rechazada.status).toBe('REJECTED');
      expect(rechazada.reason).toBe('Muestra insuficiente');
      expect(rechazada.canReject).toBe(false);
      expect(estadoDe(id)).toBe('REJECTED');
    });

    it('cancelar no existe para el laboratorio: la API responde 422 en cualquier estado y la orden no cambia', () => {
      for (const status of ['DRAFT', 'RECEIVED'] as const) {
        const id = ordenDeLaboratorio(status);
        expect(estado(paso(id, 'CANCEL', 'Pedida por error'))).toBe(422);
        expect(estadoDe(id)).toBe(status);
      }
    });

    it('rechazar una orden de imagenología (sin muestra) es un 422 y la orden no cambia', () => {
      // The sample inbox only has laboratory orders: one is turned into imaging for this test and restored.
      const id = ordenDeLaboratorio('RECEIVED');
      const original = labInboxOrders.get(id)!;
      labInboxOrders.agregar({ ...original, categoryConceptId: ORDER_CATEGORY['SRQ-IMAGING']! });
      try {
        const antes = listar().items.find((o) => o.orderId === id)!;
        expect(antes.canReject).toBe(false);
        expect(estado(paso(id, 'REJECT', 'Placa movida'))).toBe(422);
        expect(estadoDe(id)).toBe('RECEIVED');
      } finally {
        labInboxOrders.agregar(original);
      }
    });

    it('rechazar sin motivo es un 400, y un paso que el estado no admite es un 409 con el estado actual', () => {
      const borrador = ordenDeLaboratorio('DRAFT');
      expect(estado(paso(borrador, 'REJECT'))).toBe(400);
      expect(estado(paso(borrador, 'REJECT', '   '))).toBe(400);
      expect(estadoDe(borrador)).toBe('DRAFT');

      const procesada = ordenDeLaboratorio('PROCESSED');
      const rechazo = paso(procesada, 'REJECT', 'Tarde');
      expect(estado(rechazo)).toBe(409);
      expect(cuerpo<{ details: { currentStatus: string } }>(rechazo).details.currentStatus).toBe('PROCESSED');
    });

    it('rechaza un paso inventado y una cuenta ajena al laboratorio', () => {
      const id = ordenEn('DRAFT', 0);
      expect(estado(paso(id, 'ARCHIVE'))).toBe(400);
      expect(estado(pedir('GET', '/diagnostics/lab/orders', {}, farmacia))).toBe(403);
      expect(estado(paso(id, 'RECEIVE', undefined, farmacia))).toBe(403);
      expect(estado(paso('no-existe', 'RECEIVE'))).toBe(404);
      expect(estadoDe(id)).toBe('DRAFT');
    });
  });

  it('reservar una orden que el laboratorio canceló o rechazó es un 404 «Orden no encontrada»', () => {
    const paciente = buscarUsuario('paciente')!;
    const opciones = (orderId: string) => pedir('GET', `/diagnostic-results/me/orders/${orderId}/booking-options`, {}, paciente);
    const reservable = orderList.todos().find((o) => estado(opciones(o.id)) === 200);
    expect(reservable, 'una orden reservable del paciente de ejemplo').toBeDefined();
    const id = reservable!.id;

    estadosDeOrden.agregar({ id, status: 'RECEIVED', reason: null });
    expect(estado(opciones(id))).toBe(200);
    for (const status of ['CANCELLED', 'REJECTED'] as const) {
      estadosDeOrden.agregar({ id, status, reason: 'Motivo' });
      expect(estado(opciones(id))).toBe(404);
      expect(estado(pedir('POST', `/diagnostic-results/me/orders/${id}/booking`, { unitId: 'x', startAt: 'x' }, paciente))).toBe(404);
      expect(cuerpo<{ message: string }>(opciones(id)).message).toBe('Orden no encontrada');
    }
    estadosDeOrden.borrar(id);
  });

  it('decide cómo mirar un archivo por extensión y, si no, por tipo', () => {
    expect(tipoDeResultado('informe.PDF', '')).toBe('PDF');
    expect(tipoDeResultado('rx.dcm', 'application/octet-stream')).toBe('DICOM');
    expect(tipoDeResultado('foto', 'image/jpeg')).toBe('IMAGE');
    expect(tipoDeResultado('placa.tiff', 'image/tiff')).toBe('OTHER');
    expect(tipoDeResultado('datos.hl7', '')).toBe('TEXT');
    expect(tipoDeResultado('estudio.zip', 'application/zip')).toBe('OTHER');
  });
});
