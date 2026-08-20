import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { MyAgenda } from './my-agenda';

const TENANT = '11111111-1111-1111-1111-111111111111';
const PERFIL = '22222222-2222-2222-2222-222222222222';

/**
 * **Mi agenda** — MAC-4.
 *
 * Es la primera pantalla donde un médico ve su propio horario después de
 * publicarlo: hasta que existió el `GET` de plantillas, `scheduling` sólo tenía
 * los dos POST y publicar era escribir algo que nadie podía volver a leer.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **El patrón se dice en palabras**, no en filas de tabla ni en números de
 *    día — el médico lee «martes de 09:00 a 13:00», no `dayOfWeek: 2`.
 * 2. **Las franjas idénticas se agrupan**: «lunes y jueves de 9 a 13» en vez de
 *    dos renglones que dicen lo mismo.
 * 3. **Sin horario publicado no es un fallo**, es un vacío con salida.
 * 4. **El aviso de agotamiento aparece sólo cuando corresponde** — es el parche
 *    manual del horizonte rodante, y si gritara siempre nadie lo miraría.
 */
describe('MyAgenda', () => {
  let fixture: ComponentFixture<MyAgenda>;
  let http: HttpTestingController;

  const RECURSOS = `/scheduling/resources?tenantId=${TENANT}`;

  function crear(perfil: string | null = PERFIL, tenant: string | null = TENANT): void {
    // Cada caso monta su propia sesión (con perfil, sin perfil, sin tenant), y
    // sin reiniciar, el segundo `configureTestingModule` revienta.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            practitionerProfileId: signal<string | null>(perfil),
            activeTenantId: signal<string | null>(tenant),
            roles: signal<readonly string[]>(['PRACTITIONER']),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(MyAgenda);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  afterEach(() => http?.verify());

  /** Responde el recurso propio y devuelve su id. */
  function conRecurso(): string {
    http
      .expectOne(RECURSOS)
      .flush({ items: [{ id: 'res-1', name: 'Agenda', resourceRefId: PERFIL }], count: 1 });
    fixture.detectChanges();
    return 'res-1';
  }

  /** Responde la plantilla y, después, los cupos. */
  function conPlantilla(rules: unknown[], extra: Record<string, unknown> = {}): void {
    http.expectOne('/scheduling/resources/res-1/templates').flush({
      items: [{ id: 'tpl-1', name: 'Horario', statusConceptId: 'c', rules, ...extra }],
      count: 1,
    });
    fixture.detectChanges();
  }

  /** Responde los cupos con su último inicio. */
  function conCuposHasta(fecha: Date | null): void {
    const req = http.expectOne((r) => r.url === '/scheduling/slots');
    req.flush({
      items: fecha === null ? [] : [{ id: 's', startAt: fecha.toISOString() }],
      count: 1,
    });
    fixture.detectChanges();
  }

  it('dice el horario en palabras, sin números de día', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00', slotMinutes: 30 }]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Martes de 09:00 a 13:00');
    expect(texto).toContain('consultas de 30 min');
    expect(texto).not.toContain('dayOfWeek');
    expect(texto).not.toContain('tpl-1');
  });

  it('agrupa las franjas idénticas en un solo renglón', () => {
    crear();
    conRecurso();
    conPlantilla([
      { dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00', slotMinutes: 30 },
      { dayOfWeek: 4, startTime: '09:00:00', endTime: '13:00:00', slotMinutes: 30 },
    ]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    expect(fixture.nativeElement.textContent).toContain('Lunes y Jueves de 09:00 a 13:00');
  });

  it('separa las franjas que no son iguales', () => {
    crear();
    conRecurso();
    conPlantilla([
      { dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00', slotMinutes: 30 },
      { dayOfWeek: 4, startTime: '14:00:00', endTime: '18:00:00', slotMinutes: 30 },
    ]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Lunes de 09:00 a 13:00');
    expect(texto).toContain('Jueves de 14:00 a 18:00');
  });

  it('la semanita marca los días que atiende y los que no, con palabras', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    const dias = fixture.nativeElement.querySelectorAll('.mi-agenda__dia');
    expect(dias).toHaveLength(7);
    // El color nunca solo: el estado va también en el nombre accesible.
    expect(dias[1].getAttribute('aria-label')).toBe('Martes: atendés');
    expect(dias[0].getAttribute('aria-label')).toBe('Lunes: no atendés');
  });

  it('sin fecha de fin lo dice, en vez de dejar el dato en blanco', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    expect(fixture.nativeElement.textContent).toContain('rige hasta que lo cambies');
  });

  it('sin horario publicado ofrece publicarlo, en vez de un error', () => {
    crear();
    conRecurso();
    http.expectOne('/scheduling/resources/res-1/templates').flush({ items: [], count: 0 });
    fixture.detectChanges();

    // El M34 lo exige: un vacío sin salida es un callejón.
    expect(fixture.nativeElement.textContent).toContain('Publicar mi agenda');
  });

  it('sin recurso propio tampoco es un error', () => {
    crear();
    http.expectOne(RECURSOS).flush({ items: [], count: 0 });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Publicar mi agenda');
  });

  it('una cuenta sin perfil profesional no pide nada al servidor', () => {
    crear(null);
    // Ni una petición: la pantalla no le corresponde.
    http.verify();
  });

  it('no pide una ventana que la API rechaza', () => {
    // `GET /scheduling/slots` contesta 422 «La ventana no puede superar 92
    // días». Pedía un año, y como el fallo se traga a propósito, la tarjeta
    // seguía andando y el aviso de agotamiento no aparecía nunca: se vio en la
    // pestaña de red, no en las pruebas.
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00' }]);

    const req = http.expectOne((r) => r.url === '/scheduling/slots');
    const desde = new Date(req.request.params.get('from') as string);
    const hasta = new Date(req.request.params.get('to') as string);
    const dias = (hasta.getTime() - desde.getTime()) / (24 * 60 * 60 * 1000);
    expect(dias).toBeLessThanOrEqual(92);

    req.flush({ items: [], count: 0 });
  });

  it('avisa cuando los turnos publicados se están por agotar', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00' }]);
    // Diez días por delante: menos que el margen de treinta.
    conCuposHasta(new Date(Date.now() + 10 * 24 * 60 * 60 * 1000));

    expect(fixture.nativeElement.textContent).toContain('se están por agotar');
  });

  it('no avisa cuando todavía quedan meses de turnos', () => {
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00' }]);
    conCuposHasta(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).not.toContain('se están por agotar');
    expect(texto).toContain('Tenés turnos abiertos hasta el');
  });

  it('si la lectura de cupos falla, la tarjeta sigue sirviendo', () => {
    // Saber hasta cuándo llegan los cupos es un extra: no puede llevarse puesto
    // el horario, que es el dato principal.
    crear();
    conRecurso();
    conPlantilla([{ dayOfWeek: 2, startTime: '09:00:00', endTime: '13:00:00' }]);
    http
      .expectOne((r) => r.url === '/scheduling/slots')
      .flush({ message: 'x' }, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Martes de 09:00 a 13:00');
  });
});
