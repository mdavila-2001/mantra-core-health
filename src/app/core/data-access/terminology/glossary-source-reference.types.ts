/** Fuente editorial citada por la API para una ficha del glosario. */
export interface GlossarySourceReference {
  readonly source: string;
  readonly recordId: string;
  readonly url: string;
  readonly language: 'es' | 'en';
  readonly version: string;
  readonly retrievedAt: string;
  readonly role: 'concept_match' | 'related_context' | 'editorial_reference';
  readonly matchBasis?: 'title' | 'also_called';
  readonly attribution: string;
  readonly rights: string;
}
