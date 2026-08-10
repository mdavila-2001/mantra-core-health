import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DiscoveredKeysEditor } from './discovered-keys-editor';

describe('DiscoveredKeysEditor', () => {
  let fixture: ComponentFixture<DiscoveredKeysEditor>;
  let component: DiscoveredKeysEditor;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [DiscoveredKeysEditor] }).compileComponents();

    fixture = TestBed.createComponent(DiscoveredKeysEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function interno<T>(nombre: string): T {
    const valor = (component as unknown as Record<string, unknown>)[nombre];
    if (typeof valor !== 'function') return valor as T;
    return valor.bind(component) as T;
  }

  function filas(): { length: number; at: (i: number) => { patchValue: (v: object) => void } } {
    return interno<{
      length: number;
      at: (i: number) => { patchValue: (v: object) => void };
    }>('filas');
  }

  it('nace vacío y sin filas devuelve la lista vacía: el JWKS es opcional', () => {
    expect(filas().length).toBe(0);
    expect(component.intentarEnvio()).toEqual([]);
  });

  it('una fila incompleta bloquea el envío entero', () => {
    interno<() => void>('agregarFila')();
    filas().at(0).patchValue({ keyId: 'k-1' });

    expect(component.intentarEnvio()).toBeNull();
  });

  it('las claves viajan en orden, con el certificado solo cuando se carga', () => {
    interno<() => void>('agregarFila')();
    interno<() => void>('agregarFila')();
    filas().at(0).patchValue({ keyId: 'k-1', algorithm: 'RS256', publicKey: 'pem-1' });
    filas()
      .at(1)
      .patchValue({ keyId: 'k-2', algorithm: 'ES256', publicKey: 'pem-2', certificate: 'cert' });

    expect(component.intentarEnvio()).toEqual([
      { keyId: 'k-1', algorithm: 'RS256', publicKey: 'pem-1' },
      { keyId: 'k-2', algorithm: 'ES256', publicKey: 'pem-2', certificate: 'cert' },
    ]);
  });

  it('quitar una fila conserva las demás', () => {
    interno<() => void>('agregarFila')();
    interno<() => void>('agregarFila')();
    filas().at(1).patchValue({ keyId: 'k-2', algorithm: 'ES256', publicKey: 'pem-2' });

    interno<(i: number) => void>('quitarFila')(0);

    expect(filas().length).toBe(1);
    expect(component.intentarEnvio()).toEqual([
      { keyId: 'k-2', algorithm: 'ES256', publicKey: 'pem-2' },
    ]);
  });
});
