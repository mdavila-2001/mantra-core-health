import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';

import { Blocks } from './blocks';
import { AuthService } from '../../../core/auth/auth.service';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';

const TENANT = 't-1';
const PERFIL = 'hp-1';

/** El catálogo, para que el motivo se resuelva y se pueda precargar. */
const CATALOGO = [
  { type: 'VACATION', conceptId: 'c-1', label: 'Vacaciones', requiresText: false, blocks: true },
];

/**
 * LOS BLOQUEOS, CON SU PROPIO FLUJO — carril 11.
 *
 * El pedido original lo dice en mayúsculas: «TIENE EL MISMO DISEÑO Y RUTAS QUE
 * TODO EL FLUJO DE HORARIOS». Hasta acá bloquear era un panel dentro de «Mi
 * agenda»: funcionaba, pero no había lista, ni históricos, ni forma de ver de
 * un vistazo qué tenías cerrado.
 */
describe('Blocks', () => {
  let fixture: ComponentFixture<Blocks>;
  let http: HttpTestingController;
  let respuestaDelDialogo = true;

  function acc(): {
    vigentes: () => readonly { id: string; motivo: string; descripcion: string | null }[];
    historicos: () => readonly { id: string }[];
  } {
    return fixture.componentInstance as never;
  }

  function crear(perfil: string | null = PERFIL): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            activeTenantId: signal<string | null>(TENANT),
            practitionerProfileId: signal<string | null>(perfil),
            roles: signal<readonly string[]>(['PRACTITIONER']),
          },
        },
        {
          provide: DialogService,
          useValue: { confirm: () => Promise.resolve(respuestaDelDialogo) },
        },
      ],
    });
    fixture = TestBed.createComponent(Blocks);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  }

  /** Responde el recurso y la lista, que es lo que la pantalla pide al abrir. */
  function responder(items: unknown[]): void {
    http.expectOne((r) => r.url === '/scheduling/resources').flush({
      items: [{ id: 'res-1', name: 'Consultorio', resourceRefId: PERFIL }],
      count: 1,
    });
    fixture.detectChanges();
    // El catálogo va PRIMERO: cada bloqueo resuelve su motivo contra él para
    // poder precargarlo al editar. Al revés, todos caerían en el respaldo.
    http.expectOne('/scheduling/exception-types').flush({ items: CATALOGO });
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/scheduling/resources/res-1/exceptions')
      .flush({ items, count: items.length });
    fixture.detectChanges();
  }

  function bloqueo(id: string, dias: number, extra: Record<string, unknown> = {}): unknown {
    const desde = new Date();
    desde.setDate(desde.getDate() + dias);
    const hasta = new Date(desde);
    hasta.setHours(hasta.getHours() + 4);
    return {
      id,
      exceptionTypeConceptId: 'c-1',
      startAt: desde.toISOString(),
      endAt: hasta.toISOString(),
      reasonLabel: 'Vacaciones',
      ...extra,
    };
  }

  afterEach(() => http.verify());

  it('separa lo vigente de lo que ya pasó', () => {
    crear();
    responder([bloqueo('b-futuro', 5), bloqueo('b-viejo', -30)]);

    expect(acc().vigentes().map((b) => b.id)).toEqual(['b-futuro']);
    expect(acc().historicos().map((b) => b.id)).toEqual(['b-viejo']);
  });

  it('usa la etiqueta del servidor, y sin ella NO inventa un motivo', () => {
    // El motivo catalogado es lo único de un bloqueo que también ve el
    // paciente: poner una palabra nuestra ahí sería ponerle al profesional
    // algo que no eligió.
    crear();
    responder([bloqueo('b-1', 5), bloqueo('b-2', 6, { reasonLabel: undefined })]);

    const motivos = acc().vigentes().map((b) => b.motivo);
    expect(motivos).toContain('Vacaciones');
    expect(motivos).toContain('Sin motivo registrado');
  });

  it('la descripción libre viaja aparte del motivo', () => {
    // Son dos cosas, y el pedido original lo dice: «un motivo (catalogable) y
    // una descripción». La descripción sólo la ve quien administra la agenda.
    crear();
    responder([bloqueo('b-1', 5, { reason: 'Me voy a Tarija' })]);

    expect(acc().vigentes()[0].descripcion).toBe('Me voy a Tarija');
  });

  it('quitar pide confirmación y llama al DELETE', async () => {
    crear();
    responder([bloqueo('b-1', 5)]);

    await (fixture.componentInstance as never as { quitar(b: unknown): Promise<void> }).quitar(
      acc().vigentes()[0],
    );

    const req = http.expectOne('/scheduling/exceptions/b-1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    fixture.detectChanges();

    // Y recarga: el bloqueo ya no está, así que la lista de arriba miente.
    responder([]);
  });

  it('si se cancela el diálogo, NO borra nada', async () => {
    // Quitar un bloqueo no tiene deshacer y los cupos no vuelven solos: la
    // confirmación es lo único que separa un clic distraído de un rato abierto
    // que nadie quería abrir.
    crear();
    responder([bloqueo('b-1', 5)]);

    respuestaDelDialogo = false;
    await (fixture.componentInstance as never as { quitar(b: unknown): Promise<void> }).quitar(
      acc().vigentes()[0],
    );
    respuestaDelDialogo = true;

    // `http.verify()` del afterEach falla si salió algún DELETE.
    expect(acc().vigentes()).toHaveLength(1);
  });

  it('sin perfil profesional no pide nada al servidor', () => {
    // Es una pantalla de quien atiende. Preguntar igual sería un 403 con forma
    // de pantalla vacía.
    crear(null);
    expect(acc().vigentes()).toEqual([]);
  });

  /**
   * CORREGIR UN BLOQUEO — AC-11-7, con el mismo formulario que lo crea.
   *
   * Escribir uno aparte para editar es el camino corto que termina con dos
   * formularios que divergen: uno gana un campo, el otro no, y a los seis
   * meses nadie sabe cuál es el bueno.
   */
  describe('corregir un bloqueo', () => {
    function editando(): { id: string; exceptionType: string } | null {
      return (
        fixture.componentInstance as never as {
          editando: () => { id: string; exceptionType: string } | null;
        }
      ).editando();
    }

    it('precarga el motivo resuelto contra el catálogo', () => {
      // Sin el catálogo leído antes, el motivo caería en el respaldo y editar
      // cambiaría el tipo del bloqueo sin que nadie lo pidiera.
      crear();
      responder([bloqueo('b-1', 5)]);

      const boton: HTMLButtonElement | null = fixture.nativeElement.querySelector(
        '[data-testid="bloqueo-editar"]',
      );
      boton?.click();
      fixture.detectChanges();

      expect(editando()?.id).toBe('b-1');
      expect(editando()?.exceptionType).toBe('VACATION');
    });

    it('sólo lo vigente se puede corregir', () => {
      // Un bloqueo que ya pasó no se toca: corregirlo no cambia ningún turno.
      crear();
      responder([bloqueo('b-viejo', -30)]);

      expect(
        fixture.nativeElement.querySelector('[data-testid="bloqueo-editar"]'),
      ).toBeNull();
    });
  });
});
