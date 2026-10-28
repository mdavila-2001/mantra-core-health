import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { FormField } from '../form-field/form-field';
import { OrganizationSelect } from './organization-select';
import {
  AFFILIATE_LABEL,
  OWN_OFFICE_KEY,
  OWN_OFFICE_LABEL,
  type OrganizationChoice,
  type PractitionerOrganization,
} from './organization-select.types';

const OWN_OFFICE: PractitionerOrganization = {
  practiceId: 'practice-own',
  practiceSiteId: 'site-own',
  name: 'Consultorio Dra. Rojas',
  isOwnOffice: true,
};
const OLIVOS: PractitionerOrganization = {
  practiceId: 'practice-olivos',
  practiceSiteId: 'site-olivos',
  name: 'Clínica Los Olivos',
  isOwnOffice: false,
};
const SAN_LUCAS: PractitionerOrganization = {
  practiceId: 'practice-san-lucas',
  practiceSiteId: null,
  name: 'Hospital San Lucas',
  isOwnOffice: false,
};

interface Rendered {
  readonly fixture: ComponentFixture<OrganizationSelect>;
  readonly choices: OrganizationChoice[];
  readonly affiliationRequests: () => number;
}

async function render(
  organizations: readonly PractitionerOrganization[],
  value?: string,
): Promise<Rendered> {
  const fixture = TestBed.createComponent(OrganizationSelect);
  fixture.componentRef.setInput('organizations', organizations);
  if (value !== undefined) {
    fixture.componentRef.setInput('value', value);
  }
  const choices: OrganizationChoice[] = [];
  let requests = 0;
  fixture.componentInstance.selected.subscribe((choice) => choices.push(choice));
  fixture.componentInstance.affiliationRequested.subscribe(() => requests++);
  await fixture.whenStable();
  return { fixture, choices, affiliationRequests: () => requests };
}

function trigger(fixture: ComponentFixture<unknown>): HTMLButtonElement {
  return fixture.nativeElement.querySelector('.select-trigger');
}

function rows(fixture: ComponentFixture<unknown>): HTMLLIElement[] {
  return Array.from(fixture.nativeElement.querySelectorAll('[role="option"]'));
}

function rowLabels(fixture: ComponentFixture<unknown>): string[] {
  return rows(fixture).map((row) => row.querySelector('.option-label')?.textContent?.trim() ?? '');
}

async function open(fixture: ComponentFixture<unknown>): Promise<void> {
  trigger(fixture).click();
  await fixture.whenStable();
}

async function chooseRow(fixture: ComponentFixture<unknown>, index: number): Promise<void> {
  await open(fixture);
  rows(fixture)[index].click();
  await fixture.whenStable();
}

async function pressInList(fixture: ComponentFixture<unknown>, key: string): Promise<void> {
  const list = fixture.nativeElement.querySelector('.search-input, .select-list');
  list.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  await fixture.whenStable();
}

