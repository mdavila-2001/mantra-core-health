import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { VersionImport } from './version-import';

/**
 * Importar es subir el archivo y después leerlo: dos llamadas encadenadas.
 *
 * Lo que estas pruebas fijan: que sólo se ofrezcan versiones que admiten
 * conceptos —una publicada da 422 al enviar, y descubrirlo ahí es tarde—, y que
 * publicar sea un paso propio: sin él los conceptos importados son invisibles a
 * toda expansión y **no da error**, que es el modo de fallo más callado del
 * catálogo.
 */
const SISTEMAS = [
  {
    id: 'cs-1',
    internalCode: 'icd10cm',
    name: 'CIE-10-CM',
    canonicalUrl: 'http://hl7.org/fhir/sid/icd-10-cm',
  },
];

const VERSIONES = [
  {
    id: 'v-borrador',
    version: '2026',
    state: 'DRAFT',
    isDefault: false,
    publishedAt: null,
    acceptsConcepts: true,
  },
  {
    id: 'v-publicada',
    version: '2025',
    state: 'ACTIVE',
    isDefault: true,
    publishedAt: '2025-01-01T00:00:00.000Z',
    acceptsConcepts: false,
  },
  {
    // El caso real de los importadores externos: sin estado, y admite conceptos.
    id: 'v-sin-estado',
    version: '2024',
    state: 'UNKNOWN',
    isDefault: false,
    publishedAt: null,
    acceptsConcepts: true,
  },
];

describe('VersionImport', () => {
  let fixture: ComponentFixture<VersionImport>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VersionImport],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', children: [] }]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(VersionImport);
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne('/terminology/code-systems').flush({ items: SISTEMAS });
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  function crudo<T>(nombre: string): T {
    return (fixture.componentInstance as unknown as Record<string, unknown>)[nombre] as T;
  }

  /** Elige el sistema y responde sus versiones. */
  function elegirSistema(): void {
    interno<(id: string) => void>('cambiarSistema')('cs-1');
    http.expectOne('/terminology/code-systems/cs-1/versions').flush({ items: VERSIONES });
    fixture.detectChanges();
  }

  it('sólo ofrece las versiones que admiten conceptos', () => {
    // Ofrecer una publicada sería preparar un 422 que se descubre al enviar.
    elegirSistema();

    const opciones = crudo<() => readonly { value: string }[]>('opcionesDeVersion').call(
      fixture.componentInstance,
    );
    expect(opciones.map((o) => o.value)).toEqual(['v-borrador', 'v-sin-estado']);
  });

  it('manda el archivo directo al importador', () => {
    elegirSistema();
    interno<(id: string) => void>('cambiarVersion')('v-borrador');
    crudo<{ set: (v: readonly File[]) => void }>('archivos').set([
      new File(['{"code":"A00","display":"Cólera"}\n'], 'cie10.ndjson', { type: 'text/plain' }),
    ]);

    interno<() => void>('importar')();

    // Una sola llamada, con el archivo como multipart. No pasa por
    // `common/files`: esa subida sólo admite PDF e imágenes.
    const importacion = http.expectOne('/terminology/versions/v-borrador/import-file');
    expect(importacion.request.method).toBe('POST');
    expect(importacion.request.body).toBeInstanceOf(FormData);
    expect((importacion.request.body as FormData).get('file')).toBeInstanceOf(File);
    importacion.flush({
      batchId: 'b-1',
      totalRead: 3,
      inserted: 2,
      skipped: 0,
      errors: 1,
      errorSamples: [{ line: 2, message: 'La línea no es un JSON válido.' }],
    });
    fixture.detectChanges();

    const informe = crudo<() => { inserted: number; errors: number } | null>('resultado').call(
      fixture.componentInstance,
    );
    expect(informe?.inserted).toBe(2);
    expect(informe?.errors).toBe(1);
  });

  it('sin versión o sin archivo no importa', () => {
    elegirSistema();

    // Con versión pero sin archivo.
    interno<(id: string) => void>('cambiarVersion')('v-borrador');
    expect(crudo<() => boolean>('puedeImportar').call(fixture.componentInstance)).toBe(false);

    interno<() => void>('importar')();
    http.expectNone('/terminology/versions/v-borrador/import-file');
  });

  it('publicar es un paso propio y relee las versiones', () => {
    // Sin publicar, los conceptos importados son invisibles a toda expansión y
    // no da ningún error: por eso la pantalla lo ofrece aparte y lo dice.
    elegirSistema();
    interno<(id: string) => void>('cambiarVersion')('v-borrador');

    interno<() => void>('publicar')();

    const publicacion = http.expectOne('/terminology/versions/v-borrador/publish');
    expect(publicacion.request.method).toBe('POST');
    publicacion.flush({ id: 'v-borrador', state: 'TERM_ACTIVE' });

    // Y relee: la versión cambió de estado y ya no admite conceptos.
    http.expectOne('/terminology/code-systems/cs-1/versions').flush({ items: VERSIONES });
  });

  it('cambiar de sistema limpia la versión y el resultado anterior', () => {
    elegirSistema();
    interno<(id: string) => void>('cambiarVersion')('v-borrador');

    interno<(id: string | null) => void>('cambiarSistema')(null);

    expect(crudo<() => string | null>('version').call(fixture.componentInstance)).toBeNull();
    expect(crudo<() => unknown>('resultado').call(fixture.componentInstance)).toBeNull();
  });
});
