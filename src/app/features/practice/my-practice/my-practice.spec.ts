import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NavigationService } from '../../../core/navigation/navigation.service';
import { WorkHistory } from '../../account/my-profile/work-history/work-history';
import { MyPractice } from './my-practice';

/**
 * «Mi consultorio propio» reutiliza el bloque de «Mi perfil» acotado a la
 * sección de consultorios (sin el historial laboral): se fija que lo monte
 * así, con su encabezado y las migas del servicio de navegación.
 */

@Component({ selector: 'app-work-history', template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class WorkHistoryDoble {
  readonly secciones = input<string>('');
}

describe('MyPractice', () => {
  it('monta el encabezado y el bloque de consultorios', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: NavigationService, useValue: { breadcrumbs: signal([]) } }],
    });
    TestBed.overrideComponent(MyPractice, { remove: { imports: [WorkHistory] }, add: { imports: [WorkHistoryDoble] } });
    const fixture = TestBed.createComponent(MyPractice);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent).toContain('Mi consultorio propio');
    const bloque = fixture.debugElement.query((d) => d.componentInstance instanceof WorkHistoryDoble);
    expect((bloque.componentInstance as WorkHistoryDoble).secciones()).toBe('consultorios');
  });
});
