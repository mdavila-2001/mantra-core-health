import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { AgendaPreferences, AUTO_CONFIRM_TEXT, REVIEW_EACH_TEXT } from './agenda-preferences';

/**
 * What these tests pin (client request, 2026-11-05): the panel lists the
 * caller's own agendas; the switch reads "confirm automatically" although the
 * API stores `requiresApproval`; after saving it shows what the server
 * returned; a rejection puts the switch back and says so; and without an
 * agenda the empty state leads to publishing one.
 */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

const MINE = { id: 'r-mia', name: 'Consultorio propio', requiresApproval: true };

describe('AgendaPreferences', () => {
  let fixture: ComponentFixture<AgendaPreferences>;
  let http: HttpTestingController;

  const query = (testid: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`[data-testid="${testid}"]`);
  const text = (): string => fixture.nativeElement.textContent as string;
  const toggle = (id: string): HTMLInputElement | null =>
    query(`agenda-prefs-switch-${id}`)?.querySelector('input') ?? null;

  function mount(claims: Record<string, unknown> = { hpid: 'hp-1', tenants: ['t-1'] }): void {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['PRACTITIONER'], ...claims }),
      refreshToken: 'r',
    });
    fixture = TestBed.createComponent(AgendaPreferences);
    fixture.detectChanges();
  }

  function answerAgendas(items: readonly unknown[]): void {
    const req = http.expectOne((r) => r.url === '/scheduling/my-resources');
    expect(req.request.params.get('tenantId')).toBe('t-1');
    req.flush({ items });
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista las agendas propias, apagadas cuando exigen aceptación', () => {
    mount();
    answerAgendas([MINE]);

    expect(query('agenda-prefs-r-mia')).not.toBeNull();
    expect(toggle('r-mia')?.checked).toBe(false);
    expect(text()).toContain(REVIEW_EACH_TEXT);
    expect(toggle('r-mia')?.getAttribute('aria-label')).toBe(
      'Confirmar automáticamente las solicitudes de Consultorio propio',
    );
  });

  it('encender el interruptor manda requiresApproval=false y pinta lo que el servidor devolvió', () => {
    mount();
    answerAgendas([MINE]);

    toggle('r-mia')!.click();
    fixture.detectChanges();

    const req = http.expectOne('/scheduling/resources/r-mia');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ requiresApproval: false });
    // While the change travels the switch is inert: two requests never overlap.
    expect(toggle('r-mia')?.disabled).toBe(true);

    req.flush({ ...MINE, requiresApproval: false });
    fixture.detectChanges();

    expect(toggle('r-mia')?.checked).toBe(true);
    expect(toggle('r-mia')?.disabled).toBe(false);
    expect(text()).toContain(AUTO_CONFIRM_TEXT);
    expect(query('agenda-prefs-saved')?.textContent).toContain('se confirman solas');
  });

  it('apagarlo vuelve a requiresApproval=true', () => {
    mount();
    answerAgendas([{ ...MINE, requiresApproval: false }]);
    expect(toggle('r-mia')?.checked).toBe(true);

    toggle('r-mia')!.click();
    fixture.detectChanges();

    const req = http.expectOne('/scheduling/resources/r-mia');
    expect(req.request.body).toEqual({ requiresApproval: true });
    req.flush({ ...MINE, requiresApproval: true });
    fixture.detectChanges();

    expect(toggle('r-mia')?.checked).toBe(false);
    expect(query('agenda-prefs-saved')?.textContent).toContain('vuelve a aceptar cada solicitud');
  });

  it('un rechazo del servidor deja el interruptor como estaba y lo dice', () => {
    mount();
    answerAgendas([MINE]);

    toggle('r-mia')!.click();
    fixture.detectChanges();
    http
      .expectOne('/scheduling/resources/r-mia')
      .flush(
        { message: 'Esta agenda es de otro profesional' },
        { status: 403, statusText: 'Forbidden' },
      );
    fixture.detectChanges();

    expect(toggle('r-mia')?.checked).toBe(false);
    expect(toggle('r-mia')?.disabled).toBe(false);
    expect(query('agenda-prefs-error')).not.toBeNull();
    expect(query('agenda-prefs-saved')).toBeNull();
  });

  it('sin agenda publicada es un vacío con su próxima acción: publicarla', () => {
    mount();
    answerAgendas([]);

    expect(query('agenda-prefs-list')).toBeNull();
    expect(text()).toContain('Todavía no publicó una agenda');
    const accion = fixture.nativeElement.querySelector(
      'a[href="/schedule/new"]',
    ) as HTMLAnchorElement | null;
    expect(accion?.textContent).toContain('Publicar mi agenda');
  });

  it('sin organización activa no pregunta nada y ofrece publicar la agenda', () => {
    mount({ hpid: 'hp-1', tenants: ['t-1', 't-2'] });

    http.expectNone((r) => r.url === '/scheduling/my-resources');
    expect(text()).toContain('Publicar mi agenda');
  });
});
