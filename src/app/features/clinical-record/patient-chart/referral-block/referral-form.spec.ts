import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AuthService } from '../../../../core/auth/auth.service';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import type { DestinoElegido } from './referral-destination';
import { ReferralForm } from './referral-form';

const PRIORIDADES = {
  code: 'prioridad',
  name: 'Prioridad',
  definitionId: 'd',
  valueSetId: 'vs',
  cacheToken: 'v1',
  allowCustomValue: false,
  options: [
    { conceptId: 'pri-rutina', code: 'PRI-ROUTINE', display: 'Routine', ordinal: 1 },
    { conceptId: 'pri-urgente', code: 'PRI-URGENT', display: 'Urgent', ordinal: 2 },
  ],
};

/**
 * El formulario de derivación: reglas de la API antes de mandar, errores al
 * intentar (no a cada tecla), foco al primero, y el cuerpo exacto del POST.
 */
describe('ReferralForm', () => {
  let fixture: ComponentFixture<ReferralForm>;
  let componente: ReferralForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReferralForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            activeTenantId: signal<string | null>('t-1'),
            roles: signal<readonly string[]>(['PRACTITIONER']),
            practitionerProfileId: signal<string | null>('hp-1'),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ReferralForm);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    for (const req of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      req.flush(PRIORIDADES);
    }
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function señal<T>(nombre: string): WritableSignal<T> {
    return (componente as unknown as Record<string, WritableSignal<T>>)[nombre]!;
  }

  function emitir(): void {
    (componente as unknown as { emitir: () => void }).emitir();
    fixture.detectChanges();
  }

  function html(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('no muestra errores antes de intentar emitir', () => {
    expect(html().querySelector('[data-testid="derivacion-resumen-errores"]')).toBeNull();
    expect(html().textContent).toContain('Paso 1 de 5');
    expect(html().textContent).toContain('Emitir derivación');
  });

  it('las prioridades del catálogo van como radios en castellano', () => {
    const radios = html().querySelector('[data-testid="derivacion-prioridad"]');
    expect(radios?.textContent).toContain('Rutina');
    expect(radios?.textContent).toContain('Urgente');
  });

  it('con el formulario vacío no manda nada, resume los errores y enfoca el tipo', () => {
    emitir();
    http.expectNone((r) => r.url === '/referrals');
    const resumen = html().querySelector('[data-testid="derivacion-resumen-errores"]');
    expect(resumen?.textContent).toContain('Elegí qué tipo de derivación es.');
    expect(resumen?.textContent).toContain('Indicá a quién derivás');
    expect(resumen?.textContent).toContain('resumen clínico');
    const tipo = html().querySelector('[data-campo="referralType"]');
    expect(tipo?.contains(document.activeElement)).toBe(true);
  });

  it('el destino externo sólo muestra sus campos al elegirlo', () => {
    expect(html().querySelector('[data-campo="targetExternalName"]')).toBeNull();
    señal<DestinoElegido>('destino').set({ modo: 'EXTERNO' });
    fixture.detectChanges();
    expect(html().querySelector('[data-campo="targetExternalName"]')).not.toBeNull();
    expect(html().querySelector('[data-campo="targetExternalContact"]')).not.toBeNull();
  });

  it('emite con el cuerpo de la API y avisa con la derivación creada', () => {
    let emitida: Referral | null = null;
    componente.emitida.subscribe((r) => (emitida = r));

    señal<string | null>('tipo').set('THERAPY');
    señal<DestinoElegido>('destino').set({
      modo: 'EXTERNO',
      nombre: 'Centro de Fisioterapia Andino',
      contacto: '3 3345678',
    });
    señal<string>('servicio').set('Fisioterapia de rodilla, 10 sesiones');
    señal<string>('resumen').set('Gonalgia derecha de 6 meses.');
    señal<string | null>('prioridad').set('pri-urgente');
    fixture.detectChanges();
    emitir();

    const req = http.expectOne((r) => r.url === '/referrals' && r.method === 'POST');
    expect(req.request.body).toEqual({
      patientProfileId: 'p-1',
      referralType: 'THERAPY',
      targetExternalName: 'Centro de Fisioterapia Andino',
      targetExternalContact: '3 3345678',
      requestedServiceText: 'Fisioterapia de rodilla, 10 sesiones',
      clinicalSummary: 'Gonalgia derecha de 6 meses.',
      priorityConceptId: 'pri-urgente',
      referringProfileId: 'hp-1',
    });
    req.flush({
      id: 'r-1',
      patientProfileId: 'p-1',
      statusConceptId: 's',
      status: 'PENDING',
      referralType: 'THERAPY',
      createdAt: '2026-10-28T10:00:00Z',
    });
    fixture.detectChanges();

    expect(emitida!.id).toBe('r-1');
    // Lo cargado se limpia después de emitir.
    expect(señal<string>('servicio')()).toBe('');
  });

  it('la consulta elegida viaja como sourceEncounterId', () => {
    fixture.componentRef.setInput('citas', [{ id: 'enc-7', etiqueta: '26 oct · Control', enCurso: false }]);
    fixture.detectChanges();
    expect(html().querySelector('[data-testid="derivacion-cita"]')).not.toBeNull();
    señal<string | null>('tipo').set('PROCEDURE');
    señal<DestinoElegido>('destino').set({ modo: 'EXTERNO', nombre: 'Clínica X' });
    señal<string>('servicio').set('Colonoscopia');
    señal<string>('resumen').set('Sangrado digestivo bajo.');
    señal<string | null>('citaElegida').set('enc-7');
    emitir();
    const req = http.expectOne((r) => r.url === '/referrals' && r.method === 'POST');
    expect(req.request.body.sourceEncounterId).toBe('enc-7');
    req.flush({ id: 'r-2', patientProfileId: 'p-1', statusConceptId: 's', createdAt: '2026-10-28T10:00:00Z' });
  });

  it('un 400 con reason de la API se dice en palabras y conserva lo escrito', () => {
    señal<string | null>('tipo').set('CONSULTATION');
    señal<DestinoElegido>('destino').set({ modo: 'ORGANIZACION', tenantId: 't-9' });
    señal<string>('servicio').set('Interconsulta');
    señal<string>('resumen').set('Resumen.');
    emitir();
    http
      .expectOne((r) => r.url === '/referrals')
      .flush(
        {
          statusCode: 404,
          code: 'NOT_FOUND',
          reason: 'REFERRAL_TARGET_BRANCH_NOT_FOUND',
          message: 'Sede no encontrada',
          details: {},
        },
        { status: 404, statusText: 'Not Found' },
      );
    fixture.detectChanges();
    expect(html().querySelector('[data-testid="derivacion-error-envio"]')?.textContent).toContain(
      'La sede elegida ya no existe',
    );
    expect(señal<string>('servicio')()).toBe('Interconsulta');
  });
});
