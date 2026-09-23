import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Observable, Subject, defer, switchMap } from 'rxjs';

import { RefreshTokenStorage } from '../auth/refresh-token.storage';
import { SessionStore } from '../auth/session.store';
import { CrossTabLock } from './cross-tab-lock';
import { SessionBroadcast } from './session-broadcast';
import { TokenRefreshService } from './token-refresh.service';

/**
 * Lock que no concede el turno hasta que la prueba lo diga.
 *
 * En jsdom `navigator.locks` no existe, así que el `CrossTabLock` real devuelve
 * la fuente sin envolver y **la espera entre pestañas desaparece**. Justamente
 * lo que hay que poder simular es esa espera: lo que el servicio hace antes de
 * entrar al lock y lo que hace ya dentro no son lo mismo, y sin una espera de
 * verdad los dos casos se ven idénticos.
 */
class LockControlado {
  /** Se emite cuando la prueba concede el turno. */
  readonly turno = new Subject<void>();

  withLock<T>(_name: string, source: Observable<T>): Observable<T> {
    // `defer` es la clave: la fuente no se toca hasta que llega el turno, igual
    // que con un lock de verdad en disputa.
    return defer(() => this.turno).pipe(switchMap(() => source));
  }
}

/**
 * La garantía de este servicio es **una sola petición de refresco en vuelo**, y
 * es exactamente la clase de propiedad que un refactor rompe sin que nada
 * avise: el código sigue compilando y las pantallas siguen funcionando, hasta
 * que tres 401 simultáneos gastan tres de los 20 intentos por minuto que admite
 * la API y rotan el token unos sobre otros.
 */
