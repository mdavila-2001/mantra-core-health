import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { wireDetail, wireMine, wirePage, wireRequirement, wireSummary } from '../../../../testing/admissions';
import { SessionStore } from '../../auth/session.store';
import { authInterceptor } from '../../http/auth.interceptor';
import { AdmissionsClient, DocumentLinkExpiredError, normalizeStatusCode } from './admissions.client';

function token(claims: Record<string, unknown>): string {
  const enc = (v: object): string => btoa(JSON.stringify(v)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${enc({ alg: 'none' })}.${enc(claims)}.x`;
}

describe('AdmissionsClient', () => {
  let client: AdmissionsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    client = TestBed.inject(AdmissionsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('la bandeja', () => {
    it('pide por GET ordenada por vencimiento y no manda lo vacío', () => {
      client.list({ status: 'SUBMITTED', type: '', assignedTo: undefined, limit: 25 }).subscribe();
      const req = http.expectOne((r) => r.url === '/admissions');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('sort')).toBe('due_at');
      expect(req.request.params.get('status')).toBe('SUBMITTED');
      expect(req.request.params.get('limit')).toBe('25');
      expect(req.request.params.has('type')).toBe(false);
      expect(req.request.params.has('q')).toBe(false);
      req.flush(wirePage());
    });

    it('manda `overdue` solo cuando se pide y cada filtro con su nombre', () => {
      client.list({ overdue: true, assignedTo: 'none', cursor: 'abc', type: 'ALTA_DE_DOCTOR' }).subscribe();
      const req = http.expectOne((r) => r.url === '/admissions');
      expect(req.request.params.get('overdue')).toBe('true');
      expect(req.request.params.get('assignedTo')).toBe('none');
      expect(req.request.params.get('cursor')).toBe('abc');
      expect(req.request.params.get('type')).toBe('ALTA_DE_DOCTOR');
      req.flush(wirePage());
    });

    it('con texto de búsqueda va por POST: el documento no viaja en la dirección', () => {
      client.list({ q: ' 4567890 ', status: 'IN_REVIEW', overdue: true }).subscribe();
      const req = http.expectOne('/admissions/search');
      expect(req.request.method).toBe('POST');
      expect(req.request.urlWithParams).not.toContain('4567890');
      expect(req.request.body).toMatchObject({ q: '4567890', status: 'IN_REVIEW', overdue: true, sort: 'due_at' });
      req.flush(wirePage());
    });

    it('convierte las fechas y resume en cero si la API no manda el avance', () => {
      let resultado: any;
      client.list().subscribe((p) => (resultado = p));
      const s = wireSummary();
      delete (s as { requirementsSummary?: unknown }).requirementsSummary;
      http.expectOne((r) => r.url === '/admissions').flush(wirePage([s], { nextCursor: 'n2' }));
      expect(resultado.items[0].submittedAt).toBeInstanceOf(Date);
      expect(resultado.items[0].requirementsSummary).toEqual({ total: 0, verified: 0, rejected: 0, pending: 0 });
      expect(resultado.nextCursor).toBe('n2');
    });

    it('acepta el vocabulario heredado en español y lo traduce a los códigos estables', () => {
      let resultado: any;
      client.list().subscribe((p) => (resultado = p));
      http.expectOne((r) => r.url === '/admissions').flush(
        wirePage([wireSummary({ status: { code: 'EN_REVISION', label: 'En revisión' } })], { counts: { ENVIADA: 2, EN_REVISION: 1 } }),
      );
      expect(resultado.items[0].status.code).toBe('IN_REVIEW');
      expect(resultado.counts).toEqual({ SUBMITTED: 2, IN_REVIEW: 1 });
      expect(normalizeStatusCode('VERIFICADA')).toBe('VERIFIED');
      expect(normalizeStatusCode('CODIGO_NUEVO')).toBe('CODIGO_NUEVO');
    });
  });

  describe('la ficha', () => {
    it('trae requisitos, documentos y formulario, y deriva lo que la API no manda', () => {
      let d: any;
      client.get('a/1').subscribe((x) => (d = x));
      const wire = wireDetail();
      delete (wire as { documents?: unknown }).documents;
      delete (wire as { submittedForm?: unknown }).submittedForm;
      http.expectOne('/admissions/a%2F1').flush(wire);
      expect(d.requirements).toHaveLength(3);
      expect(d.documents).toHaveLength(2);
      expect(d.documents[0]).toMatchObject({ requirementCode: 'NATIONAL_ID', fileId: 'f-1' });
      expect(d.submittedForm.map((s: any) => s.key)).toEqual(['personal', 'contact', 'licenses', 'credentials', 'specialties']);
      expect(d.allowedActions).toEqual([]);
    });

    it('respeta lo que la API manda: documentos, formulario y acciones permitidas', () => {
      let d: any;
      client.get('a').subscribe((x) => (d = x));
      http.expectOne('/admissions/a').flush(
        wireDetail({ allowedActions: [{ code: 'DECIDE', allowed: false, reasonCode: 'FOUR_EYES', message: 'Otra persona debe aprobar.' }] }),
      );
      expect(d.allowedActions[0].message).toBe('Otra persona debe aprobar.');
      expect(d.documents[0].uploadedAt).toBeInstanceOf(Date);
    });

    it('traduce los estados heredados de cada requisito', () => {
      let d: any;
      client.get('a').subscribe((x) => (d = x));
      http.expectOne('/admissions/a').flush(wireDetail({ requirements: [wireRequirement({ status: 'VERIFICADO' as never })] }));
      expect(d.requirements[0].status).toBe('VERIFIED');
    });
  });

  describe('las escrituras mandan la versión que se vio', () => {
    const casos: [string, () => void, string, object][] = [];
    it.each([
      ['claim', (c: AdmissionsClient) => c.claim('a', { expectedRowVersion: 4 }), '/admissions/a/claim', { expectedRowVersion: 4 }],
      ['release', (c: AdmissionsClient) => c.release('a', { expectedRowVersion: 4 }), '/admissions/a/release', { expectedRowVersion: 4 }],
      ['reassign', (c: AdmissionsClient) => c.reassign('a', { assigneeId: 'u', expectedRowVersion: 4 }), '/admissions/a/reassign', { assigneeId: 'u', expectedRowVersion: 4 }],
      ['request-info', (c: AdmissionsClient) => c.requestInfo('a', { reasonCode: 'ILLEGIBLE', reason: 'No se lee.', internalNote: 'n', expectedRowVersion: 4 }), '/admissions/a/request-info', { reasonCode: 'ILLEGIBLE', reason: 'No se lee.', internalNote: 'n', expectedRowVersion: 4 }],
      ['decision', (c: AdmissionsClient) => c.decide('a', { decision: 'VERIFIED', expectedRowVersion: 4 }), '/admissions/a/decision', { decision: 'VERIFIED', expectedRowVersion: 4 }],
      ['suspend', (c: AdmissionsClient) => c.suspend('a', { reason: 'Denuncia.', expectedRowVersion: 4 }), '/admissions/a/suspend', { reason: 'Denuncia.', expectedRowVersion: 4 }],
      ['reinstate', (c: AdmissionsClient) => c.reinstate('a', { reason: 'Resuelta.', expectedRowVersion: 4 }), '/admissions/a/reinstate', { reason: 'Resuelta.', expectedRowVersion: 4 }],
      ['review', (c: AdmissionsClient) => c.reviewRequirement('a', 'r 1', { decision: 'VERIFIED', sourceType: 'SEDES', sourceConsultedAt: '2026-10-29', expectedRowVersion: 4 }), '/admissions/a/items/r%201/review', { decision: 'VERIFIED', sourceType: 'SEDES', sourceConsultedAt: '2026-10-29', expectedRowVersion: 4 }],
    ] as const)('%s', (_n, llamar, url, cuerpo) => {
      void casos;
      let d: any;
      llamar(client).subscribe((x) => (d = x));
      const req = http.expectOne(url);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(cuerpo);
      req.flush(wireDetail({ rowVersion: 5 }));
      expect(d.rowVersion).toBe(5);
    });

    it('la decisión final NO lleva ítems: el servidor deriva el estado de las revisiones', () => {
      client.decide('a', { decision: 'REJECTED', reason: 'No figura.', reasonCode: 'NOT_IN_REGISTRY', expectedRowVersion: 1 }).subscribe();
      const req = http.expectOne('/admissions/a/decision');
      expect('items' in (req.request.body as object)).toBe(false);
      req.flush(wireDetail());
    });

    it('un 409 sube tal cual: lo interpreta la pantalla', () => {
      let falla: any;
      client.claim('a', { expectedRowVersion: 1 }).subscribe({ error: (e) => (falla = e) });
      http.expectOne('/admissions/a/claim').flush({ code: 'CONFLICT', details: { reason: 'ADMISSION_STALE' } }, { status: 409, statusText: 'Conflict' });
      expect(falla.status).toBe(409);
    });
  });

  describe('los documentos', () => {
    it('pide el acceso auditado y baja los bytes por la ruta de la API', () => {
      let r: any;
      client.documentContent('a', 'f/1').subscribe((x) => (r = x));
      http.expectOne('/admissions/a/documents/f%2F1').flush({ url: '/common/files/f-1/content', expiresAt: '2030-01-01T00:00:00Z' });
      const bytes = http.expectOne('/common/files/f-1/content');
      expect(bytes.request.responseType).toBe('blob');
      bytes.flush(new Blob(['x'], { type: 'image/png' }), { headers: { 'Content-Disposition': "attachment; filename*=UTF-8''c%C3%A9dula.png" } });
      expect(r.originalName).toBe('cédula.png');
      expect(r.blob.size).toBe(1);
    });

    describe('con la sesión abierta', () => {
      beforeEach(() => {
        TestBed.inject(SessionStore).start({
          accessToken: token({ sub: 'u1', sid: 's', roles: ['ADMISSIONS_REVIEWER'], tenants: ['t-1'] }),
          refreshToken: 'r-1',
        });
      });

      it('la ruta de la API lleva la credencial', () => {
        client.documentContent('a', 'f').subscribe();
        http.expectOne('/admissions/a/documents/f').flush({ url: '/common/files/f/content', expiresAt: '2030-01-01T00:00:00Z' });
        const bytes = http.expectOne('/common/files/f/content');
        expect(bytes.request.headers.get('Authorization')).toMatch(/^Bearer /);
        expect(bytes.request.headers.get('X-Tenant-Id')).toBe('t-1');
        bytes.flush(new Blob(['x']));
      });

      it('una URL firmada de otro origen NO lleva Authorization ni X-Tenant-Id ni ninguna cabecera propia', () => {
        let r: any;
        client.documentContent('a', 'f').subscribe((x) => (r = x));
        http.expectOne('/admissions/a/documents/f').flush({ url: 'https://almacen.example.com/obj?X-Signature=abc', expiresAt: '2030-01-01T00:00:00Z' });
        const bytes = http.expectOne('https://almacen.example.com/obj?X-Signature=abc');
        expect(bytes.request.headers.has('Authorization')).toBe(false);
        expect(bytes.request.headers.has('X-Tenant-Id')).toBe(false);
        expect(bytes.request.headers.keys()).toEqual([]);
        bytes.flush(new Blob(['x']));
        expect(r.blob.size).toBe(1);
      });

      it('una firma vencida (403) es «el enlace venció», no «sin permiso», y se pide una nueva al reintentar', () => {
        let falla: unknown;
        client.documentContent('a', 'f').subscribe({ error: (e) => (falla = e) });
        http.expectOne('/admissions/a/documents/f').flush({ url: 'https://almacen.example.com/obj?s=1', expiresAt: '2020-01-01T00:00:00Z' });
        http.expectOne('https://almacen.example.com/obj?s=1').flush('expired', { status: 403, statusText: 'Forbidden' });
        expect(falla).toBeInstanceOf(DocumentLinkExpiredError);
        // Reintentar vuelve a pedir el acceso (otra firma), no reusa la vencida.
        client.documentContent('a', 'f').subscribe();
        http.expectOne('/admissions/a/documents/f').flush({ url: 'https://almacen.example.com/obj?s=2', expiresAt: '2030-01-01T00:00:00Z' });
        http.expectOne('https://almacen.example.com/obj?s=2').flush(new Blob(['x']));
      });

      it('el 403 de una ruta de la API sigue siendo un 403: es de permiso, no de firma', () => {
        let falla: any;
        client.documentContent('a', 'f').subscribe({ error: (e) => (falla = e) });
        http.expectOne('/admissions/a/documents/f').flush({ url: '/common/files/f/content', expiresAt: '2030-01-01T00:00:00Z' });
        http.expectOne('/common/files/f/content').flush({}, { status: 403, statusText: 'Forbidden' });
        expect(falla).not.toBeInstanceOf(DocumentLinkExpiredError);
        expect(falla.status).toBe(403);
      });
    });
  });

  describe('lo del propio médico', () => {
    it('lee su admisión y convierte las fechas y los estados', () => {
      let m: any;
      client.myAdmission().subscribe((x) => (m = x));
      http.expectOne('/profiles/practitioners/me/admission').flush(wireMine({ status: { code: 'ENVIADA', label: 'Enviada' }, infoDueAt: '2026-11-20T00:00:00Z' }));
      expect(m.status.code).toBe('SUBMITTED');
      expect(m.infoDueAt).toBeInstanceOf(Date);
      expect(m.resubmissionsRemaining).toBe(3);
    });

    it('reenvía con la atestación', () => {
      client.resubmitMyAdmission({ attested: true, attestationVersion: '2026-10' }).subscribe();
      const req = http.expectOne('/profiles/practitioners/me/admission/resubmit');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ attested: true, attestationVersion: '2026-10' });
      req.flush(wireMine());
    });
  });
});
