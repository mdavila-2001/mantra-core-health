import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { API_BASE_URL } from '../../../core/data-access/api';
import { Cockpit } from './cockpit';
import { ACCION_DEL_ESTADO, ETIQUETA_DE_ESTADO, TONO_DEL_ESTADO } from './flujo-del-documento';

/* ============================================================================
    El cockpit contable.

    Lo que se prueba acá es lo que distingue a un cockpit de una lista: que el
    contexto mande, que el flujo del documento no admita saltos, y que un
    documento sin postear NO cuente como dinero en los libros. Lo estético se
    mira en el navegador, no acá.
    ========================================================================== */

const BASE = 'http://api.test';

function montar(): { fixture: ReturnType<typeof TestBed.createComponent<Cockpit>>; http: HttpTestingController } {
  TestBed.configureTestingModule({
    imports: [Cockpit],
    providers: [
      provideZonelessChangeDetection(),
      provideHttpClient(),
      provideHttpClientTesting(),
      // El cockpit enlaza a los libros con `routerLink`, y esa directiva pide
      // `ActivatedRoute`: sin router el componente no se construye.
      provideRouter([]),
      { provide: API_BASE_URL, useValue: BASE },
    ],
  });
  const fixture = TestBed.createComponent(Cockpit);
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController) };
}

describe('Cockpit contable', () => {
  it('pide las prácticas antes que nada: sin práctica no hay libros que leer', () => {
    const { http } = montar();

    // La primera llamada es la lista de prácticas; ninguna lectura contable
    // sale sin un `practiceId`, así que el cockpit no puede inventarse una.
    const pedido = http.expectOne(`${BASE}/practices`);
    expect(pedido.request.method).toBe('GET');

    http.verify();
  });

  it('no ofrece ninguna acción para un documento revertido', () => {
    // Revertido es terminal: el documento espejo ya existe y no hay nada que
    // hacerle. Ofrecer un botón ahí sería prometer una llamada que la API
    // rechaza con 422.
    expect(ACCION_DEL_ESTADO.REVERSED).toBeNull();
  });

  it('cada estado del flujo ofrece UNA sola acción, la que el backend acepta', () => {
    // La máquina no admite saltos: de borrador no se postea, se clasifica.
    expect(ACCION_DEL_ESTADO.DRAFT?.action).toBe('classify');
    expect(ACCION_DEL_ESTADO.AUTO_CLASSIFIED?.action).toBe('submit-review');
    expect(ACCION_DEL_ESTADO.PENDING_REVIEW?.action).toBe('approve');
    expect(ACCION_DEL_ESTADO.APPROVED?.action).toBe('post');
    expect(ACCION_DEL_ESTADO.POSTED?.action).toBe('reverse');
  });

  it('postear es la única acción principal: es la única que toca el mayor', () => {
    const principales = Object.values(ACCION_DEL_ESTADO)
      .filter((a) => a !== null)
      .filter((a) => a.principal);

    expect(principales.map((a) => a.action)).toEqual(['post']);
  });

  it('sólo el posteado se pinta en verde', () => {
    // Un estado intermedio en verde diría «ya está» sobre algo que todavía no
    // existe para los libros.
    const verdes = Object.entries(TONO_DEL_ESTADO)
      .filter(([, tono]) => tono === 'success')
      .map(([estado]) => estado);

    expect(verdes).toEqual(['POSTED']);
  });

  it('los seis estados tienen nombre en castellano', () => {
    // Si un estado llega sin traducir, la bandeja muestra `AUTO_CLASSIFIED` a
    // quien lleva los libros.
    expect(Object.values(ETIQUETA_DE_ESTADO).every((e) => /^[A-ZÁÉÍÓÚÑ]/.test(e))).toBe(true);
    expect(Object.keys(ETIQUETA_DE_ESTADO).length).toBe(6);
  });

  it('formatea el importe sin convertirlo a número', () => {
    const { fixture } = montar();
    const cockpit = fixture.componentInstance;

    // El importe viaja como texto decimal a propósito: pasarlo por un `float`
    // es cómo un balance termina descuadrado por un céntimo. El formateo
    // separa miles y conserva los dos decimales tal como llegaron.
    expect(cockpit.importe('1465927.50')).toBe('Bs 1 465 927,50');
    expect(cockpit.importe('0.00')).toBe('Bs 0,00');
    expect(cockpit.importe('-2480.35')).toBe('Bs -2 480,35');
  });

  it('reconoce un importe negativo por su signo, no por su valor', () => {
    const { fixture } = montar();
    const cockpit = fixture.componentInstance;

    expect(cockpit.esNegativo('-1.00')).toBe(true);
    expect(cockpit.esNegativo('0.00')).toBe(false);
    expect(cockpit.esNegativo('1250.00')).toBe(false);
  });
});
