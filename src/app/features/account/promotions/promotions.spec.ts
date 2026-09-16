import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError, type Observable } from 'rxjs';

import { environment } from '../../../../environments/environment';
import { routes } from '../../../app.routes';
import { APP_SECTIONS } from '../../../core/navigation/navigation.map';
import { NAV_SUBGROUPS } from '../../../core/navigation/navigation.subgroups';
import { seccionRolesGuard } from '../../../core/navigation/section-roles.guard';
import {
  CAMPANAS_SEMBRADAS,
  idSembrado,
} from '../../../core/data-access/pharmacy-campaigns/pharmacy-campaigns.fixtures';
import { Promotions, PROMOCIONES_RECIBIDAS } from './promotions';
import {
  FARMACIA_DE_EJEMPLO,
  promocionesRecibidasDeEjemplo,
  type PromocionRecibida,
} from './promotions.fixtures';

/**
 * «Promociones» (T-E7). Lo que se fija: la lista pinta una tarjeta por
 * promoción y un ejemplo compacto de notificación; carga, vacío y error pasan
 * por `ViewStateHost`; con `campaignsDemo` apagado no aparece nada inventado; y
 * el fixture habla de campañas, no de la salud de la persona.
 */

/** El texto como lo lee una persona: sin los saltos de la plantilla. */
function normalizado(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\s+/g, ' ').trim();
}

describe('Promotions', () => {
  let fixture: ComponentFixture<Promotions>;
  let llamadas: number;

  function montarCon(fuente: () => Observable<readonly PromocionRecibida[]>): void {
    llamadas = 0;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: PROMOCIONES_RECIBIDAS,
          useValue: () => {
            llamadas += 1;
            return fuente();
          },
        },
      ],
    });
    fixture = TestBed.createComponent(Promotions);
    fixture.detectChanges();
  }

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function porTestId(id: string): HTMLElement | null {
    return raiz().querySelector(`[data-testid="${id}"]`);
  }

  function tarjetas(variante: 'completa' | 'compacta'): NodeListOf<HTMLElement> {
    return raiz().querySelectorAll(
      `[data-testid="promocion-tarjeta"][data-variante="${variante}"]`,
    );
  }

  it('lista una tarjeta completa por promoción, con chip DEMO', () => {
    const promociones = promocionesRecibidasDeEjemplo();
    montarCon(() => of(promociones));

    expect(porTestId('promociones-lista')).not.toBeNull();
    expect(tarjetas('completa').length).toBe(promociones.length);
    expect(normalizado(porTestId('promociones-chip-demo')?.textContent)).toBe(
      'DEMO — promociones de ejemplo',
    );
    const enlaces = [...raiz().querySelectorAll('[data-testid="promociones-lista"] a')].map(
      (enlace) => enlace.getAttribute('href'),
    );
    expect(enlaces).toEqual(promociones.map((p) => `/promotions/${p.campaignId}`));
  });

  it('dibuja la notificación compacta con la primera promoción vigente', () => {
    const [nueva, vista, vencida] = promocionesRecibidasDeEjemplo();
    montarCon(() => of([vencida, vista, nueva]));

    const compactas = tarjetas('compacta');
    expect(compactas.length).toBe(1);
    expect(normalizado(compactas[0].textContent)).toContain(vista.titulo);
  });

  it('sin promociones vigentes no dibuja la notificación de ejemplo', () => {
    const [, , vencida] = promocionesRecibidasDeEjemplo();
    montarCon(() => of([vencida]));

    expect(tarjetas('completa').length).toBe(1);
    expect(porTestId('promociones-notificacion')).toBeNull();
  });

  it('mientras carga muestra el estado de carga, sin tarjetas', () => {
    montarCon(() => NEVER);

    expect(raiz().querySelector('.view-state-host__loading')).not.toBeNull();
    expect(tarjetas('completa').length).toBe(0);
  });

  it('sin promociones dice que todavía no llegó ninguna, con una salida', () => {
    montarCon(() => of([]));

    const leido = normalizado(raiz().textContent);
    expect(leido).toContain('Todavía no recibiste promociones de ninguna farmacia.');
    expect(leido).toContain('Buscar farmacias');
    expect(porTestId('promociones-lista')).toBeNull();
    expect(porTestId('promociones-chip-demo')).toBeNull();
  });

  it('con error lo dice y reintentar vuelve a pedir', () => {
    montarCon(() => throwError(() => new Error('falló')));

    expect(normalizado(raiz().textContent)).toContain('Algo salió mal');
    expect(tarjetas('completa').length).toBe(0);

    const reintentar = [...raiz().querySelectorAll('button')].find(
      (boton) => normalizado(boton.textContent) === 'Reintentar',
    );
    expect(reintentar).toBeDefined();
    reintentar?.click();
    fixture.detectChanges();

    expect(llamadas).toBe(2);
  });
});

