import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../../../../core/auth/session.store';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import type { CierreDelFormulario } from '../form-conclusion-block/form-conclusion-block';
import {
  BLOQUE_CIRUGIA,
  BLOQUE_ALERGIA,
  BLOQUE_DIAGNOSTICO,
  BLOQUE_LABORATORIO,
  BLOQUE_ODONTOLOGIA,
  PLANTILLA_HOJA_LIBRE,
  SpecialtyFormBlock,
} from './specialty-form-block';

/**
 * Completar la plantilla de la especialidad dentro del encuentro — carril 2,
 * punto 1. Lo que estas pruebas fijan:
 *
 * 1. **Vive dentro del encuentro abierto**, igual que el diagnóstico y la
 *    receta: sin uno, no hay dónde adjuntar la instancia de `forms`.
 * 2. **Una sola plantilla se preselecciona sola**; con más de una, se elige.
 * 3. **Los obligatorios del esquema gobiernan el envío**, no sólo el DTO.
 * 4. **Completar encadena las tres llamadas de `forms`** — abrir, capturar,
 *    cerrar — y limpia el formulario al terminar.
 * 5. **El `409` de una instancia repetida es un aviso, no un error rojo** —
 *    mismo criterio que el duplicado del diagnóstico.
 * 6. **Con una instancia previa, el bloque entra en modo lectura**: muestra lo
 *    respondido, no ofrece crear otra, y los valores enmascarados salen como
 *    marcador — nunca el contenido.
 */

const PLANTILLA = {
  id: 'tpl-1',
  specialtyConceptId: 'sp-1',
  code: 'CARDIO_INTAKE',
  name: 'Ficha de cardiología',
  version: 1,
  statusConceptId: 'st-1',
  fields: [
    {
      assignmentId: 'as-1',
      fieldId: 'f-1',
      code: 'tolerancia',
      name: 'Tolerancia al ejercicio',
      dataType: 'string',
      required: true,
    },
    {
      assignmentId: 'as-2',
      fieldId: 'f-2',
      code: 'edema',
      name: 'Edema',
      dataType: 'boolean',
      required: false,
    },
  ],
};

