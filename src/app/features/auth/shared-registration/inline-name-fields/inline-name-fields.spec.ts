import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';

import { InlineNameFields } from './inline-name-fields';
import { executivesControls } from '../executives';
import { nameGroup, completeName } from '../name-fields/person-name';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InlineNameFields],
  template: `<app-inline-name-fields [grupo]="grupo" [obligatorio]="true" prefijoTestId="t" />`,
})
class Anfitrion {
  readonly grupo = nameGroup(true);
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InlineNameFields],
  template: `<app-inline-name-fields [grupo]="grupo" [obligatorio]="true" prefijoTestId="t" />`,
})
class AnfitrionEnPartes {
  /** Un nombre que viaja en partes (`name`, `middleName`, `lastName`, `motherLastName`). */
  readonly grupo = nameGroup(true, true);
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [InlineNameFields],
  template: `<app-inline-name-fields [grupo]="grupo" [obligatorio]="enUso" prefijoTestId="g" />`,
})
class AnfitrionGerencia {
  readonly form = new FormGroup(executivesControls());
  readonly grupo = this.form.controls.generalManagerName;
  enUso = true;
}

describe('CamposDeNombreEnLinea en una gerencia con el bloque en uso', () => {
  it('con el nombre cargado y el apellido paterno vacío: asterisco en los dos y el mensaje bajo el apellido', () => {
    const fixture = TestBed.createComponent(AnfitrionGerencia);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({
      generalManagerPhone: '+591 70011111',
      generalManagerName: { name: 'Carla' },
    });
    fixture.componentInstance.grupo.markAllAsTouched();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('.required-asterisk')).toHaveLength(2);
    expect(raiz.textContent).toContain('Escriba el apellido paterno.');
    expect(raiz.textContent).not.toContain('Escriba el primer nombre.');
  });

  it('con el bloque vacío (sin `obligatorio`) no hay asteriscos ni mensajes', () => {
    const fixture = TestBed.createComponent(AnfitrionGerencia);
    fixture.componentInstance.enUso = false;
    fixture.detectChanges();
    fixture.componentInstance.grupo.markAllAsTouched();
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelectorAll('.required-asterisk')).toHaveLength(0);
    expect(raiz.textContent).not.toContain('Escriba el apellido paterno.');
  });
});

describe('CamposDeNombreEnLinea con el nombre en partes', () => {
  it('60 + 1 + 59 caracteres de segundo y tercer nombre pasan los 100 del middleName y lo dice bajo el apellido', () => {
    const fixture = TestBed.createComponent(AnfitrionEnPartes);
    fixture.detectChanges();
    const grupo = fixture.componentInstance.grupo;
    grupo.patchValue({ name: 'Ana', lastName: 'Paz', middleName: 'a'.repeat(60), thirdName: 'b'.repeat(59) });
    grupo.markAllAsTouched();
    fixture.detectChanges();

    expect(grupo.invalid).toBe(true);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'El segundo, tercer y demás nombres juntos no pueden pasar de 100 caracteres.',
    );
  });

  it('un primer nombre de solo espacios dice «Escriba el primer nombre.»', () => {
    const fixture = TestBed.createComponent(AnfitrionEnPartes);
    fixture.detectChanges();
    const grupo = fixture.componentInstance.grupo;
    grupo.patchValue({ name: '   ', lastName: 'Paz' });
    grupo.markAllAsTouched();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Escriba el primer nombre.');
  });
});

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

    expect(completeName(grupo.getRawValue())).toBe('Ana Sofía Beatriz Rojas Vega');
  });

  it('un nombre completo de más de 200 caracteres invalida el grupo', () => {
    const { grupo } = montar();
    grupo.patchValue({ name: 'A'.repeat(100), lastName: 'B'.repeat(100), motherLastName: 'C'.repeat(10) });
    expect(grupo.hasError('nombreCompletoLargo')).toBe(true);
  });

  it('con `obligatorio` falso el grupo vacío es válido (las gerencias)', () => {
    expect(nameGroup(false).valid).toBe(true);
    expect(nameGroup(true).valid).toBe(false);
  });
});
