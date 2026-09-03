import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { SymptomCheck } from './symptom-check';

/**
 * A dónde manda el chequeo de síntomas.
 *
 * La pantalla recomienda especialidades y ofrece «ver quién atiende». Ese salto
 * es el único punto donde el chequeo deja de ser una conversación y se vuelve
 * una lista de médicos, así que lo que importa es que aterrice **en la
 * especialidad recomendada** y no en una búsqueda de texto que da lo mismo de
 * casualidad.
 *
 * El resto de la pantalla —qué se recomienda y por qué— vive en las funciones
 * puras y ya está cubierto en `motor.spec.ts`, `sintomas.spec.ts` y
 * `corpus.spec.ts`.
 */
describe('SymptomCheck · a dónde lleva «ver quién atiende»', () => {
  let componente: SymptomCheck;
  let fixture: ReturnType<typeof TestBed.createComponent<SymptomCheck>>;
  let http: HttpTestingController;
  let navegar: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  function montar(): void {
    fixture = TestBed.createComponent(SymptomCheck);
    componente = fixture.componentInstance;
    fixture.detectChanges();
    // La lista de especialidades con gente se pide recién cuando alguien
    // empieza a escribir —antes no hace falta y sería una consulta al abrir la
    // pantalla de inicio del paciente—. Sin esto no hay nada que responder.
    (componente as unknown as { escribir(v: string): void }).escribir('me duele el pecho');
    fixture.detectChanges();
  }

  /**
   * Resuelve las dos lecturas encadenadas: la guía primero y, con sus
   * conceptos, el catálogo que les pone nombre. En ese orden y no juntas — la
   * segunda no existe hasta que responde la primera.
   */
  function responderCatalogo(): void {
    http
      .expectOne((r) => r.url === '/profiles/practitioners')
      .flush({
        items: [
          {
            profileId: 'per-1',
            practitionerCode: 'MED-1',
            displayName: 'Dra. Salas',
            verificationStatusConceptId: 'st',
            verified: true,
            acceptsNewPatients: true,
            telehealthAvailable: false,
            specialties: [{ specialtyConceptId: 'con-cardio', isPrimary: true }],
          },
        ],
        count: 1,
        limit: 50,
        nextCursor: null,
      });
    fixture.detectChanges();

    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({
        items: [
          {
            conceptId: 'con-cardio',
            code: 'CARDIOLOGY',
            display: 'Cardiología',
            codeSystemVersionId: 'csv-1',
          },
        ],
        count: 1,
        limit: 200,
      });
    // La señal que guarda el mapa se actualiza con la respuesta: sin otra
    // detección, la navegación se decide sobre el mapa vacío del arranque.
    fixture.detectChanges();
  }

  function verProfesionales(nombre: string): void {
    (componente as unknown as { verProfesionales(n: string): void }).verProfesionales(nombre);
  }

  it('lleva el CONCEPTO de la especialidad, no el texto', () => {
    montar();
    responderCatalogo();

    verProfesionales('Cardiología');

    // El directorio acota por `?especialidad=` contra el servidor; mandarle el
    // nombre funcionaba sólo de rebote, porque el buscador matchea el
    // encabezado del grupo.
    expect(navegar).toHaveBeenCalledWith(['/directory'], {
      queryParams: { especialidad: 'con-cardio' },
    });
  });

  it('sin concepto conocido cae al texto, que es como funcionaba antes', () => {
    montar();
    responderCatalogo();

    // Un nombre de la tabla de síntomas que el catálogo no tiene: peor destino,
    // nunca una pantalla rota.
    verProfesionales('Reumatología');

    expect(navegar).toHaveBeenCalledWith(['/directory'], {
      queryParams: { q: 'Reumatología' },
    });
  });
});
