import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CamposDeNombreEnLinea } from './inline-name-fields';
import { grupoDeNombre, nombreCompleto } from '../name-fields/person-name';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CamposDeNombreEnLinea],
  template: `<app-inline-name-fields [grupo]="grupo" [obligatorio]="true" prefijoTestId="t" />`,
})
class Anfitrion {
  readonly grupo = grupoDeNombre(true);
}

describe('CamposDeNombreEnLinea', () => {
  function montar() {
    const fixture = TestBed.createComponent(Anfitrion);
    fixture.detectChanges();
    const raiz = fixture.nativeElement as HTMLElement;
    return { fixture, raiz, grupo: fixture.componentInstance.grupo };
  }

  const clic = (raiz: HTMLElement, testId: string) =>
    (raiz.querySelector(`[data-testid="${testId}"]`) as HTMLElement).click();

  it('pide primer, segundo y tercer nombre, apellido paterno y materno', () => {
    const { raiz } = montar();
    const rotulos = Array.from(raiz.querySelectorAll('label')).map((l) => l.textContent!.trim());
    expect(rotulos.join('|')).toContain('Primer nombre');
    expect(rotulos.join('|')).toContain('Segundo nombre (opcional)');
    expect(rotulos.join('|')).toContain('Tercer nombre (opcional)');
    expect(rotulos.join('|')).toContain('Apellido paterno');
    expect(rotulos.join('|')).toContain('Apellido materno (opcional)');
  });

  it('«Agregar otro nombre» suma una casilla y el botón de quitar la retira', () => {
    const { fixture, raiz, grupo } = montar();

    clic(raiz, 't-agregar-nombre');
    fixture.detectChanges();
    expect(grupo.controls.extraNames.length).toBe(1);
    expect(raiz.querySelector('[data-testid="t-nombre-extra-0"]')).not.toBeNull();

    clic(raiz, 't-quitar-nombre-0');
    fixture.detectChanges();
    expect(grupo.controls.extraNames.length).toBe(0);
    expect(raiz.querySelector('[data-testid="t-nombre-extra-0"]')).toBeNull();
  });

  it('muestra el límite de un nombre adicional inválido', () => {
    const { fixture, raiz, grupo } = montar();
    clic(raiz, 't-agregar-nombre');
    fixture.detectChanges();
    const extra = grupo.controls.extraNames.at(0);
    extra.setValue('a'.repeat(101));
    extra.markAsTouched();
    fixture.detectChanges();
    expect(grupo.invalid).toBe(true);
    expect(raiz.textContent).toContain('El nombre no puede pasar de 100 caracteres.');
  });

  it('compone el nombre completo con todas las partes en orden y descarta las vacías', () => {
    const { raiz, fixture, grupo } = montar();
    clic(raiz, 't-agregar-nombre');
    clic(raiz, 't-agregar-nombre');
    fixture.detectChanges();
    grupo.patchValue({ name: ' Ana ', thirdName: 'Sofía', lastName: 'Rojas', motherLastName: 'Vega' });
    grupo.controls.extraNames.at(1).setValue('Beatriz');

    expect(nombreCompleto(grupo.getRawValue())).toBe('Ana Sofía Beatriz Rojas Vega');
  });

  it('un nombre completo de más de 200 caracteres invalida el grupo', () => {
    const { grupo } = montar();
    grupo.patchValue({ name: 'A'.repeat(100), lastName: 'B'.repeat(100), motherLastName: 'C'.repeat(10) });
    expect(grupo.hasError('nombreCompletoLargo')).toBe(true);
  });

  it('con `obligatorio` falso el grupo vacío es válido (las gerencias)', () => {
    expect(grupoDeNombre(false).valid).toBe(true);
    expect(grupoDeNombre(true).valid).toBe(false);
  });
});
