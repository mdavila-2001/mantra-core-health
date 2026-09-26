import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { signal, type WritableSignal } from '@angular/core';

import { AuthService } from '../../../../core/auth/auth.service';
import { DocumentBlock, TARGET_CATEGORIA_DOCUMENTAL } from './document-block';

/** Una expansión de catálogo con la forma que sirve `system-context`. */
const CATALOGO = {
  code: 'document-category',
  name: 'Categoría',
  description: '',
  definitionId: 'def-1',
  valueSetId: 'vs-1',
  versionId: 'v-1',
  cacheToken: 'v1',
  allowCustomValue: false,
  options: [{ conceptId: 'cat-lab', code: 'DOC-CAT-LAB', display: 'Laboratorio', ordinal: 1 }],
};

const RESPUESTA = {
  id: 'doc-1',
  statusConceptId: 'st-borrador',
  fileCount: 0,
  createdAt: '2026-09-10T10:00:00.000Z',
};

/** Un archivo de mentira, que es lo único que `FilesClient.upload` necesita. */
function archivo(nombre: string): File {
  return new File([new Uint8Array([1, 2, 3])], nombre, { type: 'application/pdf' });
}

/**
 * La pestaña «Documentos» sabía listar y nada más: el papel que la persona
 * trae en la mano no tenía por dónde entrar a la historia. Estas pruebas fijan
 * lo que el alta nueva tiene que respetar: los archivos se suben **antes** del
 * alta —el contrato recibe los `fileId` en el propio `POST`—, el primero es el
 * `PRIMARY`, y si la subida falla no se registra nada.
 */
