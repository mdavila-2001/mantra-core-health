import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { OnboardingPractitioner } from './onboarding-practitioner';

/**
 * El alta del profesional — TJ-1.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **Las cinco etapas se pintan siempre**, completas o no: quien entra tiene
 *    que ver el recorrido entero, no sólo lo que le falta.
 * 2. **La etapa actual es la que el servidor dice**, no una que la pantalla
 *    calcule por su cuenta — si las dos deciden, se contradicen.
 * 3. **Cero jerga de la API en pantalla**: el servidor manda claves
 *    (`license-number`) y acá se leen frases.
 * 4. **Sin perfil profesional no es un fallo**: es que la pantalla no le
 *    corresponde, y se dice con esas palabras.
 */
describe('OnboardingPractitioner', () => {
  let fixture: ComponentFixture<OnboardingPractitioner>;
  let http: HttpTestingController;

  const RUTA = '/profiles/practitioners/me/onboarding';

  function paso(key: string, complete: boolean, missing: string[] = []) {
    return { key, complete, missing };
  }

  function montar(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(OnboardingPractitioner);
    fixture.detectChanges();
  }

  function responder(steps: unknown[], firstIncomplete: string): void {
    http
      .expectOne((r) => r.url === RUTA)
      .flush({ practitionerProfileId: 'hp-1', steps, firstIncomplete });
    fixture.detectChanges();
  }

  /** El estado a medio camino: datos y foto listos, el resto no. */
  function aMedias(): unknown[] {
    return [
      paso('professional-data', true),
      paso('photo', true),
      paso('organizations', false, ['affiliation']),
      paso('schedule', false, ['published-schedule']),
      paso('review', false, ['previous-steps']),
    ];
  }

  afterEach(() => http.verify());

  it('pregunta por el avance al abrir', () => {
    montar();

    http
      .expectOne((r) => r.url === RUTA)
      .flush({
        practitionerProfileId: 'hp-1',
        steps: aMedias(),
        firstIncomplete: 'organizations',
      });
  });

  it('pinta las cinco etapas, no sólo las que faltan', () => {
    montar();
    responder(aMedias(), 'organizations');

    expect(fixture.nativeElement.querySelectorAll('.alta__etapa')).toHaveLength(5);
  });

  it('dice cuántas van, para que el recorrido tenga tamaño', () => {
    montar();
    responder(aMedias(), 'organizations');

    expect(fixture.nativeElement.textContent).toContain('2 de 5');
  });

  it('marca como actual la que dice el servidor, no una que calcule la pantalla', () => {
    montar();
    responder(aMedias(), 'organizations');

    const actuales = fixture.nativeElement.querySelectorAll('.alta__etapa--actual');
    expect(actuales).toHaveLength(1);
    expect(actuales[0].textContent).toContain('Dónde atendés');
  });

  it('no muestra una sola clave de la API: el texto es del front', () => {
    montar();
    responder(aMedias(), 'organizations');

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).not.toContain('published-schedule');
    expect(texto).not.toContain('affiliation');
    expect(texto).not.toContain('professional-data');
    // Y sí muestra la frase que le corresponde.
    expect(texto).toContain('Publicá tu agenda');
  });

  it('con todo cumplido felicita y no empuja a ningún paso', () => {
    montar();
    responder(
      [
        paso('professional-data', true),
        paso('photo', true),
        paso('organizations', true),
        paso('schedule', true),
        paso('review', true),
      ],
      'done',
    );

    const texto: string = fixture.nativeElement.textContent;
    expect(texto).toContain('Tu perfil está completo');
    expect(fixture.nativeElement.querySelectorAll('.alta__etapa--actual')).toHaveLength(0);
  });

  it('una cuenta sin perfil profesional no ve un error, ve que no le corresponde', () => {
    montar();
    http
      .expectOne((r) => r.url === RUTA)
      .flush(
        { message: 'La cuenta no tiene perfil profesional' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Esta sección es para profesionales');
  });
});
