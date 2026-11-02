import { Component, input, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AppSection } from '../../core/navigation/navigation.types';
import { NavigationService } from '../../core/navigation/navigation.service';
import { Groups } from '../groups/groups';
import { MedicalGroupList } from '../medical-groups/medical-group-list/medical-group-list';
import { GroupsHub } from './groups-hub';

@Component({ selector: 'app-groups', template: '<p data-testid="stub-grupos">G</p>' })
class GroupsStub {
  readonly embedded = input(false);
}

@Component({ selector: 'app-medical-group-list', template: '<p data-testid="stub-grupos-medicos">GM</p>' })
class MedicalGroupListStub {
  readonly embedded = input(false);
}

@Component({ template: '' })
class Vacio {}

function seccion(path: string): AppSection {
  return { path } as AppSection;
}

describe('GroupsHub — «Grupos y foros | Grupos médicos»', () => {
  const alcanzables = signal<readonly AppSection[]>([]);
  let fixture: ComponentFixture<GroupsHub>;
  let router: Router;

  async function abrir(url: string, secciones: readonly string[]): Promise<HTMLElement> {
    alcanzables.set(secciones.map(seccion));
    await router.navigateByUrl(url);
    fixture = TestBed.createComponent(GroupsHub);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const etiquetas = (raiz: HTMLElement): string[] =>
    [...raiz.querySelectorAll('[role="tab"]')].map((t) => (t.textContent ?? '').trim());

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'groups', component: Vacio },
          { path: 'my-medical-groups', component: Vacio },
        ]),
        {
          provide: NavigationService,
          useValue: { visibleSections: alcanzables, breadcrumbs: signal([]) },
        },
      ],
    });
    TestBed.overrideComponent(GroupsHub, {
      remove: { imports: [Groups, MedicalGroupList] },
      add: { imports: [GroupsStub, MedicalGroupListStub] },
    });
    router = TestBed.inject(Router);
  });

  it('el médico ve las dos pestañas y /groups abre «Grupos y foros»', async () => {
    const raiz = await abrir('/groups', ['groups', 'my-medical-groups']);

    expect(etiquetas(raiz)).toEqual(['Grupos y foros', 'Grupos médicos']);
    expect(raiz.querySelector('[data-testid="stub-grupos"]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid="stub-grupos-medicos"]')).toBeNull();
  });

  it('/my-medical-groups abre «Grupos médicos» y no monta Grupos y foros', async () => {
    const raiz = await abrir('/my-medical-groups', ['groups', 'my-medical-groups']);

    expect(raiz.querySelector('[data-testid="stub-grupos-medicos"]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid="stub-grupos"]')).toBeNull();
  });

  it('quien sólo alcanza «Grupos y foros» ve una sola pestaña', async () => {
    const raiz = await abrir('/groups', ['groups']);

    expect(etiquetas(raiz)).toEqual(['Grupos y foros']);
  });

  it('elegir la otra pestaña navega a su ruta', async () => {
    const raiz = await abrir('/groups', ['groups', 'my-medical-groups']);
    const pestañas = raiz.querySelectorAll<HTMLElement>('[role="tab"]');

    pestañas[1]?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toBe('/my-medical-groups');
  });
});
