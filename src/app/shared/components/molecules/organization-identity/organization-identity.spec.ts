import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';

import { OrganizationLogoClient } from '../../../../core/data-access/directory/organization-logo.client';
import { OrganizationIdentity } from './organization-identity';

const PNG = 'data:image/png;base64,iVBORw0KGgo=';

describe('OrganizationIdentity', () => {
  let getUrl: ReturnType<typeof vi.fn>;

  function create(inputs: Record<string, unknown>) {
    TestBed.configureTestingModule({
      providers: [{ provide: OrganizationLogoClient, useValue: { getUrl } }],
    });
    const fixture = TestBed.createComponent(OrganizationIdentity);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture;
  }
  const el = (f: { nativeElement: unknown }) => f.nativeElement as HTMLElement;

  beforeEach(() => {
    getUrl = vi.fn();
  });

  it('con logo lo dibuja contenido y sin texto alternativo (el nombre ya está al lado)', () => {
    getUrl.mockReturnValue(of(PNG));
    const fixture = create({ tenantId: 'org-con-logo', name: 'Laboratorio Central', subtitle: 'Laboratorio' });

    const img = el(fixture).querySelector('img');
    expect(img?.getAttribute('src')).toBe(PNG);
    expect(img?.getAttribute('alt')).toBe('');
    expect(el(fixture).textContent).toContain('Laboratorio Central');
    expect(el(fixture).textContent).toContain('Laboratorio');
  });

  it('sin logo muestra las iniciales en una baldosa del mismo tamaño', () => {
    getUrl.mockReturnValue(of(null));
    const fixture = create({ tenantId: 'org-sin-logo', name: 'Laboratorio Central', size: 'lg' });

    expect(el(fixture).querySelector('img')).toBeNull();
    expect(el(fixture).querySelector('.identidad__iniciales')?.textContent).toBe('LC');
    expect(el(fixture).querySelector<HTMLElement>('.identidad__baldosa')?.style.width).toBe('64px');
  });

  it('un logo que no carga cae a las iniciales: no deja un hueco', () => {
    getUrl.mockReturnValue(of(PNG));
    const fixture = create({ tenantId: 'org-logo-roto', name: 'Clínica Norte' });

    el(fixture).querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();

    expect(el(fixture).querySelector('img')).toBeNull();
    expect(el(fixture).querySelector('.identidad__iniciales')?.textContent).toBe('CN');
  });

  it('sin organización no pide nada', () => {
    const fixture = create({ tenantId: null, name: 'Centro' });
    expect(getUrl).not.toHaveBeenCalled();
    expect(el(fixture).querySelector('.identidad__iniciales')).not.toBeNull();
  });

  it('en modo compacto el nombre queda sólo para el lector de pantalla', () => {
    getUrl.mockReturnValue(of(null));
    const fixture = create({ tenantId: 'org-compacta', name: 'Laboratorio Central', compact: true });

    expect(el(fixture).querySelector('.identidad__texto')).toBeNull();
    expect(el(fixture).querySelector('.sr-only')?.textContent).toBe('Laboratorio Central');
  });

  it('pide cada logo una sola vez aunque la tarjeta se dibuje otra vez', () => {
    const lectura = new Subject<string | null>();
    getUrl.mockReturnValue(lectura);
    create({ tenantId: 'org-cache', name: 'A' });
    TestBed.resetTestingModule();
    create({ tenantId: 'org-cache', name: 'A' });
    expect(getUrl).toHaveBeenCalledTimes(1);
  });
});
