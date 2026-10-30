import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { concat, lastValueFrom, toArray } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { AdditionalFields, entradasDelTexto, textoDeLasEntradas, type FilaAdicional } from './additional-fields';

/**
 * Los campos adicionales del doctor, al final del formulario médico.
 *
 * Lo que fijan estas pruebas:
 *
 * 1. **Opcional de verdad**: arranca sin filas y sin nada que registrar.
 * 2. **Cada fila lleva texto, archivos o las dos cosas**; sin ninguna de las
 *    dos, o sin campo, se marca y el formulario no se completa.
 * 3. **Registrar**: una nota con las filas y un documento por fila con
 *    archivos, todo contra el encuentro.
 * 4. **Lo que la sesión no permite se dice antes de enviar.**
 */
describe('AdditionalFields', () => {
  let fixture: ComponentFixture<AdditionalFields>;
  let componente: AdditionalFields;
  let http: HttpTestingController;
  let tenant: WritableSignal<string | null>;
  let profesional: WritableSignal<string | null>;

  function interno<T>(clave: string): T {
    return (componente as unknown as Record<string, T>)[clave] as T;
  }

  function filas(valor: readonly Omit<FilaAdicional, 'clave'>[]): void {
    interno<WritableSignal<readonly FilaAdicional[]>>('filas').set(
      valor.map((fila, clave) => ({ clave, ...fila })),
    );
  }

  const archivo = (nombre: string) => new File(['x'], nombre, { type: 'image/jpeg' });

  beforeEach(() => {
    tenant = signal<string | null>('t-1');
    profesional = signal<string | null>('hp-1');
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { activeTenantId: tenant, practitionerProfileId: profesional },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdditionalFields);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('patientProfileId', 'pac-1');
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('arranca sin filas y sin nada que registrar', () => {
    expect(interno<() => readonly FilaAdicional[]>('filas')()).toEqual([]);
    expect(componente.tieneContenido()).toBe(false);
    expect(componente.hayProblemas()).toBe(false);
    expect(componente.pasos('enc-1')).toEqual([]);
  });

  it('una fila con sólo archivos es válida, y su valor nombra los adjuntos', () => {
    filas([
      { rotulo: 'Análisis con el que vino', valor: '', archivos: [archivo('hemograma.jpg')] },
    ]);

    expect(componente.hayProblemas()).toBe(false);
    expect(componente.entradas()).toEqual([
      { label: 'Análisis con el que vino', value: 'Adjunto: hemograma.jpg' },
    ]);
  });

  it('texto y archivos juntos viajan en el mismo valor', () => {
    filas([
      {
        rotulo: 'Rx tórax',
        valor: 'Sin hallazgos',
        archivos: [archivo('a.jpg'), archivo('b.jpg')],
      },
    ]);

    expect(componente.entradas()[0]?.value).toBe('Sin hallazgos · Adjunto: a.jpg, b.jpg');
  });

  it('sin valor ni archivos, o sin campo, la fila se marca', () => {
    filas([
      { rotulo: 'Presión', valor: '', archivos: [] },
      { rotulo: '', valor: '120/80', archivos: [] },
    ]);

    const problemas = interno<() => ReadonlyMap<number, string | null>>('problemas')();
    expect(problemas.get(0)).toBe('Escriba un valor o adjunte un archivo.');
    expect(problemas.get(1)).toBe('Falta el campo.');
    expect(componente.hayProblemas()).toBe(true);
  });

  it('dos filas con el mismo campo se marcan', () => {
    filas([
      { rotulo: 'Presión arterial', valor: '120/80', archivos: [] },
      { rotulo: 'presion arterial', valor: '130/85', archivos: [] },
    ]);

    expect(interno<() => ReadonlyMap<number, string | null>>('problemas')().get(1)).toBe(
      'Ese campo ya está en otra fila.',
    );
  });

  it('registra una nota con las filas y un documento por fila con archivos', async () => {
    filas([
      { rotulo: 'Presión', valor: '120/80', archivos: [] },
      {
        rotulo: 'Análisis con el que vino',
        valor: '',
        archivos: [archivo('hemo.jpg'), archivo('orina.pdf')],
      },
    ]);
    interno<WritableSignal<string>>('textoLibre').set('Refiere mareos.');

    const pasos = componente.pasos('enc-1');
    expect(pasos.map((paso) => paso.nombre)).toEqual([
      'la nota con los campos adicionales',
      'el documento con los archivos de «Análisis con el que vino»',
    ]);

    const hecho = lastValueFrom(concat(...pasos.map((paso) => paso.ejecutar())).pipe(toArray()));

    const nota = http.expectOne((r) => r.url === '/charts/notes' && r.method === 'POST');
    expect(nota.request.body).toEqual({
      patientProfileId: 'pac-1',
      authorProfileId: 'hp-1',
      encounterId: 'enc-1',
      // P39: la API guarda las filas estructuradas; ya no se aplanan en `objectiveText`.
      entries: [
        { label: 'Presión', value: '120/80' },
        { label: 'Análisis con el que vino', value: 'Adjunto: hemo.jpg, orina.pdf' },
      ],
      subjectiveText: 'Refiere mareos.',
    });
    nota.flush({ noteId: 'n-1', versionId: 'v-1' });

    const subidas = http.match('/common/files/upload');
    expect(subidas).toHaveLength(2);
    subidas[0]!.flush({ id: 'f-1' });
    subidas[1]!.flush({ id: 'f-2' });

    const documento = http.expectOne('/charts/documents');
    expect(documento.request.body).toEqual({
      patientProfileId: 'pac-1',
      tenantId: 't-1',
      title: 'Análisis con el que vino',
      encounterId: 'enc-1',
      files: [
        { fileId: 'f-1', contentRole: 'PRIMARY', ordinal: 0 },
        { fileId: 'f-2', contentRole: 'ATTACHMENT', ordinal: 1 },
      ],
    });
    documento.flush({ documentId: 'd-1', fileCount: 2 });

    await hecho;
  });

  it('sin organización no se pueden adjuntar archivos, y se dice antes', () => {
    tenant.set(null);
    filas([{ rotulo: 'Foto', valor: '', archivos: [archivo('f.jpg')] }]);

    expect(componente.impedimento()).toContain('organización');
  });

  it('sin perfil profesional los campos no se pueden guardar, y se dice antes', () => {
    profesional.set(null);
    filas([{ rotulo: 'Presión', valor: '120/80', archivos: [] }]);

    expect(componente.impedimento()).toContain('profesional');
  });

  it('agregar y quitar filas', () => {
    const agregar = interno<() => void>('agregarFila').bind(componente);
    agregar();
    agregar();
    const actuales = interno<() => readonly FilaAdicional[]>('filas')();
    expect(actuales).toHaveLength(2);

    interno<(clave: number) => void>('quitarFila').call(componente, actuales[0]!.clave);
    expect(interno<() => readonly FilaAdicional[]>('filas')()).toHaveLength(1);
  });

  it('cada fila admite varios archivos: el selector es múltiple', () => {
    interno<() => void>('agregarFila').call(componente);
    fixture.detectChanges();

    const selector = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(
      '[data-testid="adicional-fila"] input[type="file"]',
    );
    expect(selector?.multiple).toBe(true);
  });

  it('después de registrar vuelve a la sección vacía: sin filas ni texto libre', () => {
    filas([
      { rotulo: 'Glucemia', valor: '98 mg/dL', archivos: [] },
      { rotulo: 'Rx tórax', valor: '', archivos: [archivo('rx.jpg'), archivo('rx-perfil.jpg')] },
    ]);
    interno<WritableSignal<string>>('textoLibre').set('Vino en ayunas.');
    expect(componente.tieneContenido()).toBe(true);

    componente.limpiar();

    expect(interno<() => readonly FilaAdicional[]>('filas')()).toEqual([]);
    expect(componente.tieneContenido()).toBe(false);
    expect(componente.pasos('enc-1')).toEqual([]);
  });
});

/**
 * Lo que `AdditionalFields` ganó el 30/10/2026 para que el alta de un presuntivo
 * la reutilice —sin duplicar el componente—: título y bajada propios, sin archivos
 * ni texto libre, precarga de filas desde otra fuente y nota sin encuentro.
 * Los valores por defecto **no cambian** el uso del formulario médico.
 */
describe('AdditionalFields reutilizado', () => {
  let fixture: ComponentFixture<AdditionalFields>;
  let componente: AdditionalFields;
  let http: HttpTestingController;
  const raiz = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { activeTenantId: signal('t-1'), practitionerProfileId: signal('hp-1') },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdditionalFields);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('patientProfileId', 'pac-1');
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  const filas = () =>
    (componente as unknown as { filas(): readonly FilaAdicional[] }).filas();

  it('por omisión sigue siendo la sección de siempre: título, archivos y texto libre', () => {
    (componente as unknown as { agregarFila(): void }).agregarFila();
    fixture.detectChanges();

    expect(raiz().querySelector('#adicionales-titulo')?.textContent).toContain(
      'Campos adicionales del doctor',
    );
    expect(raiz().textContent).toContain('Se aceptan');
    expect(raiz().querySelector('[data-testid="adicional-archivos"]')).not.toBeNull();
    expect(raiz().querySelector('[data-testid="adicional-texto"]')).not.toBeNull();
  });

  it('con título y bajada propios, sin archivos ni texto libre', () => {
    fixture.componentRef.setInput('titulo', 'Motivos del diagnóstico');
    fixture.componentRef.setInput('ayuda', 'Cada fila es un campo y su valor.');
    fixture.componentRef.setInput('conArchivos', false);
    fixture.componentRef.setInput('conTextoLibre', false);
    (componente as unknown as { agregarFila(): void }).agregarFila();
    fixture.detectChanges();

    expect(raiz().querySelector('#adicionales-titulo')?.textContent).toContain(
      'Motivos del diagnóstico',
    );
    expect(raiz().textContent).toContain('Cada fila es un campo y su valor.');
    expect(raiz().textContent).not.toContain('Se aceptan');
    expect(raiz().querySelector('[data-testid="adicional-archivos"]')).toBeNull();
    expect(raiz().querySelector('[data-testid="adicional-texto"]')).toBeNull();
    expect(raiz().querySelector('[data-testid="adicional-rotulo"]')).not.toBeNull();
  });

  describe('cargar', () => {
    it('trae filas editables marcadas con su origen y devuelve 0 si entraron todas', () => {
      const sobrantes = componente.cargar(
        [
          { label: 'Fiebre', value: '39 °C' },
          { label: 'Tos', value: 'Productiva' },
        ],
        'formulario',
      );

      expect(sobrantes).toBe(0);
      expect(filas().map((f) => [f.rotulo, f.valor, f.origen])).toEqual([
        ['Fiebre', '39 °C', 'formulario'],
        ['Tos', 'Productiva', 'formulario'],
      ]);
      expect(componente.tieneContenido()).toBe(true);
    });

    it('cargar otra vez reemplaza las del mismo origen y conserva las escritas a mano', () => {
      (componente as unknown as { agregarFila(): void }).agregarFila();
      const manual = filas()[0]!;
      (componente as unknown as { fijarRotulo(c: number, v: string): void }).fijarRotulo(manual.clave, 'Mío');
      (componente as unknown as { fijarValor(c: number, v: string): void }).fijarValor(manual.clave, 'a mano');
      componente.cargar([{ label: 'A', value: '1' }], 'formulario');
      componente.cargar([{ label: 'B', value: '2' }], 'formulario');

      expect(filas().map((f) => f.rotulo)).toEqual(['Mío', 'B']);
    });

    it('quitarOrigen saca sólo lo traído', () => {
      (componente as unknown as { agregarFila(): void }).agregarFila();
      const manual = filas()[0]!;
      (componente as unknown as { fijarRotulo(c: number, v: string): void }).fijarRotulo(manual.clave, 'Mío');
      (componente as unknown as { fijarValor(c: number, v: string): void }).fijarValor(manual.clave, 'a mano');
      componente.cargar([{ label: 'A', value: '1' }], 'formulario');

      componente.quitarOrigen('formulario');

      expect(filas().map((f) => f.rotulo)).toEqual(['Mío']);
    });

    it('respeta el tope de 40 filas y dice cuántas no entraron', () => {
      const cuarenta = Array.from({ length: 43 }, (_, i) => ({ label: `Campo ${i}`, value: 'v' }));

      const sobrantes = componente.cargar(cuarenta, 'formulario');

      expect(filas()).toHaveLength(40);
      expect(sobrantes).toBe(3);
    });

    it('una fila traída con un campo repetido se marca como cualquier otra', () => {
      componente.cargar(
        [
          { label: 'Dolor', value: 'a' },
          { label: 'dolor', value: 'b' },
        ],
        'formulario',
      );

      expect(componente.hayProblemas()).toBe(true);
    });
  });

  describe('texto plano (espejo de @IsPlainText de la API)', () => {
    const conFila = (rotulo: string, valor: string) => {
      componente.cargar([{ label: rotulo, value: valor }], 'formulario');
      fixture.detectChanges();
    };

    it('una etiqueta HTML marca la fila: la API la rechazaría con un 400 sin decir cuál', () => {
      conFila('Nota', 'Ver <b>informe</b>');

      expect(componente.hayProblemas()).toBe(true);
      expect(raiz().textContent).toContain('Sólo admite texto plano');
    });

    it('un carácter de control también', () => {
      conFila('Nota', 'dato\u0007raro');

      expect(componente.hayProblemas()).toBe(true);
    });

    it('un valor clínico con «<» NO es HTML: «<140» y «PA < 140 y > 90» valen', () => {
      conFila('PA', '<140');
      expect(componente.hayProblemas()).toBe(false);

      componente.limpiar();
      conFila('PA', 'PA < 140 y > 90');
      expect(componente.hayProblemas()).toBe(false);
    });

    it('el campo también se valida', () => {
      conFila('<script>', 'x');

      expect(componente.hayProblemas()).toBe(true);
    });
  });

  it('como subsección el título es un h4; por omisión sigue siendo un h3', () => {
    expect(raiz().querySelector('#adicionales-titulo')?.tagName).toBe('H3');

    fixture.componentRef.setInput('subseccion', true);
    fixture.detectChanges();

    expect(raiz().querySelector('#adicionales-titulo')?.tagName).toBe('H4');
  });

  describe('pasos', () => {
    it('sin encuentro la nota se crea igual, sin `encounterId`', () => {
      componente.cargar([{ label: 'Fiebre', value: '39 °C' }], 'formulario');

      const [nota] = componente.pasos(null);
      nota!.ejecutar().subscribe();

      const req = http.expectOne('/charts/notes');
      expect('encounterId' in (req.request.body as object)).toBe(false);
      expect((req.request.body as { entries: unknown }).entries).toEqual([
        { label: 'Fiebre', value: '39 °C' },
      ]);
      req.flush({ noteId: 'n-1', versionId: 'v-1', versionNumber: 1, lifecycleStatusConceptId: 'l', versionStatusConceptId: 'v' });
    });

    it('el encabezado abre el texto de la nota, y sin filas ni texto no crea ninguna', () => {
      fixture.componentRef.setInput('encabezadoDeLaNota', 'Motivos del diagnóstico presuntivo «HTA»');
      expect(componente.pasos('enc-1')).toEqual([]);

      componente.cargar([{ label: 'Fiebre', value: '39 °C' }], 'formulario');
      const [nota] = componente.pasos('enc-1');
      nota!.ejecutar().subscribe();

      const req = http.expectOne('/charts/notes');
      expect((req.request.body as { subjectiveText: string }).subjectiveText).toBe(
        'Motivos del diagnóstico presuntivo «HTA»',
      );
      expect((req.request.body as { encounterId: string }).encounterId).toBe('enc-1');
      req.flush({ noteId: 'n-1', versionId: 'v-1', versionNumber: 1, lifecycleStatusConceptId: 'l', versionStatusConceptId: 'v' });
    });
  });
});

describe('las filas en el texto de la nota', () => {
  it('van y vuelven como «campo: valor», una por línea', () => {
    const filas = [
      { label: 'Presión', value: '120/80' },
      { label: 'Glucemia', value: 'En ayunas: 95 mg/dL' },
    ];
    const texto = textoDeLasEntradas(filas);

    expect(texto).toBe('Presión: 120/80\nGlucemia: En ayunas: 95 mg/dL');
    expect(entradasDelTexto(texto)).toEqual(filas);
  });

  it('una línea sin campo se lee igual, y sin texto no hay filas', () => {
    expect(entradasDelTexto('Escrito a mano')).toEqual([{ label: 'Nota', value: 'Escrito a mano' }]);
    expect(entradasDelTexto(undefined)).toEqual([]);
    expect(entradasDelTexto('\n  \n')).toEqual([]);
  });
});
