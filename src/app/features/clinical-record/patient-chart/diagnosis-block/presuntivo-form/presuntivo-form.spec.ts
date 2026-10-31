import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { By } from '@angular/platform-browser';

import { SessionStore } from '../../../../../core/auth/session.store';
import { AdditionalFields } from '../../additional-fields/additional-fields';
import { PresuntivoForm } from './presuntivo-form';

/**
 * El alta corta de un presuntivo (2026-10-30). Lo que estas pruebas fijan:
 *
 * 1. **El borrador es fiel.** `tieneCambiosPendientes` (contrato de `DraftBlock`, que el bloque
 *    delega) es `true` en cuanto hay algo escrito: el modal pregunta antes de tirarlo.
 * 2. **Nace presuntivo con el contrato real**: el concepto se resuelve por código y viaja como
 *    `verificationStatusConceptId`, nunca como la palabra `PROVISIONAL` (la API la rechaza con 400).
 * 3. **Un fallo parcial no duplica ni pierde**: si la nota falla, el diagnóstico ya existe, lo
 *    escrito se conserva y reintentar sólo repite la nota. `terminado` —que los anfitriones atienden
 *    cerrando el modal— no se emite hasta que todo quedó guardado.
 * 4. **Traer un formulario llenado** respeta los topes de la API y nunca copia lo protegido.
 */

/** Los códigos que `diagnosisStateOf` necesita, con sus etiquetas. */
const ETIQUETAS = {
  items: [
    {
      conceptId: 'dx-hta',
      code: 'I10',
      display: 'Hipertensión esencial',
      codeSystemVersionId: 'v',
    },
    { conceptId: 'st-activa', code: 'COND_ACTIVE', display: 'Activa', codeSystemVersionId: 'v' },
    {
      conceptId: 'st-provisional',
      code: 'COND_PROVISIONAL',
      display: 'Provisional',
      codeSystemVersionId: 'v',
    },
    {
      conceptId: 'st-confirmada',
      code: 'COND_CONFIRMED',
      display: 'Confirmado',
      codeSystemVersionId: 'v',
    },
  ],
  count: 4,
  limit: 200,
};

/** base64url **sobre UTF-8**, como el token real. */
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

