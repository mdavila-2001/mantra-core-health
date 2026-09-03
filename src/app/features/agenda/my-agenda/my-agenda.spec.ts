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

  /** Responde el listado con una plantilla vigente y N retiradas. */
  function conHistorico(retiradas: number): void {
    http.expectOne('/scheduling/resources/res-1/templates').flush({
      items: [
        {
          id: 'tpl-vieja',
          name: 'Horario anterior',
          statusConceptId: 'r',
          retired: true,
          rules: [],
        },
        {
          id: 'tpl-1',
          name: 'Horario',
          statusConceptId: 'c',
          retired: false,
          rules: [{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }],
        },
      ].slice(retiradas === 0 ? 1 : 0),
      count: retiradas === 0 ? 1 : 2,
    });
    fixture.detectChanges();
  }

  /* -- El horario vigente, el retirado y el histórico (TAREA-10) ------------ */

  describe('vigente vs retirado', () => {
    it('no confunde un horario retirado con el vigente aunque sea el más reciente', () => {
      // El listado devuelve TODAS las plantillas ordenadas por creación. Antes
      // se tomaba `items[0]`: retirar el horario y recargar dejaba al médico
      // viendo el retirado como si siguiera atendiendo.
      crear();
      conRecurso();
      http.expectOne('/scheduling/resources/res-1/templates').flush({
        items: [
          {
            id: 'tpl-retirada',
            name: 'La más reciente, retirada',
            statusConceptId: 'r',
            retired: true,
            rules: [{ dayOfWeek: 3, startTime: '15:00:00', endTime: '19:00:00' }],
          },
          {
            id: 'tpl-viva',
            name: 'La vigente',
            statusConceptId: 'c',
            retired: false,
            rules: [{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }],
          },
        ],
        count: 2,
      });
      fixture.detectChanges();
      conCuposHasta(new Date('2030-01-01'));

      const texto: string = fixture.nativeElement.textContent;
      // El lunes es de la vigente; el miércoles, de la retirada.
      expect(texto).toContain('unes');
      expect(texto).not.toContain('iércoles');
    });

    it('los horarios retirados se listan aparte, como historia', () => {
      crear();
      conRecurso();
      conHistorico(1);
      conCuposHasta(new Date('2030-01-01'));

      const texto: string = fixture.nativeElement.textContent;
      expect(texto).toContain('Horarios anteriores');
      expect(texto).toContain('Horario anterior');
      expect(texto).toContain('Retirado');
    });

    it('sin historia no dibuja la sección: no hay nada que contar', () => {
      crear();
      conRecurso();
      conHistorico(0);
      conCuposHasta(new Date('2030-01-01'));

      expect(fixture.nativeElement.textContent).not.toContain('Horarios anteriores');
    });

    it('un horario sin fecha de fin lleva la etiqueta HORARIO PERMANENTE', () => {
      crear();
      conRecurso();
      conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }], {
        retired: false,
      });
      conCuposHasta(new Date('2030-01-01'));

      // Las palabras y las mayúsculas son del propietario (punto 5).
      expect(fixture.nativeElement.textContent).toContain('HORARIO PERMANENTE');
    });

    it('con fecha de fin no la lleva: no es permanente', () => {
      crear();
      conRecurso();
      conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }], {
        retired: false,
        validTo: '2030-12-31T00:00:00.000Z',
      });
      conCuposHasta(new Date('2030-01-01'));

      expect(fixture.nativeElement.textContent).not.toContain('HORARIO PERMANENTE');
    });

    it('avisa que estos horarios no son para cirugías', () => {
      crear();
      conRecurso();
      conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }], {
        retired: false,
      });
      conCuposHasta(new Date('2030-01-01'));

      // Punto 8, textual del propietario: es una regla, no una nota al margen.
      const texto: string = fixture.nativeElement.textContent;
      expect(texto).toContain('para consulta y cita');
      expect(texto).toContain('quirúrgicas');
    });

    it('ofrece retirar el horario, y dice retirar y no borrar', () => {
      crear();
      conRecurso();
      conPlantilla([{ dayOfWeek: 1, startTime: '09:00:00', endTime: '13:00:00' }], {
        retired: false,
      });
      conCuposHasta(new Date('2030-01-01'));

      const texto: string = fixture.nativeElement.textContent;
      // «Borrar» prometería algo que el sistema no hace: la plantilla no se
      // puede borrar nunca, la referencia la auditoría.
      expect(texto).toContain('Retirar horario');
      expect(texto).not.toContain('Borrar horario');
    });
  });

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

  /**
   * VOLVER A ACTIVAR UN HORARIO PAUSADO — «volví del viaje».
   *
   * Retirar era un camino de ida: publicar uno nuevo dejaba el viejo en la
   * lista para siempre. Y reactivar **no repone los cupos**, así que lo que
   * esta pantalla no puede hacer es dejar creer que sí.
   */
  describe('reactivar un horario', () => {
    it('lo ofrece sobre el horario retirado', () => {
      crear();
      conRecurso();
      conHistorico(1);
      conCuposHasta(new Date('2030-01-01'));

      const boton = fixture.nativeElement.querySelector('[data-testid="historico-reactivar"]');
      expect(boton).not.toBeNull();
    });

    it('llama al endpoint y avisa que faltan los cupos', () => {
      crear();
      conRecurso();
      conHistorico(1);
      conCuposHasta(new Date('2030-01-01'));

      const boton: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        '[data-testid="historico-reactivar"]',
      );
      boton?.click();
      fixture.detectChanges();

      const req = http.expectOne('/scheduling/templates/tpl-vieja/reactivate');
      expect(req.request.method).toBe('POST');
      // El aviso es la mitad del arreglo: sin él, el horario queda «vigente» y
      // sin un solo turno ofrecido, y nadie sabe por qué.
      req.flush({ id: 'tpl-vieja', statusConceptId: 'c-pub', slotsPendientes: true });
      fixture.detectChanges();

      // Y recarga: el horario cambió de estado, así que la lista de arriba ya
      // no describe lo que hay.
      conRecurso();
      conHistorico(1);
      conCuposHasta(new Date('2030-01-01'));
    });
  });
});