function jwt(payload: Record<string, unknown>): string {
  /**
   * base64url **sobre UTF-8**, como el token real.
   *
   * `btoa(JSON.stringify(...))` a secas no sirve: es Latin-1, así que un nombre
   * con acentos sale como un byte que no es UTF-8 válido y `decodeAccessToken`
   * —que decodifica con `TextDecoder`, precisamente para que los acentos no se
   * rompan— devuelve un carácter de reemplazo. El defecto sería del doble de
   * prueba, no del código.
   */
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    const binario = String.fromCharCode(...bytes);
    return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

const TOKEN = jwt({ sub: 'u-1', roles: [], tenants: ['t-1'] });

describe('TokenRefreshService', () => {
  let refresher: TokenRefreshService;
  let session: SessionStore;
  let storage: RefreshTokenStorage;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    refresher = TestBed.inject(TokenRefreshService);
    session = TestBed.inject(SessionStore);
    storage = TestBed.inject(RefreshTokenStorage);
    http = TestBed.inject(HttpTestingController);

    session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
  });

  afterEach(() => {
    http.verify();
  });

  function responderRefresco(refreshToken = 'r-2') {
    http.expectOne((request) => request.url.endsWith('/iam/auth/token/refresh')).flush({
      accessToken: TOKEN,
      refreshToken,
      expiresAt: '2026-08-01T12:00:00.000Z',
    });
  }

  it('tres llamadas concurrentes producen UNA sola petición', () => {
    refresher.refresh().subscribe();
    refresher.refresh().subscribe();
    refresher.refresh().subscribe();

    // `expectOne` falla si hubiera más de una: es la aserción.
    responderRefresco();
  });

  it('las tres reciben la misma sesión', () => {
    const recibidos: string[] = [];
    refresher.refresh().subscribe((s) => recibidos.push(s.refreshToken));
    refresher.refresh().subscribe((s) => recibidos.push(s.refreshToken));
    refresher.refresh().subscribe((s) => recibidos.push(s.refreshToken));

    responderRefresco('r-nuevo');

    expect(recibidos).toEqual(['r-nuevo', 'r-nuevo', 'r-nuevo']);
  });

  it('renueva los tokens del store', () => {
    refresher.refresh().subscribe();
    responderRefresco('r-nuevo');

    expect(session.refreshToken()).toBe('r-nuevo');
  });

  it('libera el hueco tras completar: un refresco posterior vuelve a pedir', () => {
    refresher.refresh().subscribe();
    responderRefresco();

    refresher.refresh().subscribe();
    responderRefresco('r-3');
  });

  /**
   * El caso que motiva el `finalize`: si el hueco quedara ocupado tras un
   * fallo, **ningún intento posterior podría refrescar en toda la sesión**.
   */
  it('libera el hueco tras un fallo', () => {
    refresher.refresh().subscribe({ error: () => undefined });
    http
      .expectOne((request) => request.url.endsWith('/iam/auth/token/refresh'))
      .flush({ code: 'UNAUTHENTICATED' }, { status: 401, statusText: 'Unauthorized' });

    // Si el hueco no se hubiera liberado, esto no dispararía ninguna petición
    // y `expectOne` fallaría.
    refresher.refresh().subscribe({ error: () => undefined });
    responderRefresco();
  });

  it('sin refresh token falla sin gastar una petición', () => {
    session.clear();

    let error: unknown = null;
    refresher.refresh().subscribe({ error: (e: unknown) => (error = e) });

    expect(error).toBeInstanceOf(Error);
    // `http.verify()` en `afterEach` comprueba que no salió ninguna petición.
  });

  /**
   * El defecto que vivía suelto: `renew` sólo tocaba el store en memoria.
   * Sin esto, recargar la página después de **cualquier** refresco normal
   * —uno por sesión, no hace falta una segunda pestaña— presentaba el token
   * anterior a esa rotación, ya usado, y el servidor lo rechazaba por reuso
   * (MCH-005): la persona quedaba deslogueada al recargar.
   */
  it('persiste el refresh token nuevo, no sólo lo deja en memoria', () => {
    refresher.refresh().subscribe();
    responderRefresco('r-persistido');

    expect(storage.read()).toBe('r-persistido');
  });

  /**
   * El caso de dos pestañas (MCH-016/carril C): esta pestaña capturó `r-1`,
   * pero mientras tanto otra ya rotó y dejó `r-de-otra-pestana` en
   * `localStorage`. Presentar `r-1` de nuevo lo trataría el servidor como
   * reuso y revocaría la sesión — por eso el tramo de red relee el storage
   * antes de pedir, y presenta el más nuevo en vez del que esta pestaña tenía
   * en memoria.
   */
  it('si storage ya tiene un token más nuevo que el capturado, presenta ése', () => {
    storage.write('r-de-otra-pestana');

    refresher.refresh().subscribe();

    const peticion = http.expectOne((request) => request.url.endsWith('/iam/auth/token/refresh'));
    expect(peticion.request.body).toEqual({ refreshToken: 'r-de-otra-pestana' });
    peticion.flush({
      accessToken: TOKEN,
      refreshToken: 'r-3',
      expiresAt: '2026-08-01T12:00:00.000Z',
    });
  });
});

/**
 * Lo que pasa mientras esta pestaña **espera el lock**.
 *
 * Con el lock real no hay forma de que la otra pestaña rote antes que nosotros
 * si no esperamos; con `LockControlado` la espera es explícita y se puede
 * intercalar lo que hace la otra pestaña en el medio. Los dos casos de acá son
 * los que distinguen «serializado» de «serializado y sin refrescos de más».
 */
