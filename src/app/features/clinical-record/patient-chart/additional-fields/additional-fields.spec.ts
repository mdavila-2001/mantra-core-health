import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { concat, lastValueFrom, toArray } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { AdditionalFields, type FilaAdicional } from './additional-fields';

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
    expect(problemas.get(0)).toBe('Escribí un valor o adjuntá un archivo.');
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
});
