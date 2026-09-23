import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthService } from '../../../../../core/auth/auth.service';
import { NoteGrid, type ColumnaDeCuadricula, type FilaDeCuadricula } from './note-grid';

/**
 * La cuadrícula de la consulta — **C-14**.
 *
 * Lo que estas pruebas fijan, que es lo que el pedido nombró:
 *
 * 1. **Las cabeceras salen del catálogo**, con su nombre y nunca un uuid.
 * 2. **Una fila por sesión.** Con la fila de hoy ya registrada no se ofrece
 *    cargar otra, y la restricción se evalúa contra lo que devolvió el
 *    servidor, no contra lo que dibujamos.
 * 3. **Una fila es N observaciones con el mismo encuentro**, no una observación
 *    con componentes: la lectura no devuelve componentes y guardarlos ahí sería
 *    escribir algo que la pantalla no puede releer.
 * 4. **Las celdas vacías no se escriben.** Una observación sin valor es basura
 *    en una historia clínica.
 * 5. **El orden es determinista**, con desempate: dos consultas del mismo
 *    instante no pueden alternar de lugar entre dos lecturas.
 */
describe('NoteGrid', () => {
  const PACIENTE = 'pp-1';
  const HOY = 'enc-hoy';
  const ANTES = 'enc-antes';

  const PRESION = 'c-presion';
  const PESO = 'c-peso';

  /** Un expediente con lo que cada caso necesite; lo demás, vacío. */
  function expediente(opciones: {
    observations?: readonly Record<string, unknown>[];
    encounters?: readonly Record<string, unknown>[];
  }): Record<string, unknown> {
    return {
      patientProfileId: PACIENTE,
      conditions: [],
      allergies: [],
      medicationRequests: [],
      observations: opciones.observations ?? [],
      encounters: opciones.encounters ?? [],
      careEpisodes: [],
      limit: 50,
      truncated: [],
    };
  }

  function observacion(
    encounterId: string,
    codeConceptId: string,
    valor: string,
  ): Record<string, unknown> {
    return {
      id: `obs-${encounterId}-${codeConceptId}`,
      codeConceptId,
      statusConceptId: 'st-final',
      quantityValue: valor,
      encounterId,
    };
  }

  function encuentro(id: string, startAt: string, reasonText: string): Record<string, unknown> {
    return { id, statusConceptId: 'st-fin', startAt, reasonText };
  }

  async function montar(
    opciones: {
      encounterId?: string | null;
      tenantId?: string | null;
      resumen?: Record<string, unknown>;
      etiquetas?: readonly Record<string, unknown>[];
    } = {},
  ) {
    await TestBed.configureTestingModule({
      imports: [NoteGrid],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            activeTenantId: signal(opciones.tenantId === undefined ? 't-1' : opciones.tenantId),
            practitionerProfileId: signal('prac-1'),
          },
        },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<NoteGrid> = TestBed.createComponent(NoteGrid);
    fixture.componentRef.setInput('patientProfileId', PACIENTE);
    fixture.componentRef.setInput(
      'encounterId',
      opciones.encounterId === undefined ? HOY : opciones.encounterId,
    );
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);

    http
      .expectOne((r) => r.url.endsWith(`/clinical/patients/${PACIENTE}/summary`))
      .flush(opciones.resumen ?? expediente({}));

    // El catálogo sólo se consulta si hay algún concepto que traducir.
    const etiquetas = http.match((r) => r.url.endsWith('/terminology/concepts'));
    etiquetas.forEach((peticion) =>
      peticion.flush({ items: opciones.etiquetas ?? [], count: 0, limit: 200 }),
    );
    fixture.detectChanges();

    return { fixture, http };
  }

  /** Lee un miembro protegido, que es donde vive el estado de la cuadrícula. */
  function interno<T>(fixture: ComponentFixture<NoteGrid>, nombre: string): T {
    return (fixture.componentInstance as unknown as Record<string, T>)[nombre];
  }

  it('la cabecera muestra el nombre del catálogo, nunca el uuid', async () => {
    const { fixture } = await montar({
      resumen: expediente({
        observations: [observacion(ANTES, PRESION, '120')],
        encounters: [encuentro(ANTES, '2026-09-10T10:00:00.000Z', 'Control')],
      }),
      etiquetas: [
        {
          conceptId: PRESION,
          code: 'BP',
          display: 'Presión arterial',
          codeSystemVersionId: 'v1',
        },
      ],
    });

    const columnas = interno<() => readonly ColumnaDeCuadricula[]>(fixture, 'columnas')();
    expect(columnas).toHaveLength(1);
    expect(columnas[0]?.nombre).toBe('Presión arterial');
    expect(columnas[0]?.nombre).not.toContain(PRESION);
  });

  it('las columnas son las mediciones que esa persona ya tiene', async () => {
    const { fixture } = await montar({
      resumen: expediente({
        observations: [
          observacion(ANTES, PRESION, '120'),
          observacion(ANTES, PESO, '70'),
          // Repetida en otra sesión: sigue siendo UNA columna.
          observacion(HOY, PRESION, '118'),
        ],
        encounters: [
          encuentro(ANTES, '2026-09-10T10:00:00.000Z', 'Control'),
          encuentro(HOY, '2026-09-20T10:00:00.000Z', 'Consulta'),
        ],
      }),
    });

    expect(interno<() => readonly ColumnaDeCuadricula[]>(fixture, 'columnas')()).toHaveLength(2);
  });

  it('una sesión con mediciones YA tiene su fila: no se ofrece cargar otra', async () => {
    const { fixture } = await montar({
      resumen: expediente({
        observations: [observacion(HOY, PRESION, '118')],
        encounters: [encuentro(HOY, '2026-09-20T10:00:00.000Z', 'Consulta')],
      }),
    });

    expect(interno<() => boolean>(fixture, 'yaTieneFila')()).toBe(true);
    expect(interno<() => boolean>(fixture, 'puedeCargarFila')()).toBe(false);
  });

  it('una sesión sin mediciones puede cargar su fila', async () => {
    const { fixture } = await montar({
      resumen: expediente({
        observations: [observacion(ANTES, PRESION, '120')],
        encounters: [encuentro(ANTES, '2026-09-10T10:00:00.000Z', 'Control')],
      }),
    });

    expect(interno<() => boolean>(fixture, 'yaTieneFila')()).toBe(false);
    expect(interno<() => boolean>(fixture, 'puedeCargarFila')()).toBe(true);
  });

  it('guardar escribe UNA observación por celda llena, todas con el mismo encuentro', async () => {
    const { fixture, http } = await montar({
      resumen: expediente({
        observations: [observacion(ANTES, PRESION, '120'), observacion(ANTES, PESO, '70')],
        encounters: [encuentro(ANTES, '2026-09-10T10:00:00.000Z', 'Control')],
      }),
    });

    const escribir = interno<(c: string, v: string) => void>(fixture, 'escribir').bind(
      fixture.componentInstance,
    );
    escribir(PRESION, '118');
    escribir(PESO, '69.5');
    fixture.detectChanges();

    interno<() => void>(fixture, 'guardar').call(fixture.componentInstance);

    const altas = http.match(
      (r) => r.url.endsWith('/clinical/observations') && r.method === 'POST',
    );
    expect(altas).toHaveLength(2);
    for (const alta of altas) {
      expect(alta.request.body).toMatchObject({
        patientProfileId: PACIENTE,
        custodianTenantId: 't-1',
        encounterId: HOY,
      });
      // La fila NO viaja como componentes: la lectura no los devuelve.
      expect(alta.request.body).not.toHaveProperty('components');
    }
    expect(altas.map((a) => a.request.body.codeConceptId).sort()).toEqual([PESO, PRESION].sort());
  });

  it('una celda vacía no se escribe', async () => {
    const { fixture, http } = await montar({
      resumen: expediente({
        observations: [observacion(ANTES, PRESION, '120'), observacion(ANTES, PESO, '70')],
        encounters: [encuentro(ANTES, '2026-09-10T10:00:00.000Z', 'Control')],
      }),
    });

    interno<(c: string, v: string) => void>(fixture, 'escribir').call(
      fixture.componentInstance,
      PRESION,
      '118',
    );
    fixture.detectChanges();
    interno<() => void>(fixture, 'guardar').call(fixture.componentInstance);

    const altas = http.match(
      (r) => r.url.endsWith('/clinical/observations') && r.method === 'POST',
    );
    expect(altas).toHaveLength(1);
    expect(altas[0]?.request.body.codeConceptId).toBe(PRESION);
  });

  it('sin una sola celda escrita no se puede guardar', async () => {
    const { fixture } = await montar({
      resumen: expediente({
        observations: [observacion(ANTES, PRESION, '120')],
        encounters: [encuentro(ANTES, '2026-09-10T10:00:00.000Z', 'Control')],
      }),
    });

    expect(interno<() => boolean>(fixture, 'filaVacia')()).toBe(true);
    expect(interno<() => boolean>(fixture, 'puedeGuardar')()).toBe(false);
  });

  it('las filas van de la más reciente a la más vieja, con desempate por encuentro', async () => {
    const MISMO_INSTANTE = '2026-09-10T10:00:00.000Z';
    const { fixture } = await montar({
      encounterId: null,
      resumen: expediente({
        observations: [
          observacion('enc-b', PRESION, '120'),
          observacion('enc-a', PRESION, '118'),
          observacion('enc-viejo', PRESION, '115'),
        ],
        encounters: [
          encuentro('enc-b', MISMO_INSTANTE, 'Control'),
          encuentro('enc-a', MISMO_INSTANTE, 'Control'),
          encuentro('enc-viejo', '2026-01-01T10:00:00.000Z', 'Control'),
        ],
      }),
    });

    const filas = interno<() => readonly FilaDeCuadricula[]>(fixture, 'filas')();
    // Empatadas en fecha: manda el id, y siempre el mismo.
    expect(filas.map((f) => f.encounterId)).toEqual(['enc-a', 'enc-b', 'enc-viejo']);
  });

  it('si el guardado falla, lo escrito sigue en la cuadrícula', async () => {
    const { fixture, http } = await montar({
      resumen: expediente({
        observations: [observacion(ANTES, PRESION, '120')],
        encounters: [encuentro(ANTES, '2026-09-10T10:00:00.000Z', 'Control')],
      }),
    });

    interno<(c: string, v: string) => void>(fixture, 'escribir').call(
      fixture.componentInstance,
      PRESION,
      '118',
    );
    fixture.detectChanges();
    interno<() => void>(fixture, 'guardar').call(fixture.componentInstance);

    http
      .match((r) => r.url.endsWith('/clinical/observations'))
      .forEach((peticion) =>
        peticion.flush({ mensaje: 'no' }, { status: 500, statusText: 'Server Error' }),
      );
    fixture.detectChanges();

    expect(interno<() => string | null>(fixture, 'errorAlGuardar')()).toContain('sigue acá');
    expect(
      interno<(c: string) => string>(fixture, 'valorDeColumna').call(
        fixture.componentInstance,
        PRESION,
      ),
    ).toBe('118');
  });

  it('sin organización no se puede cargar la fila', async () => {
    const { fixture } = await montar({
      tenantId: null,
      resumen: expediente({
        observations: [observacion(ANTES, PRESION, '120')],
        encounters: [encuentro(ANTES, '2026-09-10T10:00:00.000Z', 'Control')],
      }),
    });

    expect(interno<() => boolean>(fixture, 'puedeCargarFila')()).toBe(false);
  });

  it('sin encuentro abierto tampoco: la fila pertenece a una consulta', async () => {
    const { fixture } = await montar({
      encounterId: null,
      resumen: expediente({
        observations: [observacion(ANTES, PRESION, '120')],
        encounters: [encuentro(ANTES, '2026-09-10T10:00:00.000Z', 'Control')],
      }),
    });

    expect(interno<() => boolean>(fixture, 'puedeCargarFila')()).toBe(false);
  });

  it('el expediente sin nada muestra el vacío que orienta, no una tabla en blanco', async () => {
    const { fixture } = await montar({});
    expect(interno<() => boolean>(fixture, 'vacio')()).toBe(true);
  });
});
