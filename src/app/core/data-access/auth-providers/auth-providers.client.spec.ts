import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthProvidersClient } from './auth-providers.client';

/**
 * Lo que fijan estas pruebas es el contrato con el backend: ruta exacta, verbo
 * y **solo** las claves que los DTOs admiten — `forbidNonWhitelisted` convierte
 * cualquier propiedad de más en un 400.
 */
describe('AuthProvidersClient', () => {
  let client: AuthProvidersClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(AuthProvidersClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('el alta del proveedor manda exactamente lo cargado, sin claves de más', () => {
    client
      .createProvider({ code: 'anses', name: 'ANSES', protocol: 'OIDC', category: 'GOVERNMENT' })
      .subscribe();

    const req = http.expectOne('/auth-providers/identity-providers');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      code: 'anses',
      name: 'ANSES',
      protocol: 'OIDC',
      category: 'GOVERNMENT',
    });

    req.flush({ id: 'p-1', code: 'anses', stateConceptId: 'estado-uuid', isGlobal: false });
  });

  it('la configuración de protocolo cuelga del proveedor y lleva las claves del JWKS anidadas', () => {
    client
      .configureProtocol('p-1', {
        environment: 'PRODUCTION',
        jwksUri: 'https://idp.example/jwks',
        discoveredKeys: [{ keyId: 'k-1', algorithm: 'RS256', publicKey: '-----BEGIN…' }],
      })
      .subscribe();

    const req = http.expectOne('/auth-providers/identity-providers/p-1/protocol-configs');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      environment: 'PRODUCTION',
      jwksUri: 'https://idp.example/jwks',
      discoveredKeys: [{ keyId: 'k-1', algorithm: 'RS256', publicKey: '-----BEGIN…' }],
    });

    req.flush({
      id: 'c-1',
      providerId: 'p-1',
      environmentConceptId: 'entorno-uuid',
      replaced: true,
      importedKeyIds: ['k-uuid'],
    });
  });

  it('publicar una clave exige identificador, algoritmo y clave pública', () => {
    client
      .publishSigningKey('p-1', { keyId: 'k-2', algorithm: 'RS256', publicKey: 'pem' })
      .subscribe();

    const req = http.expectOne('/auth-providers/identity-providers/p-1/signing-keys');
    expect(req.request.body).toEqual({ keyId: 'k-2', algorithm: 'RS256', publicKey: 'pem' });

    req.flush({ id: 'sk-1', keyId: 'k-2', stateConceptId: 'estado-uuid' });
  });

  it('rotar va al segmento plano `rotate`, admite gracia 0 y devuelve la fecha como Date', () => {
    let resultado: { graceUntil?: Date } | undefined;
    client
      .rotateSigningKey('p-1', {
        keyId: 'k-3',
        algorithm: 'RS256',
        publicKey: 'pem',
        // 0 es la rotación de emergencia: la clave saliente muere ya. Que no
        // se pierda por falsy es exactamente lo que fija esta prueba.
        graceHours: 0,
      })
      .subscribe((value) => (resultado = value));

    const req = http.expectOne('/auth-providers/identity-providers/p-1/signing-keys/rotate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      keyId: 'k-3',
      algorithm: 'RS256',
      publicKey: 'pem',
      graceHours: 0,
    });

    req.flush({ newKeyId: 'k-uuid', retiringCount: 2, graceUntil: '2026-08-08T12:00:00.000Z' });
    expect(resultado?.graceUntil).toBeInstanceOf(Date);
  });

  it('una rotación sin gracia informada no inventa la clave `graceUntil`', () => {
    let resultado: object | undefined;
    client
      .rotateSigningKey('p-1', { keyId: 'k-4', algorithm: 'RS256', publicKey: 'pem' })
      .subscribe((value) => (resultado = value));

    http
      .expectOne('/auth-providers/identity-providers/p-1/signing-keys/rotate')
      .flush({ newKeyId: 'k-uuid', retiringCount: 0 });

    expect(resultado).toEqual({ newKeyId: 'k-uuid', retiringCount: 0 });
  });

  it('el mapeo de atributos viaja por PUT: es un reemplazo, no un alta', () => {
    client
      .setAttributeMappings('p-1', {
        mappings: [{ sourceClaim: 'sub', targetAttribute: 'external_subject', isIdentifier: true }],
      })
      .subscribe();

    const req = http.expectOne('/auth-providers/identity-providers/p-1/attribute-mappings');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      mappings: [{ sourceClaim: 'sub', targetAttribute: 'external_subject', isIdentifier: true }],
    });

    req.flush({ providerId: 'p-1', mappingIds: ['m-1'], removed: 3, identifierClaim: 'sub' });
  });

  it('el vínculo con el tenant es plano: proveedor y tenant van en el cuerpo', () => {
    client.bindTenant({ providerId: 'p-1', tenantId: 't-1', autoProvision: true }).subscribe();

    const req = http.expectOne('/auth-providers/tenant-bindings');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ providerId: 'p-1', tenantId: 't-1', autoProvision: true });

    req.flush({ id: 'b-1', providerId: 'p-1', tenantId: 't-1', isEnabled: true, updated: false });
  });

  it('la regla de aprovisionamiento cuelga de su proveedor', () => {
    client.createProvisioningRule('p-1', { priority: 1, effect: 'DENY' }).subscribe();

    const req = http.expectOne('/auth-providers/identity-providers/p-1/provisioning-rules');
    expect(req.request.body).toEqual({ priority: 1, effect: 'DENY' });

    req.flush({ id: 'r-1', priority: 1, effectConceptId: 'efecto-uuid', isActive: true });
  });

  it('el login federado se inicia por código de proveedor y admite cuerpo vacío', () => {
    let inicio: { state: string } | undefined;
    client.startFederatedLogin('anses', {}).subscribe((value) => (inicio = value));

    const req = http.expectOne('/auth-providers/identity-providers/by-code/anses/authorize');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});

    req.flush({
      attemptId: 'a-1',
      state: 'state-1',
      nonce: 'nonce-1',
      authorizeUrl: 'https://idp.example/authorize',
      pkceRequired: true,
    });
    expect(inicio?.state).toBe('state-1');
  });

  it('escapa el código del proveedor en la ruta: es texto libre, no un UUID', () => {
    client.startFederatedLogin('anses/1', {}).subscribe();

    // Sin escapar, la barra abriría un segmento nuevo y la petición iría a otra
    // ruta del backend.
    const req = http.expectOne('/auth-providers/identity-providers/by-code/anses%2F1/authorize');
    req.flush({
      attemptId: 'a-1',
      state: 'state-1',
      nonce: 'nonce-1',
      authorizeUrl: 'https://idp.example/authorize',
      pkceRequired: true,
    });
  });

  it('el callback presenta el state y los claims como objeto, tal cual', () => {
    client
      .processCallback('anses', {
        state: 'state-1',
        externalSubject: 'sujeto-externo',
        claims: { sub: 'sujeto-externo', email: 'a@b.c' },
      })
      .subscribe();

    const req = http.expectOne('/auth-providers/identity-providers/by-code/anses/callback');
    expect(req.request.body).toEqual({
      state: 'state-1',
      externalSubject: 'sujeto-externo',
      claims: { sub: 'sujeto-externo', email: 'a@b.c' },
    });

    req.flush({ outcomeConceptId: 'desenlace-uuid', provisioned: false, attemptId: 'a-1' });
  });

  it('la solicitud de vinculación convierte el vencimiento a fecha de verdad', () => {
    let solicitud: { linkToken: string; expiresAt: Date } | undefined;
    client
      .requestAccountLink({ providerId: 'p-1', externalSubject: 'sujeto-externo' })
      .subscribe((value) => (solicitud = value));

    const req = http.expectOne('/auth-providers/account-link-requests');
    expect(req.request.body).toEqual({ providerId: 'p-1', externalSubject: 'sujeto-externo' });

    req.flush({
      id: 'l-1',
      linkToken: 'token-una-sola-vez',
      expiresAt: '2026-08-07T13:00:00.000Z',
      statusConceptId: 'estado-uuid',
    });
    expect(solicitud?.linkToken).toBe('token-una-sola-vez');
    expect(solicitud?.expiresAt).toBeInstanceOf(Date);
  });

  it('completar la vinculación presenta el token, sin identificadores en la ruta', () => {
    client.completeAccountLink({ linkToken: 'token-una-sola-vez' }).subscribe();

    const req = http.expectOne('/auth-providers/account-link-requests/complete');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ linkToken: 'token-una-sola-vez' });

    req.flush({
      requestId: 'l-1',
      federatedIdentityId: 'f-1',
      userId: 'u-1',
      statusConceptId: 'estado-uuid',
    });
  });

  it('desvincular exige el motivo: queda en la auditoría', () => {
    client.unlinkIdentity('f-1', { reason: 'baja del empleado' }).subscribe();

    const req = http.expectOne('/auth-providers/federated-identities/f-1/unlink');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'baja del empleado' });

    req.flush({ id: 'f-1', stateConceptId: 'estado-uuid', attemptId: 'a-2' });
  });
});
