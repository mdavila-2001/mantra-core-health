import type { PractitionerCredential } from '../../../core/data-access/profiles/profiles.types';
import type { ConceptLabels } from '../../../core/data-access/terminology/terminology.types';
import type { StatusSealVariant } from '../../../shared/components/organisms/status-seal/status-seal.types';
import { sello } from '../my-profile/practitioner-profile/practitioner-seal';

/* ============================================================================
    Which credentials the required «Títulos» step of the roadmap counts.

    The API's admission catalog requires one credential only: the university
    degree (`TITULO_UNIVERSITARIO`, `itemSubtype: 'DEGREE'`, `minItems: 1`).
    Diplomas, master's, doctorates and specialty degrees are optional there, so
    they never lower the step: they are only mentioned beside it.
    ========================================================================== */

/**
 * The university degree's code in the credential-type catalog: the same code
 * the registration form sends for «Título universitario»
 * (`register-practitioner.ts`). Compared against the concept's code, never its
 * label: the label is translated and rewritten, the code is the contract.
 */
const DEGREE_CREDENTIAL_CODE = 'CREDENTIAL_TYPE_DEGREE';

/** The credentials as the «Títulos» step reads them. */
export interface CredentialsForStep {
  /** One state per university degree, plus `unknown` per credential of unreadable type. */
  readonly required: readonly StatusSealVariant[];
  /** How many other credentials there are: optional, they do not touch the step. */
  readonly optional: number;
}

/**
 * Splits the credentials for the «Títulos» step.
 *
 * A credential whose type the catalog did not resolve counts as `unknown`:
 * without knowing whether it is a degree, it can neither be left out (the step
 * would claim nothing was loaded) nor vouch for the step.
 */
export function splitCredentials(
  credentials: readonly PractitionerCredential[],
  labels: ConceptLabels,
  now: Date,
): CredentialsForStep {
  const required: StatusSealVariant[] = [];
  let optional = 0;
  for (const credential of credentials) {
    const typeCode = labels.get(credential.credentialTypeConceptId)?.code;
    if (typeCode === undefined) {
      required.push('unknown');
    } else if (typeCode !== DEGREE_CREDENTIAL_CODE) {
      optional += 1;
    } else {
      // From the state concept, as in «Mi perfil»: the API also writes
      // `verifiedAt` on a REJECTION, so reading it would call a rejected
      // degree «Verificado». Expiry changes the seal, not the decision.
      required.push(
        credential.expiryDate !== undefined && credential.expiryDate < now
          ? 'expired'
          : sello(labels, credential.stateConceptId),
      );
    }
  }
  return { required, optional };
}

/** « · 2 títulos más, opcionales», to keep the other credentials in sight; empty without them. */
export function optionalCredentialsNote(optional: number): string {
  if (optional === 0) return '';
  return ` · ${optional} ${optional === 1 ? 'título más, opcional' : 'títulos más, opcionales'}`;
}