describe('OrganizationSelect', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OrganizationSelect] }).compileComponents();
  });

  describe('las opciones', () => {
    it('elige «Mi consultorio» por omisión', async () => {
      const { fixture } = await render([OWN_OFFICE, OLIVOS]);

      expect(trigger(fixture).textContent?.trim()).toBe(OWN_OFFICE_LABEL);
    });

    it('va el consultorio primero, después las organizaciones y al final la afiliación', async () => {
      const { fixture } = await render([OLIVOS, OWN_OFFICE, SAN_LUCAS]);

      await open(fixture);

      expect(rowLabels(fixture)).toEqual([
        OWN_OFFICE_LABEL,
        'Clínica Los Olivos',
        'Hospital San Lucas',
        AFFILIATE_LABEL,
      ]);
    });

    it('con el consultorio registrado, su nombre va en segunda línea', async () => {
      const { fixture } = await render([OWN_OFFICE]);

      await open(fixture);

      expect(rows(fixture)[0].querySelector('.option-description')?.textContent?.trim()).toBe(
        'Consultorio Dra. Rojas',
      );
    });

    it('con la lista vacía, la única organización que aparece es «Mi consultorio»', async () => {
      const { fixture } = await render([]);

      await open(fixture);

      expect(rowLabels(fixture)).toEqual([OWN_OFFICE_LABEL, AFFILIATE_LABEL]);
      expect(trigger(fixture).textContent?.trim()).toBe(OWN_OFFICE_LABEL);
    });

    it('muestra la organización que llega por `value`', async () => {
      const { fixture } = await render([OWN_OFFICE, OLIVOS], OLIVOS.practiceId);

      expect(trigger(fixture).textContent?.trim()).toBe('Clínica Los Olivos');
    });
  });

  describe('elegir', () => {
    it('una organización la entrega con su clave', async () => {
      const { fixture, choices } = await render([OWN_OFFICE, OLIVOS]);

      await chooseRow(fixture, 1);

      expect(choices).toEqual([{ key: OLIVOS.practiceId, organization: OLIVOS }]);
      expect(trigger(fixture).textContent?.trim()).toBe('Clínica Los Olivos');
    });

    it('«Mi consultorio» entrega la sede propia', async () => {
      const { fixture, choices } = await render([OWN_OFFICE, OLIVOS], OLIVOS.practiceId);

      await chooseRow(fixture, 0);

      expect(choices).toEqual([{ key: OWN_OFFICE_KEY, organization: OWN_OFFICE }]);
    });

    it('«Mi consultorio» sin registrar entrega la clave y ninguna organización', async () => {
      const { fixture, choices } = await render([OLIVOS], OLIVOS.practiceId);

      await chooseRow(fixture, 0);

      expect(choices).toEqual([{ key: OWN_OFFICE_KEY, organization: null }]);
    });

    it('volver a elegir lo que ya estaba no emite nada', async () => {
      const { fixture, choices } = await render([OWN_OFFICE, OLIVOS]);

      await chooseRow(fixture, 0);

      expect(choices).toEqual([]);
    });
  });

  describe('«Afiliarme a otra organización…»', () => {
    it('emite la intención y el valor no cambia', async () => {
      const { fixture, choices, affiliationRequests } = await render([OWN_OFFICE, OLIVOS]);

      await chooseRow(fixture, 2);

      expect(affiliationRequests()).toBe(1);
      expect(choices).toEqual([]);
      expect(trigger(fixture).textContent?.trim()).toBe(OWN_OFFICE_LABEL);
    });

    it('después de elegir una organización, la deja elegida', async () => {
      const { fixture, choices, affiliationRequests } = await render([OWN_OFFICE, OLIVOS]);
      await chooseRow(fixture, 1);

      await chooseRow(fixture, 2);

      expect(affiliationRequests()).toBe(1);
      expect(choices).toHaveLength(1);
      expect(trigger(fixture).textContent?.trim()).toBe('Clínica Los Olivos');
      await open(fixture);
      expect(rows(fixture)[1].getAttribute('aria-selected')).toBe('true');
      expect(rows(fixture)[2].getAttribute('aria-selected')).toBe('false');
    });
  });

  describe('teclado y nombre accesible', () => {
    it('se abre con flecha abajo y elige con Enter', async () => {
      const { fixture, choices } = await render([OWN_OFFICE, OLIVOS]);

      trigger(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await fixture.whenStable();
      await pressInList(fixture, 'ArrowDown');
      await pressInList(fixture, 'Enter');

      expect(choices).toEqual([{ key: OLIVOS.practiceId, organization: OLIVOS }]);
    });

    it('Fin y Enter llegan a la afiliación sin cambiar el valor', async () => {
      const { fixture, choices, affiliationRequests } = await render([OWN_OFFICE, OLIVOS]);

      trigger(fixture).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await fixture.whenStable();
      await pressInList(fixture, 'End');
      await pressInList(fixture, 'Enter');

      expect(affiliationRequests()).toBe(1);
      expect(choices).toEqual([]);
      expect(trigger(fixture).textContent?.trim()).toBe(OWN_OFFICE_LABEL);
    });

    it('suelto, es un combobox con nombre propio', async () => {
      const { fixture } = await render([OWN_OFFICE]);

      expect(trigger(fixture).getAttribute('role')).toBe('combobox');
      expect(trigger(fixture).getAttribute('aria-label')).toBe('Organización');
    });

    it('acepta otro nombre accesible', async () => {
      const { fixture } = await render([OWN_OFFICE]);

      fixture.componentRef.setInput('ariaLabel', 'Dónde publica la agenda');
      await fixture.whenStable();

      expect(trigger(fixture).getAttribute('aria-label')).toBe('Dónde publica la agenda');
    });

    it('dentro de un campo lo nombra el rótulo', async () => {
      @Component({
        imports: [FormField, OrganizationSelect],
        template: `
          <app-form-field label="Organización donde atiende">
            <app-organization-select [organizations]="organizations()" />
          </app-form-field>
        `,
      })
      class FieldHost {
        readonly organizations = signal<readonly PractitionerOrganization[]>([OWN_OFFICE]);
      }
      const fixture = TestBed.createComponent(FieldHost);
      await fixture.whenStable();

      const label: HTMLLabelElement = fixture.nativeElement.querySelector('label');
      expect(label.htmlFor).toBe(trigger(fixture).id);
      expect(label.textContent?.trim()).toBe('Organización donde atiende');
      expect(trigger(fixture).hasAttribute('aria-label')).toBe(false);
    });

    it('deshabilitado no se abre', async () => {
      const { fixture } = await render([OWN_OFFICE]);

      fixture.componentRef.setInput('disabled', true);
      await fixture.whenStable();

      expect(trigger(fixture).disabled).toBe(true);
    });
  });
});
