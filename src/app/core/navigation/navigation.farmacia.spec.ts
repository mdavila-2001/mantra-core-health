import { beforeEach, describe, expect, it } from 'vitest';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../auth/session.store';
import { NavigationService } from './navigation.service';

/**
 * El menú de la cuenta de farmacia (tenant `PHARMACY`): ocho renglones planos,
 * en este orden y nada más, más los dos fijos de toda cuenta.
 *
 * Y, del otro lado, que **ninguna otra cuenta cambió de menú**: la regla 3 del
 * propietario. Las listas de abajo son el menú de cada una antes de este
 * carril; si una de ellas se mueve, alguien tocó lo que no debía.
 */
@Component({ template: '', changeDetection: ChangeDetectionStrategy.OnPush })
class Vacio {}

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

const MENU_DE_LA_FARMACIA = [
  '/administration/pharmacy',
  '/administration/pharmacy-catalog',
  '/administration/pharmacy-categories',
  '/administration/pharmacy-import',
  '/administration/pharmacy-inventory',
  '/administration/pharmacy-orders',
  '/administration/pharmacy-campaigns',
  '/administration/pharmacy-profile',
];

const FIJOS_DE_TODA_CUENTA = ['/my-account', '/notification-center'];

describe('Menú de la cuenta de farmacia', () => {
  let service: NavigationService;
  let session: SessionStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: Vacio }]),
      ],
    });
    service = TestBed.inject(NavigationService);
    session = TestBed.inject(SessionStore);
  });

  function abrirSesion(
    roles: readonly string[],
    tenants: readonly string[],
    tenantTypes?: Readonly<Record<string, string>>,
  ) {
    session.start({
      accessToken: jwt({
        sub: 'u-1',
        roles,
        tenants,
        ...(tenantTypes === undefined ? {} : { tenantTypes }),
      }),
      refreshToken: 'r',
    });
  }

  function rutasDelMenu(): readonly string[] {
    return [
      ...service.pinnedItems().map((item) => item.route),
      ...service.menu().flatMap((grupo) => grupo.items.map((item) => item.route)),
    ];
  }

  it('ofrece los ocho renglones de la farmacia, en orden, y nada de otra cuenta', () => {
    abrirSesion(['USER'], ['t-f'], { 't-f': 'PHARMACY' });

    const rutas = rutasDelMenu();

    expect(rutas.filter((ruta) => !FIJOS_DE_TODA_CUENTA.includes(ruta))).toEqual(
      MENU_DE_LA_FARMACIA,
    );
    expect(rutas.filter((ruta) => FIJOS_DE_TODA_CUENTA.includes(ruta)).sort()).toEqual(
      [...FIJOS_DE_TODA_CUENTA].sort(),
    );
  });

  it('los ocho van planos: en un dominio aplanado, sin encabezado ni desplegable', () => {
    abrirSesion(['USER'], ['t-f'], { 't-f': 'PHARMACY' });

    const grupos = service
      .menu()
      .filter((grupo) => grupo.items.some((item) => MENU_DE_LA_FARMACIA.includes(item.route)));

    expect(grupos).toHaveLength(1);
    expect(grupos[0].aplanado).toBe(true);
    expect(grupos[0].items.map((item) => item.label)).toEqual([
      'Resumen',
      'Productos',
      'Categorías',
      'Importación masiva',
      'Inventario',
      'Solicitudes de retiro',
      'Promociones',
      'Ficha de la farmacia',
    ]);
  });

  it('el rol de la farmacia no le abre el menú de aseguradora ni de clínica', () => {
    abrirSesion(['USER'], ['t-f'], { 't-f': 'PHARMACY' });

    const rutas = rutasDelMenu();

    expect(rutas.some((ruta) => ruta.includes('insurance'))).toBe(false);
    expect(rutas).not.toContain('/administration/my-organization');
    expect(rutas).not.toContain('/my-account/appointments');
    expect(rutas).not.toContain('/directories');
  });

  it('las secciones de farmacia no se ofrecen a una clínica ni a una aseguradora', () => {
    abrirSesion(['USER'], ['t-c'], { 't-c': 'CLINIC' });
    expect(rutasDelMenu().filter((r) => r.includes('pharmacy'))).toEqual([]);

    abrirSesion(['USER'], ['t-p'], { 't-p': 'PAYER' });
    expect(rutasDelMenu().filter((r) => r.includes('pharmacy'))).toEqual([]);
  });

  it('la aseguradora conserva sus cuatro secciones', () => {
    abrirSesion(['USER'], ['t-p'], { 't-p': 'PAYER' });

    const rutas = rutasDelMenu();

    for (const ruta of [
      '/administration/insurance',
      '/administration/insurance-analytics',
      '/administration/received-claims',
      '/administration/insurance-campaigns',
    ]) {
      expect(rutas).toContain(ruta);
    }
  });

  it('el paciente y el médico no ven ni una sección de la farmacia', () => {
    abrirSesion(['PATIENT'], []);
    expect(rutasDelMenu().filter((r) => r.includes('administration/pharmacy'))).toEqual([]);

    abrirSesion(['PRACTITIONER'], ['t-c'], { 't-c': 'CLINIC' });
    expect(rutasDelMenu().filter((r) => r.includes('administration/pharmacy'))).toEqual([]);
  });
});
