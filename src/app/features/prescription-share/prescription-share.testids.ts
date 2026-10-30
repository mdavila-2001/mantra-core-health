/**
 * Ids de prueba de la receta compartida (FAR-01): las dos páginas públicas,
 * el diálogo «Compartir» y la lista de enlaces de «Mis recetas».
 *
 * Misma forma que `PHARMACY_TESTIDS`: clave camelCase, valor kebab-case con el
 * prefijo `prescription-share-`, en inglés como el resto de los `data-testid`.
 */
export const PRESCRIPTION_SHARE_TESTIDS = {
  publicPage: 'prescription-share-public-page',
  publicStatus: 'prescription-share-public-status',
  publicIssuer: 'prescription-share-public-issuer',
  publicItemCount: 'prescription-share-public-item-count',
  publicNotFound: 'prescription-share-public-not-found',
  verifyPage: 'prescription-share-verify-page',
  verifyStatus: 'prescription-share-verify-status',
  verifyLicense: 'prescription-share-verify-license',
  verifyHash: 'prescription-share-verify-hash',
  verifySealInstruction: 'prescription-share-verify-seal-instruction',
  verifyNotFound: 'prescription-share-verify-not-found',
  shareButton: 'prescription-share-button',
  dialog: 'prescription-share-dialog',
  dialogQr: 'prescription-share-dialog-qr',
  dialogUrl: 'prescription-share-dialog-url',
  dialogExpiry: 'prescription-share-dialog-expiry',
  dialogNativeShare: 'prescription-share-dialog-native-share',
  dialogWhatsapp: 'prescription-share-dialog-whatsapp',
  dialogCopy: 'prescription-share-dialog-copy',
  linksList: 'prescription-share-links-list',
  linkRow: 'prescription-share-link-row',
  linkStatus: 'prescription-share-link-status',
  linkRevoke: 'prescription-share-link-revoke',
  linkHighlight: 'prescription-share-link-highlight',
} as const;
