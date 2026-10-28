import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import type { Referral } from '../../../../core/data-access/referrals/referrals.types';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import type { ReferenceOption } from '../../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { ReferralBlock } from './referral-block';

const LUCIA = {
  kind: 'PRACTITIONER',
  id: 'hp-1',
  displayName: 'Dra. Lucía Mendoza',
  tenantId: 't-clinica',
  subtitle: 'Endocrinología',
};

/** Quien deriva. La API no debería devolverlo, y si lo hace no se ofrece. */
const YO = { ...LUCIA, id: 'hp-yo', displayName: 'Dra. Camila Vargas', subtitle: null };

const HOSPITAL = {
  kind: 'ORGANIZATION',
  id: 't-hospital',
  displayName: 'Hospital San Lucas',
  tenantId: 't-hospital',
  subtitle: 'Hospital · Santa Cruz',
};

const FISIO = {
  id: 's-fisio',
  code: 'FISIO',
  name: 'Fisioterapia',
  description: 'Diez sesiones.',
  price: '120.00',
  currency: 'BOB',
  tenantId: 't-hospital',
  practiceName: 'Hospital San Lucas',
};

const ALTA = {
  id: 'ref-1',
  patientProfileId: 'pat-1',
  statusConceptId: 'x',
  createdAt: '2026-10-24T12:00:00Z',
};

/**
 * Derivar desde la consulta: a otro profesional (pedido del propietario,
 * 24/10/2026) o a una organización médica, por un servicio concreto («tipo
 * tratamiento», pedido del cliente, 28/10/2026). Se fija el contrato con la
 * API: qué se manda, qué no se manda (quien deriva sale del token), que sin
 * encuentro no hay formulario, y que la lista y los servicios respetan M34.
 */
