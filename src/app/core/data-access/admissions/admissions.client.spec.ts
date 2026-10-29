/* eslint-disable @typescript-eslint/no-explicit-any -- los cuerpos son JSON del contrato HTTP del backend (sin tipo estático en la prueba); lo que se verifica es su forma, no su tipo TS. */
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { wireDetail, wireItem, wireMine, wirePage, wireRequirement, wireSummary } from '../../../../testing/admissions';
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
    it('pide por GET ordenada por vencimiento, con el estado en el vocabulario de la API, y no manda lo vacío', () => {
      client.list({ status: 'SUBMITTED', type: '', assignedTo: undefined, limit: 25 }).subscribe();
      const req = http.expectOne((r) => r.url === '/admissions');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('sort')).toBe('due_at');
      expect(req.request.params.get('status')).toBe('ENVIADA');
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
      expect(req.request.body).toMatchObject({ q: '4567890', status: 'EN_REVISION', overdue: true, sort: 'due_at' });
      req.flush(wirePage());
    });

    it('convierte las fechas y los estados, y resume en cero si la API no manda el avance', () => {
      let resultado: any;
      client.list().subscribe((p) => (resultado = p));
      const s = wireSummary({ status: { code: 'EN_REVISION', label: 'En revisión' } });
      delete (s as { requirementsSummary?: unknown }).requirementsSummary;
      http.expectOne((r) => r.url === '/admissions').flush(wirePage([s], { nextCursor: 'n2', counts: { ENVIADA: 2, EN_REVISION: 1, ABANDONADA: 1 } }));
      expect(resultado.items[0].submittedAt).toBeInstanceOf(Date);
      expect(resultado.items[0].status.code).toBe('IN_REVIEW');
      expect(resultado.items[0].requirementsSummary).toEqual({ total: 0, verified: 0, rejected: 0, pending: 0 });
      expect(resultado.counts).toEqual({ SUBMITTED: 2, IN_REVIEW: 1, ABANDONED: 1 });
      expect(resultado.nextCursor).toBe('n2');
    });

    it('el plazo solo corre mientras la admisión espera a quien revisa', () => {
      let resultado: any;
      client.list().subscribe((p) => (resultado = p));
      http.expectOne((r) => r.url === '/admissions').flush(
        wirePage([wireSummary(), wireSummary({ id: 'x', status: { code: 'VERIFICADA', label: 'Verificada' } })]),
      );
      expect(resultado.items[0].dueAt).toBeInstanceOf(Date);
      expect(resultado.items[1].dueAt).toBeNull();
    });

    it('traduce los códigos de estado de la API y deja pasar uno que no conoce', () => {
      expect(normalizeStatusCode('VERIFICADA')).toBe('VERIFIED');
      expect(normalizeStatusCode('ABANDONADA')).toBe('ABANDONED');
      expect(normalizeStatusCode('CODIGO_NUEVO')).toBe('CODIGO_NUEVO');
    });
  });

  describe('la ficha', () => {
    it('trae requisitos con sus fichas (id y versión de cada una), documentos y bloqueos', () => {
      let d: any;
      client.get('a/1').subscribe((x) => (d = x));
      http.expectOne('/admissions/a%2F1').flush(wireDetail());
      expect(d.requirements).toHaveLength(3);
      const matricula = d.requirements[1];
      expect(matricula).toMatchObject({ code: 'MATRICULA_MSALUD', mandatory: true, requiresSource: true, state: 'PENDING' });
      expect(matricula.items[0]).toMatchObject({ id: 'rev-1', itemId: 'item-1', rowVersion: 2, evidenceSha256: 'a'.repeat(64), evidenceChanged: false });
      expect(d.documents[0]).toMatchObject({ requirementCode: 'MATRICULA_MSALUD', fileId: 'f-1' });
      expect(d.documents[0].uploadedAt).toBeInstanceOf(Date);
      expect(d.blockers[0]).toMatchObject({ reason: 'PENDING' });
      expect(d.canVerify).toBe(false);
      expect(d.fourEyesRequired).toBe(true);
    });

    it('arma el formulario por secciones, ligando cada campo al requisito que lo respalda', () => {
      let d: any;
      client.get('a').subscribe((x) => (d = x));
      http.expectOne('/admissions/a').flush(wireDetail());
      const claves = d.submittedForm.map((s: any) => s.key);
      expect(claves).toEqual(['personal', 'contact', 'addresses', 'licenses']);
      const personal = d.submittedForm[0].fields;
      expect(personal.find((f: any) => f.key === 'nationalId')).toMatchObject({ value: '4567890 SC', requirementCode: 'CI', required: true });
      // La fecha de nacimiento no se declaró: queda vacía y marcada como obligatoria (CI lo es).
      expect(personal.find((f: any) => f.key === 'birthDate')).toMatchObject({ value: null, required: true });
      const gps = d.submittedForm[2].fields.find((f: any) => f.key === 'home-gps');
      expect(gps).toMatchObject({ kind: 'COORDINATES', value: '-17.78, -63.18' });
      expect(d.submittedForm[3].fields[0]).toMatchObject({ requirementCode: 'MATRICULA_MSALUD', value: 'MP-2404' });
    });

    it('traduce la fuente y el motivo de cada ficha al vocabulario de la aplicación', () => {
      let d: any;
      client.get('a').subscribe((x) => (d = x));
      http.expectOne('/admissions/a').flush(
        wireDetail({
          requirements: [
            wireRequirement({
              items: [
                wireItem({ state: 'VERIFIED', sourceType: 'REGISTRO_MINSALUD', sourceRef: 'Comprobante 4512', sourceConsultedAt: '2026-10-28T12:00:00Z' }),
                wireItem({ id: 'rev-2', itemId: 'item-2', state: 'REJECTED', reasonCode: 'NO_FIGURA_EN_REGISTRO', reasonText: 'No figura.' }),
              ],
            }),
          ],
        }),
      );
      const [verificada, rechazada] = d.requirements[0].items;
      expect(verificada.source).toMatchObject({ type: { code: 'MINSALUD_REGISTRY' }, ref: 'Comprobante 4512' });
      expect(verificada.source.consultedAt).toBeInstanceOf(Date);
      expect(rechazada.reasonCode).toBe('NOT_IN_REGISTRY');
    });

    it('una revisión antigua que solo trae la dirección se muestra como «otra fuente»', () => {
      let d: any;
      client.get('a').subscribe((x) => (d = x));
      http.expectOne('/admissions/a').flush(
        wireDetail({ requirements: [wireRequirement({ items: [wireItem({ state: 'VERIFIED', verificationSourceUri: 'Libro 3, folio 9' })] })] }),
      );
      expect(d.requirements[0].items[0].source).toMatchObject({ type: { code: 'OTHER' }, ref: 'Libro 3, folio 9' });
    });
  });

  describe('las escrituras mandan la versión que se vio', () => {
    it.each([
      ['claim', (c: AdmissionsClient) => c.claim('a', { expectedRowVersion: 4 }), '/admissions/a/claim', { expectedRowVersion: 4 }],
      ['release', (c: AdmissionsClient) => c.release('a', { expectedRowVersion: 4 }), '/admissions/a/release', { expectedRowVersion: 4 }],
      ['reassign', (c: AdmissionsClient) => c.reassign('a', { toUserId: 'u', expectedRowVersion: 4 }), '/admissions/a/reassign', { toUserId: 'u', expectedRowVersion: 4 }],
      ['request-info', (c: AdmissionsClient) => c.requestInfo('a', { reasonCode: 'ILLEGIBLE', reason: 'No se lee.', internalNote: 'n', expectedRowVersion: 4 }), '/admissions/a/request-info', { reasonCode: 'ILEGIBLE', reason: 'No se lee.', internalNote: 'n', expectedRowVersion: 4 }],
      ['decision', (c: AdmissionsClient) => c.decide('a', { decision: 'VERIFIED', expectedRowVersion: 4 }), '/admissions/a/decision', { decision: 'VERIFIED', expectedRowVersion: 4 }],
      ['suspend', (c: AdmissionsClient) => c.suspend('a', { reason: 'Denuncia.', expectedRowVersion: 4 }), '/admissions/a/suspend', { reason: 'Denuncia.', expectedRowVersion: 4 }],
      ['reinstate', (c: AdmissionsClient) => c.reinstate('a', { reason: 'Resuelta.', expectedRowVersion: 4 }), '/admissions/a/reinstate', { reason: 'Resuelta.', expectedRowVersion: 4 }],
    ] as const)('%s', (_n, llamar, url, cuerpo) => {
      let d: any;
      llamar(client).subscribe((x) => (d = x));
      const req = http.expectOne(url);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(cuerpo);
      req.flush(wireDetail({ rowVersion: 5 }));
      expect(d.rowVersion).toBe(5);
    });

    it('revisar una ficha va a `.../items/:id-de-la-revisión/review` con los códigos de la API, la huella y la versión DE LA FICHA', () => {
      client
        .reviewRequirement('a', 'rev 1', {
          decision: 'VERIFIED',
          sourceType: 'MINSALUD_REGISTRY',
          sourceRef: 'Comprobante 4512',
          sourceConsultedAt: '2026-10-29',
          evidenceSha256: 'b'.repeat(64),
          expectedRowVersion: 7,
        })
        .subscribe();
      const req = http.expectOne('/admissions/a/items/rev%201/review');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        decision: 'VERIFIED',
        sourceType: 'REGISTRO_MINSALUD',
        sourceRef: 'Comprobante 4512',
        sourceConsultedAt: '2026-10-29',
        evidenceSha256: 'b'.repeat(64),
        expectedRowVersion: 7,
      });
      req.flush(wireDetail());
    });

    it('rechazar manda el motivo estructurado, el texto del médico y la nota interna aparte', () => {
      client.reviewRequirement('a', 'r', { decision: 'REJECTED', reasonCode: 'SUSPECTED_FRAUD', reason: 'Ilegible.', internalNote: 'Ver con el colegio.', expectedRowVersion: 2 }).subscribe();
      const req = http.expectOne('/admissions/a/items/r/review');
      expect(req.request.body).toEqual({ decision: 'REJECTED', reasonCode: 'SOSPECHA_DE_FRAUDE', reason: 'Ilegible.', internalNote: 'Ver con el colegio.', expectedRowVersion: 2 });
      req.flush(wireDetail());
    });

    it('la decisión final NO lleva ítems: el servidor deriva el estado de las revisiones', () => {
      client.decide('a', { decision: 'REJECTED', reason: 'No figura.', reasonCode: 'NOT_IN_REGISTRY', expectedRowVersion: 1 }).subscribe();
      const req = http.expectOne('/admissions/a/decision');
      expect('items' in (req.request.body as object)).toBe(false);
      expect(req.request.body).toMatchObject({ reasonCode: 'NO_FIGURA_EN_REGISTRO' });
      req.flush(wireDetail());
    });

    it('un 409 sube tal cual: lo interpreta la pantalla', () => {
      let falla: any;
      client.claim('a', { expectedRowVersion: 1 }).subscribe({ error: (e) => (falla = e) });
      http.expectOne('/admissions/a/claim').flush({ code: 'CONFLICT', reason: 'ADMISSION_STALE' }, { status: 409, statusText: 'Conflict' });
      expect(falla.status).toBe(409);
    });
  });

  describe('los documentos', () => {
    const acceso = (url: string) => ({ url, expiresAt: '2030-01-01T00:00:00Z', name: 'cedula.png', mimeType: 'image/png' });

    it('pide la dirección firmada por POST y baja los bytes por la ruta de la API', () => {
      let r: any;
      client.documentContent('a', 'f/1').subscribe((x) => (r = x));
      const firma = http.expectOne('/admissions/a/documents/f%2F1/download-url');
      expect(firma.request.method).toBe('POST');
      firma.flush(acceso('/admissions/a/documents/f-1/content?expires=1&signature=abc'));
      const bytes = http.expectOne('/admissions/a/documents/f-1/content?expires=1&signature=abc');
      expect(bytes.request.method).toBe('GET');
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
        http.expectOne('/admissions/a/documents/f/download-url').flush(acceso('/admissions/a/documents/f/content?expires=1&signature=s'));
        const bytes = http.expectOne('/admissions/a/documents/f/content?expires=1&signature=s');
        expect(bytes.request.headers.get('Authorization')).toMatch(/^Bearer /);
        expect(bytes.request.headers.get('X-Tenant-Id')).toBe('t-1');
        bytes.flush(new Blob(['x']));
      });

      it('una URL firmada de otro origen NO lleva Authorization ni X-Tenant-Id ni ninguna cabecera propia', () => {
        let r: any;
        client.documentContent('a', 'f').subscribe((x) => (r = x));
        http.expectOne('/admissions/a/documents/f/download-url').flush(acceso('https://almacen.example.com/obj?X-Signature=abc'));
        const bytes = http.expectOne('https://almacen.example.com/obj?X-Signature=abc');
        expect(bytes.request.headers.has('Authorization')).toBe(false);
        expect(bytes.request.headers.has('X-Tenant-Id')).toBe(false);
        expect(bytes.request.headers.keys()).toEqual([]);
        bytes.flush(new Blob(['x']));
        expect(r.blob.size).toBe(1);
      });

      it('una firma vencida de otro origen (403) es «el enlace venció», y se pide una nueva al reintentar', () => {
        let falla: unknown;
        client.documentContent('a', 'f').subscribe({ error: (e) => (falla = e) });
        http.expectOne('/admissions/a/documents/f/download-url').flush(acceso('https://almacen.example.com/obj?s=1'));
        http.expectOne('https://almacen.example.com/obj?s=1').flush('expired', { status: 403, statusText: 'Forbidden' });
        expect(falla).toBeInstanceOf(DocumentLinkExpiredError);
        client.documentContent('a', 'f').subscribe();
        http.expectOne('/admissions/a/documents/f/download-url').flush(acceso('https://almacen.example.com/obj?s=2'));
        http.expectOne('https://almacen.example.com/obj?s=2').flush(new Blob(['x']));
      });

      it('la API responde 410 a una firma vencida: «el enlace venció»', () => {
        let falla: unknown;
        client.documentContent('a', 'f').subscribe({ error: (e) => (falla = e) });
        http.expectOne('/admissions/a/documents/f/download-url').flush(acceso('/admissions/a/documents/f/content?expires=1&signature=s'));
        http.expectOne('/admissions/a/documents/f/content?expires=1&signature=s').flush(new Blob(['{}']), { status: 410, statusText: 'Gone' });
        expect(falla).toBeInstanceOf(DocumentLinkExpiredError);
      });

      it('`ADMISSION_DOCUMENT_URL_INVALID` (403) es una firma que no sirve: «el enlace venció»', async () => {
        let falla: unknown;
        client.documentContent('a', 'f').subscribe({ error: (e) => (falla = e) });
        http.expectOne('/admissions/a/documents/f/download-url').flush(acceso('/admissions/a/documents/f/content?expires=1&signature=s'));
        http
          .expectOne('/admissions/a/documents/f/content?expires=1&signature=s')
          .flush(new Blob([JSON.stringify({ reason: 'ADMISSION_DOCUMENT_URL_INVALID' })]), { status: 403, statusText: 'Forbidden' });
        await vi.waitFor(() => expect(falla).toBeInstanceOf(DocumentLinkExpiredError));
      });

      it('el 403 de permiso de la API (sin ese motivo) sigue siendo un 403', async () => {
        let falla: any;
        client.documentContent('a', 'f').subscribe({ error: (e) => (falla = e) });
        http.expectOne('/admissions/a/documents/f/download-url').flush(acceso('/admissions/a/documents/f/content?expires=1&signature=s'));
        http
          .expectOne('/admissions/a/documents/f/content?expires=1&signature=s')
          .flush(new Blob([JSON.stringify({ reason: 'ADMISSION_SELF_ACCESS' })]), { status: 403, statusText: 'Forbidden' });
        await vi.waitFor(() => expect(falla).toBeDefined());
        expect(falla).not.toBeInstanceOf(DocumentLinkExpiredError);
        expect(falla.status).toBe(403);
      });
    });
  });

  describe('lo del propio médico', () => {
    it('lee su admisión y convierte las fechas y los estados', () => {
      let m: any;
      client.myAdmission().subscribe((x) => (m = x));
      http.expectOne('/profiles/practitioners/me/admission').flush(wireMine({ status: { code: 'ENVIADA', label: 'Enviada' }, infoDueAt: '2026-11-20T00:00:00Z', canWithdraw: true }));
      expect(m.status.code).toBe('SUBMITTED');
      expect(m.infoDueAt).toBeInstanceOf(Date);
      expect(m).toMatchObject({ canResubmit: false, canWithdraw: true, resubmissionCount: 0 });
    });

    it('a quien le ven un motivo de fraude no se lo cuentan: la API ya lo entrega como «otro»', () => {
      let m: any;
      client.myAdmission().subscribe((x) => (m = x));
      http.expectOne('/profiles/practitioners/me/admission').flush(
        wireMine({ items: [{ type: 'LICENSE', id: 'i', label: 'Matrícula', state: 'REJECTED', reasonText: 'No se lee.', reasonCode: 'ILEGIBLE' }] }),
      );
      expect(m.items[0].reasonCode).toBe('ILLEGIBLE');
    });

    it('reenvía con la atestación y su versión, y nada más', () => {
      client.resubmitMyAdmission({ attested: true, attestationVersion: '2026-10' }).subscribe();
      const req = http.expectOne('/profiles/practitioners/me/admission/resubmit');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ attested: true, attestationVersion: '2026-10' });
      req.flush(wireMine());
    });

    it('retira su solicitud', () => {
      let m: any;
      client.withdrawMyAdmission().subscribe((x) => (m = x));
      const req = http.expectOne('/profiles/practitioners/me/admission/withdraw');
      expect(req.request.method).toBe('POST');
      req.flush(wireMine({ status: { code: 'RETIRADA', label: 'Retirada' }, canWithdraw: false }));
      expect(m.status.code).toBe('WITHDRAWN');
    });
  });
});
