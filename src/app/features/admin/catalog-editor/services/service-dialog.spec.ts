import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { AdminServiceItem, ServiceScopes } from '../../../../core/data-access/admin-portal/catalog-editor.types';
import { ServiceDialog } from './service-dialog';

const ALCANCE: ServiceScopes = {
  types: [{ conceptId: 'tipo-lab', code: 'PR_TYPE_LAB', display: 'Laboratorio' }],
  practices: [{ id: 'pr-1', name: 'Laboratorio Demo', typeConceptId: 'tipo-lab' }],
  currencies: [
    { conceptId: 'moneda-bob', code: 'BOB' },
    { conceptId: 'moneda-usd', code: 'USD' },
  ],
};

const SERVICIO: AdminServiceItem = {
  id: 'srv-1',
  practiceId: 'pr-1',
  practiceTypeConceptId: 'tipo-lab',
  code: 'HEMO',
  name: 'Hemograma',
  descriptionText: null,
  termsText: null,
  defaultPrice: '85.00',
  currencyConceptId: 'moneda-bob',
  currencyCode: 'BOB',
  isActive: true,
  rowVersion: 3,
  updatedAt: '2026-10-31T10:00:00.000Z',
};

interface Interno {
  practiceId: { (): string; set(v: string): void };
  currencyConceptId: { (): string; set(v: string): void };
  code: { set(v: string): void };
  name: { set(v: string): void };
  defaultPrice: { set(v: string): void };
  descriptionText: { set(v: string): void };
  guardando(): boolean;
  errores(): Record<string, string>;
  aviso(): string | null;
  conflicto(): boolean;
  guardar(): void;
}

