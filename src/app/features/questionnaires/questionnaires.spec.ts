import { Component, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { signal } from '@angular/core';

import { NavigationService } from '../../core/navigation/navigation.service';
import { SurveysInbox } from './inbox/surveys-inbox';
import { SurveysHome } from './questionnaires';
import { ServiceSurveys } from './service-surveys/service-surveys';

/** Each panel has its own spec; this one only measures the sub-tabs. */
@Component({ selector: 'app-surveys-inbox', template: '<p data-testid="stub-inbox">B</p>' })
class InboxStub {
  readonly goToServices = output<void>();
}

@Component({ selector: 'app-service-surveys', template: '<p data-testid="stub-services">S</p>' })
class ServicesStub {}

describe('SurveysHome · «Buzón» y «Encuestas por servicio» (06/11/2026)', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'questionnaires', component: SurveysHome }]),
        { provide: NavigationService, useValue: { breadcrumbs: signal([]) } },
      ],
    });
    TestBed.overrideComponent(SurveysHome, {
      remove: { imports: [SurveysInbox, ServiceSurveys] },
      add: { imports: [InboxStub, ServicesStub] },
    });
    harness = await RouterTestingHarness.create();
  });

  const raiz = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const pestanas = (): string[] =>
    [...raiz().querySelectorAll('[data-testid="surveys-subtabs"] [role="tab"]')].map((t) =>
      (t.textContent ?? '').trim(),
    );

  it('dibuja las dos sub-pestañas en una sola tira, en este orden', async () => {
    await harness.navigateByUrl('/questionnaires', SurveysHome);

    expect(pestanas()).toEqual(['Buzón', 'Encuestas por servicio']);
    expect(raiz().querySelectorAll('app-tabs').length).toBe(1);
  });

  it('sin parámetro abre el Buzón y no monta «Encuestas por servicio»', async () => {
    await harness.navigateByUrl('/questionnaires', SurveysHome);

    expect(raiz().querySelector('[data-testid="stub-inbox"]')).not.toBeNull();
    expect(raiz().querySelector('[data-testid="stub-services"]')).toBeNull();
  });

  it('?encuestas=servicios abre la segunda, y un valor desconocido cae en el Buzón', async () => {
    await harness.navigateByUrl('/questionnaires?encuestas=servicios', SurveysHome);
    expect(raiz().querySelector('[data-testid="stub-services"]')).not.toBeNull();
    expect(raiz().querySelector('[data-testid="stub-inbox"]')).toBeNull();

    await harness.navigateByUrl('/questionnaires?encuestas=otra', SurveysHome);
    expect(raiz().querySelector('[data-testid="stub-inbox"]')).not.toBeNull();
  });

  it('elegir una sub-pestaña la escribe en la URL; volver al Buzón la quita', async () => {
    await harness.navigateByUrl('/questionnaires', SurveysHome);
    const router = TestBed.inject(Router);

    raiz().querySelectorAll<HTMLButtonElement>('[role="tab"]')[1]!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(router.url).toBe('/questionnaires?encuestas=servicios');
    expect(raiz().querySelector('[data-testid="stub-services"]')).not.toBeNull();

    raiz().querySelectorAll<HTMLButtonElement>('[role="tab"]')[0]!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(router.url).toBe('/questionnaires');
  });

  it('no ofrece «Nueva encuesta» en ningún lado', async () => {
    await harness.navigateByUrl('/questionnaires', SurveysHome);

    expect(raiz().textContent).not.toContain('Nueva encuesta');
  });
});