describe('ReferralBlock', () => {
  let fixture: ComponentFixture<ReferralBlock>;
  let http: HttpTestingController;

  function acc<T>(nombre: string): T {
    const c = fixture.componentInstance as unknown as Record<string, unknown>;
    const valor = c[nombre];
    return (typeof valor === 'function' ? valor.bind(c) : valor) as T;
  }

  function señal<T>(nombre: string): WritableSignal<T> {
    return (fixture.componentInstance as unknown as Record<string, WritableSignal<T>>)[nombre];
  }

  function el(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function crear(encounterId: string | null = 'enc-1'): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { practitionerProfileId: signal<string | null>('hp-yo') },
        },
      ],
    });
    fixture = TestBed.createComponent(ReferralBlock);
    fixture.componentRef.setInput('patientProfileId', 'pat-1');
    fixture.componentRef.setInput('encounterId', encounterId);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  /** Busca, devuelve los destinos y elige el primero que se ofrece. */
  function elegirDestino(destinos: readonly object[], servicios: readonly object[] = [FISIO]): void {
    acc<(q: string) => void>('buscar')('lu');
    http.expectOne((r) => r.url === '/referrals/targets').flush({ items: destinos });
    const opcion = acc<() => readonly ReferenceOption[]>('opciones')()[0]!;
    acc<(o: ReferenceOption) => void>('elegir')(opcion);
    http.expectOne((r) => r.url === '/referrals/target-services').flush({ items: servicios });
    fixture.detectChanges();
  }

  afterEach(() => {
    for (const r of http.match((req) => req.url === '/terminology/concepts')) {
      r.flush({ items: [], count: 0, limit: 200 });
    }
    http.verify();
  });

  /* -- Buscar ---------------------------------------------------------------- */

  it('busca en la API con espera, desde dos letras y por la clase elegida', async () => {
    crear();
    const input = el().querySelector<HTMLInputElement>('[data-testid="derivacion-profesional"] input')!;
    expect(input).not.toBeNull();

    input.value = 'l';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 400));
    // Una sola letra no viaja: el servidor exige dos.
    http.expectNone((r) => r.url === '/referrals/targets');

    input.value = 'luc';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    http.expectNone((r) => r.url === '/referrals/targets');
    await new Promise((r) => setTimeout(r, 400));

    const req = http.expectOne((r) => r.url === '/referrals/targets');
    expect(req.request.params.get('q')).toBe('luc');
    expect(req.request.params.get('kind')).toBe('PRACTITIONER');
    req.flush({ items: [LUCIA] });

    expect(acc<() => readonly ReferenceOption[]>('opciones')()).toEqual([
      { value: 'hp-1', label: 'Dra. Lucía Mendoza', hint: 'Endocrinología' },
    ]);
  });

  it('nunca ofrece a quien deriva, aunque la API lo devuelva', () => {
    crear();
    acc<(q: string) => void>('buscar')('va');
    http.expectOne((r) => r.url === '/referrals/targets').flush({ items: [YO, LUCIA] });

    expect(acc<() => readonly ReferenceOption[]>('opciones')().map((o) => o.value)).toEqual([
      'hp-1',
    ]);
  });

  it('a organización: busca por ORGANIZATION y pide sus servicios por targetTenantId', () => {
    crear();
    acc<(k: string) => void>('elegirClase')('ORGANIZATION');
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="derivacion-organizacion"]')).not.toBeNull();

    acc<(q: string) => void>('buscar')('san');
    const busqueda = http.expectOne((r) => r.url === '/referrals/targets');
    expect(busqueda.request.params.get('kind')).toBe('ORGANIZATION');
    busqueda.flush({ items: [HOSPITAL] });
    acc<(o: ReferenceOption) => void>('elegir')(acc<() => readonly ReferenceOption[]>('opciones')()[0]!);

    const servicios = http.expectOne((r) => r.url === '/referrals/target-services');
    expect(servicios.request.params.get('targetTenantId')).toBe('t-hospital');
    expect(servicios.request.params.has('targetProfileId')).toBe(false);
    servicios.flush({ items: [FISIO] });

    expect(acc<() => readonly { label: string }[]>('opcionesDeServicio')().map((o) => o.label)).toEqual([
      'Sin un servicio en particular',
      'Fisioterapia · Bs 120.00',
    ]);
  });

  it('cambiar de clase olvida el destino elegido', () => {
    crear();
    elegirDestino([LUCIA]);
    acc<(k: string) => void>('elegirClase')('ORGANIZATION');
    expect(acc<() => unknown>('destino')()).toBeNull();
    expect(señal<string | null>('servicioElegido')()).toBeNull();
  });

  /* -- Servicios ------------------------------------------------------------- */

  it('un destino sin servicios es S3 con su próxima acción, y aun así se puede derivar', () => {
    crear();
    elegirDestino([LUCIA], []);

    const estado = acc<() => ViewState<unknown>>('servicios')();
    expect(estado.status).toBe('empty');
    expect(estado.status === 'empty' && estado.nextAction.label).toContain('busque otro destino');
    expect(el().textContent).toContain('no tiene servicios publicados');
    expect(acc<() => boolean>('puedeEnviar')()).toBe(true);
  });

  it('el detalle del servicio elegido se muestra para no elegir a ciegas', () => {
    crear();
    elegirDestino([LUCIA]);
    señal<string | null>('servicioElegido').set('s-fisio');
    expect(acc<() => string>('detalleDelServicio')()).toBe('Diez sesiones.');
  });

  /* -- Tipo y envío ---------------------------------------------------------- */

  it('el tipo viene en Tratamiento y las cinco opciones están en castellano', () => {
    crear();
    expect(señal<string | null>('tipo')()).toBe('TREATMENT');
    expect(acc<readonly { label: string }[]>('opcionesDeTipo').map((o) => o.label)).toEqual([
      'Tratamiento',
      'Interconsulta',
      'Estudio diagnóstico',
      'Procedimiento',
      'Segunda opinión',
    ]);
  });

  it('sin elegir a nadie no se puede enviar', () => {
    crear();
    expect(acc<() => boolean>('puedeEnviar')()).toBe(false);
    elegirDestino([LUCIA]);
    expect(acc<() => boolean>('puedeEnviar')()).toBe(true);
  });

  it('deriva: persona, encuentro, destino, servicio y tipo — y NO quién deriva', () => {
    crear();
    let cambios = 0;
    fixture.componentInstance.cambio.subscribe(() => (cambios += 1));
    elegirDestino([LUCIA]);
    señal<string | null>('servicioElegido').set('s-fisio');
    señal<string>('motivo').set('  Control de la tiroides  ');

    acc<() => void>('derivar')();

    const req = http.expectOne((r) => r.url === '/referrals' && r.method === 'POST');
    expect(req.request.body).toEqual({
      patientProfileId: 'pat-1',
      sourceEncounterId: 'enc-1',
      targetProfileId: 'hp-1',
      targetServiceCatalogId: 's-fisio',
      referralType: 'TREATMENT',
      reasonText: 'Control de la tiroides',
    });
    expect(req.request.body.referringProfileId).toBeUndefined();
    req.flush(ALTA, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    expect(cambios).toBe(1);
    expect(acc<() => string | null>('derivadoA')()).toContain('Lucía Mendoza');
    expect(el().querySelector('[data-testid="derivacion-exito"]')).not.toBeNull();
    // El formulario queda limpio para derivar a otro, con Tratamiento otra vez.
    expect(acc<() => boolean>('puedeEnviar')()).toBe(false);
    expect(señal<string | null>('tipo')()).toBe('TREATMENT');
  });

  it('a una organización manda targetTenantId, y lo vacío no viaja', () => {
    crear();
    acc<(k: string) => void>('elegirClase')('ORGANIZATION');
    elegirDestino([HOSPITAL]);
    señal<string | null>('tipo').set('SECOND_OPINION');
    señal<Date | null>('vigencia').set(new Date(2026, 11, 31));

    acc<() => void>('derivar')();

    const req = http.expectOne((r) => r.url === '/referrals' && r.method === 'POST');
    expect(req.request.body).toEqual({
      patientProfileId: 'pat-1',
      sourceEncounterId: 'enc-1',
      targetTenantId: 't-hospital',
      referralType: 'SECOND_OPINION',
      validUntil: '2026-12-31',
    });
    req.flush(ALTA);
  });

  it('sin encuentro abierto lo dice y no ofrece enviar', () => {
    crear(null);

    expect(acc<() => boolean>('sinEncuentro')()).toBe(true);
    expect(acc<() => boolean>('puedeEnviar')()).toBe(false);
    expect(el().querySelector('[data-testid="derivacion-sin-encuentro"]')).not.toBeNull();
    expect(el().querySelector('[data-testid="derivacion-enviar"]')).toBeNull();
  });

  /* -- Errores --------------------------------------------------------------- */

  it('un 409 es un aviso («ya la derivó»), no un error', () => {
    crear();
    elegirDestino([LUCIA]);
    acc<() => void>('derivar')();
    http
      .expectOne((r) => r.url === '/referrals' && r.method === 'POST')
      .flush(
        { code: 'CONFLICT', message: 'Ya existe una referencia equivalente' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(acc<() => boolean>('yaDerivado')()).toBe(true);
    expect(acc<() => string | null>('errorDelRegistro')()).toBeNull();
    expect(el().querySelector('[data-testid="derivacion-duplicada"]')).not.toBeNull();
  });

  it('un 404 del encuentro se dice con palabras, no con «error», y no emite cambio', () => {
    crear();
    let cambios = 0;
    fixture.componentInstance.cambio.subscribe(() => (cambios += 1));
    elegirDestino([LUCIA]);
    acc<() => void>('derivar')();
    http
      .expectOne((r) => r.url === '/referrals' && r.method === 'POST')
      .flush(
        { code: 'NOT_FOUND', message: 'Encuentro no encontrado' },
        { status: 404, statusText: 'Not Found' },
      );
    fixture.detectChanges();

    expect(cambios).toBe(0);
    expect(acc<() => string | null>('errorDelRegistro')()).toContain('No encontramos este encuentro');
    expect(el().querySelector('[data-testid="derivacion-error"]')).not.toBeNull();
    // Lo elegido sigue ahí: reintentar no obliga a empezar de cero.
    expect(acc<() => unknown>('destino')()).not.toBeNull();
  });

  it('una validación del servidor se muestra con su mensaje', () => {
    crear();
    elegirDestino([LUCIA]);
    acc<() => void>('derivar')();
    http.expectOne((r) => r.url === '/referrals' && r.method === 'POST').flush(
      {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Validation failed',
        details: { violations: ['reasonText must be shorter than or equal to 1000 characters'] },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();
    expect(el().querySelector('[data-testid="derivacion-error"]')?.textContent).toContain('1000');
  });

  it('si los servicios no cargan, se dice y se puede reintentar', () => {
    crear();
    acc<(q: string) => void>('buscar')('lu');
    http.expectOne((r) => r.url === '/referrals/targets').flush({ items: [LUCIA] });
    acc<(o: ReferenceOption) => void>('elegir')(acc<() => readonly ReferenceOption[]>('opciones')()[0]!);
    http
      .expectOne((r) => r.url === '/referrals/target-services')
      .flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();
    expect(acc<() => ViewState<unknown>>('servicios')().status).toBe('error');

    acc<() => void>('cargarServicios')();
    http.expectOne((r) => r.url === '/referrals/target-services').flush({ items: [FISIO] });
    expect(acc<() => ViewState<unknown>>('servicios')().status).toBe('ready');
  });

  /* -- La lista -------------------------------------------------------------- */

  describe('la lista', () => {
    const DERIVACION: Referral = {
      id: 'r-1',
      patientProfileId: 'pat-1',
      statusConceptId: 'st-aceptada',
      createdAt: new Date('2026-10-20T12:00:00.000Z'),
      referralType: 'TREATMENT',
      targetDisplayName: 'Hospital San Lucas',
      targetServiceName: 'Fisioterapia',
    };

    it('sin `derivaciones` no se dibuja', () => {
      crear();
      expect(el().querySelector('[data-testid="derivacion-lista"]')).toBeNull();
      expect(acc<() => unknown>('lista')()).toBeNull();
    });

    it('vacía es S3 con próxima acción', () => {
      crear();
      fixture.componentRef.setInput('derivaciones', ready([]));
      fixture.detectChanges();
      expect(acc<() => ViewState<unknown>>('lista')().status).toBe('empty');
      expect(el().textContent).toContain('todavía no tiene derivaciones');
    });

    it('muestra tipo, destino, servicio y el estado traducido por código', () => {
      crear();
      fixture.componentRef.setInput('derivaciones', ready([DERIVACION]));
      fixture.detectChanges();
      http.expectOne((r) => r.url === '/terminology/concepts').flush({
        items: [
          { conceptId: 'st-aceptada', code: 'REF_ACCEPTED', display: 'Referral accepted', codeSystemVersionId: 'v' },
        ],
        count: 1,
        limit: 200,
      });
      fixture.detectChanges();

      const filas = el().querySelectorAll('[data-testid="derivacion-fila"]');
      expect(filas).toHaveLength(1);
      expect(filas[0]?.textContent).toContain('Tratamiento · Hospital San Lucas');
      expect(filas[0]?.textContent).toContain('Fisioterapia');
      // El código manda: el rótulo del catálogo en inglés no llega a la pantalla.
      expect(filas[0]?.textContent).toContain('Aceptada');
      expect(filas[0]?.textContent).not.toContain('Referral accepted');
    });

    it('se sigue viendo sin encuentro abierto', () => {
      crear(null);
      fixture.componentRef.setInput('derivaciones', ready([DERIVACION]));
      fixture.detectChanges();
      http.expectOne((r) => r.url === '/terminology/concepts').flush({ items: [], count: 0, limit: 200 });
      fixture.detectChanges();
      expect(el().querySelectorAll('[data-testid="derivacion-fila"]')).toHaveLength(1);
    });

    it('mientras no sabe cómo se llama el estado, la lista espera (S2): nunca un estado falso', () => {
      crear();
      fixture.componentRef.setInput('derivaciones', ready([DERIVACION]));
      fixture.detectChanges();
      expect(acc<() => ViewState<unknown>>('lista')().status).toBe('loading');
      expect(el().querySelectorAll('[data-testid="derivacion-fila"]')).toHaveLength(0);
      http.expectOne((r) => r.url === '/terminology/concepts').flush({ items: [], count: 0, limit: 200 });
      expect(acc<() => ViewState<unknown>>('lista')().status).toBe('ready');
    });

    it('si el catálogo falla, la lista igual se muestra y no se vuelve a pedir al releer', () => {
      crear();
      fixture.componentRef.setInput('derivaciones', ready([DERIVACION]));
      fixture.detectChanges();
      http
        .expectOne((r) => r.url === '/terminology/concepts')
        .flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();
      expect(el().querySelector('[data-testid="derivacion-fila"]')?.textContent).toContain('Sin registrar');

      // La relectura pasa por `loading` y vuelve con lo mismo: no hay otra petición.
      fixture.componentRef.setInput('derivaciones', loading());
      fixture.detectChanges();
      fixture.componentRef.setInput('derivaciones', ready([DERIVACION]));
      fixture.detectChanges();
      http.expectNone((r) => r.url === '/terminology/concepts');
      expect(acc<() => ViewState<unknown>>('lista')().status).toBe('ready');
    });

    it('los estados que no son datos pasan tal cual al anfitrión', () => {
      crear();
      fixture.componentRef.setInput('derivaciones', loading());
      expect(acc<() => ViewState<unknown>>('lista')().status).toBe('loading');
      fixture.componentRef.setInput('derivaciones', empty({ label: 'x' }));
      expect(acc<() => ViewState<unknown>>('lista')().status).toBe('empty');
    });
  });
});
