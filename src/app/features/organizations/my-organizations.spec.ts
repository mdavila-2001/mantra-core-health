import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyOrganizations } from './my-organizations';

describe('MyOrganizations — Carril 18', () => {
  let fixture: ComponentFixture<MyOrganizations>;
  let http: HttpTestingController;

  function flushInicial(): void {
    http.expectOne((r) => r.url === '/practitioners/me/role-assignments').flush([]);
    http.expectOne((r) => r.url === '/practices').flush([]);
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyOrganizations],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MyOrganizations);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide mis vinculaciones y las organizaciones disponibles al construirse', () => {
    fixture.detectChanges();
    flushInicial();
  });

  /* ---- una caída no es «no tiene organizaciones» (regla 14, 2026-10-08) ---- */

  it('si las vinculaciones no llegan, no dice «Todavía no tiene vinculaciones»: muestra el error con reintento', () => {
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/practitioners/me/role-assignments')
      .flush(
        { code: 'INTERNAL', message: 'boom', correlationId: 'corr-vinc', timestamp: '', path: '' },
        { status: 500, statusText: 'Server Error' },
      );
    http.expectOne((r) => r.url === '/practices').flush([]);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).not.toContain('Todavía no tiene vinculaciones');
    const estado = (
      fixture.componentInstance as unknown as { estadoDeLaTabla: () => { status: string } }
    ).estadoDeLaTabla();
    expect(estado.status).toBe('error');

    // El reintento vuelve a preguntar y, si responde vacío, recién ahí es vacío.
    (fixture.componentInstance as unknown as { reintentarVinculaciones: () => void })
      .reintentarVinculaciones();
    http.expectOne((r) => r.url === '/practitioners/me/role-assignments').flush([]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Todavía no tiene vinculaciones',
    );
  });

  it('si la lista de organizaciones no llega, lo dice y ofrece volver a cargarla', () => {
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/practitioners/me/role-assignments').flush([]);
    http
      .expectOne((r) => r.url === '/practices')
      .flush(
        { code: 'DEPENDENCY_UNAVAILABLE', message: 'El servicio contable no responde.', correlationId: 'c-org', timestamp: '', path: '' },
        { status: 503, statusText: 'Service Unavailable' },
      );
    fixture.detectChanges();

    const aviso = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="organizaciones-no-cargaron"]',
    );
    expect(aviso?.textContent).toContain('El servicio contable no responde. (Código de soporte: c-org)');
    expect(aviso?.getAttribute('role')).toBe('status');

    (fixture.componentInstance as unknown as { cargarOrganizaciones: () => void }).cargarOrganizaciones();
    http.expectOne((r) => r.url === '/practices').flush([{ id: 'p-1', name: 'Hospital Central' }]);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="organizaciones-no-cargaron"]'),
    ).toBeNull();
  });

  it('sin organización elegida, "solicitar" no manda nada', () => {
    fixture.detectChanges();
    flushInicial();
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { solicitar: () => void }).solicitar();
    // http.verify() en afterEach confirma que no salió ninguna petición.
  });

  it('solicitar una vinculación postea al practiceId elegido y relee la lista', () => {
    fixture.detectChanges();
    flushInicial();
    fixture.detectChanges();

    const componente = fixture.componentInstance as unknown as {
      organizacionElegida: { set: (v: string | null) => void };
      solicitar: () => void;
    };
    componente.organizacionElegida.set('practice-1');
    componente.solicitar();

    const req = http.expectOne(
      (r) => r.url === '/practices/practice-1/role-assignments/self-request',
    );
    expect(req.request.method).toBe('POST');
    req.flush({
      id: 'role-1',
      practiceId: 'practice-1',
      practitionerProfileId: 'prof-1',
      status: 'status-pending',
      createdAt: '2026-01-01T00:00:00.000Z',
    });

    // Tras enviar, relee "mis vinculaciones" — la pantalla no queda desactualizada.
    http.expectOne((r) => r.url === '/practitioners/me/role-assignments').flush([
      {
        id: 'role-1',
        practiceId: 'practice-1',
        practiceName: 'Clínica Central',
        practiceType: null,
        practiceSiteId: null,
        roleConceptId: 'role-attending',
        specialtyConceptId: null,
        status: '9705765a-52a0-5c34-b666-a71fda4d9a16',
        isPrimary: false,
        validFrom: null,
        validTo: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        avatarUrl: '/public/media/logo-1',
      },
    ]);
    fixture.detectChanges();

    const filas = (
      fixture.componentInstance as unknown as {
        filas: () => readonly {
          practiceName: string;
          statusLabel: string;
          avatarUrl: string | null;
          verified: boolean;
        }[];
      }
    ).filas();
    expect(filas).toEqual([
      expect.objectContaining({
        practiceName: 'Clínica Central',
        statusLabel: 'Pendiente de aprobación',
        avatarUrl: '/public/media/logo-1',
        // PENDING todavía no es ACTIVE: sin sello hasta que la organización acepte.
        verified: false,
      }),
    ]);
  });

  it('una vinculación ACTIVA (la organización ya aceptó) se marca verificada', () => {
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/practitioners/me/role-assignments').flush([
      {
        id: 'role-3',
        practiceId: 'practice-3',
        practiceName: 'Hospital del Sur',
        practiceType: null,
        practiceSiteId: null,
        roleConceptId: 'role-attending',
        specialtyConceptId: null,
        status: '15fb063e-479c-56e6-b5d1-ebd5a36b62db', // ACTIVE
        isPrimary: true,
        validFrom: null,
        validTo: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        avatarUrl: null,
      },
    ]);
    http.expectOne((r) => r.url === '/practices').flush([]);
    fixture.detectChanges();

    const filas = (
      fixture.componentInstance as unknown as {
        filas: () => readonly { verified: boolean; avatarUrl: string | null }[];
      }
    ).filas();
    expect(filas[0]).toEqual(
      expect.objectContaining({ verified: true, avatarUrl: null }),
    );
  });

  it('una vinculación RECHAZADA o FINALIZADA se marca como final', () => {
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/practitioners/me/role-assignments').flush([
      {
        id: 'role-2',
        practiceId: 'practice-2',
        practiceName: 'Consultorio X',
        practiceType: null,
        practiceSiteId: null,
        roleConceptId: 'role-attending',
        specialtyConceptId: null,
        status: 'a6caee55-265d-54cd-a966-97ac762891d9', // REJECTED
        isPrimary: false,
        validFrom: null,
        validTo: '2026-01-05',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    http.expectOne((r) => r.url === '/practices').flush([]);
    fixture.detectChanges();

    const filas = (
      fixture.componentInstance as unknown as {
        filas: () => readonly { isFinal: boolean; statusLabel: string }[];
      }
    ).filas();
    expect(filas[0]).toEqual(
      expect.objectContaining({ isFinal: true, statusLabel: 'Rechazada' }),
    );
  });
});
