import { Component, input, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';

import type { AppSection } from '../../core/navigation/navigation.types';
import { NavigationService } from '../../core/navigation/navigation.service';
import { FormBuilder } from '../form-builder/form-builder';
import { SurveysHome } from '../questionnaires/questionnaires';
import { FormsHub } from './forms-hub';

@Component({ selector: 'app-form-builder', template: '<p data-testid="stub-formularios">F</p>' })
class FormBuilderStub {
  readonly embedded = input(false);
}

@Component({ selector: 'app-surveys-home', template: '<p data-testid="stub-encuestas">E</p>' })
class SurveysHomeStub {
  readonly embedded = input(false);
}

@Component({ template: '' })
class Vacio {}

function seccion(path: string): AppSection {
  return { path } as AppSection;
}

describe('FormsHub — «Formularios | Encuestas» (28/10/2026)', () => {
  const alcanzables = signal<readonly AppSection[]>([]);
  let fixture: ComponentFixture<FormsHub>;
  let router: Router;

  async function abrir(url: string, secciones: readonly string[]): Promise<HTMLElement> {
    alcanzables.set(secciones.map(seccion));
    await router.navigateByUrl(url);
    fixture = TestBed.createComponent(FormsHub);
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
          { path: 'form-builder', component: Vacio },
          { path: 'questionnaires', component: Vacio },
        ]),
        {
          provide: NavigationService,
          useValue: { visibleSections: alcanzables, breadcrumbs: signal([]) },
        },
      ],
    });
    TestBed.overrideComponent(FormsHub, {
      remove: { imports: [FormBuilder, SurveysHome] },
      add: { imports: [FormBuilderStub, SurveysHomeStub] },
    });
    router = TestBed.inject(Router);
  });

  it('el médico ve las dos pestañas y /form-builder abre «Formularios»', async () => {
    const raiz = await abrir('/form-builder', ['form-builder', 'questionnaires']);

    expect(etiquetas(raiz)).toEqual(['Formularios', 'Encuestas']);
    expect(raiz.querySelector('[data-testid="stub-formularios"]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid="stub-encuestas"]')).toBeNull();
  });

  it('/questionnaires abre «Encuestas» y no monta Formularios', async () => {
    const raiz = await abrir('/questionnaires', ['form-builder', 'questionnaires']);

    expect(raiz.querySelector('[data-testid="stub-encuestas"]')).not.toBeNull();
    expect(raiz.querySelector('[data-testid="stub-formularios"]')).toBeNull();
  });

  it('la ficha de una encuesta (/questionnaires/:id) también marca «Encuestas»', async () => {
    TestBed.inject(Router).resetConfig([
      { path: 'questionnaires/:id', component: Vacio },
      { path: 'form-builder', component: Vacio },
    ]);
    const raiz = await abrir('/questionnaires/abc', ['form-builder', 'questionnaires']);

    expect(raiz.querySelector('[data-testid="stub-encuestas"]')).not.toBeNull();
  });

  it('quien sólo alcanza «Encuestas» ve una sola pestaña', async () => {
    const raiz = await abrir('/questionnaires', ['questionnaires']);

    expect(etiquetas(raiz)).toEqual(['Encuestas']);
  });

  it('elegir la otra pestaña navega a su ruta', async () => {
    const raiz = await abrir('/form-builder', ['form-builder', 'questionnaires']);

    (raiz.querySelectorAll('[role="tab"]')[1] as HTMLElement).click();
    await fixture.whenStable();

    expect(router.url).toBe('/questionnaires');
  });
});