describe('PresuntivoForm', () => {
  let fixture: ComponentFixture<PresuntivoForm>;
  let componente: PresuntivoForm;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'], hpid: 'hp-1' }),
      refreshToken: 'r-1',
    });
    fixture = TestBed.createComponent(PresuntivoForm);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('patientProfileId', 'p-1');
  });

  afterEach(() => {
    // El selector del diagnóstico pide su catálogo al dibujarse: es su asunto, así que acá
    // sólo se drena para que `http.verify()` no tropiece con una petición que el formulario no abrió.
    for (const opcional of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      opcional.flush({
        code: 'opcional',
        name: 'Opcional',
        definitionId: 'def-opcional',
        valueSetId: 'vs-opcional',
        allowCustomValue: false,
        options: [],
      });
    }
    http.verify();
  });

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function elemento(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function porTestId(id: string): HTMLElement | null {
    return elemento().querySelector(`[data-testid="${id}"]`);
  }

  /** Elige el diagnóstico y contesta la lectura de su etiqueta. */
  function elegirDiagnostico(conceptId: string): void {
    interno<(id: string | null) => void>('elegirDiagnostico')(conceptId);
    for (const lectura of http.match(
      (r) => r.url === '/terminology/concepts' && r.params.has('ids'),
    )) {
      lectura.flush(ETIQUETAS);
    }
    fixture.detectChanges();
  }

  /** Escribe una fila «campo: valor» en los motivos, como lo haría quien atiende. */
  function escribirMotivo(campo: string, valor: string): void {
    const motivos = fixture.debugElement.query(By.directive(AdditionalFields))
      .componentInstance as AdditionalFields;
    (motivos as unknown as { agregarFila(): void }).agregarFila();
    fixture.detectChanges();
    const filas = (motivos as unknown as { filas(): readonly { clave: number }[] }).filas();
    const clave = filas.at(-1)!.clave;
    (motivos as unknown as { fijarRotulo(c: number, v: string): void }).fijarRotulo(clave, campo);
    (motivos as unknown as { fijarValor(c: number, v: string): void }).fijarValor(clave, valor);
    fixture.detectChanges();
  }

  function botonDeRegistro(): HTMLButtonElement {
    return elemento().querySelector<HTMLButtonElement>('app-form-actions button[type="submit"]')!;
  }

  /**
   * `app-form-actions` libera el envío **un turno después** (es su guard contra
   * el doble clic) y el botón lo refleja en la detección de cambios siguiente.
   */
  async function esperarElEnvio(): Promise<void> {
    await Promise.resolve();
    fixture.detectChanges();
  }

  /** `app-button` no usa el `disabled` nativo: se declara con `aria-disabled`. */
  function registroBloqueado(): boolean {
    const boton = botonDeRegistro();
    return boton.disabled || boton.getAttribute('aria-disabled') === 'true';
  }

  /** El concepto `COND_PROVISIONAL`, como lo devuelve la búsqueda del catálogo. */
  function responderBusquedaDelConcepto(): void {
    http
      .expectOne((r) => r.url === '/terminology/concepts' && r.params.get('q') === 'COND_PROVISIONAL')
      .flush({
        items: [
          { conceptId: 'otro-concepto', code: 'COND_PROVISIONAL_X', display: 'Otro', codeSystemVersionId: 'v' },
          { conceptId: 'st-provisional', code: 'COND_PROVISIONAL', display: 'Provisional', codeSystemVersionId: 'v' },
        ],
        count: 2,
        limit: 50,
      });
  }

  const CONDICION_REGISTRADA = {
    id: 'c-9',
    patientProfileId: 'p-1',
    clinicalStatus: 'st-activa',
    verificationStatus: 'st-provisional',
    clinicalCourse: null,
    createdAt: '2026-10-30T10:00:00.000Z',
  };

  function conEncuentro(items: readonly object[] = []): void {
    fixture.componentRef.setInput('encounterId', 'enc-1');
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === '/forms/instances' && r.params.get('encounter') === 'enc-1')
      .flush({ encounterId: 'enc-1', items, limit: 50, truncated: false });
  }

  /** Pinta el formulario (no lee nada de la persona: la tabla es del bloque). */
  function cargar(): void {
    fixture.detectChanges();
  }


  it('tieneCambiosPendientes sigue lo escrito: diagnóstico, hallazgos o motivos', () => {
    expect(componente.tieneCambiosPendientes()).toBe(false);
    cargar();
    expect(componente.tieneCambiosPendientes()).toBe(false);

    componente['hallazgos'].set('Cuadro febril');
    expect(componente.tieneCambiosPendientes()).toBe(true);
    componente['hallazgos'].set('   ');
    expect(componente.tieneCambiosPendientes()).toBe(false);

    elegirDiagnostico('dx-hta');
    expect(componente.tieneCambiosPendientes()).toBe(true);
    interno<() => void>('reiniciar')();
    expect(componente.tieneCambiosPendientes()).toBe(false);

    // Una fila de motivos a medio escribir también es algo que se perdería.
    escribirMotivo('Fiebre', '');
    expect(componente.tieneCambiosPendientes()).toBe(true);
  });

  describe('alta del presuntivo', () => {
    it('sin diagnóstico elegido el botón no se puede usar', () => {
      cargar();
      expect(registroBloqueado()).toBe(true);

      elegirDiagnostico('dx-hta');
      expect(registroBloqueado()).toBe(false);
    });

    it('registra el presuntivo con el contrato real, avisa que terminó y limpia', async () => {
      cargar();
      let avisos = 0;
      componente.terminado.subscribe(() => (avisos += 1));
      elegirDiagnostico('dx-hta');

      botonDeRegistro().click();
      // El concepto se resuelve por código: la API no entiende la palabra `PROVISIONAL`.
      responderBusquedaDelConcepto();
      const alta = http.expectOne('/clinical/conditions');
      expect(alta.request.method).toBe('POST');
      expect(alta.request.body).toEqual({
        custodianTenantId: 't-1',
        patientProfileId: 'p-1',
        codeConceptId: 'dx-hta',
        verificationStatusConceptId: 'st-provisional',
      });
      expect('verificationStatus' in (alta.request.body as object)).toBe(false);
      alta.flush(CONDICION_REGISTRADA);
      // Sin motivos escritos no hay nota que crear.
      http.expectNone('/charts/notes');
      await esperarElEnvio();

      expect(avisos).toBe(1);
      expect(componente.tieneCambiosPendientes()).toBe(false);
      expect(registroBloqueado()).toBe(true);
    });

    it('con motivos crea la nota del encuentro con las filas estructuradas', () => {
      cargar();
      conEncuentro();
      elegirDiagnostico('dx-hta');
      escribirMotivo('Fiebre', '39 °C desde hace dos días');
      componente['hallazgos'].set('Cuadro febril con tos');
      fixture.detectChanges();

      botonDeRegistro().click();
      responderBusquedaDelConcepto();
      const alta = http.expectOne('/clinical/conditions');
      const cuerpo = alta.request.body as Record<string, unknown>;
      expect(cuerpo['encounterId']).toBe('enc-1');
      expect(cuerpo['noteText']).toBe(
        'Cuadro febril con tos\nMotivos: Fiebre: 39 °C desde hace dos días',
      );
      alta.flush(CONDICION_REGISTRADA);

      const nota = http.expectOne('/charts/notes');
      expect(nota.request.method).toBe('POST');
      expect(nota.request.body).toEqual({
        patientProfileId: 'p-1',
        authorProfileId: 'hp-1',
        encounterId: 'enc-1',
        entries: [{ label: 'Fiebre', value: '39 °C desde hace dos días' }],
        subjectiveText: 'Motivos del diagnóstico presuntivo «Hipertensión esencial»',
      });
      nota.flush({
        noteId: 'n-1',
        versionId: 'v-1',
        versionNumber: 1,
        lifecycleStatusConceptId: 'l',
        versionStatusConceptId: 'v',
      });

      expect(componente.tieneCambiosPendientes()).toBe(false);
      expect(porTestId('diagnostico-fallo-motivos')).toBeNull();
    });

    it('sin encuentro registra igual: ni el diagnóstico ni la nota llevan encounterId', () => {
      cargar();
      elegirDiagnostico('dx-hta');
      escribirMotivo('Fiebre', '39 °C');

      botonDeRegistro().click();
      responderBusquedaDelConcepto();
      const alta = http.expectOne('/clinical/conditions');
      expect('encounterId' in (alta.request.body as object)).toBe(false);
      alta.flush(CONDICION_REGISTRADA);
      const nota = http.expectOne('/charts/notes');
      expect('encounterId' in (nota.request.body as object)).toBe(false);
      nota.flush({ noteId: 'n-1', versionId: 'v-1', versionNumber: 1, lifecycleStatusConceptId: 'l', versionStatusConceptId: 'v' });
    });

    it('si falla la nota, el diagnóstico ya existe: se conserva lo escrito y reintentar no lo duplica', async () => {
      cargar();
      let avisos = 0;
      let creados = 0;
      componente.terminado.subscribe(() => (avisos += 1));
      componente.diagnosticoCreado.subscribe(() => (creados += 1));
      elegirDiagnostico('dx-hta');
      escribirMotivo('Fiebre', '39 °C');

      botonDeRegistro().click();
      responderBusquedaDelConcepto();
      http.expectOne('/clinical/conditions').flush(CONDICION_REGISTRADA);
      http
        .expectOne('/charts/notes')
        .flush(
          { statusCode: 500, code: 'INTERNAL', message: 'Se rompió', error: 'Error', requestId: 'req-1' },
          { status: 500, statusText: 'Internal Server Error' },
        );
      // La tabla tiene que releerse igual: el diagnóstico existe aunque la nota no se guardó.
      expect(creados).toBe(1);
      fixture.detectChanges();

      // `terminado` NO se emite con la nota fallida: los anfitriones cierran el modal al
      // recibirlo y destruirían el bloque con el aviso y lo escrito adentro.
      expect(avisos).toBe(0);
      const aviso = porTestId('diagnostico-fallo-motivos')?.textContent ?? '';
      expect(aviso).toContain('El diagnóstico quedó registrado');
      // Dos frases bien separadas: lo que falló, terminado en punto, y qué hacer.
      expect(aviso).toContain('No pudimos guardar los motivos');
      expect(aviso).toMatch(/\.\s+Sus filas siguen acá/);
      // Lo escrito sigue ahí y el botón ofrece reintentar sólo los motivos.
      expect(componente.tieneCambiosPendientes()).toBe(true);
      expect(botonDeRegistro().textContent).toContain('Reintentar guardar los motivos');

      await esperarElEnvio();
      botonDeRegistro().click();
      // NO se vuelve a crear el diagnóstico ni a buscar su concepto: sólo la nota.
      http.expectNone('/clinical/conditions');
      const reintento = http.expectOne('/charts/notes');
      reintento.flush({ noteId: 'n-1', versionId: 'v-1', versionNumber: 1, lifecycleStatusConceptId: 'l', versionStatusConceptId: 'v' });
      fixture.detectChanges();

      expect(porTestId('diagnostico-fallo-motivos')).toBeNull();
      expect(componente.tieneCambiosPendientes()).toBe(false);
      // Recién con todo guardado el anfitrión relee.
      expect(avisos).toBe(1);
    });

    it('«Dejar los motivos sin guardar» limpia el formulario, no escribe nada y avisa al anfitrión', () => {
      cargar();
      let avisos = 0;
      componente.terminado.subscribe(() => (avisos += 1));
      elegirDiagnostico('dx-hta');
      escribirMotivo('Fiebre', '39 °C');
      botonDeRegistro().click();
      responderBusquedaDelConcepto();
      http.expectOne('/clinical/conditions').flush(CONDICION_REGISTRADA);
      http.expectOne('/charts/notes').flush({ message: 'x' }, { status: 500, statusText: 'Error' });
      fixture.detectChanges();

      expect(avisos).toBe(0);
      http.expectNone('/charts/notes');
      porTestId('diagnostico-dejar-sin-guardar')!.click();
      fixture.detectChanges();

      expect(porTestId('diagnostico-fallo-motivos')).toBeNull();
      expect(componente.tieneCambiosPendientes()).toBe(false);
      // El diagnóstico existe: el anfitrión tiene que releer.
      expect(avisos).toBe(1);
    });

    it('el 409 «ya lo tiene» se muestra en el campo del diagnóstico y conserva lo escrito', async () => {
      cargar();
      elegirDiagnostico('dx-hta');
      escribirMotivo('Fiebre', '39 °C');

      botonDeRegistro().click();
      responderBusquedaDelConcepto();
      http.expectOne('/clinical/conditions').flush(
        {
          statusCode: 409,
          code: 'CONFLICT',
          message: 'El paciente ya tiene esa condición activa',
          error: 'Conflict',
          requestId: 'req-2',
        },
        { status: 409, statusText: 'Conflict' },
      );
      fixture.detectChanges();

      await esperarElEnvio();

      expect(elemento().textContent).toContain('ya tiene este diagnóstico activo o en estudio');
      expect(porTestId('diagnostico-error')).toBeNull();
      // Nada se guardó: no hay nota, y lo escrito sigue.
      http.expectNone('/charts/notes');
      expect(componente.tieneCambiosPendientes()).toBe(true);
      expect(registroBloqueado()).toBe(false);
    });

    it('si el catálogo no publica el concepto presuntivo NO registra un diagnóstico firme', async () => {
      cargar();
      elegirDiagnostico('dx-hta');

      botonDeRegistro().click();
      http
        .expectOne((r) => r.url === '/terminology/concepts' && r.params.get('q') === 'COND_PROVISIONAL')
        .flush({ items: [], count: 0, limit: 50 });
      http
        .expectOne((r) => r.url === '/terminology/concepts' && r.params.get('q') === 'CONDITION_PROVISIONAL')
        .flush({ items: [], count: 0, limit: 50 });
      fixture.detectChanges();

      await esperarElEnvio();

      http.expectNone('/clinical/conditions');
      expect(porTestId('diagnostico-error')?.textContent).toContain('El catálogo no publica «COND_PROVISIONAL»');
      expect(registroBloqueado()).toBe(false);
    });

    it('un 403 se dice con las palabras de siempre y no pierde lo escrito', () => {
      cargar();
      elegirDiagnostico('dx-hta');

      botonDeRegistro().click();
      responderBusquedaDelConcepto();
      http.expectOne('/clinical/conditions').flush(
        { statusCode: 403, code: 'FORBIDDEN', message: '', error: 'Forbidden', requestId: 'req-3' },
        { status: 403, statusText: 'Forbidden' },
      );
      fixture.detectChanges();

      expect(porTestId('diagnostico-error')?.textContent).toContain('no permite registrar diagnósticos');
      expect(componente.tieneCambiosPendientes()).toBe(true);
    });

    it('no admite el doble envío: el segundo clic mientras viaja no repite nada', () => {
      cargar();
      elegirDiagnostico('dx-hta');

      botonDeRegistro().click();
      botonDeRegistro().click();
      responderBusquedaDelConcepto();
      http.expectOne('/clinical/conditions');
      // Un solo POST: `expectOne` falla si hubiera dos.
      http.expectNone('/charts/notes');
    });

    it('con una fila mal escrita no deja registrar', () => {
      cargar();
      elegirDiagnostico('dx-hta');
      escribirMotivo('', 'valor sin campo');

      expect(registroBloqueado()).toBe(true);
    });
  });

  /* ---- lo que el revisor independiente encontró (30/10/2026) -------------- */

  describe('robustez del alta', () => {
    it('un registro en vuelo NO escribe sobre otra persona si se cambió de paciente', () => {
      cargar();
      elegirDiagnostico('dx-hta');
      botonDeRegistro().click();

      // Mientras viaja, se pasa a otra persona: el formulario se vacía.
      fixture.componentRef.setInput('patientProfileId', 'p-2');
      fixture.detectChanges();

      // Vuelve lo de la persona anterior.
      responderBusquedaDelConcepto();
      http.expectOne('/clinical/conditions').flush(CONDICION_REGISTRADA);
      http.match(() => true);
      fixture.detectChanges();

      // Nada de eso quedó en el formulario de la persona nueva…
      expect(componente['registrado']()).toBeNull();
      expect(componente.tieneCambiosPendientes()).toBe(false);
      // …ni se escribió una nota con lo de ella.
      http.expectNone('/charts/notes');
    });

    it('Enter en el campo de una fila NO registra el diagnóstico', () => {
      cargar();
      elegirDiagnostico('dx-hta');
      escribirMotivo('Fiebre', '39');
      const campo = elemento().querySelector<HTMLInputElement>(
        '.adicionales__fila input',
      )!;

      const evento = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      campo.dispatchEvent(evento);

      expect(evento.defaultPrevented).toBe(true);
      http.expectNone('/clinical/conditions');
    });

    it('Enter en un cuadro de texto libre (hallazgos) no se frena: es un salto de línea', () => {
      cargar();
      const area = elemento().querySelector<HTMLTextAreaElement>(
        '[data-testid="diagnostico-hallazgos"] textarea, textarea[data-testid="diagnostico-hallazgos"]',
      )!;

      const evento = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      area.dispatchEvent(evento);

      expect(evento.defaultPrevented).toBe(false);
    });

    it('los motivos van como un h4: la sección ya tiene su h3', () => {
      cargar();
      const titulo = elemento().querySelector('#adicionales-titulo');

      expect(titulo?.tagName).toBe('H4');
      expect(elemento().querySelector('#diagnostico-alta-titulo')?.tagName).toBe('H3');
    });

    it('sólo ofrece mensaje de descarte cuando el diagnóstico ya quedó registrado', () => {
      cargar();
      expect(componente.mensajeDeDescarte()).toBeNull();

      componente['registrado'].set({
        id: 'c-9',
        patientProfileId: 'p-1',
        clinicalStatus: null,
        verificationStatus: null,
        clinicalCourse: null,
        createdAt: new Date(),
      });
      expect(componente.mensajeDeDescarte()).toContain('ya quedó registrado');
    });

    it('una lectura de plantillas vacía no se cachea: la siguiente importación puede funcionar', () => {
      cargar();
      conEncuentro([
        { id: 'inst-1', resourceId: 'enc-1', resourceTypeConceptId: 'rt', schemaVersion: 1, closedAt: '2026-10-30T10:30:00.000Z', createdAt: '2026-10-30T10:05:00.000Z' },
      ]);
      const uno = { id: 'v1', fieldId: 'f-motivo', value: 'Tos', dataType: 'TEXT', ordinal: 0, masked: false };
      const detalle = { id: 'inst-1', resourceId: 'enc-1', resourceTypeConceptId: 'rt', schemaVersion: 1, closedAt: '2026-10-30T10:30:00.000Z', createdAt: '2026-10-30T10:05:00.000Z', values: [uno] };
      const elegir = interno<(id: string | null) => void>('elegirRespuesta');

      elegir('inst-1');
      http.expectOne('/forms/instances/inst-1').flush(detalle);
      http.expectOne((r) => r.url === '/charts/templates').flush([]);
      fixture.detectChanges();
      expect(porTestId('diagnostico-fallo-importacion')).not.toBeNull();

      // Segundo intento: vuelve a pedir las plantillas (no quedó el `[]` cacheado).
      elegir('inst-1');
      http.expectOne('/forms/instances/inst-1').flush(detalle);
      http
        .expectOne((r) => r.url === '/charts/templates')
        .flush([{ id: 'tpl-1', name: 'Ficha', fields: [{ fieldId: 'f-motivo', name: 'Motivo', dataType: 'TEXT', assignmentId: 'a-1' }] }]);
      fixture.detectChanges();

      expect(porTestId('diagnostico-fallo-importacion')).toBeNull();
      expect(porTestId('diagnostico-aviso-importacion')?.textContent).toContain('Se trajeron 1 respuesta');
    });
  });

  /* ---- un formulario médico ya llenado ------------------------------------ */

  describe('motivos desde un formulario médico ya llenado', () => {
    const INSTANCIA = {
      id: 'inst-1',
      resourceId: 'enc-1',
      resourceTypeConceptId: 'rt',
      schemaVersion: 1,
      closedAt: '2026-10-30T10:30:00.000Z',
      createdAt: '2026-10-30T10:05:00.000Z',
    };

    const PLANTILLA = {
      id: 'tpl-1',
      name: 'Ficha de prueba',
      fields: [
        { fieldId: 'f-motivo', name: 'Motivo de consulta', dataType: 'TEXT', assignmentId: 'a-1' },
        { fieldId: 'f-dolor', name: 'Dolor', dataType: 'TEXT', assignmentId: 'a-2' },
        { fieldId: 'f-secreto', name: 'Antecedente protegido', dataType: 'TEXT', assignmentId: 'a-3' },
        { fieldId: 'f-dolor2', name: 'Dolor', dataType: 'TEXT', assignmentId: 'a-4' },
      ],
    };

    function detalle(valores: readonly object[]): object {
      return { ...INSTANCIA, values: valores };
    }

    const valor = (id: string, fieldId: string, value: string, ordinal: number, masked = false) => ({
      id,
      fieldId,
      value,
      dataType: 'TEXT',
      ordinal,
      masked,
    });

    function elegirFormulario(valores: readonly object[]): void {
      interno<(id: string | null) => void>('elegirRespuesta')('inst-1');
      http.expectOne('/forms/instances/inst-1').flush(detalle(valores));
      http.expectOne((r) => r.url === '/charts/templates').flush([PLANTILLA]);
      fixture.detectChanges();
    }

    function filas(): readonly { rotulo: string; valor: string; origen?: string }[] {
      const motivos = fixture.debugElement.query(By.directive(AdditionalFields)).componentInstance;
      return (motivos as unknown as { filas(): readonly { rotulo: string; valor: string; origen?: string }[] }).filas();
    }

    it('sin encuentro no ofrece formularios: no hay de dónde traerlos', () => {
      cargar();
      expect(porTestId('diagnostico-formulario')).toBeNull();
    });

    it('con un encuentro sin formulario completado lo dice y deja escribir a mano', () => {
      cargar();
      conEncuentro([{ ...INSTANCIA, closedAt: null }]);
      fixture.detectChanges();

      expect(porTestId('diagnostico-sin-formularios')).not.toBeNull();
    });

    it('trae las respuestas como filas editables, sin las protegidas ni las vacías', () => {
      cargar();
      conEncuentro([INSTANCIA]);
      fixture.detectChanges();
      expect(porTestId('diagnostico-formulario')).not.toBeNull();

      elegirFormulario([
        valor('v1', 'f-motivo', 'Tos productiva', 0),
        valor('v2', 'f-dolor', 'Torácico', 1),
        valor('v3', 'f-secreto', '', 2, true),
        valor('v4', 'f-dolor2', 'Abdominal', 3),
        valor('v5', 'f-motivo', '   ', 4),
      ]);

      expect(filas().map((f) => [f.rotulo, f.valor])).toEqual([
        ['Motivo de consulta', 'Tos productiva'],
        ['Dolor', 'Torácico'],
        ['Dolor (2)', 'Abdominal'],
      ]);
      expect(filas().every((f) => f.origen === 'formulario')).toBe(true);
      expect(porTestId('diagnostico-aviso-importacion')?.textContent).toContain(
        'Se trajeron 3 respuestas',
      );
      expect(porTestId('diagnostico-aviso-importacion')?.textContent).toContain(
        '1 respuesta protegida no se copió',
      );
      expect(componente.tieneCambiosPendientes()).toBe(true);
    });

    it('«Ninguno» saca lo traído y conserva lo escrito a mano', () => {
      cargar();
      conEncuentro([INSTANCIA]);
      escribirMotivo('Fiebre', '39 °C');
      elegirFormulario([valor('v1', 'f-motivo', 'Tos productiva', 0)]);
      expect(filas().map((f) => f.rotulo)).toEqual(['Fiebre', 'Motivo de consulta']);

      interno<(id: string | null) => void>('elegirRespuesta')(null);
      fixture.detectChanges();

      expect(filas().map((f) => f.rotulo)).toEqual(['Fiebre']);
    });

    it('al registrar deja el formulario de origen en el diagnóstico y en la nota', () => {
      cargar();
      conEncuentro([INSTANCIA]);
      elegirDiagnostico('dx-hta');
      elegirFormulario([valor('v1', 'f-motivo', 'Tos productiva', 0)]);

      botonDeRegistro().click();
      responderBusquedaDelConcepto();
      const alta = http.expectOne('/clinical/conditions');
      const texto = (alta.request.body as { noteText: string }).noteText;
      expect(texto).toContain('Del formulario «Ficha de prueba»');
      expect(texto).toContain('Motivos: Motivo de consulta: Tos productiva');
      alta.flush(CONDICION_REGISTRADA);
      const nota = http.expectOne('/charts/notes');
      expect((nota.request.body as { subjectiveText: string }).subjectiveText).toContain(
        'Del formulario «Ficha de prueba»',
      );
      nota.flush({ noteId: 'n-1', versionId: 'v-1', versionNumber: 1, lifecycleStatusConceptId: 'l', versionStatusConceptId: 'v' });
    });

    it('sin plantillas que nombren las preguntas no trae filas sin sentido: lo dice', () => {
      cargar();
      conEncuentro([INSTANCIA]);
      interno<(id: string | null) => void>('elegirRespuesta')('inst-1');
      http
        .expectOne('/forms/instances/inst-1')
        .flush(detalle([valor('v1', 'f-motivo', 'Tos productiva', 0)]));
      http.expectOne((r) => r.url === '/charts/templates').flush([]);
      fixture.detectChanges();

      expect(porTestId('diagnostico-fallo-importacion')).not.toBeNull();
      expect(filas()).toHaveLength(0);
      expect(componente['respuestaElegida']()).toBeNull();
    });

    it('si no se pueden leer las respuestas lo dice y deja escribir a mano', () => {
      cargar();
      conEncuentro([INSTANCIA]);
      interno<(id: string | null) => void>('elegirRespuesta')('inst-1');
      http
        .expectOne('/forms/instances/inst-1')
        .flush({ message: 'boom' }, { status: 500, statusText: 'Error' });
      // El `forkJoin` ya cortó: la lectura de plantillas quedó cancelada.
      http.match((r) => r.url === '/charts/templates');
      fixture.detectChanges();

      expect(porTestId('diagnostico-fallo-importacion')).not.toBeNull();
      expect(filas()).toHaveLength(0);
      expect(componente['respuestaElegida']()).toBeNull();
    });
  });
});
