import { readFileSync } from 'node:fs';

import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { pharmacyOrderDtoFixture } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.spec-fixtures';
import type { PharmacyOrderDto } from '../../../core/data-access/pharmacy-orders/pharmacy-orders.dto';
import type { PharmacySiteRead } from '../../../core/data-access/pharmacy/pharmacy.types';
import { FARMACIA_DETALLE } from '../../../core/data-access/pharmacy/pharmacy.fixtures';
import { ID_PEDIDO_CON_DELIVERY } from '../../../core/mock/fixtures/pedidos-de-farmacia';
import { AlarmaDePedidos } from './alarma-de-pedidos';
import { PharmacyInbox } from './pharmacy-inbox';

describe('PharmacyInbox with the tenant API list', () => {
  let http: HttpTestingController;
  let alarm: {
    sonidoActivo: ReturnType<typeof signal<boolean>>;
    alternarSonido: ReturnType<typeof vi.fn>;
    notificar: ReturnType<typeof vi.fn>;
    descartar: ReturnType<typeof vi.fn>;
    acusarRecibo: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    alarm = {
      sonidoActivo: signal(true),
      alternarSonido: vi.fn(),
      notificar: vi.fn(),
      descartar: vi.fn(),
      acusarRecibo: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // El detalle existe como ruta para que abrir una tarjeta sea un clic
        // de verdad y no una llamada directa al método de la clase.
        provideRouter([{ path: 'administration/pharmacy-orders/:orderId', children: [] }]),
        // `userId` lo lee el carrito (`CartStore`), que el cliente de pedidos inyecta:
        // sin él el efecto del carrito revienta en el primer `detectChanges`.
        { provide: SessionStore, useValue: { displayName: () => 'Ana Pérez', userId: () => null } },
      ],
    });
    TestBed.overrideComponent(PharmacyInbox, {
      set: { providers: [{ provide: AlarmaDePedidos, useValue: alarm }] },
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  /** La petición de la bandeja, con cualquier combinación de filtros. */
  function pedidosRequest() {
    return http.expectOne((request) => request.url === '/pharmacy/orders');
  }

  /**
   * Monta la bandeja. La carga empieza por las sedes —la bandeja abre en la
   * casa matriz—, así que primero se contestan las dos lecturas de farmacia y
   * después la de pedidos. Sin `sedes`, la organización no tiene ninguna.
   */
  function mount(
    items: readonly PharmacyOrderDto[],
    sedes: readonly PharmacySiteRead[] = [],
  ): ComponentFixture<PharmacyInbox> {
    const fixture = TestBed.createComponent(PharmacyInbox);
    fixture.detectChanges();
    if (sedes.length === 0) {
      http.expectOne('/pharmacy/pharmacies').flush({ items: [], count: 0 });
    } else {
      http
        .expectOne('/pharmacy/pharmacies')
        .flush({ items: [{ id: FARMACIA_DETALLE.id }], count: 1 });
      http
        .expectOne(`/pharmacy/pharmacies/${FARMACIA_DETALLE.id}`)
        .flush({ ...FARMACIA_DETALLE, sites: sedes });
    }
    const request = pedidosRequest();
    expect(request.request.method).toBe('GET');
    request.flush({ items, count: items.length });
    fixture.detectChanges();
    return fixture;
  }

  function text(fixture: ComponentFixture<PharmacyInbox>): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('loads the honest empty state without a demo preset gate', () => {
    const fixture = mount([]);
    expect(text(fixture)).toContain('Todavía no llegó ningún pedido');
    expect(text(fixture)).toContain('Sonido de alarma');
    fixture.destroy();
  });

  it('groups real API states and does not expose pickupCode to staff', () => {
    const submitted = pharmacyOrderDtoFixture({ pickupCode: 'SECRET' });
    const ready = pharmacyOrderDtoFixture({
      id: '00000000-0000-4000-8000-000000000009',
      status: { code: 'PINV_ORDER_LISTO_PARA_RETIRO', display: 'Listo' },
      pickupCode: 'ABC234',
    });
    const fixture = mount([submitted, ready]);
    const root = fixture.nativeElement as HTMLElement;
    expect([...root.querySelectorAll('.bandeja__cola')].map((node) => node.getAttribute('aria-label')))
      .toEqual([
        'Nuevos',
        'En revisión',
        'Esperando al paciente',
        'En preparación',
        'Listos para retiro',
        'Cerrados',
      ]);
    expect(text(fixture)).toContain('Ana Paciente');
    expect(text(fixture)).toContain('Amoxicilina');
    expect(text(fixture)).not.toContain('SECRET');
    expect(text(fixture)).not.toContain('ABC234');
    fixture.destroy();
  });

  it('treats the first load as baseline and alarms on a later poll', () => {
    vi.useFakeTimers();
    const initial = pharmacyOrderDtoFixture();
    const fixture = mount([initial]);
    expect(alarm.notificar).not.toHaveBeenCalled();

    vi.advanceTimersByTime(20_000);
    const added = pharmacyOrderDtoFixture({ id: '00000000-0000-4000-8000-000000000009' });
    pedidosRequest().flush({ items: [initial, added], count: 2 });
    fixture.detectChanges();

    expect(alarm.notificar).toHaveBeenCalledWith(1);
    expect(text(fixture)).toContain('Llegó un pedido nuevo');
    fixture.destroy();
  });

  /* ─── Lo que T-I3 suma: contador, cartel, medio de entrega ─────────────── */

  /** Dispara la llegada de un pedido y devuelve la bandeja ya renderizada. */
  function llegaUnPedidoNuevo(): ComponentFixture<PharmacyInbox> {
    vi.useFakeTimers();
    const initial = pharmacyOrderDtoFixture();
    const fixture = mount([initial]);
    vi.advanceTimersByTime(20_000);
    pedidosRequest().flush({
      items: [initial, pharmacyOrderDtoFixture({ id: '00000000-0000-4000-8000-000000000009' })],
      count: 2,
    });
    fixture.detectChanges();
    return fixture;
  }

  it('el conteo por cola es un distintivo, y «Nuevos» con pedidos usa el énfasis propio', () => {
    const fixture = mount([pharmacyOrderDtoFixture()]);
    const root = fixture.nativeElement as HTMLElement;
    const contadores = [...root.querySelectorAll('.bandeja__titulo app-badge')];

    expect(contadores).toHaveLength(6);
    expect(contadores[0]?.classList.contains('badge--primary')).toBe(true);
    expect(contadores[0]?.textContent?.trim()).toBe('1');
    // Las cinco colas vacías no reclaman atención.
    expect(contadores.slice(1).every((nodo) => nodo.classList.contains('badge--secondary'))).toBe(
      true,
    );
    fixture.destroy();
  });

  it('el contador no crea una región viva más: la cifra viaja en palabras', () => {
    const fixture = mount([pharmacyOrderDtoFixture()]);
    const root = fixture.nativeElement as HTMLElement;

    for (const contador of root.querySelectorAll('.bandeja__titulo app-badge')) {
      // `app-badge` es `role="status"`: seis contadores serían seis
      // regiones vivas compitiendo con el aviso único de la bandeja.
      expect(contador.getAttribute('aria-hidden')).toBe('true');
    }
    expect(root.querySelector('.bandeja__titulo .sr-only')?.textContent).toContain('1 pedido');
    fixture.destroy();
  });

  it('la última palabra de la etiqueta y la cifra son una unidad que no se parte', () => {
    const fixture = mount([pharmacyOrderDtoFixture()]);
    const root = fixture.nativeElement as HTMLElement;

    const encabezados = [...root.querySelectorAll('.bandeja__titulo')].map((h2) => {
      const cifra = h2.querySelector('.bandeja__cifra');
      const antes = [...h2.childNodes]
        .filter((nodo) => nodo.nodeType === 3)
        .map((nodo) => nodo.textContent ?? '')
        .join('');
      return {
        antes: antes.trim(),
        unidad: cifra?.firstChild?.textContent?.trim() ?? '',
        conCifra: cifra?.querySelector('app-badge') !== null,
      };
    });

    // Lo que queda fuera de la unidad puede envolver; lo de adentro, no.
    expect(encabezados).toEqual([
      { antes: '', unidad: 'Nuevos', conCifra: true },
      { antes: 'En', unidad: 'revisión', conCifra: true },
      { antes: 'Esperando al', unidad: 'paciente', conCifra: true },
      { antes: 'En', unidad: 'preparación', conCifra: true },
      { antes: 'Listos para', unidad: 'retiro', conCifra: true },
      { antes: '', unidad: 'Cerrados', conCifra: true },
    ]);
    fixture.destroy();
  });

  it('partir la etiqueta no le cambia una palabra ni le come el espacio', () => {
    const fixture = mount([pharmacyOrderDtoFixture()]);
    const root = fixture.nativeElement as HTMLElement;
    const leido = [...root.querySelectorAll('.bandeja__titulo')].map((h2) =>
      (h2.textContent ?? '').replace(/\s+/gu, ' ').trim(),
    );

    expect(leido[2]).toContain('Esperando al paciente');
    expect(leido[4]).toContain('Listos para retiro');
    fixture.destroy();
  });

  it('la regla que sostiene esa unidad sigue en la hoja, no es adorno', () => {
    // Se lee el CSS porque jsdom no maqueta: si alguien borra el `nowrap` por
    // parecerle decorativo, el contador vuelve a irse solo a la línea de abajo
    // y ninguna prueba de DOM se entera.
    const hoja = readFileSync(
      'src/app/features/organization/pharmacy-inbox/pharmacy-inbox.css',
      'utf8',
    ).replace(/\s+/gu, ' ');

    expect(hoja).toContain('.bandeja__cifra { white-space: nowrap; }');
  });

  it('el cartel de pedidos nuevos aparece al llegar uno y no antes', () => {
    const fixture = mount([pharmacyOrderDtoFixture()]);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="bandeja-cartel-nuevos"]')).toBeNull();
    fixture.destroy();

    const conNuevo = llegaUnPedidoNuevo();
    expect(
      (conNuevo.nativeElement as HTMLElement).querySelector('[data-testid="bandeja-cartel-nuevos"]'),
    ).not.toBeNull();
    conNuevo.destroy();
  });

  it('los dos canales del aviso llevan la misma cuenta, no una cada uno', () => {
    vi.useFakeTimers();
    const inicial = pharmacyOrderDtoFixture();
    const fixture = mount([inicial]);
    const root = fixture.nativeElement as HTMLElement;
    const items = [inicial];

    // Dos llegadas de a UNA: el delta del tic siempre dice «un pedido», pero
    // sin acusar recibo hay dos esperando.
    for (const id of [
      '00000000-0000-4000-8000-000000000009',
      '00000000-0000-4000-8000-00000000000b',
    ]) {
      items.push(pharmacyOrderDtoFixture({ id }));
      vi.advanceTimersByTime(20_000);
      pedidosRequest().flush({ items: [...items], count: items.length });
      fixture.detectChanges();
    }

    const anuncio = root.querySelector('[data-testid="bandeja-aviso"]')?.textContent ?? '';
    const cartel = root.querySelector('[data-testid="bandeja-cartel-nuevos"]')?.textContent ?? '';
    expect(anuncio).toContain('Llegaron 2 pedidos nuevos');
    expect(cartel).toContain('Llegaron 2 pedidos nuevos');
    fixture.destroy();
  });

  it('el cartel no se va solo: se va cuando el mostrador lo descarta', () => {
    const fixture = llegaUnPedidoNuevo();
    const root = fixture.nativeElement as HTMLElement;
    const cartel = root.querySelector('[data-testid="bandeja-cartel-nuevos"]');

    // Otro tic sin novedades no lo borra: nadie acusó recibo todavía.
    vi.advanceTimersByTime(20_000);
    pedidosRequest().flush({ items: [], count: 0 });
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="bandeja-cartel-nuevos"]')).not.toBeNull();

    cartel?.querySelector<HTMLButtonElement>('.alert__dismiss')?.click();
    fixture.detectChanges();
    expect(root.querySelector('[data-testid="bandeja-cartel-nuevos"]')).toBeNull();
    fixture.destroy();
  });

  it('abrir un pedido también acusa recibo del cartel', () => {
    const fixture = llegaUnPedidoNuevo();
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLAnchorElement>('[data-testid="bandeja-pedido"]')?.click();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="bandeja-cartel-nuevos"]')).toBeNull();
    fixture.destroy();
  });

  it('la tarjeta dice por qué medio se entrega', () => {
    const fixture = mount([pharmacyOrderDtoFixture()]);
    const root = fixture.nativeElement as HTMLElement;
    const chips = [...root.querySelectorAll('.bandeja__entrega app-chip')];

    // Un pedido común trae su medio del contrato: un solo chip, sin rótulo.
    expect(chips.map((nodo) => nodo.textContent?.trim())).toEqual(['Recojo en mostrador']);
    // El ámbar es el punto de acción único del sistema: acá no va.
    expect(chips[0]?.classList.contains('tone--warning')).toBe(false);
    fixture.destroy();
  });

  it('un pedido a domicilio se ve como delivery por lo que dice el contrato, sin rótulo de maqueta', () => {
    const fixture = mount([
      pharmacyOrderDtoFixture({
        id: ID_PEDIDO_CON_DELIVERY,
        deliveryMode: { code: 'PINV_DELIVERY_DOMICILIO', display: 'Entrega a domicilio' },
      }),
    ]);
    const root = fixture.nativeElement as HTMLElement;
    const chips = [...root.querySelectorAll('.bandeja__entrega app-chip')];

    expect(chips.map((nodo) => nodo.textContent?.trim())).toEqual(['Delivery']);
    expect(text(fixture)).not.toContain('Datos de ejemplo');
    expect(chips[0]?.classList.contains('tone--info')).toBe(true);
    fixture.destroy();
  });

  it('el interruptor de sonido dice en palabras en qué estado quedó', () => {
    const fixture = mount([pharmacyOrderDtoFixture()]);
    const root = fixture.nativeElement as HTMLElement;
    const etiqueta = (): string =>
      root.querySelector('[data-testid="bandeja-estado-sonido"]')?.textContent?.trim() ?? '';

    expect(etiqueta()).toBe('Aviso sonoro activado');
    alarm.sonidoActivo.set(false);
    fixture.detectChanges();
    expect(etiqueta()).toBe('Aviso sonoro silenciado');
    fixture.destroy();
  });
  /* ─── El tablero: sede por defecto, fechas de «Cerrados», tope ─────────── */

  const SEDE_NORTE: PharmacySiteRead = {
    id: '00000000-0000-4000-8000-0000000000a1',
    code: 'S1',
    name: 'Sucursal Norte',
    addressText: null,
    latitude: null,
    longitude: null,
  };
  const SEDE_MATRIZ: PharmacySiteRead = {
    id: '00000000-0000-4000-8000-0000000000a2',
    code: 'S2',
    name: 'Casa matriz',
    addressText: null,
    latitude: null,
    longitude: null,
    isHeadOffice: true,
  };

  const DIA_MS = 86_400_000;
  const hace = (dias: number) => new Date(Date.now() - dias * DIA_MS).toISOString();

  function pedido(
    id: string,
    estado: string,
    paciente: string,
    creado: string,
  ): PharmacyOrderDto {
    return pharmacyOrderDtoFixture({
      id,
      status: { code: `PINV_ORDER_${estado}`, display: estado },
      patientName: paciente,
      createdAt: creado,
    });
  }

  function sedeSelect(fixture: ComponentFixture<PharmacyInbox>) {
    return fixture.debugElement.query(By.css('[data-testid="bandeja-filtro-sede"]'));
  }

  it('abre en la casa matriz y le pide al servidor sólo esa sede', () => {
    const fixture = TestBed.createComponent(PharmacyInbox);
    fixture.detectChanges();
    http.expectOne('/pharmacy/pharmacies').flush({ items: [{ id: FARMACIA_DETALLE.id }], count: 1 });
    http
      .expectOne(`/pharmacy/pharmacies/${FARMACIA_DETALLE.id}`)
      .flush({ ...FARMACIA_DETALLE, sites: [SEDE_NORTE, SEDE_MATRIZ] });

    const request = pedidosRequest();
    expect(request.request.params.get('siteId')).toBe(SEDE_MATRIZ.id);
    expect(request.request.params.get('limit')).toBe('500');
    request.flush({ items: [], count: 0 });
    fixture.detectChanges();

    expect(sedeSelect(fixture)).not.toBeNull();
    expect(text(fixture)).not.toContain('Ninguna sede está marcada');
    fixture.destroy();
  });

  it('sin casa matriz marcada abre con la primera sede y lo dice', () => {
    const fixture = TestBed.createComponent(PharmacyInbox);
    fixture.detectChanges();
    http.expectOne('/pharmacy/pharmacies').flush({ items: [{ id: FARMACIA_DETALLE.id }], count: 1 });
    http
      .expectOne(`/pharmacy/pharmacies/${FARMACIA_DETALLE.id}`)
      .flush({ ...FARMACIA_DETALLE, sites: [{ ...SEDE_MATRIZ, isHeadOffice: false }, SEDE_NORTE] });

    const request = pedidosRequest();
    expect(request.request.params.get('siteId')).toBe(SEDE_NORTE.id);
    request.flush({ items: [], count: 0 });
    fixture.detectChanges();

    expect(text(fixture)).toContain('Ninguna sede está marcada como casa matriz');
    fixture.destroy();
  });

  it('con una sola sede no hay selector de sede, pero sí de fechas', () => {
    const fixture = mount([pharmacyOrderDtoFixture()], [SEDE_NORTE]);
    expect(sedeSelect(fixture)).toBeNull();
    expect(
      fixture.debugElement.query(By.css('[data-testid="bandeja-filtro-cerrados"]')),
    ).not.toBeNull();
    fixture.destroy();
  });

  it('cambiar de sede vuelve a pedir, y lo que hay en la otra no suena como nuevo', () => {
    const fixture = mount([pharmacyOrderDtoFixture()], [SEDE_NORTE, SEDE_MATRIZ]);

    sedeSelect(fixture).triggerEventHandler('valueChange', SEDE_NORTE.id);
    const otra = pedidosRequest();
    expect(otra.request.params.get('siteId')).toBe(SEDE_NORTE.id);
    otra.flush({
      items: [pharmacyOrderDtoFixture({ id: '00000000-0000-4000-8000-000000000009' })],
      count: 1,
    });
    fixture.detectChanges();

    expect(alarm.notificar).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('elegir «Todas las sedes» pide sin filtrar por sede', () => {
    const fixture = mount([], [SEDE_NORTE, SEDE_MATRIZ]);
    sedeSelect(fixture).triggerEventHandler('valueChange', 'all');
    const todas = pedidosRequest();
    expect(todas.request.params.has('siteId')).toBe(false);
    todas.flush({ items: [], count: 0 });
    fixture.destroy();
  });

  it('la fecha recorta sólo «Cerrados»: lo pendiente de hace días sigue en su cola', () => {
    const fixture = mount([
      pedido('00000000-0000-4000-8000-0000000000b1', 'ENVIADO', 'Pendiente Vieja', hace(10)),
      pedido('00000000-0000-4000-8000-0000000000b2', 'RETIRADO', 'Cerrado Hoy', hace(0)),
      pedido('00000000-0000-4000-8000-0000000000b3', 'RETIRADO', 'Cerrado Antiguo', hace(10)),
    ]);

    expect(text(fixture)).toContain('Pendiente Vieja');
    expect(text(fixture)).toContain('Cerrado Hoy');
    expect(text(fixture)).not.toContain('Cerrado Antiguo');

    // Es del lado del cliente: no vuelve a pedir nada.
    fixture.debugElement
      .query(By.css('[data-testid="bandeja-filtro-cerrados"]'))
      .triggerEventHandler('valueChange', 'all');
    fixture.detectChanges();
    http.expectNone((request) => request.url === '/pharmacy/orders');
    expect(text(fixture)).toContain('Cerrado Antiguo');
    fixture.destroy();
  });

  it('la columna de cerrados dice de qué fechas es', () => {
    const fixture = mount([pharmacyOrderDtoFixture()]);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="bandeja-recorte"]')
        ?.textContent,
    ).toContain('Hoy');
    fixture.destroy();
  });

  it('avisa cuando volvieron tantos pedidos como el tope: puede haber más', () => {
    const muchos = Array.from({ length: 500 }, (_, i) =>
      pedido(
        `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        'EN_REVISION',
        `Paciente ${i}`,
        hace(1),
      ),
    );
    const fixture = mount(muchos);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="bandeja-cortado"]'),
    ).not.toBeNull();
    fixture.destroy();
  });

  it('el tablero se desplaza por dentro: tope de alto por columna y scroll horizontal', () => {
    // jsdom no maqueta: se lee la hoja para que nadie borre el tope por
    // parecer decorativo y el tablero vuelva a estirar la página.
    const hoja = readFileSync(
      'src/app/features/organization/pharmacy-inbox/pharmacy-inbox.css',
      'utf8',
    ).replace(/\s+/gu, ' ');

    expect(hoja).toMatch(/\.bandeja__lista \{[^}]*max-height:[^}]*overflow-y: auto/u);
    expect(hoja).toMatch(/\.bandeja__colas \{[^}]*grid-auto-flow: column[^}]*overflow-x: auto/u);
  });
});