describe('ServiceDialog', () => {
  let fixture: ComponentFixture<ServiceDialog>;
  let http: HttpTestingController;
  let guardados: AdminServiceItem[];
  let recargas: number;

  const interno = () => fixture.componentInstance as unknown as Interno;
  const q = (selector: string) => (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(selector);

  function montar(servicio: AdminServiceItem | null): void {
    TestBed.configureTestingModule({ imports: [ServiceDialog], providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ServiceDialog);
    fixture.componentRef.setInput('scopes', ALCANCE);
    fixture.componentRef.setInput('servicio', servicio);
    fixture.componentRef.setInput('tipoInicial', 'tipo-lab');
    guardados = [];
    recargas = 0;
    fixture.componentInstance.saved.subscribe((s) => guardados.push(s));
    fixture.componentInstance.reloadRequested.subscribe(() => recargas++);
    fixture.detectChanges();
  }

  afterEach(() => http.verify());

  describe('alta', () => {
    beforeEach(() => montar(null));

    it('preselecciona la práctica del tipo elegido y la primera moneda', () => {
      expect(interno().practiceId()).toBe('pr-1');
      expect(interno().currencyConceptId()).toBe('moneda-bob');
      expect(q('[data-testid="service-dialog-save"]')?.textContent).toContain('Crear servicio');
    });

    it('inválido: no manda nada y marca cada campo, con el aviso general', () => {
      interno().practiceId.set('');
      interno().guardar();
      fixture.detectChanges();
      http.expectNone('/admin/catalogs/services');
      expect(Object.keys(interno().errores()).sort()).toEqual(['code', 'defaultPrice', 'name', 'practiceId']);
      expect(interno().aviso()).toBe('Revise los campos marcados.');
      expect(q('[data-testid="service-dialog-error"]')).not.toBeNull();
    });

    it('rechaza el precio con coma o en cero antes de molestar al servidor', () => {
      interno().code.set('X');
      interno().name.set('X');
      interno().defaultPrice.set('10,5');
      interno().guardar();
      expect(interno().errores()['defaultPrice']).toMatch(/punto/);
      interno().defaultPrice.set('0.00');
      interno().guardar();
      expect(interno().errores()['defaultPrice']).toMatch(/mayor que cero/);
      http.expectNone('/admin/catalogs/services');
    });

    it('correcto: crea con el precio como cadena y avisa al guardarse', () => {
      interno().practiceId.set('pr-1');
      interno().code.set(' GLU ');
      interno().name.set('Glucosa');
      interno().defaultPrice.set('40.00');
      interno().guardar();
      const req = http.expectOne('/admin/catalogs/services');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ practiceId: 'pr-1', code: 'GLU', name: 'Glucosa', defaultPrice: '40.00', isActive: true, currencyConceptId: 'moneda-bob' });
      expect(typeof req.request.body.defaultPrice).toBe('string');
      req.flush({ ...SERVICIO, id: 'srv-9', code: 'GLU', name: 'Glucosa' });
      expect(guardados.map((s) => s.id)).toEqual(['srv-9']);
    });

    it('sin doble envío: un segundo clic mientras guarda no manda otra petición', () => {
      interno().practiceId.set('pr-1');
      interno().code.set('GLU');
      interno().name.set('Glucosa');
      interno().defaultPrice.set('40.00');
      interno().guardar();
      interno().guardar();
      expect(interno().guardando()).toBe(true);
      http.expectOne('/admin/catalogs/services').flush(SERVICIO);
      expect(interno().guardando()).toBe(false);
    });

    it('el código repetido que rechaza el servidor se muestra en el campo y conserva lo escrito', () => {
      interno().practiceId.set('pr-1');
      interno().code.set('GLU');
      interno().name.set('Glucosa');
      interno().defaultPrice.set('40.00');
      interno().guardar();
      http.expectOne('/admin/catalogs/services').flush(
        { statusCode: 409, code: 'CONFLICT', message: 'x', reason: 'SERVICE_CATALOG_CODE_ALREADY_EXISTS' },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();
      expect(interno().errores()['code']).toMatch(/Ya existe/);
      expect(interno().guardando()).toBe(false);
      expect(guardados).toEqual([]);
      expect((q('[data-testid="service-field-name"] input') as HTMLInputElement).value).toBe('Glucosa');
    });

    it('un 403 se explica sin perder lo escrito', () => {
      interno().practiceId.set('pr-1');
      interno().code.set('GLU');
      interno().name.set('Glucosa');
      interno().defaultPrice.set('40.00');
      interno().guardar();
      http.expectOne('/admin/catalogs/services').flush({ statusCode: 403, code: 'FORBIDDEN', message: 'Forbidden resource' }, { status: 403, statusText: 'Forbidden' });
      expect(interno().aviso()).toMatch(/no tiene permiso/i);
      expect(interno().aviso()).not.toContain('Forbidden resource');
    });
  });

  describe('edición', () => {
    beforeEach(() => montar(SERVICIO));

    it('carga los valores y no deja editar el código', () => {
      expect((q('[data-testid="service-field-code"] input') as HTMLInputElement).readOnly).toBe(true);
      expect((q('[data-testid="service-field-name"] input') as HTMLInputElement).value).toBe('Hemograma');
    });

    it('sin cambios no manda nada', () => {
      interno().guardar();
      http.expectNone('/admin/catalogs/services/srv-1');
      expect(interno().aviso()).toBe('No hay cambios para guardar.');
    });

    it('manda sólo lo que cambió, con la versión leída; la moneda viaja con el precio', () => {
      interno().name.set('Hemograma completo');
      interno().defaultPrice.set('90.00');
      interno().guardar();
      const req = http.expectOne('/admin/catalogs/services/srv-1');
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ expectedRowVersion: 3, name: 'Hemograma completo', defaultPrice: '90.00', currencyConceptId: 'moneda-bob' });
      req.flush({ ...SERVICIO, name: 'Hemograma completo', defaultPrice: '90.00', rowVersion: 4 });
      expect(guardados[0]!.rowVersion).toBe(4);
    });

    it('vaciar un texto manda null para limpiarlo', () => {
      interno().descriptionText.set('Texto');
      interno().guardar();
      http.expectOne('/admin/catalogs/services/srv-1').flush({ ...SERVICIO, descriptionText: 'Texto', rowVersion: 4 });
      interno().descriptionText.set('');
      // El diálogo se reabre con el servicio guardado: acá se simula leyendo el valor previo.
      fixture.componentRef.setInput('servicio', { ...SERVICIO, descriptionText: 'Texto', rowVersion: 4 });
      interno().guardar();
      const req = http.expectOne('/admin/catalogs/services/srv-1');
      expect(req.request.body).toEqual({ expectedRowVersion: 4, descriptionText: null });
      req.flush({ ...SERVICIO, rowVersion: 5 });
    });

    it('409 de versión: no pisa, conserva lo escrito y ofrece recargar', () => {
      interno().name.set('Mi cambio');
      interno().guardar();
      http.expectOne('/admin/catalogs/services/srv-1').flush(
        { statusCode: 409, code: 'CONFLICT', message: 'x', reason: 'SERVICE_CATALOG_VERSION_MISMATCH', details: { expected: 3, actual: 4 } },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();
      expect(interno().conflicto()).toBe(true);
      expect(guardados).toEqual([]);
      expect((q('[data-testid="service-field-name"] input') as HTMLInputElement).value).toBe('Mi cambio');
      q('[data-testid="service-dialog-reload"]')?.click();
      expect(recargas).toBe(1);
    });
  });
});
