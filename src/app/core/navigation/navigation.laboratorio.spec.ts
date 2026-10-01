import { beforeEach, describe, expect, it } from 'vitest';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../auth/session.store';
import { NavigationService } from './navigation.service';

/**
 * El menú de la cuenta de laboratorio (tenant `DIAGNOSTIC_CENTER`): plano, en
 * este orden y nada más, más los dos fijos de toda cuenta. Es el espejo de
 * `navigation.farmacia.spec.ts`.
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

const MENU_DEL_LABORATORIO = [
  '/administration/laboratory',
  '/laboratorio/recepcion',
  '/laboratorio/cola',
  '/administration/laboratory-results',
  '/administration/laboratory-prices',
  '/administration/laboratory-branches',
];

const FIJOS_DE_TODA_CUENTA = ['/my-account', '/notification-center'];

describe('Menú de la cuenta de laboratorio', () => {
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

  it('ofrece los renglones del laboratorio, en orden, y nada de otra cuenta', () => {
    abrirSesion(['USER'], ['t-l'], { 't-l': 'DIAGNOSTIC_CENTER' });

    const rutas = rutasDelMenu();

    expect(rutas.filter((ruta) => !FIJOS_DE_TODA_CUENTA.includes(ruta))).toEqual(
      MENU_DEL_LABORATORIO,
    );
  });

  it('van planos: en un dominio aplanado, sin encabezado ni desplegable', () => {
    abrirSesion(['USER'], ['t-l'], { 't-l': 'DIAGNOSTIC_CENTER' });

    const grupos = service
      .menu()
      .filter((grupo) => grupo.items.some((item) => MENU_DEL_LABORATORIO.includes(item.route)));

    expect(grupos).toHaveLength(1);
    expect(grupos[0].aplanado).toBe(true);
    expect(grupos[0].items.map((item) => item.label)).toEqual([
      'Resumen',
      'Recepción de muestras',
      'Cola de trabajo',
      'Resultados',
      'Precios',
      'Sucursales',
    ]);
  });

  it('no ve nada de aseguradora, de paciente ni los directorios', () => {
    abrirSesion(['USER'], ['t-l'], { 't-l': 'DIAGNOSTIC_CENTER' });

    const rutas = rutasDelMenu();

    expect(rutas.some((ruta) => ruta.includes('insurance'))).toBe(false);
    expect(rutas).not.toContain('/administration/my-organization');
    expect(rutas).not.toContain('/my-account/appointments');
    expect(rutas).not.toContain('/directories');
  });

  it('las secciones del laboratorio no existen para otra cuenta', () => {
    for (const [roles, tenants, tipos] of [
      [['USER'], ['t-f'], { 't-f': 'PHARMACY' }],
      [['USER'], ['t-p'], { 't-p': 'PAYER' }],
      [['PRACTITIONER'], ['t-c'], { 't-c': 'CLINIC' }],
      [['PATIENT'], [], undefined],
    ] as const) {
      abrirSesion(roles, tenants, tipos);
      const rutas = rutasDelMenu();
      expect(rutas.filter((r) => r.includes('administration/laboratory'))).toEqual([]);
      expect(rutas.filter((r) => r.startsWith('/laboratorio/'))).toEqual([]);
    }
  });

  it('la farmacia conserva sus diez renglones', () => {
    abrirSesion(['USER'], ['t-f'], { 't-f': 'PHARMACY' });
    expect(rutasDelMenu().filter((r) => r.includes('administration/pharmacy'))).toHaveLength(10);
  });
});
