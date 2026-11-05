/** Visible labels of the roles a person can hold inside an organization. */
const ROLE_LABELS: Readonly<Record<string, string>> = {
  OWNER: 'Dueño',
  ADMIN: 'Administración',
  STAFF: 'Equipo',
};

/** The role in words; a role the API does not label is said, never shown as an id. */
export function organizationRoleLabel(code: string | undefined): string {
  return (code && ROLE_LABELS[code]) || 'Otro rol';
}