describe('SpecialtyFormBlock', () => {
  let fixture: ComponentFixture<SpecialtyFormBlock>;
  let componente: SpecialtyFormBlock;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SpecialtyFormBlock);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('encounterId', 'enc-1');
    fixture.componentRef.setInput('patientProfileId', 'pac-1');
  });

  afterEach(() => {
    // El bloque pregunta con qué especialidad se presenta quien atiende para
    // preseleccionar su plantilla. La mayoría de los casos no la ejerce, así
    // que se drena acá: sin perfil profesional —lo que responde el 404— el
    // bloque sigue funcionando con el selector de siempre.
    for (const perfil of http.match((r) => r.url === '/profiles/practitioners/me/summary')) {
      if (!perfil.cancelled) {
        perfil.flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
      }
    }
    // Y desde C-14, la hoja en blanco trae su cuadrícula, que lee el expediente
    // para saber si esta consulta ya tiene su fila. Mismo criterio que el
    // perfil: se drena con una respuesta válida en vez de relajar el `verify`,
    // que es lo que dejaría pasar sin ruido una petición de más.
    for (const expediente of http.match((r) =>
      r.url.endsWith('/clinical/patients/pac-1/summary'),
    )) {
      if (!expediente.cancelled) {
        expediente.flush({
          patientProfileId: 'pac-1',
          conditions: [],
          allergies: [],
          medicationRequests: [],
          observations: [],
          encounters: [],
          careEpisodes: [],
          limit: 50,
          truncated: [],
        });
      }
    }
    // Desde D4, con una plantilla elegida se dibuja el cierre de la ficha, y
    // sus selectores piden sus catálogos. Se drenan con lista vacía: lo que
    // gobierna el cierre lo cubren sus propias pruebas y las de abajo.
    for (const catalogo of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      if (!catalogo.cancelled) {
        catalogo.flush({ code: 'x', name: 'x', definitionId: 'd', valueSetId: 'v', options: [] });
      }
    }
    http.verify();
  });

  /** La especialidad de quien atiende, para los casos que la ejercen. */
  function responderEspecialidad(specialtyConceptId: string): void {
    http
      .expectOne((r) => r.url === '/profiles/practitioners/me/summary')
      .flush({
        profileId: 'hp-1',
        personId: 'per-1',
        practitionerCode: 'MP-1',
        specialties: [
          {
            id: 'sp-1',
            specialtyConceptId,
            isPrimary: true,
            boardCertified: false,
            verificationStatusConceptId: 'vs-1',
          },
        ],
        credentials: [],
        licenses: [],
        languages: [],
        affiliations: [],
        activity: {},
        createdAt: '2026-08-17T14:00:00.000Z',
      });
  }

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function señal<T>(nombre: string): { set: (v: T) => void } {
    return (componente as unknown as Record<string, { set: (v: T) => void }>)[nombre];
  }

  /** Lo que el desplegable ofrece hoy, en orden. */
  /**
   * Las **plantillas** que ofrece el desplegable.
   *
   * Deja fuera las seis entradas fijas a propósito —diagnóstico, alergia, hoja
   * en blanco, cirugía, odontología y laboratorio—: no son plantillas del
   * catálogo sino lo que se puede completar sin ninguna, y están siempre. Si
   * contaran, cada prueba sobre qué fichas se ofrecen tendría que sumarles
   * cinco, y el número dejaría de decir lo que la prueba quiere decir. Que
   * estén, y en qué orden, lo fija su propia prueba.
   */
  const ENTRADAS_FIJAS: readonly string[] = [
    BLOQUE_DIAGNOSTICO,
    BLOQUE_ALERGIA,
    PLANTILLA_HOJA_LIBRE,
    BLOQUE_CIRUGIA,
    BLOQUE_ODONTOLOGIA,
    BLOQUE_LABORATORIO,
  ];

  function etiquetasOfrecidas(): string[] {
    return opcionesCrudas()
      .filter((opcion) => !ENTRADAS_FIJAS.includes(opcion.value))
      .map((opcion) => opcion.label);
  }

  /**
   * Vacía las lecturas que dispara el bloque recién montado.
   *
   * Diagnóstico, procedimiento y laboratorio traen cada uno sus catálogos y su
   * histórico. Esta prueba mira que se dibuje el bloque correcto, no lo que
   * cada uno hace con sus datos, pero el `afterEach` verifica que no queden
   * peticiones sin responder: se les contesta vacío y listo.
   */
  function drenarLecturasDelBloque(): void {
    for (const peticion of http.match(() => true)) {
      peticion.flush({ items: [], options: [], nextCursor: null });
    }
  }

  /** El desplegable tal cual, con las entradas fijas incluidas. */
  function opcionesCrudas(): readonly { value: string; label: string }[] {
    return interno<() => readonly { value: string; label: string }[]>('opcionesDePlantilla')();
  }

  function peticionDePlantillas() {
    return http.expectOne((r) => r.url === '/charts/templates' && r.method === 'GET');
  }

  function peticionDeRespuesta() {
    return http.expectOne(
      (r) =>
        r.url === '/forms/instances' && r.method === 'GET' && r.params.get('encounter') === 'enc-1',
    );
  }

  const LISTADO_VACIO = { encounterId: 'enc-1', items: [], limit: 50, truncated: false };

  const INSTANCIA = {
    id: 'inst-9',
    resourceId: 'enc-1',
    resourceTypeConceptId: 'rt-1',
    schemaVersion: 1,
    stateConceptId: 'st-cerrada',
    closedAt: '2026-08-17T15:00:00.000Z',
    createdAt: '2026-08-17T14:00:00.000Z',
  };

  const DETALLE = {
    ...INSTANCIA,
    values: [
      { id: 'v-1', fieldId: 'f-1', dataType: 'string', value: 'Buena', ordinal: 0, masked: false },
      {
        id: 'v-2',
        fieldId: 'f-2',
        dataType: 'boolean',
        value: 'SECRETO',
        ordinal: 1,
        masked: true,
      },
    ],
  };

  /** Deja el bloque en modo lectura: plantillas + una instancia ya respondida. */
  function llegarAModoLectura() {
    peticionDePlantillas().flush([PLANTILLA]);
    fixture.detectChanges();
    peticionDeRespuesta().flush({ ...LISTADO_VACIO, items: [INSTANCIA] });
    http.expectOne((r) => r.url === '/forms/instances/inst-9' && r.method === 'GET').flush(DETALLE);
    fixture.detectChanges();
  }

  it('con una sola plantilla, la preselecciona', () => {
    peticionDePlantillas().flush([PLANTILLA]);

    expect(interno<() => string | null>('plantillaId')()).toBe('tpl-1');
  });

  it('sin plantillas, lo dice y no ofrece formulario', () => {
    peticionDePlantillas().flush([]);
    fixture.detectChanges();
    peticionDeRespuesta().flush(LISTADO_VACIO);
    fixture.detectChanges();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('no hay ninguna plantilla');
  });

  it('sin encuentro abierto no deja completar', () => {
    fixture.componentRef.setInput('encounterId', null);
    peticionDePlantillas().flush([PLANTILLA]);

    expect(interno<() => boolean>('hayEncuentro')()).toBe(false);
    expect(interno<() => boolean>('puedeCompletar')()).toBe(false);
  });

  it('no deja completar sin los campos obligatorios del esquema', () => {
    peticionDePlantillas().flush([PLANTILLA]);

    expect(interno<() => boolean>('puedeCompletar')()).toBe(false);

    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-1', 'Buena');

    expect(interno<() => boolean>('puedeCompletar')()).toBe(true);
  });

  it('completar abre, captura y cierra la instancia, y limpia el formulario', () => {
    peticionDePlantillas().flush([PLANTILLA]);

    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-1', 'Buena');
    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-2', true);

    let releido = 0;
    componente.cambio.subscribe(() => (releido += 1));

    interno<() => void>('completar')();

    const apertura = http.expectOne((r) => r.url === '/forms/instances' && r.method === 'POST');
    expect(apertura.request.body).toEqual({ resourceId: 'enc-1' });
    apertura.flush({ id: 'inst-1', schemaVersion: 1, state: 'open' });

    const captura = http.expectOne(
      (r) => r.url === '/forms/instances/inst-1/values' && r.method === 'POST',
    );
    expect(captura.request.body).toEqual({
      values: [
        { fieldId: 'f-1', dataType: 'string', value: 'Buena', assignmentId: 'as-1', ordinal: 0 },
        { fieldId: 'f-2', dataType: 'boolean', value: true, assignmentId: 'as-2', ordinal: 1 },
      ],
    });
    captura.flush({ ids: ['v-1', 'v-2'] });

    const cierre = http.expectOne(
      (r) => r.url === '/forms/instances/inst-1/close' && r.method === 'POST',
    );
    cierre.flush({ ok: true });

    // Tras guardar, el bloque relee lo respondido del backend.
    peticionDeRespuesta().flush(LISTADO_VACIO);

    expect(releido).toBe(1);
    expect(interno<() => Record<string, unknown>>('valores')()).toEqual({});
  });

  it('omite del envío los campos opcionales sin valor', () => {
    peticionDePlantillas().flush([PLANTILLA]);

    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-1', 'Buena');
    interno<() => void>('completar')();

    const apertura = http.expectOne((r) => r.url === '/forms/instances');
    apertura.flush({ id: 'inst-1', schemaVersion: 1, state: 'open' });

    const captura = http.expectOne((r) => r.url === '/forms/instances/inst-1/values');
    expect((captura.request.body as { values: unknown[] }).values).toHaveLength(1);
    captura.flush({ ids: ['v-1'] });

    http.expectOne('/forms/instances/inst-1/close').flush({ ok: true });
    peticionDeRespuesta().flush(LISTADO_VACIO);
  });

  it('el 409 de una instancia repetida se cuenta como aviso, no como error', () => {
    peticionDePlantillas().flush([PLANTILLA]);

    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-1', 'Buena');
    interno<() => void>('completar')();

    http
      .expectOne((r) => r.url === '/forms/instances')
      .flush(
        {
          code: 'CONFLICT',
          message: 'Ya existe una instancia para el recurso y versión',
          timestamp: '',
          path: '',
        },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();
    peticionDeRespuesta().flush(LISTADO_VACIO);
    fixture.detectChanges();

    expect(interno<() => string | null>('avisoDeDuplicado')()).toContain('ya se completó');
    expect(interno<() => string | null>('errorDeCompletado')()).toBeNull();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="formulario-especialidad-duplicado"]')).not.toBeNull();
    expect(html.querySelector('[data-testid="formulario-especialidad-error"]')).toBeNull();
  });

  it('con una instancia previa entra en modo lectura y no ofrece captura', () => {
    llegarAModoLectura();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="formulario-respondido"]')).not.toBeNull();
    // La captura no se ofrece: sin campos ni botón de completar.
    expect(html.querySelector('[data-testid="campo-especialidad"]')).toBeNull();
    expect(html.querySelector('form')).toBeNull();

    const texto = html.textContent ?? '';
    expect(texto).toContain('Ficha de cardiología');
    expect(texto).toContain('Tolerancia al ejercicio');
    expect(texto).toContain('Buena');
    // `http.verify()` del afterEach certifica que no se disparó ningún POST.
  });

  it('un valor enmascarado muestra el marcador y jamás el contenido', () => {
    llegarAModoLectura();

    const html = fixture.nativeElement as HTMLElement;
    const marcador = html.querySelector('[data-testid="respuesta-enmascarada"]');
    expect(marcador).not.toBeNull();
    expect(marcador?.textContent).toContain('No disponible por reglas de acceso');
    // Aunque el backend mandara algo por error, el bloque no lo expone.
    expect(html.textContent ?? '').not.toContain('SECRETO');
  });

  it('tras guardar con éxito, relee y pasa a modo lectura', () => {
    peticionDePlantillas().flush([PLANTILLA]);
    fixture.detectChanges();
    peticionDeRespuesta().flush(LISTADO_VACIO);
    fixture.detectChanges();

    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-1', 'Buena');
    interno<() => void>('completar')();

    http
      .expectOne((r) => r.url === '/forms/instances' && r.method === 'POST')
      .flush({ id: 'inst-9', schemaVersion: 1, state: 'open' });
    http.expectOne('/forms/instances/inst-9/values').flush({ ids: ['v-1'] });
    http.expectOne('/forms/instances/inst-9/close').flush({ ok: true });

    // La relectura posterior encuentra la instancia recién guardada.
    peticionDeRespuesta().flush({ ...LISTADO_VACIO, items: [INSTANCIA] });
    http.expectOne((r) => r.url === '/forms/instances/inst-9' && r.method === 'GET').flush(DETALLE);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="formulario-respondido"]')).not.toBeNull();
    expect(html.querySelector('form')).toBeNull();
  });

  it('elegirPlantilla vacía los valores de la anterior', () => {
    const dosPlantillas = [PLANTILLA, { ...PLANTILLA, id: 'tpl-2', name: 'Otra' }];
    peticionDePlantillas().flush(dosPlantillas);

    // Con dos, no se preselecciona ninguna.
    expect(interno<() => string | null>('plantillaId')()).toBeNull();

    señal<string>('plantillaId').set('tpl-1');
    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-1', 'Buena');
    expect(interno<() => Record<string, unknown>>('valores')()).not.toEqual({});

    interno<(id: string) => void>('elegirPlantilla')('tpl-2');
    expect(interno<() => Record<string, unknown>>('valores')()).toEqual({});
  });

  /* ---- la plantilla de tu especialidad ------------------------------------ */

  it('preselecciona la plantilla de la especialidad de quien atiende', () => {
    const odonto = { ...PLANTILLA, id: 'tpl-odo', specialtyConceptId: 'sp-odo' };
    peticionDePlantillas().flush([PLANTILLA, odonto]);
    // Con dos plantillas y sin especialidad todavía, no se elige ninguna.
    expect(interno<() => string | null>('plantillaId')()).toBeNull();

    responderEspecialidad('sp-odo');

    expect(interno<() => string | null>('plantillaId')()).toBe('tpl-odo');
  });

  it('el selector esconde las fichas de otras especialidades', () => {
    const odonto = {
      ...PLANTILLA,
      id: 'tpl-odo',
      specialtyConceptId: 'sp-odo',
      code: 'ODONTO_FICHA',
      name: 'Ficha odontológica',
    };
    peticionDePlantillas().flush([PLANTILLA, odonto]);
    responderEspecialidad('sp-odo');
    // El filtro por especialidad sigue existiendo; sólo dejó de ser el
    // default. Se lo activa a mano para probarlo.
    interno<(v: boolean) => void>('alternarVerTodas')(false);

    // La de cardiología no le sirve a quien atiende en odontología.
    expect(etiquetasOfrecidas()).toEqual(['Ficha odontológica']);
    expect(interno<() => string | null>('plantillaId')()).toBe('tpl-odo');
  });

  it('una elección manual no la pisa la especialidad que llega después', () => {
    const odonto = { ...PLANTILLA, id: 'tpl-odo', specialtyConceptId: 'sp-odo' };
    peticionDePlantillas().flush([PLANTILLA, odonto]);

    interno<(id: string) => void>('elegirPlantilla')('tpl-1');
    responderEspecialidad('sp-odo');

    expect(interno<() => string | null>('plantillaId')()).toBe('tpl-1');
  });

  it('sin perfil profesional no rompe: queda el selector de siempre', () => {
    peticionDePlantillas().flush([PLANTILLA, { ...PLANTILLA, id: 'tpl-2' }]);

    http
      .expectOne((r) => r.url === '/profiles/practitioners/me/summary')
      .flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });

    expect(interno<() => string | null>('plantillaId')()).toBeNull();
    expect(etiquetasOfrecidas()).toHaveLength(2);
  });

  it('una especialidad que ya no ejerce no decide la plantilla', () => {
    peticionDePlantillas().flush([PLANTILLA, { ...PLANTILLA, id: 'tpl-2' }]);

    http
      .expectOne((r) => r.url === '/profiles/practitioners/me/summary')
      .flush({
        profileId: 'hp-1',
        personId: 'per-1',
        practitionerCode: 'MP-1',
        specialties: [
          {
            id: 'sp-vieja',
            specialtyConceptId: 'sp-1',
            isPrimary: true,
            boardCertified: false,
            verificationStatusConceptId: 'vs-1',
            // Dejó de ejercerla: no puede decidir qué ficha se le ofrece hoy.
            validTo: '2025-01-01',
          },
        ],
        credentials: [],
        licenses: [],
        languages: [],
        affiliations: [],
        activity: {},
        createdAt: '2026-08-17T14:00:00.000Z',
      });

    expect(interno<() => string | null>('plantillaId')()).toBeNull();
  });

  /**
   * Vigente es una ventana, no una bandera —el mismo criterio con el que la
   * matrícula firma el papel—. Una recertificación real declara hasta cuándo
   * vale; tomar esa fecha como «ya no la ejerce» le escondería su propia ficha
   * justo a quien tiene la certificación en regla.
   */
  it('una especialidad con recertificación futura sigue decidiendo la plantilla', () => {
    peticionDePlantillas().flush([PLANTILLA, { ...PLANTILLA, id: 'tpl-2' }]);

    http
      .expectOne((r) => r.url === '/profiles/practitioners/me/summary')
      .flush({
        profileId: 'hp-1',
        personId: 'per-1',
        practitionerCode: 'MP-1',
        specialties: [
          {
            id: 'sp-vigente',
            specialtyConceptId: 'sp-1',
            isPrimary: true,
            boardCertified: true,
            verificationStatusConceptId: 'vs-1',
            validFrom: '2020-01-01',
            validTo: '2030-01-01',
          },
        ],
        credentials: [],
        licenses: [],
        languages: [],
        affiliations: [],
        activity: {},
        createdAt: '2026-08-17T14:00:00.000Z',
      });

    expect(interno<() => string | null>('plantillaId')()).toBe('tpl-1');
  });

  /** Y la que todavía no entró en vigencia tampoco decide nada. */
  it('una especialidad que todavía no empezó no decide la plantilla', () => {
    peticionDePlantillas().flush([PLANTILLA, { ...PLANTILLA, id: 'tpl-2' }]);

    http
      .expectOne((r) => r.url === '/profiles/practitioners/me/summary')
      .flush({
        profileId: 'hp-1',
        personId: 'per-1',
        practitionerCode: 'MP-1',
        specialties: [
          {
            id: 'sp-futura',
            specialtyConceptId: 'sp-1',
            isPrimary: true,
            boardCertified: false,
            verificationStatusConceptId: 'vs-1',
            validFrom: '2030-01-01',
          },
        ],
        credentials: [],
        licenses: [],
        languages: [],
        affiliations: [],
        activity: {},
        createdAt: '2026-08-17T14:00:00.000Z',
      });

    expect(interno<() => string | null>('plantillaId')()).toBeNull();
  });

  /* ---- filtrar 43 plantillas a las que sirven ------------------------------ */

  /**
   * El catálogo real son 43 plantillas: 36 especialidades, 4 transversales y
   * extras. Estas pruebas usan un catálogo chico con la misma forma —dos
   * especialidades y dos transversales— porque lo que se fija es la regla, no
   * el tamaño.
   *
   * Las transversales se reconocen por el `specialtyConceptId` que comparten,
   * y ese concepto se descubre por el prefijo `TRANSV_` de los códigos
   * sembrados. Por eso `TRANSVERSAL` acá es un uuid cualquiera: el componente
   * no puede tenerlo escrito.
   */
  const TRANSVERSAL = 'sp-transversal';

  const ANAMNESIS = {
    ...PLANTILLA,
    id: 'tpl-anamnesis',
    specialtyConceptId: TRANSVERSAL,
    code: 'TRANSV_ANAMNESIS_GENERAL',
    name: 'Anamnesis / Historia clínica general',
  };

  const CONSENTIMIENTO = {
    ...PLANTILLA,
    id: 'tpl-consentimiento',
    specialtyConceptId: TRANSVERSAL,
    code: 'TRANSV_CONSENTIMIENTO_INFORMADO',
    name: 'Consentimiento informado',
  };

  const DERMATOLOGIA = {
    ...PLANTILLA,
    id: 'tpl-derma',
    specialtyConceptId: 'sp-derma',
    code: 'DERMA_EXAMEN',
    name: 'Examen dermatológico',
  };

  /** Cardiología, dermatología y las dos transversales. */
  const CATALOGO = [PLANTILLA, DERMATOLOGIA, ANAMNESIS, CONSENTIMIENTO];

  it('ofrece la ficha de su especialidad y las transversales, en ese orden', () => {
    peticionDePlantillas().flush(CATALOGO);
    responderEspecialidad('sp-1');
    // El orden es de `plantillasSugeridas`, que sólo se ve sin el catálogo
    // entero encima: se filtra a mano porque «Ver todas» ya no es el default.
    interno<(v: boolean) => void>('alternarVerTodas')(false);

    expect(etiquetasOfrecidas()).toEqual([
      'Ficha de cardiología',
      'Anamnesis / Historia clínica general',
      'Consentimiento informado',
    ]);
  });

  it('reconoce las transversales por su concepto, no por el prefijo de cada código', () => {
    // Una transversal que un admin armó a mano: cuelga del mismo concepto pero
    // su código no respeta la convención `TRANSV_`. Es transversal igual.
    const aMano = {
      ...PLANTILLA,
      id: 'tpl-mano',
      specialtyConceptId: TRANSVERSAL,
      code: 'HOJA_DE_EGRESO',
      name: 'Hoja de egreso',
    };
    peticionDePlantillas().flush([...CATALOGO, aMano]);
    responderEspecialidad('sp-1');
    // El reconocimiento por concepto es del filtro por especialidad; se activa
    // a mano porque ya no es el default.
    interno<(v: boolean) => void>('alternarVerTodas')(false);

    expect(etiquetasOfrecidas()).toContain('Hoja de egreso');
    expect(etiquetasOfrecidas()).not.toContain('Examen dermatológico');
  });

  it('sin especialidad conocida no filtra nada ni ofrece el interruptor', () => {
    peticionDePlantillas().flush(CATALOGO);
    http
      .expectOne((r) => r.url === '/profiles/practitioners/me/summary')
      .flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });

    // Sin perfil profesional no hay por qué filtrar: queda el catálogo entero.
    expect(etiquetasOfrecidas()).toHaveLength(4);
    expect(interno<() => boolean>('puedeVerTodas')()).toBe(false);
  });

  /* ---- el interruptor «Ver todas las especialidades» ------------------------ */

  it('arranca prendido —muestra el catálogo entero— y apagarlo filtra por especialidad', () => {
    peticionDePlantillas().flush(CATALOGO);
    responderEspecialidad('sp-1');

    // Arranca en «Ver todas»: dos cuentas con perfiles profesionales distintos
    // no pueden ver listas de tamaño distinto por default, eso se leía como
    // un bug («en la Mac salen más formularios»).
    expect(interno<() => boolean>('puedeVerTodas')()).toBe(true);
    expect(etiquetasOfrecidas()).toHaveLength(4);
    expect(etiquetasOfrecidas()).toContain('Examen dermatológico');

    interno<(v: boolean) => void>('alternarVerTodas')(false);
    expect(etiquetasOfrecidas()).toHaveLength(3);
    expect(etiquetasOfrecidas()).not.toContain('Examen dermatológico');

    interno<(v: boolean) => void>('alternarVerTodas')(true);
    expect(etiquetasOfrecidas()).toHaveLength(4);
    expect(etiquetasOfrecidas()).toContain('Examen dermatológico');
  });

  it('el interruptor no pide plantillas de nuevo: filtra sobre lo ya traído', () => {
    peticionDePlantillas().flush(CATALOGO);
    responderEspecialidad('sp-1');

    interno<(v: boolean) => void>('alternarVerTodas')(false);
    interno<(v: boolean) => void>('alternarVerTodas')(true);

    // `http.verify()` del afterEach reventaría ante un GET de más; esto lo
    // dice explícito.
    http.expectNone((r) => r.url === '/charts/templates');
  });

  it('lo elegido con el interruptor puesto no desaparece al apagarlo', () => {
    peticionDePlantillas().flush(CATALOGO);
    responderEspecialidad('sp-1');

    interno<(v: boolean) => void>('alternarVerTodas')(true);
    interno<(id: string) => void>('elegirPlantilla')('tpl-derma');
    interno<(v: boolean) => void>('alternarVerTodas')(false);

    // Sin esto el desplegable mostraría el placeholder mientras dibuja los
    // campos de la dermatológica debajo.
    expect(etiquetasOfrecidas()).toContain('Examen dermatológico');
    expect(interno<() => string | null>('plantillaId')()).toBe('tpl-derma');
  });

  it('el interruptor aparece en pantalla sólo cuando hay algo escondido', () => {
    peticionDePlantillas().flush(CATALOGO);
    responderEspecialidad('sp-1');
    fixture.detectChanges();
    peticionDeRespuesta().flush(LISTADO_VACIO);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const interruptor = html.querySelector('[data-testid="ver-todas-especialidades"]');
    expect(interruptor).not.toBeNull();
    expect(interruptor?.textContent).toContain('Ver todas las especialidades');
  });

  /* ---- la especialidad sin ficha propia ------------------------------------ */

  it('sin ficha de su especialidad, preselecciona la anamnesis general', () => {
    peticionDePlantillas().flush(CATALOGO);
    responderEspecialidad('sp-sin-ficha');
    interno<(v: boolean) => void>('alternarVerTodas')(false);

    expect(interno<() => string | null>('plantillaId')()).toBe('tpl-anamnesis');
    // Sólo le quedan las transversales.
    expect(etiquetasOfrecidas()).toEqual([
      'Anamnesis / Historia clínica general',
      'Consentimiento informado',
    ]);
  });

  it('sin anamnesis en el catálogo, cae a la primera transversal que haya', () => {
    peticionDePlantillas().flush([PLANTILLA, DERMATOLOGIA, CONSENTIMIENTO]);
    responderEspecialidad('sp-sin-ficha');

    expect(interno<() => string | null>('plantillaId')()).toBe('tpl-consentimiento');
  });

  it('el fallback no pisa una elección manual anterior', () => {
    peticionDePlantillas().flush(CATALOGO);
    interno<(id: string) => void>('elegirPlantilla')('tpl-derma');
    responderEspecialidad('sp-sin-ficha');

    expect(interno<() => string | null>('plantillaId')()).toBe('tpl-derma');
  });

  it('con ficha propia no hay fallback ni aviso', () => {
    peticionDePlantillas().flush(CATALOGO);
    responderEspecialidad('sp-1');
    fixture.detectChanges();
    peticionDeRespuesta().flush(LISTADO_VACIO);
    fixture.detectChanges();

    expect(interno<() => boolean>('sinFichaPropia')()).toBe(false);
    expect(interno<() => string | null>('plantillaId')()).toBe('tpl-1');
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="sin-ficha-propia"]')).toBeNull();
  });

  /* ---- los dos copys, que no dicen lo mismo -------------------------------- */

  it('«tu especialidad no tiene ficha» se avisa discreto y el formulario sigue', () => {
    peticionDePlantillas().flush(CATALOGO);
    responderEspecialidad('sp-sin-ficha');
    fixture.detectChanges();
    peticionDeRespuesta().flush(LISTADO_VACIO);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const aviso = html.querySelector('[data-testid="sin-ficha-propia"]');
    expect(aviso).not.toBeNull();
    expect(aviso?.textContent).toContain('no tiene una ficha específica');
    expect(aviso?.textContent).toContain('fichas generales');

    // Es una situación normal, no un problema de datos: ni el copy del
    // catálogo vacío ni un `app-alert` que grite.
    expect(html.querySelector('[data-testid="catalogo-vacio"]')).toBeNull();
    expect(aviso?.tagName).toBe('P');
    // Y se puede completar igual: el formulario está ahí, con su plantilla.
    expect(html.querySelector('form')).not.toBeNull();
    expect(interno<() => boolean>('sinFichaPropia')()).toBe(true);
  });

  /**
   * El aviso promete algo concreto —«te ofrecemos las fichas generales»—, así
   * que sólo aparece cuando esas fichas existen. Sin ninguna transversal el
   * filtro cae al catálogo entero, y avisar ahí sería prometer una anamnesis
   * que nadie sembró.
   */
  it('sin fichas generales en el catálogo no promete una que no existe', () => {
    peticionDePlantillas().flush([PLANTILLA, DERMATOLOGIA]);
    responderEspecialidad('sp-sin-ficha');
    fixture.detectChanges();
    peticionDeRespuesta().flush(LISTADO_VACIO);
    fixture.detectChanges();

    expect(interno<() => boolean>('sinFichaPropia')()).toBe(false);
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="sin-ficha-propia"]')).toBeNull();
    // Sin criterio para filtrar queda el catálogo entero, no un desplegable vacío.
    expect(etiquetasOfrecidas()).toHaveLength(2);
  });

  it('la hoja en blanco encabeza el desplegable, aun sin ninguna plantilla', () => {
    // Es la salida para quien no quiere completar campos: enterrada al final de
    // cuarenta y cuatro fichas equivale a no tenerla, y con el catálogo vacío es
    // lo único que queda.
    peticionDePlantillas().flush([]);
    responderEspecialidad('sp-1');
    fixture.detectChanges();
    peticionDeRespuesta().flush(LISTADO_VACIO);
    fixture.detectChanges();

    const opciones = opcionesCrudas();
    expect(opciones.slice(0, 6).map((opcion) => opcion.value)).toEqual([
      BLOQUE_DIAGNOSTICO,
      PLANTILLA_HOJA_LIBRE,
      BLOQUE_ALERGIA,
      BLOQUE_CIRUGIA,
      BLOQUE_ODONTOLOGIA,
      BLOQUE_LABORATORIO,
    ]);
    // La hoja en blanco **conserva el segundo lugar**: la alergia entró detrás,
    // no delante. Enterrarla al final equivale a no tenerla.
    expect(opciones[1].label).toContain('Hoja en blanco');
  });

  /**
   * Las tres entradas que no pasan por `forms` se dibujan por encima de la
   * cadena de estados del motor, y no dentro: es lo que las deja alcanzables
   * cuando el encuentro ya tiene una ficha respondida —el modo lectura tapaba
   * el selector— o cuando el catálogo ni siquiera cargó.
   */
  it('elegir el diagnóstico dibuja su bloque y ninguna ficha', () => {
    peticionDePlantillas().flush([PLANTILLA_ODONTO]);
    responderEspecialidad('sp-odonto');
    fixture.detectChanges();
    peticionDeRespuesta().flush(LISTADO_VACIO);
    fixture.detectChanges();

    interno<(id: string | null) => void>('elegirPlantilla')(BLOQUE_DIAGNOSTICO);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('app-diagnosis-block')).not.toBeNull();
    expect(html.querySelector('[data-testid="campo-especialidad"]')).toBeNull();
    expect(html.querySelector('[data-testid="campo-odontograma"]')).toBeNull();
    drenarLecturasDelBloque();
  });

  it('cirugía, odontología y laboratorio traen cada uno su bloque', () => {
    peticionDePlantillas().flush([PLANTILLA_ODONTO]);
    responderEspecialidad('sp-odonto');
    fixture.detectChanges();
    peticionDeRespuesta().flush(LISTADO_VACIO);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const elegir = interno<(id: string | null) => void>('elegirPlantilla');

    elegir(BLOQUE_CIRUGIA);
    fixture.detectChanges();
    expect(html.querySelector('app-procedures-block')).not.toBeNull();
    expect(html.querySelector('app-analysis-order-block')).toBeNull();
    drenarLecturasDelBloque();

    elegir(BLOQUE_ODONTOLOGIA);
    fixture.detectChanges();
    expect(html.querySelector('app-procedures-block')).not.toBeNull();
    expect(html.querySelector('app-analysis-order-block')).toBeNull();
    drenarLecturasDelBloque();

    elegir(BLOQUE_LABORATORIO);
    fixture.detectChanges();
    expect(html.querySelector('app-analysis-order-block')).not.toBeNull();
    expect(html.querySelector('app-procedures-block')).toBeNull();
    drenarLecturasDelBloque();
  });

  it('elegir la hoja en blanco esconde los campos y saca el botón de completar', () => {
    peticionDePlantillas().flush([PLANTILLA_ODONTO]);
    responderEspecialidad('sp-odonto');
    fixture.detectChanges();
    peticionDeRespuesta().flush(LISTADO_VACIO);
    fixture.detectChanges();

    interno<(id: string | null) => void>('elegirPlantilla')(PLANTILLA_HOJA_LIBRE);
    fixture.detectChanges();

    expect(interno<() => boolean>('hojaLibre')()).toBe(true);
    // No hay plantilla elegida, así que no hay campos que dibujar ni formulario
    // que enviar: la hoja guarda por su cuenta contra la nota clínica.
    expect(interno<() => unknown>('plantillaElegida')()).toBeNull();
    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('app-form-actions')).toBeNull();
  });

  it('«el catálogo está vacío» es otro caso, y no habla de tu especialidad', () => {
    peticionDePlantillas().flush([]);
    responderEspecialidad('sp-1');
    fixture.detectChanges();
    peticionDeRespuesta().flush(LISTADO_VACIO);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const vacio = html.querySelector('[data-testid="catalogo-vacio"]');
    expect(vacio).not.toBeNull();
    expect(vacio?.textContent).toContain('no hay ninguna plantilla');
    // El error es de datos: nadie sembró el catálogo. No es culpa de su
    // especialidad y el copy no se lo achaca.
    expect(html.querySelector('[data-testid="sin-ficha-propia"]')).toBeNull();
    expect(interno<() => boolean>('catalogoVacio')()).toBe(true);
    expect(interno<() => boolean>('sinFichaPropia')()).toBe(false);
    expect(html.querySelector('form')).toBeNull();
  });

  /* ---- cuando el catálogo no se pudo leer ---------------------------------- */

  /**
   * Un fallo de lectura no es un catálogo vacío ni una especialidad sin ficha.
   * Sin este estado quedaba un formulario dibujado y hueco —sin campos, sin
   * selector y sin una palabra—, que se lee como «no hay nada que completar».
   */
  it('si el catálogo no se pudo traer, lo dice y ofrece reintentar', () => {
    peticionDePlantillas().flush(
      { code: 'FORBIDDEN', message: 'Tu rol no permite verlas.', timestamp: '', path: '' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();
    peticionDeRespuesta().flush(LISTADO_VACIO);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('[data-testid="plantillas-error"]')).not.toBeNull();
    expect(html.querySelector('form')).toBeNull();
    expect(html.querySelector('[data-testid="catalogo-vacio"]')).toBeNull();

    // Y el reintento es una salida real, no un botón de adorno.
    interno<() => void>('recargarPlantillas')();
    peticionDePlantillas().flush([PLANTILLA]);
    fixture.detectChanges();

    expect(html.querySelector('[data-testid="plantillas-error"]')).toBeNull();
    expect(html.querySelector('form')).not.toBeNull();
  });

  /* ---- el odontograma ------------------------------------------------------ */

  /** La plantilla del odontograma, con su campo json y los conteos del CPO-D. */
  const PLANTILLA_ODONTO = {
    ...PLANTILLA,
    id: 'tpl-odo',
    code: 'ODONTO_ODONTOGRAMA_OMS',
    name: 'Odontograma OMS',
    fields: [
      {
        assignmentId: 'as-o',
        fieldId: 'f-odo',
        code: 'ODONTO_ODONTOGRAMA_OMS.odontograma_fdi',
        name: 'Odontograma',
        dataType: 'json',
        required: false,
      },
      {
        assignmentId: 'as-c',
        fieldId: 'f-car',
        code: 'ODONTO_ODONTOGRAMA_OMS.dientes_cariados',
        name: 'Cariados',
        dataType: 'integer',
        required: false,
      },
      {
        assignmentId: 'as-i',
        fieldId: 'f-cpod',
        code: 'ODONTO_ODONTOGRAMA_OMS.indice_cpod',
        name: 'CPO-D',
        dataType: 'decimal',
        required: false,
      },
    ],
  };

  it('reconoce el campo del odontograma por su código, no por el tipo', () => {
    peticionDePlantillas().flush([PLANTILLA_ODONTO]);

    const esOdontograma = interno<(campo: unknown) => boolean>('esOdontograma');
    expect(esOdontograma(PLANTILLA_ODONTO.fields[0])).toBe(true);
    // Otro campo `json` cualquiera NO se dibuja como una boca.
    expect(esOdontograma({ ...PLANTILLA_ODONTO.fields[0], code: 'X.otra_cosa' })).toBe(false);
  });

  it('registrar el estado de una pieza arma el mapa y sugiere los índices', () => {
    peticionDePlantillas().flush([PLANTILLA_ODONTO]);

    interno<(fdi: string) => void>('abrirPieza')('16');
    interno<(fieldId: string, codigo: string) => void>('fijarEstado')('f-odo', '1');

    const valores = interno<() => Record<string, unknown>>('valores')();
    expect(valores['f-odo']).toEqual({ '16': '1' });
    // Una cariada: el conteo y el índice se rellenan solos.
    expect(valores['f-car']).toBe(1);
    expect(valores['f-cpod']).toBe(1);
  });

  it('volver a elegir el mismo estado lo borra', () => {
    peticionDePlantillas().flush([PLANTILLA_ODONTO]);

    interno<(fdi: string) => void>('abrirPieza')('16');
    interno<(fieldId: string, codigo: string) => void>('fijarEstado')('f-odo', '1');
    interno<(fdi: string) => void>('abrirPieza')('16');
    interno<(fieldId: string, codigo: string) => void>('fijarEstado')('f-odo', '1');

    expect(interno<() => Record<string, unknown>>('valores')()['f-odo']).toEqual({});
  });

  it('la sugerencia no pisa un conteo tecleado a mano', () => {
    peticionDePlantillas().flush([PLANTILLA_ODONTO]);

    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-car', 7);
    interno<(fdi: string) => void>('abrirPieza')('16');
    interno<(fieldId: string, codigo: string) => void>('fijarEstado')('f-odo', '1');

    const valores = interno<() => Record<string, unknown>>('valores')();
    expect(valores['f-car']).toBe(7);
    // El que estaba vacío sí se sugiere.
    expect(valores['f-cpod']).toBe(1);
  });

  it('un odontograma sin ninguna pieza tocada no viaja', () => {
    peticionDePlantillas().flush([PLANTILLA_ODONTO]);

    interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-odo', {});
    interno<() => void>('completar')();

    // Sin ningún valor que mandar, `completar` ni siquiera abre la instancia.
    http.expectNone((r) => r.url === '/forms/instances' && r.method === 'POST');
  });

  it('el mapa del odontograma viaja como json', () => {
    peticionDePlantillas().flush([PLANTILLA_ODONTO]);

    interno<(fdi: string) => void>('abrirPieza')('16');
    interno<(fieldId: string, codigo: string) => void>('fijarEstado')('f-odo', '1');
    interno<() => void>('completar')();

    const apertura = http.expectOne((r) => r.url === '/forms/instances' && r.method === 'POST');
    apertura.flush(INSTANCIA);

    const captura = http.expectOne(
      (r) => r.url === '/forms/instances/inst-9/values' && r.method === 'POST',
    );
    const body = captura.request.body as {
      values: { fieldId: string; dataType: string; value: unknown }[];
    };
    const odontograma = body.values.find((valor) => valor.fieldId === 'f-odo')!;
    expect(odontograma.dataType).toBe('json');
    expect(odontograma.value).toEqual({ '16': '1' });

    captura.flush({ ids: ['v-1'] });
    http.expectOne((r) => r.url === '/forms/instances/inst-9/close').flush({});
    // Tras guardar, el bloque relee para pasar a modo lectura.
    peticionDeRespuesta().flush(LISTADO_VACIO);
  });

  /* ── D4: la ficha termina en el cierre ─────────────────────────────────────
     Lo que estas pruebas fijan: el cierre se dibuja sólo con una plantilla de
     `forms`; las respuestas viajan a la IA en palabras y sin el odontograma;
     completar encadena cerrar → diagnóstico → orden en ese orden, cada paso
     con su aviso; y un fallo frena lo que sigue sin deshacer lo hecho ni
     contar la ficha como fallida. */

  /** base64url sobre UTF-8, como el token real. */
  function jwt(payload: Record<string, unknown>): string {
    const b64 = (o: unknown) => {
      const bytes = new TextEncoder().encode(JSON.stringify(o));
      return btoa(String.fromCharCode(...bytes))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    };
    return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
  }

  describe('el cierre de la ficha (D4)', () => {
    const CIERRE: CierreDelFormulario = {
      diagnostico: 'dx-1',
      orden: { codeConceptId: 'st-1', category: 'LAB', categoryConceptId: 'cat-lab' },
    };

    beforeEach(() => {
      // Las dos altas del cierre exigen la organización de la sesión.
      TestBed.inject(SessionStore).start({
        accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] }),
        refreshToken: 'r-1',
      });
    });

    /** La señal, sin pasar por `interno`: éste ata las funciones y una señal lo es. */
    function fijarCierre(cierre: CierreDelFormulario): void {
      (componente as unknown as Record<string, WritableSignal<CierreDelFormulario>>)['cierre'].set(
        cierre,
      );
    }

    /** Abre, captura y cierra la instancia de la ficha, como el motor de `forms`. */
    function guardarLaFicha(): void {
      http
        .expectOne((r) => r.url === '/forms/instances' && r.method === 'POST')
        .flush({ id: 'inst-1', schemaVersion: 1, state: 'open' });
      http.expectOne('/forms/instances/inst-1/values').flush({ ids: ['v-1'] });
      // Nada del cierre se pide antes de que la ficha esté cerrada.
      http.expectNone('/clinical/conditions');
      http.expectOne('/forms/instances/inst-1/close').flush({ ok: true });
    }

    it('se dibuja sólo con una plantilla de forms elegida, antes de las acciones', () => {
      peticionDePlantillas().flush([PLANTILLA]);
      fixture.detectChanges();
      peticionDeRespuesta().flush(LISTADO_VACIO);
      fixture.detectChanges();

      const html = fixture.nativeElement as HTMLElement;
      const cierre = html.querySelector('app-form-conclusion-block');
      const acciones = html.querySelector('app-form-actions');
      expect(cierre).not.toBeNull();
      expect(acciones).not.toBeNull();
      expect(cierre!.compareDocumentPosition(acciones!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING,
      );
      drenarLecturasDelBloque();

      interno<(id: string | null) => void>('elegirPlantilla')(PLANTILLA_HOJA_LIBRE);
      fixture.detectChanges();
      expect(html.querySelector('app-form-conclusion-block')).toBeNull();
      drenarLecturasDelBloque();

      interno<(id: string | null) => void>('elegirPlantilla')(BLOQUE_DIAGNOSTICO);
      fixture.detectChanges();
      expect(html.querySelector('app-form-conclusion-block')).toBeNull();
      drenarLecturasDelBloque();
    });

    it('las respuestas viajan a la IA en palabras: pregunta = campo, respuesta = valor', () => {
      peticionDePlantillas().flush([PLANTILLA]);
      const actualizar = interno<(fieldId: string, valor: unknown) => void>('actualizarValor');

      expect(interno<() => unknown[]>('respuestasParaLaIa')()).toEqual([]);
      actualizar('f-1', 'Buena');
      actualizar('f-2', true);

      expect(interno<() => unknown[]>('respuestasParaLaIa')()).toEqual([
        { question: 'Tolerancia al ejercicio', answer: 'Buena' },
        { question: 'Edema', answer: 'Sí' },
      ]);
    });

    it('el odontograma no viaja a la IA: es un mapa de piezas, no una respuesta', () => {
      peticionDePlantillas().flush([PLANTILLA_ODONTO]);
      interno<(fdi: string) => void>('abrirPieza')('16');
      interno<(fieldId: string, codigo: string) => void>('fijarEstado')('f-odo', '1');

      const respuestas = interno<() => { question: string }[]>('respuestasParaLaIa')();
      expect(respuestas.some((r) => r.question === 'Odontograma')).toBe(false);
    });

    it('completar encadena cerrar la ficha → diagnóstico tentativo → orden, en ese orden y con sus avisos', () => {
      const exito = vi.spyOn(TestBed.inject(ToastService), 'success');
      peticionDePlantillas().flush([PLANTILLA]);
      interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-1', 'Buena');
      fijarCierre(CIERRE);
      let releido = 0;
      componente.cambio.subscribe(() => (releido += 1));

      interno<() => void>('completar')();
      guardarLaFicha();

      const alta = http.expectOne((r) => r.url === '/clinical/conditions' && r.method === 'POST');
      expect(alta.request.body).toEqual({
        custodianTenantId: 't-1',
        patientProfileId: 'pac-1',
        codeConceptId: 'dx-1',
        encounterId: 'enc-1',
        noteText: 'Del formulario «Ficha de cardiología»',
      });
      // La orden espera al diagnóstico: en serie, no en paralelo.
      http.expectNone('/clinical/service-requests');
      alta.flush({
        id: 'cond-1',
        patientProfileId: 'pac-1',
        clinicalStatus: 'ACTIVE',
        verificationStatus: 'PROVISIONAL',
        clinicalCourse: null,
        createdAt: '2026-09-26T10:00:00.000Z',
      });

      const orden = http.expectOne(
        (r) => r.url === '/clinical/service-requests' && r.method === 'POST',
      );
      expect(orden.request.body).toEqual({
        custodianTenantId: 't-1',
        patientProfileId: 'pac-1',
        codeConceptId: 'st-1',
        encounterId: 'enc-1',
        category: 'LAB',
        categoryConceptId: 'cat-lab',
      });
      orden.flush({
        id: 'ord-1',
        status: 'st-pending',
        intent: 'order',
        createdAt: '2026-09-26T10:00:01.000Z',
      });

      // Recién ahora el expediente se relee y el bloque pasa a lectura.
      peticionDeRespuesta().flush(LISTADO_VACIO);
      expect(releido).toBe(1);
      expect(exito.mock.calls.map(([, titulo]) => titulo)).toEqual([
        'Formulario completado',
        'Diagnóstico tentativo registrado',
        'Orden de análisis pedida',
      ]);
      expect(interno<() => CierreDelFormulario>('cierre')()).toEqual({
        diagnostico: null,
        orden: null,
      });
      expect(interno<() => readonly string[]>('fallosDelCierre')()).toEqual([]);
    });

    it('si falla el diagnóstico, la orden no se pide; la ficha queda guardada y se dice qué faltó', () => {
      const error = vi.spyOn(TestBed.inject(ToastService), 'error');
      peticionDePlantillas().flush([PLANTILLA]);
      interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-1', 'Buena');
      fijarCierre(CIERRE);
      let releido = 0;
      componente.cambio.subscribe(() => (releido += 1));

      interno<() => void>('completar')();
      guardarLaFicha();

      http
        .expectOne((r) => r.url === '/clinical/conditions' && r.method === 'POST')
        .flush({ message: 'Se cayó' }, { status: 500, statusText: 'Server Error' });
      // Se frena: pedir la orden de un diagnóstico que no se registró es escribir a medias.
      http.expectNone('/clinical/service-requests');
      peticionDeRespuesta().flush(LISTADO_VACIO);

      expect(releido).toBe(1);
      expect(error).toHaveBeenCalledTimes(1);
      const fallos = interno<() => readonly string[]>('fallosDelCierre')();
      expect(fallos).toHaveLength(2);
      expect(fallos[0]).toContain('No se registró el diagnóstico tentativo');
      expect(fallos[1]).toContain('la orden de análisis');
      // La ficha no falló: el aviso es ámbar y el rojo no aparece.
      expect(interno<() => string | null>('errorDeCompletado')()).toBeNull();
      fixture.detectChanges();
      const html = fixture.nativeElement as HTMLElement;
      expect(html.querySelector('[data-testid="formulario-cierre-fallos"]')).not.toBeNull();
      expect(html.querySelector('[data-testid="formulario-especialidad-error"]')).toBeNull();
      drenarLecturasDelBloque();
    });

    it('sin organización en la sesión no se registra nada del cierre, y se dice', () => {
      TestBed.inject(SessionStore).clear();
      const error = vi.spyOn(TestBed.inject(ToastService), 'error');
      peticionDePlantillas().flush([PLANTILLA]);
      interno<(fieldId: string, valor: unknown) => void>('actualizarValor')('f-1', 'Buena');
      fijarCierre(CIERRE);

      interno<() => void>('completar')();
      guardarLaFicha();
      http.expectNone('/clinical/conditions');
      http.expectNone('/clinical/service-requests');
      peticionDeRespuesta().flush(LISTADO_VACIO);

      expect(error).toHaveBeenCalledTimes(1);
      expect(interno<() => readonly string[]>('fallosDelCierre')()[0]).toContain('organización');
    });
  });
});
