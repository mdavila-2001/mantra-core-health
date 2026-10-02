import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { defaultRuleFields } from '../../../../core/promotions-engine/rule-fields';
import type { RuleFields } from '../../../../core/promotions-engine/rule-fields';
import type {
  DraftFailure,
  PromotableItem,
} from '../../../../core/promotions-engine/promotion-mechanics.types';
import { PromotionRuleEditor } from './promotion-rule-editor';

const ITEMS: readonly PromotableItem[] = [
  { itemId: 'a', label: 'Ibuprofeno 400 mg', detail: 'caja x 20', unitPrice: '22.50', currency: 'BOB' },
  { itemId: 'b', label: 'Vitamina C', detail: null, unitPrice: '15.00', currency: 'BOB' },
];

/**
 * El editor es presentacional: el anfitrión guarda los campos, como hace la
 * pantalla de promociones. Así las pruebas recorren el mismo ciclo que el uso
 * real: el usuario toca algo → el editor emite → el anfitrión guarda → el
 * editor se pinta con lo nuevo.
 */
@Component({
  selector: 'app-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PromotionRuleEditor],
  template: `
    <app-promotion-rule-editor
      [fields]="fields()"
      [items]="items()"
      [failures]="failures()"
      (fieldsChange)="fields.set($event)"
    />
  `,
})
class Host {
  readonly fields = signal<RuleFields>(defaultRuleFields());
  readonly items = signal<readonly PromotableItem[]>([]);
  readonly failures = signal<readonly DraftFailure[]>([]);
}

