import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { ReportPost } from './report-post';

/**
 * Lo que estas pruebas fijan.
 *
 * Que el motivo viaja como **código del contrato** y no como la etiqueta que se
 * muestra —«Expone datos de un paciente» no es un valor que el servidor
 * entienda—; que sin motivo no se envía; que dos pulsaciones no crean dos
 * reportes; y que al terminar la pantalla dice lo que pasó sin prometer que el
 * contenido se vaya a bajar, porque eso lo decide una persona que todavía no lo
 * miró.
 */
describe('ReportPost', () => {
  let fixture: ComponentFixture<ReportPost>;
  let http: HttpTestingController;

  const texto = (): string => fixture.nativeElement.textContent as string;

  const pulsar = (etiqueta: string): void => {
    const botones: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    botones.find((b) => b.textContent!.includes(etiqueta))!.click();
    fixture.detectChanges();
  };

  const montar = (): void => {
    fixture = TestBed.createComponent(ReportPost);
    fixture.componentRef.setInput('postId', 'post-1');
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportPost],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('manda el código del contrato, no la etiqueta que se muestra', () => {
    montar();
    pulsar('Expone datos de un paciente');
    pulsar('Enviar reporte');

    const req = http.expectOne((r) => r.url === '/community/reports');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      targetType: 'POST',
      targetId: 'post-1',
      reason: 'PHI',
    });
    req.flush({ id: 'rep-1', moderationQueueId: 'q-1' });
  });

  it('agrega el detalle sólo si se escribió algo', () => {
    montar();
    pulsar('Spam o publicidad');

    const area: HTMLTextAreaElement =
      fixture.nativeElement.querySelector('textarea');
    area.value = '   Publica lo mismo diez veces   ';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    pulsar('Enviar reporte');

    const req = http.expectOne((r) => r.url === '/community/reports');
    // Recortado: los espacios de los extremos no son detalle.
    expect(req.request.body.detailText).toBe('Publica lo mismo diez veces');
    req.flush({ id: 'rep-1', moderationQueueId: 'q-1' });
  });

  it('sin motivo elegido no envía', () => {
    montar();
    pulsar('Enviar reporte');
    http.expectNone((r) => r.url === '/community/reports');
  });

  /**
   * Reportar dos veces crea dos filas: la cola las deduplica por contenido, pero
   * el recuento de reportes sube igual y le cambia la señal al moderador.
   */
  it('dos pulsaciones seguidas reportan una sola vez', () => {
    montar();
    pulsar('Agresión o acoso');
    pulsar('Enviar');
    pulsar('Enviando');

    http
      .expectOne((r) => r.url === '/community/reports')
      .flush({ id: 'rep-1', moderationQueueId: 'q-1' });
  });

  it('al terminar dice lo que pasó, sin prometer una baja', () => {
    montar();
    pulsar('Otro motivo');
    pulsar('Enviar reporte');
    http
      .expectOne((r) => r.url === '/community/reports')
      .flush({ id: 'rep-1', moderationQueueId: 'q-1' });
    fixture.detectChanges();

    expect(texto()).toContain('Reporte enviado');
    expect(texto()).toContain('equipo de moderación');
    expect(texto()).not.toContain('eliminad');
  });

  it('si falla, avisa y deja reintentar', () => {
    montar();
    pulsar('Spam o publicidad');
    pulsar('Enviar reporte');

    http
      .expectOne((r) => r.url === '/community/reports')
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos enviar el reporte');

    pulsar('Enviar reporte');
    http
      .expectOne((r) => r.url === '/community/reports')
      .flush({ id: 'rep-2', moderationQueueId: 'q-1' });
  });
});
