import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { AccountIcon } from './account-icon';
import {
  ACCOUNT_ICON_NAMES,
  type AccountIconName,
} from './account-icon.types';

/**
 * El set es cerrado y cada nombre tiene su alta detrás: lo que se prueba es que
 * ninguno quede mudo y que cada tipo traiga el accesorio que lo distingue, que
 * es lo que la animación de juego mueve.
 */
describe('AccountIcon', () => {
  let fixture: ComponentFixture<AccountIcon>;

  function render(name: AccountIconName): HTMLElement {
    fixture = TestBed.createComponent(AccountIcon);
    fixture.componentRef.setInput('name', name);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AccountIcon] }).compileComponents();
  });

  it.each(ACCOUNT_ICON_NAMES)('«%s» dibuja un contorno', (name) => {
    expect(render(name).querySelectorAll('svg .draw').length).toBeGreaterThan(0);
  });

  const ACCESORIO: Record<AccountIconName, string> = {
    patient: '.cross',
    practitioner: '.bell',
    insurer: '.heart',
    laboratory: '.sample',
    imaging: '.sweep',
    pharmacy: '.pharmacy-cross',
    clinic: '.cross',
  };

  it.each(Object.entries(ACCESORIO))('«%s» trae su accesorio animable (%s)', (name, selector) => {
    expect(render(name as AccountIconName).querySelector(`svg ${selector}`)).not.toBeNull();
  });

  it('es siempre decorativo: nunca se anuncia como «imagen»', () => {
    expect(render('patient').querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('el juego responde a un contenedor marcado, no a un estado propio', () => {
    // El contrato con las pantallas: marcar el contenedor interactivo con
    // `data-icon-play`. Si el nombre del atributo cambia en la hoja y no en las
    // pantallas, los íconos dejan de jugar sin que nada falle.
    render('patient');
    const hojas = Array.from(document.querySelectorAll('style'))
      .map((estilo) => estilo.textContent ?? '')
      .join('\n');

    expect(hojas).toContain('data-icon-play');
  });
});