describe('DocumentBlock', () => {
  let fixture: ComponentFixture<DocumentBlock>;
  let componente: DocumentBlock;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentBlock],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            activeTenantId: signal<string | null>('t-1'),
            roles: signal<readonly string[]>(['PRACTITIONER']),
            practitionerProfileId: signal<string | null>('hp-1'),
            displayName: signal<string | null>('Dra. Rojas'),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DocumentBlock);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('patientProfileId', 'p-1');
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    for (const pendiente of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      pendiente.flush(CATALOGO);
    }
    http.verify();
  });

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function señal<T>(nombre: string): WritableSignal<T> {
    return (componente as unknown as Record<string, WritableSignal<T>>)[nombre];
  }

  function dibujar(): void {
    fixture.detectChanges();
    for (const pendiente of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      pendiente.flush(CATALOGO);
    }
    fixture.detectChanges();
  }

  it('pide el catálogo de categorías por su target', () => {
    fixture.detectChanges();
    const req = http.expectOne((r) => r.params.get('target') === TARGET_CATEGORIA_DOCUMENTAL);
    req.flush(CATALOGO);
    fixture.detectChanges();
  });

  it('el título es lo único que se exige', () => {
    dibujar();
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(false);

    señal<string | number | null>('titulo').set('Laboratorio completo');
    expect(interno<() => boolean>('puedeRegistrar')()).toBe(true);
  });

  /** El contrato declara `files` opcional: hay papeles que se asientan antes
      de digitalizarse. Lo que no se hace es fingir que hay archivo. */
  it('sin archivos registra el documento sin tocar el almacenamiento', () => {
    dibujar();
    señal<string | number | null>('titulo').set('  Laboratorio completo  ');

    interno<() => void>('registrar')();

    http.expectNone('/common/files/upload');
    const req = http.expectOne('/charts/documents');
    expect(req.request.body.title).toBe('Laboratorio completo');
    expect('files' in req.request.body).toBe(false);
    req.flush(RESPUESTA);
  });

  /**
   * El orden es subir → registrar y no al revés: `CreateDocumentDto.files`
   * recibe los `fileId` en el propio alta y **no hay ruta** para colgarle un
   * archivo a un documento ya creado.
   */
  it('sube los archivos antes del alta y manda sus identificadores', () => {
    dibujar();
    señal<string | number | null>('titulo').set('Laboratorio completo');
    señal<readonly File[]>('archivos').set([archivo('informe.pdf'), archivo('anexo.pdf')]);

    interno<() => void>('registrar')();

    const subidas = http.match('/common/files/upload');
    expect(subidas.length).toBe(2);
    subidas[0]!.flush({ id: 'file-1' });
    subidas[1]!.flush({ id: 'file-2' });

    const req = http.expectOne('/charts/documents');
    expect(req.request.body.files).toEqual([
      { fileId: 'file-1', contentRole: 'PRIMARY', ordinal: 0 },
      { fileId: 'file-2', contentRole: 'ATTACHMENT', ordinal: 1 },
    ]);
    req.flush(RESPUESTA);
  });

  /**
   * Un documento titulado «Laboratorio completo» sin el laboratorio adentro es
   * peor que no tenerlo, y arreglarlo después exigiría una ruta que no existe.
   */
  it('si la subida falla, no se registra nada', () => {
    dibujar();
    señal<string | number | null>('titulo').set('Laboratorio completo');
    señal<readonly File[]>('archivos').set([archivo('informe.pdf')]);

    interno<() => void>('registrar')();

    http.expectOne('/common/files/upload').error(new ProgressEvent('error'));
    http.expectNone('/charts/documents');
    expect(interno<() => boolean>('registrando')()).toBe(false);
    expect(interno<() => string | null>('errorDelDocumento')()).not.toBeNull();
  });

  it('los opcionales sin elegir se omiten, no viajan en null', () => {
    dibujar();
    señal<string | number | null>('titulo').set('Laboratorio completo');

    interno<() => void>('registrar')();

    const req = http.expectOne('/charts/documents');
    expect(Object.keys(req.request.body as object).sort()).toEqual([
      'patientProfileId',
      'tenantId',
      'title',
    ]);
    req.flush(RESPUESTA);
  });

  it('el rótulo del botón dice cuántos archivos van', () => {
    dibujar();
    expect(interno<() => string>('rotuloDeEnvio')()).toBe('Registrar documento');

    señal<readonly File[]>('archivos').set([archivo('a.pdf')]);
    expect(interno<() => string>('rotuloDeEnvio')()).toBe('Registrar con 1 archivo');

    señal<readonly File[]>('archivos').set([archivo('a.pdf'), archivo('b.pdf')]);
    expect(interno<() => string>('rotuloDeEnvio')()).toBe('Registrar con 2 archivos');
  });

  /** La cita elegida gana sobre el encuentro que pase el anfitrión. */
  it('manda la cita elegida y no el encuentro en curso', () => {
    fixture.componentRef.setInput('encounterId', 'enc-en-curso');
    fixture.componentRef.setInput('citas', [
      { id: 'enc-9', etiqueta: '7 sept 2026 · Control', enCurso: false },
    ]);
    dibujar();
    señal<string | number | null>('titulo').set('Laboratorio completo');
    señal<string | null>('citaElegida').set('enc-9');

    interno<() => void>('registrar')();

    const req = http.expectOne('/charts/documents');
    expect(req.request.body.encounterId).toBe('enc-9');
    req.flush(RESPUESTA);
  });

  describe('tieneCambiosPendientes — contrato de DraftBlock', () => {
    it('recién montado no tiene cambios pendientes', () => {
      dibujar();
      expect(componente.tieneCambiosPendientes()).toBe(false);
    });

    it('con un título escrito tiene cambios pendientes', () => {
      dibujar();
      señal<string | number | null>('titulo').set('Laboratorio completo');
      expect(componente.tieneCambiosPendientes()).toBe(true);
    });

    it('con un archivo elegido y nada más también cuenta', () => {
      dibujar();
      señal<readonly File[]>('archivos').set([archivo('laboratorio.pdf')]);
      expect(componente.tieneCambiosPendientes()).toBe(true);
    });

    it('registrado, vuelve a no tener cambios pendientes', () => {
      dibujar();
      señal<string | number | null>('titulo').set('Laboratorio completo');
      expect(componente.tieneCambiosPendientes()).toBe(true);

      interno<() => void>('registrar')();
      const req = http.expectOne('/charts/documents');
      req.flush(RESPUESTA);

      expect(componente.tieneCambiosPendientes()).toBe(false);
    });
  });

  /**
   * CL-28: la subida y el vinculo son dos casos de uso. Si `POST /charts/documents`
   * falla con los archivos ya subidos, «Reintentar» reenvia los mismos `fileId` y
   * **no** vuelve a subirlos (quedaban huerfanos y duplicados).
   */
  describe('reintento sin re-subir (CL-28)', () => {
    it('si el alta falla, el reintento reenvia los mismos fileId sin subir de nuevo', () => {
      dibujar();
      señal<string | number | null>('titulo').set('Laboratorio completo');
      señal<readonly File[]>('archivos').set([archivo('informe.pdf'), archivo('anexo.pdf')]);

      interno<() => void>('registrar')();
      const subidas = http.match('/common/files/upload');
      expect(subidas.length).toBe(2);
      subidas[0]!.flush({ id: 'file-1' });
      subidas[1]!.flush({ id: 'file-2' });
      http
        .expectOne('/charts/documents')
        .flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Server Error' });

      expect(interno<() => string>('rotuloDeEnvio')()).toContain('Reintentar');

      interno<() => void>('registrar')();
      // Ninguna subida nueva.
      http.expectNone('/common/files/upload');
      const req = http.expectOne('/charts/documents');
      expect(req.request.body.files).toEqual([
        { fileId: 'file-1', contentRole: 'PRIMARY', ordinal: 0 },
        { fileId: 'file-2', contentRole: 'ATTACHMENT', ordinal: 1 },
      ]);
      req.flush(RESPUESTA);
      expect(interno<() => string>('rotuloDeEnvio')()).toBe('Registrar documento');
    });

    it('si una subida falla y otra salio bien, el reintento sube solo la que falta', () => {
      dibujar();
      señal<string | number | null>('titulo').set('Laboratorio completo');
      señal<readonly File[]>('archivos').set([archivo('informe.pdf'), archivo('anexo.pdf')]);

      interno<() => void>('registrar')();
      const subidas = http.match('/common/files/upload');
      subidas[0]!.flush({ id: 'file-1' });
      subidas[1]!.error(new ProgressEvent('error'));
      http.expectNone('/charts/documents');

      interno<() => void>('registrar')();
      // Solo el segundo vuelve a subirse.
      const segunda = http.expectOne('/common/files/upload');
      segunda.flush({ id: 'file-2' });
      const req = http.expectOne('/charts/documents');
      expect(req.request.body.files).toEqual([
        { fileId: 'file-1', contentRole: 'PRIMARY', ordinal: 0 },
        { fileId: 'file-2', contentRole: 'ATTACHMENT', ordinal: 1 },
      ]);
      req.flush(RESPUESTA);
    });
  });
});
