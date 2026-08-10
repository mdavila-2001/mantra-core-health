import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttributeMappingsEditor } from './attribute-mappings-editor';

describe('AttributeMappingsEditor', () => {
  let fixture: ComponentFixture<AttributeMappingsEditor>;
  let component: AttributeMappingsEditor;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AttributeMappingsEditor] }).compileComponents();

    fixture = TestBed.createComponent(AttributeMappingsEditor);
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

  it('nace con una fila y la última no se puede quitar: el contrato exige un mapeo', () => {
    expect(filas().length).toBe(1);

    interno<(i: number) => void>('quitarFila')(0);

    expect(filas().length).toBe(1);
    expect(component.intentarEnvio()).toBeNull();
  });

  it('una fila incompleta bloquea el envío entero', () => {
    filas().at(0).patchValue({ sourceClaim: 'sub' });

    expect(component.intentarEnvio()).toBeNull();
  });

  it('los mapeos viajan en orden, con los interruptores explícitos aun apagados', () => {
    interno<() => void>('agregarFila')();
    filas().at(0).patchValue({ sourceClaim: 'sub', targetAttribute: 'external_subject' });
    filas().at(1).patchValue({
      sourceClaim: 'email',
      targetAttribute: 'contact_email',
      isIdentifier: true,
      required: true,
      transformJson: '{"lowercase": true}',
    });

    expect(component.intentarEnvio()).toEqual([
      {
        sourceClaim: 'sub',
        targetAttribute: 'external_subject',
        isIdentifier: false,
        required: false,
      },
      {
        sourceClaim: 'email',
        targetAttribute: 'contact_email',
        isIdentifier: true,
        required: true,
        transformJson: { lowercase: true },
      },
    ]);
  });

  it('quitar una fila conserva las demás', () => {
    interno<() => void>('agregarFila')();
    filas().at(1).patchValue({ sourceClaim: 'email', targetAttribute: 'contact_email' });

    interno<(i: number) => void>('quitarFila')(0);

    expect(filas().length).toBe(1);
    expect(component.intentarEnvio()).toEqual([
      {
        sourceClaim: 'email',
        targetAttribute: 'contact_email',
        isIdentifier: false,
        required: false,
      },
    ]);
  });
});
