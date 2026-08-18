import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { Moderation } from './moderation';

/**
 * Lo que estas pruebas fijan.
 *
 * Cuatro cosas que no se ven leyendo el HTML: que **sin motivo no se confirma**
 * una decisión —el contrato lo exige y acá se avisa antes—; que los filtros
 * viajan como códigos y no como uuids; que la cola se **recarga** tras decidir,
 * porque decidir cierra también los reportes del contenido y esa consecuencia la
 * sabe el servidor; y que la resolución de una apelación **no** pide un motivo
 * que no se puede guardar.
 */
describe('Moderation', () => {
  let fixture: ComponentFixture<Moderation>;
  let http: HttpTestingController;

  const texto = (): string => fixture.nativeElement.textContent as string;

  const paginaVacia = { items: [], count: 0, limit: 25, nextCursor: null };

  const entrada = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    contentTypeConceptId: 'c-post',
    contentRefId: `abcdef01-${id}`,
    sourceConceptId: 'c-report',
    priorityConceptId: 'c-normal',
    statusConceptId: 'c-queued',
    assignedToUserId: null,
    queuedAt: '2026-08-15T10:00:00.000Z',
    reportCount: 1,
    report: {
      id: 'rep-1',
      reasonConceptId: 'c-pii',
      detailText: 'Publica datos de un paciente.',
      createdAt: '2026-08-15T09:00:00.000Z',
    },
    ...extra,
  });

  const pulsar = (etiqueta: string): void => {
    const botones: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    botones.find((b) => b.textContent!.includes(etiqueta))!.click();
    fixture.detectChanges();
  };

  /** Monta la pantalla y responde la primera carga de la cola. */
  const montar = (items: unknown[] = [entrada('q1')]): void => {
    fixture = TestBed.createComponent(Moderation);
    fixture.detectChanges();

    http
      .expectOne((r) => r.url === '/community/moderation/queue')
      .flush({ ...paginaVacia, items, count: items.length });
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Moderation],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  /**
   * Los filtros van por código, no por uuid de concepto: pedirle uuids a la
   * pantalla la ataría a la semilla de terminología de cada ambiente.
   */
  it('pide la cola filtrando por código de estado', () => {
    fixture = TestBed.createComponent(Moderation);
    fixture.detectChanges();

    const req = http.expectOne((r) => r.url === '/community/moderation/queue');
    expect(req.request.params.get('status')).toBe('QUEUED');
    expect(req.request.params.get('limit')).toBe('25');
    req.flush(paginaVacia);
  });

  it('muestra el motivo declarado y el recuento cuando hay varios reportes', () => {
    montar([entrada('q1', { reportCount: 7 })]);

    expect(texto()).toContain('Publica datos de un paciente.');
    expect(texto()).toContain('7 reportes');
  });

  it('una entrada sin reporte lo dice en vez de dejar el hueco', () => {
    montar([entrada('q1', { report: null, reportCount: 0 })]);

    expect(texto()).toContain('no nació de un reporte de usuario');
  });

  /**
   * El contrato exige el motivo y rechaza la decisión sin él. El botón apagado
   * es comodidad, no la regla: si sólo estuviera acá, bastaría con llamar al
   * endpoint por fuera.
   */
  it('sin motivo no confirma la decisión', () => {
    montar();
    pulsar('Decidir');
    pulsar('Dar de baja');

    const confirmar: HTMLButtonElement = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) =>
      (b as HTMLButtonElement).textContent!.includes('Confirmar decisión'),
    ) as HTMLButtonElement;

    expect(confirmar.getAttribute('aria-disabled')).toBe('true');

    confirmar.click();
    fixture.detectChanges();
    http.expectNone((r) => r.url.includes('/decision'));
  });

  it('confirma la decisión con su motivo y recarga la cola', () => {
    montar();
    pulsar('Decidir');
    pulsar('Dar de baja');

    const area: HTMLTextAreaElement =
      fixture.nativeElement.querySelector('textarea');
    area.value = 'Incluía el nombre de un paciente.';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    pulsar('Confirmar decisión');

    const req = http.expectOne(
      (r) => r.url === '/community/moderation/queue/q1/decision',
    );
    expect(req.request.body).toEqual({
      decision: 'REMOVED',
      rationaleText: 'Incluía el nombre de un paciente.',
    });
    req.flush({ id: 'dec-1', strikeId: null, decision: 'REMOVED' });
    fixture.detectChanges();

    // Se recarga en vez de sacar la fila a mano: decidir cierra también los
    // reportes del contenido, y esa consecuencia la sabe el servidor.
    http
      .expectOne((r) => r.url === '/community/moderation/queue')
      .flush(paginaVacia);
    fixture.detectChanges();

    expect(texto()).toContain('Decisión registrada.');
  });

  it('el motivo de sólo espacios no alcanza', () => {
    montar();
    pulsar('Decidir');
    pulsar('Advertir');

    const area: HTMLTextAreaElement =
      fixture.nativeElement.querySelector('textarea');
    area.value = '    ';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const confirmar: HTMLButtonElement = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((b) =>
      (b as HTMLButtonElement).textContent!.includes('Confirmar decisión'),
    ) as HTMLButtonElement;

    expect(confirmar.getAttribute('aria-disabled')).toBe('true');
  });

  describe('apelaciones', () => {
    const apelacion = {
      id: 'ap-1',
      moderationDecisionId: 'dec-1',
      appellantProfileId: 'ffffffff-0000-0000-0000-000000000000',
      reasonText: 'No era información de un paciente.',
      statusConceptId: 'c-open',
      resolutionConceptId: null,
      reviewedByUserId: null,
      resolvedAt: null,
      createdAt: '2026-08-16T10:00:00.000Z',
      decision: {
        id: 'dec-1',
        moderationQueueId: 'q1',
        decisionConceptId: 'c-removed',
        policyConceptId: 'c-policy',
        rationaleText: 'Incluía el nombre de un paciente.',
        actionTakenConceptId: null,
        decidedByUserId: 'mod-1',
        decidedAt: '2026-08-15T12:00:00.000Z',
      },
    };

    const abrirApelaciones = (): void => {
      montar([]);
      pulsar('Apelaciones abiertas');
      http
        .expectOne((r) => r.url === '/community/moderation/appeals')
        .flush({ ...paginaVacia, items: [apelacion], count: 1 });
      fixture.detectChanges();
    };

    it('pide sólo las abiertas', () => {
      montar([]);
      pulsar('Apelaciones abiertas');

      const req = http.expectOne(
        (r) => r.url === '/community/moderation/appeals',
      );
      expect(req.request.params.get('status')).toBe('OPEN');
      req.flush(paginaVacia);
    });

    /**
     * Resolver una apelación sin leer qué se decidió y por qué es resolverla a
     * ciegas: por eso la decisión viaja embebida y se muestra.
     */
    it('muestra el motivo de la decisión impugnada', () => {
      abrirApelaciones();

      expect(texto()).toContain('No era información de un paciente.');
      expect(texto()).toContain('Incluía el nombre de un paciente.');
    });

    /**
     * `moderation_appeals` no tiene columna para el motivo de la resolución.
     * Pedirlo sería pedir algo que se descarta; está declarado como bloqueo de
     * esquema en el carril.
     */
    it('no pide un motivo que no se puede guardar', () => {
      abrirApelaciones();
      pulsar('Resolver');

      expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
    });

    it('resuelve y avisa qué no hace la reversión', () => {
      abrirApelaciones();
      pulsar('Resolver');

      expect(texto()).toContain('no restituye el contenido ni anula el strike');

      pulsar('Revertir la decisión');
      pulsar('Confirmar resolución');

      const req = http.expectOne(
        (r) => r.url === '/community/moderation/appeals/ap-1/resolve',
      );
      expect(req.request.body).toEqual({ resolution: 'OVERTURNED' });
      req.flush({ id: 'ap-1' });
      fixture.detectChanges();

      http
        .expectOne((r) => r.url === '/community/moderation/appeals')
        .flush(paginaVacia);
      fixture.detectChanges();

      expect(texto()).toContain('Apelación resuelta.');
    });

    it('sin resolución elegida no confirma', () => {
      abrirApelaciones();
      pulsar('Resolver');

      const confirmar: HTMLButtonElement = Array.from(
        fixture.nativeElement.querySelectorAll('button'),
      ).find((b) =>
        (b as HTMLButtonElement).textContent!.includes('Confirmar resolución'),
      ) as HTMLButtonElement;

      expect(confirmar.getAttribute('aria-disabled')).toBe('true');
    });
  });
});
