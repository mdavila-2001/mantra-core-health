import { FormArray, FormControl, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';

import { hayAlgoInvalido } from './invalid-anywhere';

/** Un validador asíncrono que no responde hasta que la prueba lo decida. */
function esperando() {
  const respuesta = new Subject<null>();
  return { validador: () => respuesta.asObservable(), respuesta };
}

describe('hayAlgoInvalido', () => {
  it('con un hijo inválido y otro esperando, el grupo dice PENDING pero hay algo inválido', () => {
    const { validador } = esperando();
    const grupo = new FormGroup({
      celular: new FormControl('', { validators: [Validators.required] }),
      documento: new FormControl('1234567', { asyncValidators: [validador] }),
    });
    expect(grupo.pending).toBe(true);
    expect(grupo.invalid).toBe(false);
    expect(hayAlgoInvalido(grupo)).toBe(true);
  });

  it('si lo único pendiente es la consulta, no hay nada inválido: decide la API', () => {
    const { validador } = esperando();
    const grupo = new FormGroup({
      celular: new FormControl('70000000', { validators: [Validators.required] }),
      documento: new FormControl('1234567', { asyncValidators: [validador] }),
    });
    expect(grupo.pending).toBe(true);
    expect(hayAlgoInvalido(grupo)).toBe(false);
  });

  it('baja también por listas', () => {
    const { validador } = esperando();
    const grupo = new FormGroup({
      titulos: new FormArray([new FormControl('', { validators: [Validators.required] })]),
      documento: new FormControl('1234567', { asyncValidators: [validador] }),
    });
    expect(hayAlgoInvalido(grupo)).toBe(true);
  });

  it('sin nada pendiente es lo mismo que `invalid`', () => {
    const valido = new FormGroup({ a: new FormControl('x') });
    const invalido = new FormGroup({
      a: new FormControl('', { validators: [Validators.required] }),
    });
    expect(hayAlgoInvalido(valido)).toBe(false);
    expect(hayAlgoInvalido(invalido)).toBe(true);
  });
});