/**
 * La fuente por defecto. `campaignsDemo` se restaura al final porque el entorno
 * es un solo objeto para toda la corrida.
 */
describe('Promotions con la fuente por defecto', () => {
  const entorno = environment as { campaignsDemo: boolean };
  const original = entorno.campaignsDemo;

  afterEach(() => {
    entorno.campaignsDemo = original;
  });

  function montar(): HTMLElement {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Promotions);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('con campaignsDemo encendido muestra las promociones de ejemplo', () => {
    entorno.campaignsDemo = true;
    const raiz = montar();

    expect(
      raiz.querySelectorAll('[data-testid="promocion-tarjeta"][data-variante="completa"]').length,
    ).toBe(promocionesRecibidasDeEjemplo().length);
  });

  it('con campaignsDemo apagado no inventa nada: queda vacía', () => {
    entorno.campaignsDemo = false;
    const raiz = montar();

    expect(raiz.querySelector('[data-testid="promocion-tarjeta"]')).toBeNull();
    expect(normalizado(raiz.textContent)).toContain('Todavía no recibiste promociones');
  });
});

/**
 * El registro de la sección: una sola entrada en el menú, sólo para pacientes,
 * dentro de «Mis gestiones», y la ruta carga esta pantalla y no el placeholder.
 */
describe('Promotions en la navegación', () => {
  const PATH = 'my-account/promotions';

  it('aparece una sola vez en APP_SECTIONS, restringida a PATIENT', () => {
    const secciones = APP_SECTIONS.filter((section) => section.path === PATH);

    expect(secciones.length).toBe(1);
    expect(secciones[0].roles).toEqual(['PATIENT']);
    expect(secciones[0].group).toBe('Mi cuenta');
  });

  it('está una sola vez en «Mis gestiones», junto a lo que ya estaba', () => {
    const conElPath = NAV_SUBGROUPS.filter((subgrupo) => subgrupo.paths.includes(PATH));

    expect(conElPath.map((subgrupo) => subgrupo.label)).toEqual(['Mis gestiones']);
    expect(conElPath[0].paths.filter((path) => path === PATH).length).toBe(1);
    expect(conElPath[0].paths).toEqual(
      expect.arrayContaining([
        'my-account/appointments',
        'my-account/pharmacy-orders',
        'my-account/loyalty',
      ]),
    );
  });

  it('la ruta carga Promotions, detrás del guard de roles', async () => {
    const armazon = routes.find(
      (route) => route.path === '' && route.component !== undefined && route.children !== undefined,
    );
    const ruta = armazon?.children?.find((route) => route.path === PATH);

    expect(ruta).toBeDefined();
    expect(ruta?.canActivate).toContain(seccionRolesGuard);
    const componente = await (ruta?.loadComponent as () => Promise<unknown>)();
    expect(componente).toBe(Promotions);
  });
});

describe('promocionesRecibidasDeEjemplo', () => {
  const AHORA = new Date('2026-09-16T12:00:00');

  it('título, descuento y id salen de las campañas sembradas, no de copias', () => {
    for (const promocion of promocionesRecibidasDeEjemplo(AHORA)) {
      const plantilla = CAMPANAS_SEMBRADAS.find(
        (candidata) => idSembrado(candidata.slug, FARMACIA_DE_EJEMPLO.id) === promocion.campaignId,
      );
      expect(plantilla).toBeDefined();
      expect(promocion.titulo).toBe(plantilla?.titulo);
      expect(promocion.porcentaje).toBe(plantilla?.porcentaje);
    }
  });

  it('el estado es coherente con la vigencia', () => {
    for (const promocion of promocionesRecibidasDeEjemplo(AHORA)) {
      const termino = promocion.hasta.getTime() < AHORA.getTime();
      expect(promocion.estado === 'vencida').toBe(termino);
    }
  });

  it('cubre nueva con puntos x2, lote próximo a vencer y vencida', () => {
    const [nueva, lote, vencida] = promocionesRecibidasDeEjemplo(AHORA);

    expect(nueva.estado).toBe('nueva');
    expect(nueva.factorDePuntos).toBe('2');
    expect(lote.motivo).toBe('lote-proximo-a-vencer');
    expect(vencida.estado).toBe('vencida');
  });

  it('no trae ningún campo ni texto sobre la salud de la persona', () => {
    const CAMPOS = [
      'campaignId',
      'desde',
      'estado',
      'factorDePuntos',
      'farmacia',
      'hasta',
      'id',
      'medicamento',
      'motivo',
      'porcentaje',
      'titulo',
    ];
    for (const promocion of promocionesRecibidasDeEjemplo(AHORA)) {
      expect(Object.keys(promocion).sort()).toEqual(CAMPOS);
      expect(JSON.stringify(promocion)).not.toMatch(
        /diagn[oó]stic|tratamiento|diabet|condici[oó]n|padec/i,
      );
    }
  });
});
