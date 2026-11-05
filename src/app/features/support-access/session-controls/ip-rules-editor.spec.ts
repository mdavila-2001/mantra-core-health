import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { AccountSecurityClient } from '../../../core/data-access/iam/account-security.client';
import type { MyNetwork } from '../../../core/data-access/iam/iam-new-device';
import { SupportAccessClient } from '../../../core/data-access/support-access/support-access.client';
import type { IpAccessRuleView } from '../../../core/data-access/support-access/support-access.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { IpRulesEditor } from './ip-rules-editor';

const SEDE: IpAccessRuleView = { id: 'r-1', type: 'ALLOW', cidr: '190.129.0.0/16', description: 'Sede central' };
const BLOQUEADA: IpAccessRuleView = { id: 'r-2', type: 'DENY', cidr: '190.129.99.0/24' };

function rechazo(reason: string, extra: Record<string, unknown> = {}): HttpErrorResponse {
  return new HttpErrorResponse({ status: 422, error: { statusCode: 422, code: 'PRECONDITION_FAILED', message: 'x', details: { reason, ...extra }, timestamp: '', path: '/org/ip-access-rules' } });
}

describe('IpRulesEditor', () => {
  let fixture: ComponentFixture<IpRulesEditor>;
  let getIpAccessRules: ReturnType<typeof vi.fn>;
  let putIpAccessRules: ReturnType<typeof vi.fn>;
  let confirmarCambios: ReturnType<typeof vi.fn>;
  const host = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (id: string): HTMLElement | null => host().querySelector(`[data-testid="${id}"]`);
  /** Lo escrito en todos los campos de la pantalla (las redes son campos de texto). */
  const valores = (): string[] => Array.from(host().querySelectorAll('input')).map((i) => (i as HTMLInputElement).value);
  const refrescar = async (): Promise<void> => {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const clic = async (id: string): Promise<void> => {
    (byId(id) as HTMLElement).click();
    await refrescar();
  };
  const escribir = async (id: string, valor: string): Promise<void> => {
    const input = (byId(id) as HTMLInputElement).matches('input') ? (byId(id) as HTMLInputElement) : (byId(id)!.querySelector('input') as HTMLInputElement);
    input.value = valor;
    input.dispatchEvent(new Event('input'));
    await refrescar();
  };

  async function abrir(guardadas: readonly IpAccessRuleView[], exigidaEn: readonly string[] = ['Personal de la organización'], red: MyNetwork | null = null): Promise<void> {
    getIpAccessRules = vi.fn(() => of({ rules: guardadas }));
    putIpAccessRules = vi.fn((reglas: readonly unknown[]) => of({ rules: reglas }));
    confirmarCambios = vi.fn(() => Promise.resolve(true));
    TestBed.configureTestingModule({
      providers: [
        { provide: SupportAccessClient, useValue: { getIpAccessRules, putIpAccessRules } },
        { provide: AccountSecurityClient, useValue: { getMyNetwork: () => (red === null ? NEVER : of(red)) } },
        { provide: DialogService, useValue: { confirmarCambios } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    fixture = TestBed.createComponent(IpRulesEditor);
    fixture.componentRef.setInput('exigidaEn', exigidaEn);
    fixture.detectChanges();
    await refrescar();
  }

  it('sin reglas lo dice, no deja guardar y explica en lenguaje simple cómo escribir una red', async () => {
    await abrir([]);
    expect(byId('redes-vacio')!.textContent).toContain('no se restringe a nadie');
    expect(byId('redes-resumen')!.textContent).toContain('Sin redes');
    expect(byId('redes-guardar')!.getAttribute('aria-disabled')).toBe('true');
    const ayuda = byId('redes-ayuda')!.textContent!;
    expect(ayuda).toContain('190.129.0.0/16');
    expect(ayuda).toContain('/32');
    expect(ayuda).toContain('Sin ninguna regla');
  });

  describe('la conexión que ve la API', () => {
    const SEDE_VISTA: MyNetwork = { ip: '190.129.4.7', family: 'ipv4', trustProxyHops: 1 };

    it('dice cómo ve la API su conexión y «Usar mi IP» agrega esa dirección como /32', async () => {
      await abrir([], ['Personal de la organización'], SEDE_VISTA);
      expect(byId('redes-mi-ip')!.textContent).toContain('La API ve su conexión como 190.129.4.7');
      await clic('redes-usar-mi-ip');
      expect(valores()).toContain('190.129.4.7/32');
      // Ya está cargada: el botón desaparece y la pantalla lo dice.
      expect(byId('redes-usar-mi-ip')).toBeNull();
      expect(byId('redes-mi-ip-cargada')!.textContent).toContain('ya está entre las reglas');
    });

    it('una dirección IPv6 se propone como /128', async () => {
      await abrir([], ['Personal de la organización'], { ip: '2800:cd0:1::7', family: 'ipv6', trustProxyHops: 1 });
      await clic('redes-usar-mi-ip');
      expect(valores()).toContain('2800:cd0:1::7/128');
    });

    it('avisa del proxy cuando el servidor ve una dirección interna, y no inventa una regla con ella', async () => {
      await abrir([], ['Personal de la organización'], { ip: '10.0.0.5', family: 'ipv4', trustProxyHops: 0 });
      expect(byId('redes-aviso-proxy')!.textContent).toContain('dirección interna');
    });

    it('con 0 saltos de proxy de confianza lo avisa aunque la dirección sea pública', async () => {
      await abrir([], ['Personal de la organización'], { ip: '190.129.4.7', family: 'ipv4', trustProxyHops: 0 });
      expect(byId('redes-aviso-proxy')!.textContent).toContain('0 saltos');
    });

    it('con la dirección bien leída y un proxy configurado no hay aviso', async () => {
      await abrir([], ['Personal de la organización'], SEDE_VISTA);
      expect(byId('redes-aviso-proxy')).toBeNull();
    });

    it('si la API no pudo leer la dirección no ofrece «Usar mi IP» y lo explica', async () => {
      await abrir([], ['Personal de la organización'], { ip: null, family: null, trustProxyHops: 1 });
      expect(byId('redes-usar-mi-ip')).toBeNull();
      expect(byId('redes-aviso-proxy')!.textContent).toContain('no pudo leer la dirección');
    });
  });

  it('avisa a la vista que no se guarda un conjunto que deje afuera a quien lo guarda', async () => {
    await abrir([SEDE]);
    expect(byId('redes-aviso-bloqueo')!.textContent).toContain('No se puede dejar a nadie afuera, tampoco a usted');
  });

  it('dice si estas redes hoy se hacen cumplir o todavía no restringen a nadie', async () => {
    await abrir([SEDE], []);
    expect(byId('redes-no-exigida')!.textContent).toContain('todavía no restringen a nadie');
    expect(byId('redes-exigida')).toBeNull();
    fixture.componentRef.setInput('exigidaEn', ['Todas las cuentas', 'Personal de la organización']);
    await refrescar();
    expect(byId('redes-exigida')!.textContent).toContain('Todas las cuentas, Personal de la organización');
    expect(byId('redes-no-exigida')).toBeNull();
  });

  it('muestra lo guardado, con su resumen', async () => {
    await abrir([SEDE, BLOQUEADA]);
    expect(host().querySelectorAll('[data-testid^="redes-fila-"]')).toHaveLength(2);
    expect(byId('redes-resumen')!.textContent).toContain('Solo se entra desde la red permitida');
    expect(byId('redes-resumen')!.textContent).toContain('una red queda bloqueada');
  });

  it('agregar una red permitida deja una fila vacía, y con el rango mal escrito se explica y no se manda nada', async () => {
    await abrir([]);
    await clic('redes-agregar-permitida');
    await escribir('redes-cidr-0', '190.129.0.0');
    await clic('redes-guardar');
    expect(putIpAccessRules).not.toHaveBeenCalled();
    expect(confirmarCambios).not.toHaveBeenCalled();
    expect(host().textContent).toContain('Falta la barra y el número del final');
    expect(byId('redes-problemas')).not.toBeNull();
  });

  it('un rango válido se confirma, se manda como { rules } completo y se vuelve a leer', async () => {
    await abrir([]);
    await clic('redes-agregar-permitida');
    await escribir('redes-cidr-0', ' 190.129.0.0/16 ');
    await escribir('redes-descripcion-0', 'Sede central');
    await clic('redes-guardar');
    expect(confirmarCambios).toHaveBeenCalledTimes(1);
    expect(putIpAccessRules).toHaveBeenCalledWith([{ type: 'ALLOW', cidr: '190.129.0.0/16', description: 'Sede central' }]);
    expect(getIpAccessRules).toHaveBeenCalledTimes(2);
  });

  it('si cancela la confirmación no se guarda nada', async () => {
    await abrir([SEDE]);
    await clic('redes-quitar-0');
    confirmarCambios.mockResolvedValueOnce(false);
    await clic('redes-guardar');
    expect(putIpAccessRules).not.toHaveBeenCalled();
  });

  it('quitar todas guarda un conjunto vacío: sin restricción de red', async () => {
    await abrir([SEDE]);
    await clic('redes-quitar-0');
    await clic('redes-guardar');
    expect(putIpAccessRules).toHaveBeenCalledWith([]);
  });

  it('descartar vuelve a lo guardado', async () => {
    await abrir([SEDE]);
    await clic('redes-agregar-bloqueada');
    expect(host().querySelectorAll('[data-testid^="redes-fila-"]')).toHaveLength(2);
    await clic('redes-descartar');
    expect(host().querySelectorAll('[data-testid^="redes-fila-"]')).toHaveLength(1);
  });

  it('un conjunto que deja afuera a quien lo guarda: lo explica, no pierde lo editado y no se cambia nada', async () => {
    await abrir([]);
    putIpAccessRules.mockReturnValueOnce(throwError(() => rechazo('IP_RULES_WOULD_LOCK_OUT_ACTOR')));
    await clic('redes-agregar-permitida');
    await escribir('redes-cidr-0', '203.0.113.0/24');
    await clic('redes-guardar');
    const error = byId('redes-error')!;
    expect(error.getAttribute('data-kind')).toBe('LOCK_OUT');
    expect(error.textContent).toContain('No se guardó nada');
    expect(error.textContent).toContain('usted quedaría fuera de su propia organización');
    expect((byId('redes-cidr-0') as HTMLInputElement).value).toBe('203.0.113.0/24');
    expect(getIpAccessRules).toHaveBeenCalledTimes(1);
  });

  it('un rango que la API no acepta (IP_RULE_CIDR_INVALID) también se explica', async () => {
    await abrir([]);
    putIpAccessRules.mockReturnValueOnce(throwError(() => rechazo('IP_RULE_CIDR_INVALID', { cidr: '999.1.1.1/8' })));
    await clic('redes-agregar-bloqueada');
    await escribir('redes-cidr-0', '10.0.0.0/8');
    await clic('redes-guardar');
    expect(byId('redes-error')!.getAttribute('data-kind')).toBe('CIDR');
    expect(byId('redes-error')!.textContent).toContain('999.1.1.1/8');
  });

  it('la vista previa dice si una dirección entra y por qué regla', async () => {
    await abrir([SEDE, BLOQUEADA]);
    await escribir('redes-prueba-ip', '190.129.10.4');
    expect(byId('redes-prueba-resultado')!.textContent).toContain('Puede entrar');
    expect(byId('redes-prueba-resultado')!.textContent).toContain('190.129.0.0/16 (Sede central)');
    await escribir('redes-prueba-ip', '190.129.99.7');
    expect(byId('redes-prueba-resultado')!.textContent).toContain('No puede entrar');
    expect(byId('redes-prueba-resultado')!.textContent).toContain('Bloquear gana siempre');
    await escribir('redes-prueba-ip', '8.8.8.8');
    expect(byId('redes-prueba-resultado')!.textContent).toContain('No cae en ninguna red permitida');
  });

  it('la vista previa prueba lo que se está editando, antes de guardar, y avisa de una dirección que no es una IP', async () => {
    await abrir([]);
    await clic('redes-agregar-permitida');
    await escribir('redes-cidr-0', '203.0.113.0/24');
    await escribir('redes-prueba-ip', '190.129.10.4');
    expect(byId('redes-prueba-resultado')!.textContent).toContain('No puede entrar');
    await escribir('redes-prueba-ip', 'sede central');
    expect(byId('redes-prueba-resultado')!.textContent).toContain('Revise la dirección');
  });

  it('una regla que todavía no rige no cuenta en la vista previa', async () => {
    await abrir([{ ...SEDE, validFrom: new Date(Date.now() + 5 * 86_400_000).toISOString() }]);
    await escribir('redes-prueba-ip', '8.8.8.8');
    expect(byId('redes-prueba-resultado')!.textContent).toContain('No hay redes cargadas');
  });

  it('con 50 reglas no deja agregar más y lo dice', async () => {
    const cincuenta = Array.from({ length: 50 }, (_, i): IpAccessRuleView => ({ id: `r-${i}`, type: 'ALLOW', cidr: `10.${i}.0.0/16` }));
    await abrir(cincuenta);
    expect(byId('redes-llena')!.textContent).toContain('50');
    expect(byId('redes-agregar-permitida')!.getAttribute('aria-disabled')).toBe('true');
  });

  it('si no se pueden leer las redes, lo dice con la forma de siempre', async () => {
    getIpAccessRules = vi.fn(() => throwError(() => new HttpErrorResponse({ status: 500 })));
    TestBed.configureTestingModule({ providers: [{ provide: SupportAccessClient, useValue: { getIpAccessRules, putIpAccessRules: vi.fn() } }, { provide: DialogService, useValue: {} }, { provide: ToastService, useValue: {} }] });
    fixture = TestBed.createComponent(IpRulesEditor);
    fixture.detectChanges();
    await refrescar();
    expect(byId('redes-panel')).toBeNull();
  });
});
