import { provideRouter } from '@angular/router';
import type { PatientCurrentStay } from '../../../../core/data-access/adt/adt.types';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { AdmissionBlock, type InternacionEnFicha } from './admission-block';

/** Una internación abierta, ya proyectada por la ficha. */
const ABIERTA: InternacionEnFicha = {
  id: 'ce-1',
  abierta: true,
  desde: new Date('2026-08-13T10:00:00.000Z'),
  hasta: null,
};

/**
 * Monta el bloque con la sesión y el encuentro que cada caso necesita.
 *
 * El diálogo se confirma por omisión: dar de alta una internación **exige**
 * confirmación —el backend no publica cómo cerrarla ni anularla— y cada prueba
 * que quiera ejercitar la cancelación lo dice.
 */
async function montar(opciones: {
  encounterId?: string | null;
  tenantId?: string | null;
  internaciones?: readonly InternacionEnFicha[];
  confirmar?: boolean;
  estancia?: PatientCurrentStay | null;
} = {}) {
  const confirm = vi.fn().mockResolvedValue(opciones.confirmar ?? true);

  await TestBed.configureTestingModule({
    imports: [AdmissionBlock],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      // F3: el resumen de cama enlaza a la ficha y al ingreso.
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          activeTenantId: signal(opciones.tenantId === undefined ? 't-1' : opciones.tenantId),
          practitionerProfileId: signal('prac-1'),
        },
      },
      { provide: DialogService, useValue: { confirm } },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<AdmissionBlock> = TestBed.createComponent(AdmissionBlock);
  fixture.componentRef.setInput('patientProfileId', 'pp-1');
  fixture.componentRef.setInput(
    'encounterId',
    opciones.encounterId === undefined ? 'enc-1' : opciones.encounterId,
  );
  fixture.componentRef.setInput('internaciones', opciones.internaciones ?? []);
  fixture.detectChanges();

  // F3: el resumen de la cama actual pide la internación en curso. Se responde
  // «sin internación» salvo que la prueba pida otra cosa.
  const http = TestBed.inject(HttpTestingController);
  for (const req of http.match('/clinical/patients/pp-1/inpatient-stay')) req.flush(opciones.estancia ?? null);
  fixture.detectChanges();

  return { fixture, http, confirm };
}

/** Una señal, una computada o un método del componente. */
type UnMiembro = (...args: never[]) => unknown;

/** Los miembros protegidos del componente, para hablar de lo que hace. */
function api(fixture: ComponentFixture<AdmissionBlock>): Record<string, UnMiembro> {
  return fixture.componentInstance as unknown as Record<string, UnMiembro>;
}

