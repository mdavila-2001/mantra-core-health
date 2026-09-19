import { FormControl, Validators } from '@angular/forms';
import { describe, expect, it } from 'vitest';

import { codigoDesdeSigla, MAX_SIGLA, siglaDerivaCodigo } from './codigo-desde-sigla';

describe('codigoDesdeSigla', () => {
  it('una sigla ya en el formato del backend queda igual (AC-01)', () => {
    expect(codigoDesdeSigla('APT')).toBe('APT');
  });

  it('pone mayúsculas y reemplaza espacios por guion bajo', () => {
    expect(codigoDesdeSigla('la vitalicia')).toBe('LA_VITALICIA');
  });

  it('quita diacríticos y conserva punto y guion', () => {
    expect(codigoDesdeSigla('Ñandú S.A.')).toBe('NANDU_S.A.');
  });

  it('recorta los espacios de los bordes antes de derivar', () => {
    expect(codigoDesdeSigla('  apt  ')).toBe('APT');
  });

  it('una sigla de sólo símbolos deriva en cadena vacía', () => {
    expect(codigoDesdeSigla('***')).toBe('');
  });

  it('nunca alarga: el código nunca supera los caracteres de la sigla', () => {
    const sigla = 'A'.repeat(MAX_SIGLA);
    expect(codigoDesdeSigla(sigla).length).toBeLessThanOrEqual(MAX_SIGLA);
  });
});

describe('siglaDerivaCodigo', () => {
  it('acepta una sigla que deriva en un código válido', () => {
    const control = new FormControl('APT');
    expect(siglaDerivaCodigo(control)).toBeNull();
  });

  it('rechaza una sigla de 2 caracteres (el código quedaría bajo el mínimo de 3)', () => {
    const control = new FormControl('AS');
    expect(siglaDerivaCodigo(control)).toEqual({ siglaSinCodigo: true });
  });

  it('rechaza una sigla que sólo tiene símbolos', () => {
    const control = new FormControl('---');
    expect(siglaDerivaCodigo(control)).toEqual({ siglaSinCodigo: true });
  });

  it('deja pasar el control vacío: lo cubre Validators.required, no este validador', () => {
    const control = new FormControl('');
    expect(siglaDerivaCodigo(control)).toBeNull();
  });

  it('por sí solo no limita el largo: eso lo hace Validators.maxLength en el control real', () => {
    // El tope de longitud de la SIGLA lo pone Validators.maxLength(MAX_SIGLA)
    // en el propio control, no este validador — que sólo mira si el código
    // derivado es válido para el backend.
    const control = new FormControl('A'.repeat(21));
    expect(siglaDerivaCodigo(control)).toBeNull();
  });

  it('combinado con Validators.maxLength (el control real de la pantalla), una sigla de 21 caracteres queda inválida', () => {
    const control = new FormControl('A'.repeat(21), {
      validators: [Validators.maxLength(MAX_SIGLA), siglaDerivaCodigo],
    });
    expect(control.invalid).toBe(true);
    expect(control.errors?.['maxlength']).toBeDefined();
  });
});