describe('TokenRefreshService · lo que ocurre mientras se espera el lock', () => {
  let refresher: TokenRefreshService;
  let session: SessionStore;
  let storage: RefreshTokenStorage;
  let broadcast: SessionBroadcast;
  let lock: LockControlado;
  let http: HttpTestingController;

  beforeEach(() => {
    lock = new LockControlado();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CrossTabLock, useValue: lock as unknown as CrossTabLock },
      ],
    });

    refresher = TestBed.inject(TokenRefreshService);
    session = TestBed.inject(SessionStore);
    storage = TestBed.inject(RefreshTokenStorage);
    broadcast = TestBed.inject(SessionBroadcast);
    http = TestBed.inject(HttpTestingController);

    session.start({ accessToken: TOKEN, refreshToken: 'r-1' });
    storage.write('r-1');
  });

  afterEach(() => {
    http.verify();
  });

  /**
   * El defecto: la relectura de `localStorage` ocurría al **construir** el
   * observable, o sea antes de pedir el lock. Para cuando llegaba el turno, el
   * token que iba a presentar ya estaba decidido — y si otra pestaña había
   * rotado en el medio, era uno ya gastado. El servidor lo trata como reuso y
   * revoca la sesión entera: exactamente lo que el lock venía a evitar.
   *
   * Serializar sin releer dentro del lock no sirve de nada.
   */
  it('relee el token DESPUÉS de obtener el turno, no antes de esperarlo', () => {
    refresher.refresh().subscribe();

    // Mientras esperamos el turno, la otra pestaña rota y deja el suyo.
    storage.write('r-de-la-otra-pestana');

    lock.turno.next();

    const peticion = http.expectOne((request) => request.url.endsWith('/iam/auth/token/refresh'));
    expect(peticion.request.body).toEqual({ refreshToken: 'r-de-la-otra-pestana' });
    peticion.flush({
      accessToken: TOKEN,
      refreshToken: 'r-3',
      expiresAt: '2026-08-01T12:00:00.000Z',
    });
  });

  /**
   * La otra mitad del criterio de aceptación: dos pestañas que refrescan a la
   * vez terminan ambas con sesión válida **y con un solo refresco contra el
   * backend**. Serializar sólo garantizaba lo primero; cada pestaña seguía
   * gastando su propio viaje de red, y con veinte intentos por minuto eso se
   * nota con varias pestañas abiertas.
   *
   * Si la pestaña que ganó el turno publicó su sesión y esa sesión es la que
   * está vigente en `localStorage`, no hay nada que pedir: se adopta.
   */
  it('adopta la sesión que publicó otra pestaña sin gastar un refresco', () => {
    const recibidas: string[] = [];
    refresher.refresh().subscribe((s) => recibidas.push(s.refreshToken));

    // La otra pestaña completó su refresco: persistió y publicó.
    const nueva = {
      accessToken: TOKEN,
      refreshToken: 'r-de-la-otra-pestana',
      expiresAt: new Date('2026-08-01T12:00:00.000Z'),
    };
    storage.write(nueva.refreshToken);
    broadcast.recibir(nueva);

    lock.turno.next();

    // `http.verify()` en `afterEach` es la aserción: no salió ninguna petición.
    expect(recibidas).toEqual(['r-de-la-otra-pestana']);
    expect(session.refreshToken()).toBe('r-de-la-otra-pestana');
  });

  /**
   * La adopción no puede ser un atajo silencioso: si lo publicado no es lo que
   * está vigente —una publicación vieja, de una rotación anterior—, hay que
   * pedir igual. Adoptar un token ya gastado sería el mismo fallo de reuso, y
   * más difícil de ver.
   */
  it('no adopta una publicación que ya no es la vigente', () => {
    refresher.refresh().subscribe();

    broadcast.recibir({
      accessToken: TOKEN,
      refreshToken: 'r-viejo-publicado',
      expiresAt: new Date('2026-08-01T12:00:00.000Z'),
    });
    storage.write('r-el-que-de-verdad-vale');

    lock.turno.next();

    const peticion = http.expectOne((request) => request.url.endsWith('/iam/auth/token/refresh'));
    expect(peticion.request.body).toEqual({ refreshToken: 'r-el-que-de-verdad-vale' });
    peticion.flush({
      accessToken: TOKEN,
      refreshToken: 'r-4',
      expiresAt: '2026-08-01T12:00:00.000Z',
    });
  });

  /** Sin nadie más rotando, el comportamiento de siempre: se pide. */
  it('sin rotación ajena, refresca normalmente', () => {
    refresher.refresh().subscribe();
    lock.turno.next();

    const peticion = http.expectOne((request) => request.url.endsWith('/iam/auth/token/refresh'));
    expect(peticion.request.body).toEqual({ refreshToken: 'r-1' });
    peticion.flush({
      accessToken: TOKEN,
      refreshToken: 'r-2',
      expiresAt: '2026-08-01T12:00:00.000Z',
    });
  });
});