describe('PromotionRuleEditor', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [Host] });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byId = (testId: string): HTMLElement | null => root().querySelector(`[data-testid="${testId}"]`);
  const text = (): string => root().textContent ?? '';

  function render(): void {
    fixture.detectChanges();
  }

  function elegirFamilia(family: string): void {
    (byId(`segmentado-${family}`) as HTMLButtonElement).click();
    render();
  }

  function elegirMecanica(label: string): void {
    const radios = Array.from(root().querySelectorAll('[data-testid="regla-mecanicas"] label'));
    const radio = radios.find((candidata) => candidata.textContent?.includes(label));
    (radio?.querySelector('input') as HTMLInputElement).click();
    render();
  }

  function escribir(selector: string, valor: string): void {
    const input = root().querySelector(selector) as HTMLInputElement;
    input.value = valor;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    render();
  }

  function botones(texto: string): HTMLButtonElement[] {
    return (Array.from(root().querySelectorAll('button')) as HTMLButtonElement[]).filter((boton) =>
      (boton.textContent ?? '').includes(texto),
    );
  }

  describe('el tipo de campaña', () => {
    it('ofrece las cinco familias', () => {
      for (const family of ['PRICE', 'QUANTITY', 'ORDER_TOTAL', 'COMBO', 'LOYALTY']) {
        expect(byId(`segmentado-${family}`)).not.toBeNull();
      }
    });

    it('arranca en el porcentaje de descuento de la familia Precio', () => {
      expect(host.fields()).toMatchObject({ family: 'PRICE', kind: 'PERCENT_OFF' });
      expect(root().querySelectorAll('[data-testid="regla-mecanicas"] input[type="radio"]')).toHaveLength(4);
    });

    it('elegir otra familia cambia a su primera mecánica y ofrece las suyas', () => {
      elegirFamilia('QUANTITY');

      expect(host.fields()).toMatchObject({ family: 'QUANTITY', kind: 'BUY_X_PAY_Y' });
      expect(root().querySelectorAll('[data-testid="regla-mecanicas"] input[type="radio"]')).toHaveLength(3);
      expect(text()).toContain('Llevá X, pagá Y');
    });

    it('el desplegable de pantalla angosta elige la misma familia, con su nombre completo', () => {
      const select = root().querySelector('[data-testid="regla-familias-select"] select') as HTMLSelectElement;
      // La opción oculta del placeholder no cuenta: los valores son índices de las reales.
      const nombres = Array.from(select.options)
        .filter((opcion) => opcion.value !== '')
        .map((opcion) => opcion.textContent?.trim());

      expect(nombres).toContain('Total de la compra');
      expect(nombres).toContain('Combos y regalos');
      select.value = String(nombres.indexOf('Cantidad'));
      select.dispatchEvent(new Event('change', { bubbles: true }));
      render();

      expect(host.fields()).toMatchObject({ family: 'QUANTITY', kind: 'BUY_X_PAY_Y' });
    });

    it('elegir una mecánica de la familia la deja elegida', () => {
      elegirFamilia('ORDER_TOTAL');
      elegirMecanica('Descuento escalonado por monto');

      expect(host.fields().kind).toBe('SPEND_TIERS');
    });

    it('dice para qué sirve la mecánica elegida y cómo la lee el paciente', () => {
      elegirFamilia('QUANTITY');

      expect(byId('regla-ayuda')?.textContent).toContain('Quien lleva X unidades paga solo Y');
      expect(byId('regla-ayuda')?.textContent).toContain('2x1');
    });
  });

  describe('los campos de la mecánica', () => {
    it('un porcentaje: escribirlo lo guarda como texto', () => {
      escribir('[data-testid="regla-porcentaje"] input', '35');

      expect(host.fields().percent).toBe('35');
    });

    it('un campo numérico que emite un número se guarda como texto, sin romper', () => {
      const editor = fixture.debugElement.children[0].componentInstance as { text: (v: string | number | null) => string };

      expect(editor.text(15)).toBe('15');
      expect(editor.text(null)).toBe('');
      expect(editor.text('7')).toBe('7');
    });

    it('«llevá X, pagá Y» pide las dos cantidades y nada más', () => {
      elegirFamilia('QUANTITY');

      expect(text()).toContain('Unidades que lleva');
      expect(text()).toContain('Unidades que paga');
      expect(text()).not.toContain('Porcentaje de descuento');
    });

    it('una compra mínima pide el mínimo y el porcentaje', () => {
      elegirFamilia('ORDER_TOTAL');

      expect(text()).toContain('Compra mínima');
      expect(text()).toContain('Porcentaje de descuento');
    });

    it('los puntos piden sólo el multiplicador', () => {
      elegirFamilia('LOYALTY');

      expect(text()).toContain('Multiplicador de puntos');
    });

    it('los campos de dinero aceptan centavos y los de unidades no', () => {
      elegirFamilia('ORDER_TOTAL');
      elegirMecanica('Monto fijo por compra mínima');
      const pasos = Array.from(root().querySelectorAll('[data-testid="regla-editor"] input[type="number"]'))
        .slice(0, 2)
        .map((input) => input.getAttribute('step'));

      // Compra mínima y monto: dinero, con paso de un centavo.
      expect(pasos).toEqual(['0.01', '0.01']);

      elegirFamilia('QUANTITY');
      const unidades = root().querySelector('[data-testid="regla-editor"] input[type="number"]');
      expect(unidades?.getAttribute('step')).not.toBe('0.01');
    });

    it('un precio de campaña manda a escribirlos en la lista de productos', () => {
      elegirMecanica('Precio de campaña por producto');

      expect(text()).toContain('lo escribís abajo, en la lista de productos');
    });
  });

  describe('los tramos', () => {
    beforeEach(() => {
      elegirFamilia('QUANTITY');
      elegirMecanica('Descuento escalonado por cantidad');
    });

    const filas = (): number =>
      root().querySelectorAll('[data-testid="regla-tramos-quantityTiers"] .regla__tramo').length;

    it('muestra los dos tramos de arranque', () => {
      expect(filas()).toBe(2);
    });

    it('agrega y quita tramos', () => {
      botones('Agregar tramo')[0].click();
      render();
      expect(filas()).toBe(3);
      expect(host.fields().quantityTiers).toHaveLength(3);

      botones('Quitar')[0].click();
      render();
      expect(filas()).toBe(2);
    });

    // `app-button` se deshabilita por `aria-disabled` y intercepta el click: se
    // verifica lo que ve el usuario (el aviso) y lo que pasa al tocarlo.
    const deshabilitado = (boton: HTMLButtonElement): boolean => boton.getAttribute('aria-disabled') === 'true';

    it('no deja menos de un tramo', () => {
      botones('Quitar')[0].click();
      render();
      expect(filas()).toBe(1);

      expect(deshabilitado(botones('Quitar')[0])).toBe(true);
      botones('Quitar')[0].click();
      render();
      expect(filas()).toBe(1);
    });

    it('no pasa del máximo de tramos', () => {
      while (filas() < 6) {
        botones('Agregar tramo')[0].click();
        render();
      }

      expect(deshabilitado(botones('Agregar tramo')[0])).toBe(true);
      botones('Agregar tramo')[0].click();
      render();
      expect(filas()).toBe(6);
    });

    it('cada tramo tiene un nombre accesible propio', () => {
      expect(text()).toContain('Tramo 1 · desde (unidades)');
      expect(text()).toContain('Tramo 2 · descuento (%)');
    });
  });

  describe('combos y regalos', () => {
    beforeEach(() => {
      host.items.set(ITEMS);
      elegirFamilia('COMBO');
    });

    it('un combo muestra cuánto suman los productos por separado', () => {
      expect(host.fields().kind).toBe('BUNDLE_PRICE');
      expect(text()).toContain('Por separado suman Bs 37.50');
    });

    it('un combo sin productos suficientes manda a elegirlos', () => {
      host.items.set([ITEMS[0]]);
      render();

      expect(text()).toContain('Elegí al menos dos productos abajo');
    });

    it('un regalo ofrece los productos elegidos en dos selectores', () => {
      elegirMecanica('Regalo con la compra');

      expect(text()).toContain('Producto que se compra');
      expect(text()).toContain('Producto de regalo');
    });
  });

  describe('«toda la farmacia»', () => {
    it('se ofrece en los descuentos simples', () => {
      expect(byId('regla-toda-la-tienda')).not.toBeNull();
    });

    it('no se ofrece donde hay que decir sobre qué', () => {
      elegirFamilia('QUANTITY');

      expect(byId('regla-toda-la-tienda')).toBeNull();
    });
  });

  describe('la vista previa', () => {
    it('lee la mecánica con la misma prosa que ve el paciente', () => {
      expect(byId('regla-vista-badge')?.textContent?.trim()).toBe('20 % menos');
      expect(byId('regla-vista-frase')?.textContent).toContain('20 % de descuento en cada producto');
    });

    it('con un campo a medias calla y pide lo que falta, en vez de decir un disparate', () => {
      host.items.set(ITEMS);
      elegirFamilia('COMBO');
      // El combo recién elegido no tiene precio escrito todavía.
      expect(byId('regla-vista-badge')).toBeNull();
      expect(byId('regla-vista-pendiente')?.textContent).toContain('Completá los datos de arriba');
      expect(text()).not.toContain('Combo a Bs :');
      expect(text()).not.toContain('NaN');

      escribir('[data-testid="regla-editor"] input[type="number"]', '30');

      expect(byId('regla-vista-pendiente')).toBeNull();
      expect(byId('regla-vista-frase')?.textContent).toContain('Combo a Bs 30');
    });

    it('un porcentaje vacío no se lee «NaN % menos»', () => {
      escribir('[data-testid="regla-porcentaje"] input', '');

      expect(text()).not.toContain('NaN');
      expect(byId('regla-vista-pendiente')).not.toBeNull();
    });

    it('sin productos no inventa un ejemplo', () => {
      expect(byId('regla-vista-ejemplo')).toBeNull();
    });

    it('con productos calcula un ejemplo con las reglas reales', () => {
      host.items.set(ITEMS);
      render();

      // 20 % de 22.50 = 450 centavos de descuento → 18.00.
      expect(byId('regla-vista-ejemplo')?.textContent).toContain('pagás Bs 18 en vez de Bs 22.50');
    });

    it('se actualiza al cambiar la mecánica', () => {
      host.items.set(ITEMS);
      elegirFamilia('QUANTITY');

      expect(byId('regla-vista-badge')?.textContent?.trim()).toBe('2x1');
      expect(byId('regla-vista-ejemplo')?.textContent).toContain('Llevando 2 unidades');
    });
  });

  describe('los errores', () => {
    it('marca el campo que tiene el problema y dice qué hacer', () => {
      host.failures.set(['PERCENT_OUT_OF_RANGE']);
      render();

      expect(text()).toContain('El porcentaje tiene que ser un número entero entre 1 % y 99 %.');
      const input = root().querySelector('[data-testid="regla-porcentaje"] input');
      expect(input?.getAttribute('aria-invalid')).toBe('true');
    });

    it('no marca nada cuando no hay fallos', () => {
      const input = root().querySelector('[data-testid="regla-porcentaje"] input');

      expect(input?.getAttribute('aria-invalid')).not.toBe('true');
      expect(text()).not.toContain('tiene que ser un número entero');
    });

    it('un fallo de otra mecánica no aparece en ésta', () => {
      host.failures.set(['BUY_QUANTITIES_INVALID']);
      render();

      expect(text()).not.toContain('pagás al menos una unidad');
    });
  });

  describe('las condiciones', () => {
    it('viven en un panel con su título', () => {
      expect(byId('regla-condiciones')).not.toBeNull();
      expect(text()).toContain('Condiciones opcionales');
    });

    function abrirCondiciones(): void {
      (byId('regla-condiciones')?.querySelector('button') as HTMLButtonElement).click();
      render();
    }

    it('plegadas no ocupan lugar: sus campos recién existen al abrirlas', () => {
      expect(text()).not.toContain('Tope de descuento por pedido');

      abrirCondiciones();

      expect(text()).toContain('Tope de descuento por pedido');
    });

    it('avisa que los límites todavía no se hacen cumplir en la demostración', () => {
      abrirCondiciones();

      expect(text()).toContain('todavía no se hacen cumplir');
    });

    it('guardan el tope que se escribe', () => {
      abrirCondiciones();
      const campos = Array.from(root().querySelectorAll('[data-testid="regla-condiciones"] input')) as HTMLInputElement[];
      const tope = campos.find((campo) => campo.placeholder === 'Sin tope') as HTMLInputElement;
      tope.value = '50';
      tope.dispatchEvent(new Event('input', { bubbles: true }));
      render();

      expect(host.fields().maxDiscount).toBe('50');
    });

    it('marcar días de la semana los guarda como texto', () => {
      abrirCondiciones();
      const sabado = Array.from(root().querySelectorAll('[data-testid="regla-condiciones"] label')).find((etiqueta) =>
        etiqueta.textContent?.includes('Sábado'),
      );
      (sabado?.querySelector('input') as HTMLInputElement).click();
      render();

      expect(host.fields().weekdays).toEqual(['6']);
    });

    it('el interruptor de «se puede sumar» cambia la combinabilidad', () => {
      abrirCondiciones();
      const interruptor = root().querySelector('[data-testid="regla-condiciones"] app-switch [role="switch"], [data-testid="regla-condiciones"] app-switch input, [data-testid="regla-condiciones"] app-switch button') as HTMLElement;
      interruptor.click();
      render();

      expect(host.fields().stackable).toBe(false);
    });
  });
});
