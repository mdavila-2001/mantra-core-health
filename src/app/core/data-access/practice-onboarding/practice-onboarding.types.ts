/** La primera sede del centro: dirección en una línea y punto en el mapa. */
export interface NewOrganizationSite {
  readonly name: string;
  readonly addressText: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly cityText?: string;
}

/** Cuerpo de `POST /tenants/{tenantId}/practices`. */
export interface NewOrganizationPractice {
  readonly name: string;
  readonly site: NewOrganizationSite;
}

/** Lo que devuelve la alta: la práctica y su primera sede. */
export interface CreatedOrganizationPractice {
  readonly practiceId: string;
  readonly practiceSiteId: string;
}
