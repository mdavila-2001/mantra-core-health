import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { BlockCancellations, cancelledBookingsText } from './block-cancellations';
import type { DialogConfig } from '../../shared/components/molecules/dialog/dialog.types';
import { DialogService } from '../../shared/components/molecules/dialog/dialog-service';

/**
 * Retirar un horario con citas vivas pregunta antes qué hacer con ellas
 * (etapa C, 24/10/2026). Lo que se fija acá es el contrato con la API: qué
 * pedido sale según lo que la persona decide, y que sin decidir no sale nada.
 */
describe('BlockCancellations · retirar un horario', () => {
  let http: HttpTestingController;
  let service: BlockCancellations;
  let respuesta = true;
  let dialogos: DialogConfig[] = [];

  const sinCitas = { templateId: 'tpl-1', total: 0, bookings: [], present: [] };
  const cita = {
    bookingId: 'b-1',
    startAt: '2026-11-03T13:00:00Z',
    endAt: '2026-11-03T13:30:00Z',
    patientName: 'Rosa Quispe',
    pending: false,
  };
  const retirado = {
    id: 'tpl-1',
    statusConceptId: 'retired',
    releasedSlots: 20,
    keptSlots: 1,
    liveBookings: 1,
    liveBookingIds: ['b-1'],
    truncated: false,
    cancelledBookings: 0,
  };

  beforeEach(() => {
    respuesta = true;
    dialogos = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: DialogService,
          useValue: {
            confirm: (config: DialogConfig) => {
              dialogos.push(config);
              return Promise.resolve(respuesta);
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(BlockCancellations);
  });

  afterEach(() => http.verify());

  async function tick(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('sin citas vivas retira directo, sin preguntar y sin indicador', async () => {
    const resultado = firstValueFrom(service.retireTemplate('tpl-1'));
    http.expectOne('/scheduling/templates/tpl-1/live-bookings').flush(sinCitas);
    await tick();

    const borrar = http.expectOne((r) => r.url === '/scheduling/templates/tpl-1');
    expect(borrar.request.method).toBe('DELETE');
    expect(borrar.request.params.has('affectedBookings')).toBe(false);
    borrar.flush(retirado);

    expect(await resultado).toEqual(retirado);
    expect(dialogos).toHaveLength(0);
  });

  it('con citas y el sí, retira cancelándolas: el DELETE lleva affectedBookings=cancel', async () => {
    const resultado = firstValueFrom(service.retireTemplate('tpl-1'));
    http
      .expectOne('/scheduling/templates/tpl-1/live-bookings')
      .flush({ ...sinCitas, total: 1, bookings: [cita] });
    await tick();

    expect(dialogos[0].title).toBe('Este horario tiene una cita');
    expect(dialogos[0].details?.[0].label).toBe('Rosa Quispe');
    expect(dialogos[0].destructive).toBe(true);

    const borrar = http.expectOne((r) => r.url === '/scheduling/templates/tpl-1');
    expect(borrar.request.params.get('affectedBookings')).toBe('cancel');
    borrar.flush({ ...retirado, cancelledBookings: 1 });

    expect((await resultado)?.cancelledBookings).toBe(1);
  });

  it('con citas y «Conservar», retira como siempre: sin indicador', async () => {
    respuesta = false;
    const resultado = firstValueFrom(service.retireTemplate('tpl-1'));
    http
      .expectOne('/scheduling/templates/tpl-1/live-bookings')
      .flush({ ...sinCitas, total: 1, bookings: [cita] });
    await tick();

    const borrar = http.expectOne((r) => r.url === '/scheduling/templates/tpl-1');
    expect(borrar.request.params.has('affectedBookings')).toBe(false);
    borrar.flush(retirado);
    expect(await resultado).toEqual(retirado);
  });

  it('con un paciente ya recibido sólo ofrece conservar; «Volver» no retira nada', async () => {
    respuesta = false;
    const resultado = firstValueFrom(service.retireTemplate('tpl-1'));
    http
      .expectOne('/scheduling/templates/tpl-1/live-bookings')
      .flush({ ...sinCitas, total: 1, present: [cita] });
    await tick();

    expect(dialogos[0].title).toBe('Hay un paciente ya recibido');
    expect(dialogos[0].confirmLabel).toBe('Retirar y conservar las citas');
    // `http.verify()` del afterEach falla si salió un DELETE.
    expect(await resultado).toBeNull();
  });

  it.each([404, 403])(
    'si la vista previa responde %i, retira como siempre: conserva las citas y no pregunta',
    async (status) => {
      const resultado = firstValueFrom(service.retireTemplate('tpl-1'));
      http
        .expectOne('/scheduling/templates/tpl-1/live-bookings')
        .flush({ code: 'NOT_FOUND', message: 'x' }, { status, statusText: 'x' });
      await tick();

      const borrar = http.expectOne((r) => r.url === '/scheduling/templates/tpl-1');
      expect(borrar.request.params.has('affectedBookings')).toBe(false);
      borrar.flush(retirado);

      expect(await resultado).toEqual(retirado);
      expect(dialogos).toHaveLength(0);
    },
  );

  it('un fallo real de la vista previa (500) NO retira nada a ciegas', async () => {
    const resultado = firstValueFrom(service.retireTemplate('tpl-1'));
    http
      .expectOne('/scheduling/templates/tpl-1/live-bookings')
      .flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Server Error' });

    await expect(resultado).rejects.toBeTruthy();
    // `http.verify()` del afterEach falla si salió un DELETE.
  });

  it('la frase del aviso cuenta las citas, y calla cuando no hubo ninguna', () => {
    expect(cancelledBookingsText(0)).toBe('');
    expect(cancelledBookingsText(undefined)).toBe('');
    expect(cancelledBookingsText(1)).toContain('1 cita');
    expect(cancelledBookingsText(3)).toContain('3 citas');
  });
});
