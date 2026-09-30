import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';

import { SessionStore } from '../../../core/auth/session.store';
import { PharmacyHub } from './pharmacy-hub';

/**
 * **Farmacia** — absorbe «Mis pedidos» y «Cotizaciones» del paciente como
 * pestañas de la misma pantalla (pedido del propietario, 24/09/2026). Lo que
 * se fija acá: en qué pestaña arranca según la URL, que cambiar de pestaña
 * la deja escrita, y que la de Cotizaciones entra fija en «Medicamentos»
 * —sin su selector de vertical— y sin descargarse hasta que se abre.
 *
 * Las dos pantallas embebidas son las clases reales, no dobles: mismo
 * criterio que `IdentityHub`.
 */

/** base64url **sobre UTF-8**, como el token real. */
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

const PERFIL = 'pp-1';

describe('PharmacyHub', () => {
  let fixture: ComponentFixture<PharmacyHub>;
  let http: HttpTestingController;
  let session: SessionStore;
  let router: Router;

  /**
   * Arma el módulo de pruebas desde cero por cada montaje: la pestaña inicial
   * depende de `ActivatedRoute.snapshot`, que hay que fijar **antes** de que
   * algo instancie el módulo — después, Angular prohíbe reemplazar un
   * provider (`overrideProvider` sobre un `TestBed` ya instanciado).
   */
  async function montar(tabInicial: string | null = null): Promise<void> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      // Declarado en `imports` para que `compileComponents` alcance el
      // `@defer` de la plantilla: sin compilar queda sin metadatos.
      imports: [PharmacyHub],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap(tabInicial === null ? {} : { tab: tabInicial }),
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    session.start({
      accessToken: jwt({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'], pid: PERFIL }),
      refreshToken: 'r-1',
    });

    await TestBed.compileComponents();
    fixture = TestBed.createComponent(PharmacyHub);
    fixture.detectChanges();
    await fixture.whenStable();
  }

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function texto(): string {
    return raiz().textContent ?? '';
  }

  /** Deja pasar unas vueltas de microtareas para que el `@defer` resuelva. */
  async function asentar(): Promise<void> {
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  }

  afterEach(() => http.verify());

  it('arranca en «Mis pedidos» y no descarga «Cotizaciones» hasta que se abre', async () => {
    await montar();
    http.expectOne('/pharmacy/orders/me').flush({ items: [], count: 0 });
    fixture.detectChanges();
    await asentar();

    expect(raiz().querySelector('[data-testid="farmacia-pestanas"]')).not.toBeNull();
    // Es «Mis pedidos» de `PharmacyOrders` embebida, sin su propio membrete
    // encima del de esta pantalla: un único `h1`, el de `PharmacyHub`.
    expect(raiz().querySelectorAll('h1').length).toBe(1);
    expect(texto()).toContain('Todavía no enviaste ningún pedido');

    // La pestaña inactiva no se montó: nada que responder del lado de
    // Cotizaciones, y `afterEach` lo confirma si algo quedó pendiente.
    http.expectNone('/profiles/patients/me');
  });

  it('«?tab=cotizaciones» abre directo ahí, fija en Medicamentos y sin su selector', async () => {
    await montar('cotizaciones');
    await asentar();
    http.expectOne('/profiles/patients/me').flush({
      personId: 'p-1',
      patientProfileId: PERFIL,
      identityVerified: false,
    });
    await asentar();

    expect(raiz().querySelector('[data-testid="cotizaciones-sin-termino"]')).not.toBeNull();
    // El selector de vertical no existe: quien la embebe decide qué compara.
    expect(raiz().querySelector('[data-testid="cotizaciones-vertical"]')).toBeNull();

    // `Tabs.tabs` (sus hijas por `contentChildren`) recién queda poblado
    // durante la primera vuelta de detección, así que al arrancar
    // directamente en la pestaña 1 la 0 llega a montarse una vez de forma
    // transitoria antes de asentarse — y con ella su pedido. No es un efecto
    // de esta pantalla: `Tabs` ya se comporta así en `IdentityHub`. Se
    // responde para no dejar la petición pendiente.
    http.expectOne('/pharmacy/orders/me').flush({ items: [], count: 0 });
  });

  it('cambiar de pestaña deja «tab=cotizaciones» escrito en la URL', async () => {
    await montar();
    http.expectOne('/pharmacy/orders/me').flush({ items: [], count: 0 });
    await asentar();

    const [, cotizacionesTab] = Array.from(raiz().querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    cotizacionesTab?.click();
    fixture.detectChanges();
    await asentar();

    http.expectOne('/profiles/patients/me').flush({
      personId: 'p-1',
      patientProfileId: PERFIL,
      identityVerified: false,
    });
    await asentar();

    expect(router.navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { tab: 'cotizaciones' } }),
    );
  });
});
