import { HttpHeaders } from '@angular/common/http';

import { crearRouterSimulado } from './index';
import { TAMANO_DE_PARTE, tipoDeResultado } from './lab-portal.handlers';
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

  it('una cuenta que no es de laboratorio no ve nada (403)', () => {
    expect(estado(pedir('GET', '/diagnostics/lab/result-files', {}, farmacia))).toBe(403);
    expect(estado(pedir('POST', '/diagnostics/lab/result-uploads', { fileName: 'x.pdf', contentType: '', sizeBytes: 1 }, farmacia))).toBe(403);
  });

  it('sube un archivo de más de una parte, sin tope, y lo devuelve entero', async () => {
    const targets = cuerpo<{ items: { orderId: string }[] }>(pedir('GET', '/diagnostics/lab/result-targets'));
    const orderId = targets.items[0]!.orderId;
    const size = TAMANO_DE_PARTE * 2 + 1234;
    const datos = new Uint8Array(size).map((_, i) => i % 251);
    const archivo = new Blob([datos], { type: 'video/mp4' });

    const sesion = cuerpo<{ uploadId: string; totalParts: number; chunkSizeBytes: number }>(
      pedir('POST', '/diagnostics/lab/result-uploads', {
        fileName: 'ecografia.mp4',
        contentType: 'video/mp4',
        sizeBytes: size,
        orderId,
        notify: true,
      }),
    );
    expect(sesion.totalParts).toBe(3);

    // Completar antes de mandar todo es un conflicto: faltan partes.
    expect(estado(pedir('POST', `/diagnostics/lab/result-uploads/${sesion.uploadId}/complete`))).toBe(409);

    for (let i = 0; i < sesion.totalParts; i++) {
      const parte = archivo.slice(i * sesion.chunkSizeBytes, (i + 1) * sesion.chunkSizeBytes);
      expect(estado(pedir('PUT', `/diagnostics/lab/result-uploads/${sesion.uploadId}/parts/${i}`, parte))).toBe(204);
    }
    const hecho = pedir('POST', `/diagnostics/lab/result-uploads/${sesion.uploadId}/complete`);
    expect(estado(hecho)).toBe(201);
    const file = cuerpo<{ id: string; kind: string; sizeBytes: number; notified: boolean; orderId: string }>(hecho);
    expect(file).toMatchObject({ kind: 'VIDEO', sizeBytes: size, notified: true, orderId });

    const contenido = (pedir('GET', `/diagnostics/lab/result-files/${file.id}/content`) as { body: Blob }).body;
    const vuelta = new Uint8Array(await contenido.arrayBuffer());
    expect(vuelta.length).toBe(size);
    expect(vuelta[size - 1]).toBe(datos[size - 1]);

    const lista = cuerpo<{ items: { id: string }[] }>(pedir('GET', '/diagnostics/lab/result-files'));
    expect(lista.items[0]!.id).toBe(file.id);
  });

  it('rechaza una parte de tamaño equivocado o fuera de rango', () => {
    const sesion = cuerpo<{ uploadId: string }>(
      pedir('POST', '/diagnostics/lab/result-uploads', { fileName: 'a.txt', contentType: 'text/plain', sizeBytes: 10 }),
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
        details: { violations: ['Contá por qué retirás el archivo.'] },
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
      { ...draft, categoryId: 'missing-category' },
      { ...draft, status: 'UNKNOWN' },
    ];
    for (const body of invalid) {
      expect(estado(pedir('POST', path, body))).toBe(400);
    }
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

  it('decide cómo mirar un archivo por extensión y, si no, por tipo', () => {
    expect(tipoDeResultado('informe.PDF', '')).toBe('PDF');
    expect(tipoDeResultado('rx.dcm', 'application/octet-stream')).toBe('DICOM');
    expect(tipoDeResultado('foto', 'image/jpeg')).toBe('IMAGE');
    expect(tipoDeResultado('placa.tiff', 'image/tiff')).toBe('OTHER');
    expect(tipoDeResultado('datos.hl7', '')).toBe('TEXT');
    expect(tipoDeResultado('estudio.zip', 'application/zip')).toBe('OTHER');
  });
});