describe('AdmissionBlock', () => {
  afterEach(() => TestBed.resetTestingModule());

  /**
   * Una internación que nace sin la consulta que la motivó es un registro que
   * después nadie sabe explicar. El contrato admite abrirla sin encuentro; esta
   * pantalla no.
   */
  it('no ofrece el alta sin un encuentro en curso', async () => {
    const { fixture } = await montar({ encounterId: null });

    expect(api(fixture)['puedeRegistrar']()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Abra el encuentro para internar');
  });

  it('no ofrece el alta sin organización activa', async () => {
    const { fixture } = await montar({ tenantId: null });

    expect(api(fixture)['puedeRegistrar']()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Elija una organización');
  });

  /**
   * Abrir una segunda estancia mientras la primera sigue abierta responde `409`.
   * En vez de ofrecer el formulario para que el servidor lo rechace, se muestra
   * la que está en curso.
   */
  it('con una internación abierta muestra la que hay y no ofrece abrir otra', async () => {
    const { fixture } = await montar({ internaciones: [ABIERTA] });

    expect(api(fixture)['puedeRegistrar']()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('En curso');
    expect(fixture.nativeElement.textContent).toContain('ya está internada');
  });

  it('pide confirmación antes de dar de alta, porque desde acá no se deshace', async () => {
    const { fixture, http, confirm } = await montar({ confirmar: false });

    await api(fixture)['registrar']();

    expect(confirm).toHaveBeenCalled();
    http.expectNone('/clinical/care-episodes');
    http.verify();
  });

  it('manda paciente, organización y responsable, y relee el expediente', async () => {
    const { fixture, http } = await montar();
    let releido = false;
    fixture.componentInstance.cambio.subscribe(() => (releido = true));

    await api(fixture)['registrar']();

    const req = http.expectOne('/clinical/care-episodes');
    expect(req.request.body).toEqual({
      patientProfileId: 'pp-1',
      tenantId: 't-1',
      // Quién queda a cargo sale del claim de la sesión: una internación sin
      // responsable es una estancia sin nadie que responda por ella.
      responsiblePractitionerId: 'prac-1',
    });

    req.flush({
      id: 'ce-9',
      patientProfileId: 'pp-1',
      tenantId: 't-1',
      status: 'c-activo',
      startAt: '2026-08-14T10:00:00.000Z',
      createdAt: '2026-08-14T10:00:00.000Z',
    });
    fixture.detectChanges();

    // La lista sale del expediente releído, no de la respuesta del alta.
    expect(releido).toBe(true);
    http.verify();
  });

  /**
   * El `409` es el expediente negándose a abrir dos veces la misma estancia, no
   * un fallo. Se cuenta en ámbar y señalando dónde está la que ya existe.
   */
  it('cuenta el 409 como aviso y no como error', async () => {
    const { fixture, http } = await montar();

    await api(fixture)['registrar']();

    http.expectOne('/clinical/care-episodes').flush(
      { code: 'CONFLICT', message: 'El paciente ya tiene un episodio activo' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(api(fixture)['avisoDeDuplicado']()).not.toBeNull();
    expect(api(fixture)['errorDelRegistro']()).toBeNull();
    http.verify();
  });

  /* -- C-23: la hoja de internación --------------------------------------- */

  /**
   * Una estancia que empieza mañana no es una internación: es un plan. El
   * calendario ya no la ofrece (`maxDate`), pero el campo admite teclado, así
   * que la regla tiene que vivir también en el formulario.
   */
  it('una fecha de inicio futura no se puede dar de alta', async () => {
    const { fixture } = await montar();

    const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);
    (api(fixture)['inicio'] as unknown as { set(v: Date): void }).set(manana);
    fixture.detectChanges();

    expect(api(fixture)['inicioEnElFuturo']()).toBe(true);
    expect(api(fixture)['puedeRegistrar']()).toBe(false);
  });

  it('una fecha de inicio pasada sí: registrar tarde es legítimo', async () => {
    const { fixture } = await montar();

    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    (api(fixture)['inicio'] as unknown as { set(v: Date): void }).set(ayer);
    fixture.detectChanges();

    expect(api(fixture)['inicioEnElFuturo']()).toBe(false);
    expect(api(fixture)['puedeRegistrar']()).toBe(true);
  });

  /**
   * Registrar tarde es legítimo; **ocultarlo** no. Si la estancia empezó el
   * martes y el registro se escribió el jueves, la ficha lo dice.
   */
  it('declara el registro tardío cuando se escribió después de que empezó', async () => {
    const { fixture } = await montar({
      internaciones: [
        {
          id: 'ce-9',
          abierta: true,
          desde: new Date('2026-09-15T08:00:00.000Z'),
          hasta: null,
          registradaEl: new Date('2026-09-17T19:30:00.000Z'),
        },
      ],
    });

    const tardio = api(fixture)['registroTardio'] as unknown as (i: unknown) => boolean;
    expect(tardio(fixture.componentInstance.internaciones()[0])).toBe(true);
  });

  it('no lo declara cuando se registró en el momento', async () => {
    const enElMomento = new Date('2026-09-15T08:00:00.000Z');
    const { fixture } = await montar({
      internaciones: [
        {
          id: 'ce-10',
          abierta: true,
          desde: enElMomento,
          // Los milisegundos entre armar la petición y escribirla no son un
          // registro tardío.
          registradaEl: new Date(enElMomento.getTime() + 900),
          hasta: null,
        },
      ],
    });

    const tardio = api(fixture)['registroTardio'] as unknown as (i: unknown) => boolean;
    expect(tardio(fixture.componentInstance.internaciones()[0])).toBe(false);
  });

  /* -- F3: la cama actual y el ingreso con cama ---------------------------- */

  it('sin internación con cama ofrece «Internar» con el paciente ya elegido', async () => {
    const { fixture, http } = await montar();
    const enlace = (fixture.nativeElement as HTMLElement).querySelector('[data-testid=inpatient-admit]')!;
    expect(enlace.getAttribute('href')).toBe('/inpatient/admissions/new?patient=pp-1');
    http.verify();
  });

  it('con internación en curso muestra la cama, la unidad y el enlace a la ficha', async () => {
    const { fixture, http } = await montar({
      estancia: {
        encounterId: 'enc-9', siteId: 's1', siteName: 'Hospital San Lucas', since: '2026-10-30T14:00:00.000Z',
        levelOfCare: { code: 'LOC_CARE_GENERAL', display: 'General' },
        bed: { careSpaceId: 'c1', code: '301-A', name: 'Cama 301-A', unitId: 'u1', unitName: 'Internación de medicina interna', siteId: 's1' },
      },
    });
    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-testid=inpatient-stay-summary]')?.textContent).toContain('Cama 301-A');
    expect(raiz.querySelector('[data-testid=inpatient-stay-summary]')?.textContent).toContain('Internación de medicina interna');
    expect(raiz.querySelector('[data-testid=inpatient-stay-link]')?.getAttribute('href')).toBe('/inpatient/stays/enc-9');
    // El alta de episodio de siempre sigue en su lugar (comportamiento preservado).
    expect(raiz.textContent).toContain('Dar de alta la internación');
    http.verify();
  });
});
