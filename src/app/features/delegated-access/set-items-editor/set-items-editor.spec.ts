import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SetItemsEditor } from './set-items-editor';

const PERMISO = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

describe('SetItemsEditor', () => {
  let fixture: ComponentFixture<SetItemsEditor>;
  let component: SetItemsEditor;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SetItemsEditor],
    }).compileComponents();

    fixture = TestBed.createComponent(SetItemsEditor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function interno<T>(nombre: string): T {
    const valor = (component as unknown as Record<string, unknown>)[nombre];
    if (typeof valor !== 'function') return valor as T;
    const esSenal = 'set' in valor || 'update' in valor || 'asReadonly' in valor;
    return (esSenal ? valor : valor.bind(component)) as T;
  }

  function filas(): { length: number; at: (i: number) => { patchValue: (v: object) => void } } {
    return interno('filas');
  }

  it('nace con una fila y la última no se puede quitar: el contrato exige un ítem', () => {
    expect(filas().length).toBe(1);

    interno<(i: number) => void>('quitarFila')(0);
    expect(filas().length).toBe(1);
  });

  it('una fila válida produce el ítem exacto: el switch siempre viaja, el JSON vacío no', () => {
    filas().at(0).patchValue({ permissionId: PERMISO });

    expect(component.intentarEnvio()).toEqual([
      { permissionId: PERMISO, requiresStepUpAuthentication: false },
    ]);
  });

  it('la restricción tiene que ser un objeto: un array o un JSON roto bloquean el envío', () => {
    filas().at(0).patchValue({ permissionId: PERMISO, constraintJson: '[1, 2]' });
    expect(component.intentarEnvio()).toBeNull();

    filas().at(0).patchValue({ constraintJson: '{esto no es json' });
    expect(component.intentarEnvio()).toBeNull();

    filas().at(0).patchValue({ constraintJson: '{"maxRecetas": 5}' });
    expect(component.intentarEnvio()).toEqual([
      {
        permissionId: PERMISO,
        constraintJson: { maxRecetas: 5 },
        requiresStepUpAuthentication: false,
      },
    ]);
  });

  it('agregar y quitar filas mantiene el resto intacto', () => {
    filas().at(0).patchValue({ permissionId: PERMISO });
    interno<() => void>('agregarFila')();
    expect(filas().length).toBe(2);

    interno<(i: number) => void>('quitarFila')(1);
    expect(filas().length).toBe(1);
    expect(component.intentarEnvio()).toEqual([
      { permissionId: PERMISO, requiresStepUpAuthentication: false },
    ]);
  });

});
