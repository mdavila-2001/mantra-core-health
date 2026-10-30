import { Component } from '@angular/core';
import { vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { wirePage, wireSummary } from '../../../../../testing/admissions';
import { AdmissionsQueue, QUEUE_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from './admissions-queue';

@Component({ template: '' })
class Vacia {}

describe('AdmissionsQueue', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let component: AdmissionsQueue;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'administration/admissions', component: AdmissionsQueue },
          { path: 'administration/admissions/:admissionId', component: Vacia },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const el = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const q = (testid: string): HTMLElement | null => el().querySelector(`[data-testid="${testid}"]`);

  /** Las peticiones a la bandeja, ya sea GET o POST de búsqueda. */
  const pedida = (): TestRequest =>
    http.expectOne((r) => r.url === '/admissions' || r.url === '/admissions/search');

  async function abrir(url = '/administration/admissions', page = wirePage()): Promise<TestRequest> {
    harness = await RouterTestingHarness.create();
    component = await harness.navigateByUrl(url, AdmissionsQueue);
    const req = pedida();
    req.flush(page);
    harness.detectChanges();
    return req;
  }

  it('S2: mientras carga muestra un esqueleto, y la primera lectura va ordenada por vencimiento', async () => {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/administration/admissions', AdmissionsQueue);
    harness.detectChanges();
    expect(q('admissions-loading')).not.toBeNull();
    const req = pedida();
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('sort')).toBe('due_at');
    expect(req.request.params.get('limit')).toBe(String(QUEUE_PAGE_SIZE));
    req.flush(wirePage());
  });

  it('muestra cada admisión con el estado en palabras, el avance y la cédula enmascarada', async () => {
    await abrir();
    const texto = el().textContent ?? '';
    expect(texto).toContain('Valeria Rojas Mendoza');
    expect(texto).toContain('****890');
    expect(texto).toContain('Enviada');
    expect(texto).toContain('1 de 3 requisitos verificados');
    expect(q('admission-open')?.getAttribute('href')).toBe('/administration/admissions/adm-1');
  });

  it('la tabla tiene nombre y encabezados de columna', async () => {
    await abrir();
    const tabla = el().querySelector('table');
    expect(tabla).not.toBeNull();
    expect(tabla!.querySelector('caption')?.textContent).toContain('ordenadas por vencimiento');
    expect(tabla!.querySelectorAll('th[scope="col"]').length).toBeGreaterThanOrEqual(5);
  });

  it('«vencida» se dice con palabras, no solo con color', async () => {
    await abrir('/administration/admissions', wirePage([wireSummary({ overdue: true, dueAt: new Date(Date.now() - 3 * 86_400_000).toISOString() })]));
    expect(q('admission-row-overdue')?.textContent).toContain('Vencida hace 3 días');
  });

  it('con el plazo pausado no hay fecha de vencimiento', async () => {
    await abrir('/administration/admissions', wirePage([wireSummary({ dueAt: null, status: { code: 'INFO_REQUESTED', label: 'Información requerida' } })]));
    expect(el().textContent).toContain('Sin plazo corriendo');
  });

  describe('los estados con contadores', () => {
    it('muestra «Todas» y un contador por estado, tal como los da el servidor', async () => {
      await abrir('/administration/admissions', wirePage([wireSummary()], { counts: { SUBMITTED: 4, IN_REVIEW: 2, VERIFIED: 10 } }));
      const chip = (code: string): string => (el().querySelector(`.estado-chip[data-estado="${code}"]`)?.textContent ?? '').replace(/\s+/g, ' ').trim();
      expect(chip('ALL')).toBe('Todas 16');
      expect(chip('SUBMITTED')).toBe('Enviadas 4');
      expect(chip('IN_REVIEW')).toBe('En revisión 2');
      expect(chip('VERIFIED')).toBe('Verificadas 10');
      expect(chip('REJECTED')).toBe('Rechazadas 0');
      expect(chip('EXPIRED')).toContain('Verificación vencida');
    });

    it('el estado elegido se marca como pulsado y los demás no', async () => {
      await abrir('/administration/admissions?status=VERIFIED');
      const activos = [...el().querySelectorAll('.estado-chip[aria-pressed="true"]')];
      expect(activos).toHaveLength(1);
      expect(activos[0]!.getAttribute('data-estado')).toBe('VERIFIED');
    });

    it('elegir un estado lo escribe en la URL y vuelve a pedir con ese estado', async () => {
      await abrir();
      const botones = [...(q('admissions-status-tabs')?.querySelectorAll('button, [role="radio"], label') ?? [])] as HTMLElement[];
      botones.find((b) => (b.textContent ?? '').includes('En revisión'))!.click();
      await harness.fixture.whenStable();
      expect(TestBed.inject(Router).url).toContain('status=IN_REVIEW');
      const req = pedida();
      expect(req.request.params.get('status')).toBe('IN_REVIEW');
      req.flush(wirePage([], { counts: {} }));
    });

    it('recargar con el estado en la URL reproduce la misma bandeja', async () => {
      const req = await abrir('/administration/admissions?status=VERIFIED&type=ALTA_DE_DOCTOR&overdue=true');
      expect(req.request.params.get('status')).toBe('VERIFIED');
      expect(req.request.params.get('type')).toBe('ALTA_DE_DOCTOR');
      expect(req.request.params.get('overdue')).toBe('true');
    });

    it('«Asignadas a mí» manda el id de la persona de la sesión y «Sin asignar», none', async () => {
      const req = await abrir('/administration/admissions?assignedTo=none');
      expect(req.request.params.get('assignedTo')).toBe('none');
    });
  });

  describe('la búsqueda', () => {
    it('espera a que se deje de escribir y viaja por POST, nunca en la dirección', async () => {
      vi.useFakeTimers();
      try {
        await abrir();
        (component as unknown as { onSearch(t: string): void }).onSearch('4567');
        (component as unknown as { onSearch(t: string): void }).onSearch('4567890');
        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1);
        http.expectNone((r) => r.url.startsWith('/admissions'));
        vi.advanceTimersByTime(2);
        harness.detectChanges();
        const req = http.expectOne('/admissions/search');
        expect(req.request.method).toBe('POST');
        expect(req.request.body.q).toBe('4567890');
        expect(req.request.urlWithParams).not.toContain('4567890');
        expect(TestBed.inject(Router).url).not.toContain('4567890');
        req.flush(wirePage([], { counts: {} }));
        harness.detectChanges();
        expect(q('admissions-no-match')?.textContent).toContain('Ninguna admisión coincide');
      } finally {
        vi.useRealTimers();
      }
    });

    it('«Quitar filtros» limpia la búsqueda y los filtros y vuelve a pedir la bandeja completa', async () => {
      vi.useFakeTimers();
      try {
        await abrir('/administration/admissions?status=VERIFIED');
        (component as unknown as { onSearch(t: string): void }).onSearch('zzz');
        vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS + 1);
        harness.detectChanges();
        http.expectOne('/admissions/search').flush(wirePage([], { counts: {} }));
        harness.detectChanges();
        (q('admissions-no-match')!.querySelector('button') as HTMLButtonElement).click();
        await vi.advanceTimersByTimeAsync(10);
        harness.detectChanges();
        const req = pedida();
        expect(req.request.method).toBe('GET');
        expect(req.request.params.has('status')).toBe(false);
        req.flush(wirePage());
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('la paginación por cursor', () => {
    it('«Siguiente» pide con el cursor y «Anterior» vuelve a la primera página', async () => {
      await abrir('/administration/admissions', wirePage([wireSummary({ id: 'a' })], { nextCursor: 'c2' }));
      expect(q('admissions-page')?.textContent).toContain('Página 1');
      const siguiente = [...el().querySelectorAll('button')].find((b) => /siguiente/i.test(b.textContent ?? '') || /siguiente/i.test(b.getAttribute('aria-label') ?? ''))!;
      siguiente.click();
      harness.detectChanges();
      const req = pedida();
      expect(req.request.params.get('cursor')).toBe('c2');
      req.flush(wirePage([wireSummary({ id: 'b' })], { nextCursor: null }));
      harness.detectChanges();
      expect(q('admissions-page')?.textContent).toContain('Página 2');
      const anterior = [...el().querySelectorAll('button')].find((b) => /anterior/i.test(b.textContent ?? '') || /anterior/i.test(b.getAttribute('aria-label') ?? ''))!;
      anterior.click();
      harness.detectChanges();
      const vuelta = pedida();
      expect(vuelta.request.params.has('cursor')).toBe(false);
      vuelta.flush(wirePage([wireSummary({ id: 'a' })], { nextCursor: 'c2' }));
    });

    it('cambiar un filtro vuelve a la página uno', async () => {
      await abrir('/administration/admissions', wirePage([wireSummary()], { nextCursor: 'c2' }));
      await TestBed.inject(Router).navigateByUrl('/administration/admissions?status=VERIFIED');
      harness.detectChanges();
      const req = pedida();
      expect(req.request.params.has('cursor')).toBe(false);
      req.flush(wirePage());
    });
  });

  describe('los límites', () => {
    it('200 filas con nombres de 200 caracteres y emoji no rompen la tabla', async () => {
      const largo = `${'María de los Ángeles '.repeat(10)}🩺`.slice(0, 200);
      const filas = Array.from({ length: 200 }, (_, i) =>
        wireSummary({ id: `a-${i}`, practitioner: { id: `p-${i}`, fullName: largo, profession: 'Médica 🩺', maskedNationalId: '****890' } }),
      );
      await abrir('/administration/admissions', wirePage(filas));
      expect(el().querySelectorAll('tbody tr').length).toBe(200);
      expect(el().textContent).toContain('🩺');
    });

    it('una página vacía con filtros ofrece quitarlos', async () => {
      await abrir('/administration/admissions?status=SUSPENDED', wirePage([], { counts: {} }));
      expect(q('admissions-no-match')).not.toBeNull();
    });
  });

  describe('los estados M34', () => {
    it('S3: sin ninguna admisión y sin filtros, un vacío con su próxima acción', async () => {
      await abrir('/administration/admissions', wirePage([], { counts: {} }));
      expect(el().textContent).toContain('No hay admisiones todavía.');
      expect(el().textContent).toContain('Las nuevas altas de doctor aparecen acá');
    });

    it('S5: un 403 dice qué rol falta, no «error»', async () => {
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/administration/admissions', AdmissionsQueue);
      pedida().flush({ code: 'FORBIDDEN', message: 'x', details: { reason: 'ADMISSION_ROLE_REQUIRED', requiredRole: 'ADMISSIONS_REVIEWER' } }, { status: 403, statusText: 'Forbidden' });
      harness.detectChanges();
      expect(el().textContent).toContain('«Revisión de admisiones»');
      expect(el().textContent).toContain('No tiene acceso');
    });

    it('S9: un error inesperado muestra el código de soporte y «Reintentar» vuelve a pedir', async () => {
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/administration/admissions', AdmissionsQueue);
      pedida().flush({ code: 'INTERNAL', message: 'caído', correlationId: 'req-77' }, { status: 500, statusText: 'Server Error' });
      harness.detectChanges();
      expect(el().textContent).toContain('req-77');
      const reintentar = [...el().querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('Reintentar'))!;
      reintentar.click();
      harness.detectChanges();
      pedida().flush(wirePage());
      harness.detectChanges();
      expect(el().textContent).toContain('Valeria Rojas Mendoza');
    });

    it('S8: sin conexión y sin datos previos, un estado de «sin conexión» con reintento', async () => {
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl('/administration/admissions', AdmissionsQueue);
      pedida().error(new ProgressEvent('error'));
      harness.detectChanges();
      expect([...el().querySelectorAll('button')].some((b) => (b.textContent ?? '').includes('Reintentar'))).toBe(true);
    });

    it('S7: si falla la red con datos a la vista, se conservan y se dice desde cuándo', async () => {
      await abrir();
      component['reload']?.call(component);
      pedida().error(new ProgressEvent('error'));
      harness.detectChanges();
      expect(el().textContent).toContain('Valeria Rojas Mendoza');
      expect(el().textContent).toContain('pueden estar atrasados');
      expect(el().textContent).toMatch(/Información al \d{2}\/\d{2}\/\d{4}/);
    });

    it('una respuesta vieja no pisa a la nueva', async () => {
      await abrir();
      await TestBed.inject(Router).navigateByUrl('/administration/admissions?status=A');
      const primera = pedida();
      await TestBed.inject(Router).navigateByUrl('/administration/admissions?status=B');
      const segunda = pedida();
      segunda.flush(wirePage([wireSummary({ id: 'nueva', practitioner: { id: 'p', fullName: 'Respuesta nueva', profession: 'x', maskedNationalId: '*' } })]));
      primera.flush(wirePage([wireSummary({ id: 'vieja', practitioner: { id: 'p', fullName: 'Respuesta vieja', profession: 'x', maskedNationalId: '*' } })]));
      harness.detectChanges();
      expect(el().textContent).toContain('Respuesta nueva');
      expect(el().textContent).not.toContain('Respuesta vieja');
    });
  });
});
