import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FirstStepsCard } from './first-steps-card';
import { FirstStepsStore } from './first-steps.store';

describe('FirstStepsCard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ imports: [FirstStepsCard], providers: [provideRouter([])] });
  });

  function montar(entradas: { hasAppointment?: boolean; tourDone?: boolean } = {}) {
    const fixture = TestBed.createComponent(FirstStepsCard);
    fixture.componentRef.setInput('hasAppointment', entradas.hasAppointment ?? false);
    fixture.componentRef.setInput('tourDone', entradas.tourDone ?? false);
    fixture.detectChanges();
    return fixture;
  }

  const porId = (raiz: HTMLElement, id: string) =>
    raiz.querySelector<HTMLElement>(`[data-testid="primeros-pasos-${id}"]`);

  it('arranca con la cuenta hecha: 1 de 6, y resalta el recorrido como siguiente', () => {
    const raiz: HTMLElement = montar().nativeElement;

    expect(porId(raiz, 'avance')?.getAttribute('aria-valuenow')).toBe('1');
    expect(porId(raiz, 'avance')?.getAttribute('aria-valuemax')).toBe('6');
    expect(porId(raiz, 'cuenta')?.dataset['hecho']).toBe('true');
    expect(porId(raiz, 'recorrido')?.classList).toContain('primeros-pasos__paso--siguiente');
  });

  it('la cita cuenta como hecha si la API dice que tiene una', () => {
    const raiz: HTMLElement = montar({ hasAppointment: true }).nativeElement;

    expect(porId(raiz, 'cita')?.dataset['hecho']).toBe('true');
    expect(porId(raiz, 'avance')?.getAttribute('aria-valuenow')).toBe('2');
  });

  it('«Empezar» pide abrir el recorrido', () => {
    const fixture = montar();
    let pedido = false;
    fixture.componentInstance.startTour.subscribe(() => (pedido = true));

    porId(fixture.nativeElement, 'empezar-recorrido')?.click();

    expect(pedido).toBe(true);
  });

  it('con todo hecho festeja con la medalla y deja ocultar la tarjeta', () => {
    localStorage.setItem(
      'alovida.primeros-pasos.anonimo',
      JSON.stringify({
        visited: ['/directory', '/my-account/medical-record', '/my-account/pharmacy'],
        dismissed: false,
      }),
    );
    TestBed.inject(FirstStepsStore);
    TestBed.flushEffects();
    const fixture = montar({ hasAppointment: true, tourDone: true });
    const raiz: HTMLElement = fixture.nativeElement;

    expect(porId(raiz, 'medalla')).not.toBeNull();
    expect(raiz.textContent).toContain('¡Ya conoce AloVida!');

    porId(raiz, 'ocultar')?.click();
    expect(TestBed.inject(FirstStepsStore).dismissed()).toBe(true);
  });

  it('se pliega y se despliega con el botón de la cabecera, y lo recuerda', () => {
    const fixture = montar();
    const raiz: HTMLElement = fixture.nativeElement;
    const boton = porId(raiz, 'plegar');
    const contenido = porId(raiz, 'contenido');

    expect(boton?.getAttribute('aria-expanded')).toBe('true');
    expect(boton?.getAttribute('aria-controls')).toBe(contenido?.id);
    expect(contenido?.hidden).toBe(false);

    boton?.click();
    fixture.detectChanges();

    expect(boton?.getAttribute('aria-expanded')).toBe('false');
    expect(boton?.getAttribute('aria-label')).toBe('Mostrar sus primeros pasos');
    expect(contenido?.hidden).toBe(true);
    // Plegada sigue diciendo cuánto falta: el avance queda a la vista.
    expect(porId(raiz, 'avance')?.getAttribute('aria-valuenow')).toBe('1');
    expect(TestBed.inject(FirstStepsStore).collapsed()).toBe(true);
    expect(
      JSON.parse(localStorage.getItem('alovida.primeros-pasos.anonimo') ?? '{}').collapsed,
    ).toBe(true);

    boton?.click();
    fixture.detectChanges();

    expect(boton?.getAttribute('aria-expanded')).toBe('true');
    expect(contenido?.hidden).toBe(false);
  });
});
