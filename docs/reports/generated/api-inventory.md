<!-- GENERADO POR scripts/generate-inventory.mjs — NO EDITAR A MANO. -->

# Inventario de operaciones HTTP

402 operaciones declaradas en `src/app/core/data-access/**/*.client.ts`.
Ningún componente arma URLs por su cuenta: si esta lista está completa, la
superficie de red de la aplicación está completa.

## `DelegatedAccessClient`

Archivo: `src/app/core/data-access/delegated-access/delegated-access.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/access-requests/:requestId/decision` |
| `POST` | `/authz/effective-actor/evaluate` |
| `POST` | `/delegated-access/expiry-sweep` |
| `POST` | `/delegated-permission-sets` |
| `POST` | `/delegated-permission-sets/:setId/versions` |
| `POST` | `/org/:tenantMembershipId/user-assignments` |
| `PATCH` | `/org/user-assignments/:assignmentId` |
| `POST` | `/practitioner-delegates` |
| `POST` | `/practitioner-delegates/:delegationId/access-requests` |
| `POST` | `/practitioner-delegates/:delegationId/grants` |
| `POST` | `/practitioner-delegates/:delegationId/revoke` |

## `AccountingClient`

Archivo: `src/app/core/data-access/accounting/accounting.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/accounting/accounts` |
| `GET` | `/accounting/balance-sheet` |
| `GET` | `/accounting/general-ledger` |
| `GET` | `/accounting/income-statement` |
| `GET` | `/accounting/journal-transactions` |
| `POST` | `/accounting/journal-transactions` |
| `GET` | `/accounting/journal-transactions/:transactionId` |
| `POST` | `/accounting/journal-transactions/drafts` |
| `POST` | `/accounting/practitioner/consultation-income` |
| `POST` | `/accounting/practitioner/entries` |
| `GET` | `/accounting/practitioner/paid-consultations` |
| `GET` | `/accounting/trial-balance` |
| `GET` | `/practices` |

## `ContentPacksClient`

Archivo: `src/app/core/data-access/content-packs/content-packs.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/admin/content-packs` |
| `POST` | `/admin/content-packs/:code/apply` |

## `DirectoryClient`

Archivo: `src/app/core/data-access/directory/directory.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/admin/tenants` |
| `POST` | `/admin/tenants` |
| `POST` | `/admin/tenants/:tenantId/verification` |
| `GET` | `/tenants/:tenantId` |
| `PATCH` | `/tenants/:tenantId` |
| `GET` | `/tenants/:tenantId/agenda` |
| `GET` | `/tenants/:tenantId/branches` |
| `POST` | `/tenants/:tenantId/branches` |
| `GET` | `/tenants/:tenantId/child-tenants` |
| `POST` | `/tenants/:tenantId/child-tenants` |
| `GET` | `/tenants/:tenantId/memberships` |
| `POST` | `/tenants/:tenantId/memberships` |
| `GET` | `/tenants/:tenantId/memberships/:membershipId/branch-assignments` |
| `POST` | `/tenants/:tenantId/memberships/:membershipId/branch-assignments` |
| `GET` | `/tenants/:tenantId/practitioner-requests` |
| `POST` | `/tenants/:tenantId/practitioner-requests/:affiliationId/approve` |
| `POST` | `/tenants/:tenantId/practitioner-requests/:affiliationId/reject` |
| `GET` | `/tenants/me` |

## `AuthProvidersClient`

Archivo: `src/app/core/data-access/auth-providers/auth-providers.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/auth-providers/account-link-requests` |
| `POST` | `/auth-providers/account-link-requests/complete` |
| `POST` | `/auth-providers/federated-identities/:identityId/unlink` |
| `POST` | `/auth-providers/identity-providers` |
| `PUT` | `/auth-providers/identity-providers/:providerId/attribute-mappings` |
| `POST` | `/auth-providers/identity-providers/:providerId/protocol-configs` |
| `POST` | `/auth-providers/identity-providers/:providerId/provisioning-rules` |
| `POST` | `/auth-providers/identity-providers/:providerId/signing-keys` |
| `POST` | `/auth-providers/identity-providers/:providerId/signing-keys/rotate` |
| `POST` | `/auth-providers/identity-providers/by-code/:providerCode/authorize` |
| `POST` | `/auth-providers/identity-providers/by-code/:providerCode/callback` |
| `POST` | `/auth-providers/tenant-bindings` |

## `AuthzClient`

Archivo: `src/app/core/data-access/authz/authz.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/authz/care-relationships` |
| `POST` | `/authz/care-relationships/:id/respond` |
| `POST` | `/authz/care-relationships/request` |
| `GET` | `/authz/care-relationships/requests/mine` |
| `GET` | `/authz/legal-representations` |

## `ServicesCatalogClient`

Archivo: `src/app/core/data-access/services-catalog/services-catalog.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/billing/service-catalog` |
| `POST` | `/billing/service-catalog` |
| `PATCH` | `/billing/service-catalog/:id` |
| `GET` | `/billing/service-catalog/procedure-specialties` |
| `GET` | `/billing/service-catalog/procedures` |
| `GET` | `/practices` |

## `ClinicalClient`

Archivo: `src/app/core/data-access/clinical/clinical.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/cds/check-interactions` |
| `GET` | `/charts/patients/:patientProfileId/chart` |
| `POST` | `/clinical/allergy-intolerances` |
| `POST` | `/clinical/care-episodes` |
| `POST` | `/clinical/conditions` |
| `POST` | `/clinical/conditions/:conditionId/attachments` |
| `POST` | `/clinical/conditions/:conditionId/change-status` |
| `POST` | `/clinical/diagnostic-reports` |
| `POST` | `/clinical/diagnostic-reports/:diagnosticReportId/release` |
| `POST` | `/clinical/encounters/:encounterId/close` |
| `POST` | `/clinical/encounters/check-in` |
| `GET` | `/clinical/me/medical-aspects` |
| `PUT` | `/clinical/me/medical-aspects` |
| `POST` | `/clinical/medication-requests` |
| `POST` | `/clinical/medication-requests/:medicationRequestId/issue` |
| `POST` | `/clinical/medication-requests/:medicationRequestId/sign` |
| `POST` | `/clinical/observations` |
| `GET` | `/clinical/patients/:patientProfileId/summary` |
| `POST` | `/clinical/procedures/:procedureId/attachments` |

## `ChartNotesClient`

Archivo: `src/app/core/data-access/chart-notes/chart-notes.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/charts/notes` |
| `PUT` | `/charts/notes/:noteId/versions` |

## `ChartTemplatesClient`

Archivo: `src/app/core/data-access/chart-templates/chart-templates.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/charts/templates` |
| `POST` | `/charts/templates` |
| `GET` | `/charts/templates/:id` |
| `POST` | `/charts/templates/:templateId/assignments` |

## `DiagnosticsClient`

Archivo: `src/app/core/data-access/diagnostics/diagnostics.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/clinical/service-requests` |
| `GET` | `/diagnostic-results/me` |
| `GET` | `/diagnostic-results/me/:reportId` |
| `GET` | `/diagnostic-results/me/:reportId/shares` |
| `POST` | `/diagnostic-results/me/:reportId/shares` |
| `POST` | `/diagnostic-results/me/:reportId/shares/:shareId/revoke` |
| `GET` | `/diagnostic-results/me/orders` |
| `GET` | `/diagnostics/patients/:patientProfileId/imaging-studies` |
| `GET` | `/diagnostics/patients/:patientProfileId/orders` |
| `GET` | `/diagnostics/work-orders` |

## `AddressesClient`

Archivo: `src/app/core/data-access/common/addresses.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/common/addresses` |

## `FilesClient`

Archivo: `src/app/core/data-access/files/files.client.ts`

| Método | Ruta |
|---|---|
| `DELETE` | `/common/files/:fileId` |
| `GET` | `/common/files/:fileId/content` |
| `POST` | `/common/files/:fileId/download-url` |
| `POST` | `/common/files/:fileId/links` |
| `GET` | `/common/files/links` |
| `POST` | `/common/files/upload` |

## `CommunityClient`

Archivo: `src/app/core/data-access/community/community.client.ts`

| Método | Ruta |
|---|---|
| `DELETE` | `/community/blocks` |
| `GET` | `/community/blocks` |
| `POST` | `/community/blocks` |
| `DELETE` | `/community/bookmarks` |
| `GET` | `/community/bookmarks` |
| `POST` | `/community/bookmarks` |
| `POST` | `/community/comments` |
| `GET` | `/community/comments/media/:fileId/content` |
| `GET` | `/community/conversations` |
| `POST` | `/community/conversations` |
| `GET` | `/community/conversations/:conversationId/messages` |
| `POST` | `/community/conversations/:conversationId/messages` |
| `POST` | `/community/conversations/:conversationId/read` |
| `GET` | `/community/feed` |
| `DELETE` | `/community/follows` |
| `GET` | `/community/follows` |
| `POST` | `/community/follows` |
| `GET` | `/community/groups` |
| `POST` | `/community/groups` |
| `GET` | `/community/groups/:groupId` |
| `GET` | `/community/groups/:groupId/members` |
| `POST` | `/community/groups/:groupId/members` |
| `PATCH` | `/community/groups/:groupId/members/:memberId` |
| `DELETE` | `/community/groups/:groupId/members/:memberProfileId` |
| `GET` | `/community/groups/:groupId/posts` |
| `POST` | `/community/groups/:groupId/posts` |
| `GET` | `/community/moderation/appeals` |
| `POST` | `/community/moderation/appeals/:appealId/resolve` |
| `GET` | `/community/moderation/decisions` |
| `POST` | `/community/moderation/decisions/:decisionId/appeal` |
| `GET` | `/community/moderation/queue` |
| `POST` | `/community/moderation/queue/:queueId/decision` |
| `GET` | `/community/notifications` |
| `GET` | `/community/polls/:pollId` |
| `GET` | `/community/posts/:postId` |
| `GET` | `/community/posts/:postId/comments` |
| `GET` | `/community/posts/:postId/reactions` |
| `GET` | `/community/profiles/:profileId` |
| `GET` | `/community/profiles/:profileId/posts` |
| `POST` | `/community/profiles/:profileId/posts` |
| `GET` | `/community/profiles/:profileId/reviews` |
| `POST` | `/community/profiles/:profileId/reviews` |
| `POST` | `/community/profiles/:profileId/reviews/:reviewId/responses` |
| `GET` | `/community/profiles/by-slug/:slug` |
| `GET` | `/community/profiles/me` |
| `PUT` | `/community/profiles/me` |
| `PUT` | `/community/reactions` |
| `POST` | `/community/reports` |
| `GET` | `/community/topics` |
| `GET` | `/public/search/practitioners` |

## `ProceduresClient`

Archivo: `src/app/core/data-access/procedures/procedures.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/dental-procedures` |
| `POST` | `/dental-procedures` |
| `GET` | `/dental-procedures/catalog` |
| `GET` | `/procedure-cases` |
| `GET` | `/procedure-cases` |
| `GET` | `/procedure-cases/:caseId` |
| `GET` | `/procedure-cases/:caseId/team-members` |
| `POST` | `/procedure-cases/:caseId/team-members/:memberId/accept` |
| `POST` | `/procedure-cases/:caseId/team-members/:memberId/respond` |

## `DiagnosticUnitsAdminClient`

Archivo: `src/app/core/data-access/diagnostic-units/diagnostic-units-admin.client.ts`

| Método | Ruta |
|---|---|
| `DELETE` | `/diagnostic-study-offerings/:offeringId` |
| `GET` | `/diagnostic-units/:id/administration` |
| `POST` | `/diagnostic-units/:unitId/price-schedules` |
| `POST` | `/diagnostic-units/:unitId/study-offerings` |
| `POST` | `/diagnostic-units/:unitId/verify-and-publish` |
| `GET` | `/diagnostic-units/administration` |
| `POST` | `/price-schedules/:scheduleId/study-prices` |
| `POST` | `/study-prices/:priceId/close` |

## `DiagnosticUnitsClient`

Archivo: `src/app/core/data-access/diagnostic-units/diagnostic-units.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/diagnostic-units` |
| `GET` | `/diagnostic-units/:id` |
| `GET` | `/diagnostic-units/search` |

## `FormsClient`

Archivo: `src/app/core/data-access/forms/forms.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/forms/assignments` |
| `GET` | `/forms/assignments/budget` |
| `POST` | `/forms/field-definitions` |
| `GET` | `/forms/instances` |
| `POST` | `/forms/instances` |
| `GET` | `/forms/instances/:instanceId` |
| `POST` | `/forms/instances/:instanceId/close` |
| `POST` | `/forms/instances/:instanceId/values` |
| `GET` | `/forms/me/instances` |
| `GET` | `/forms/me/instances/:instanceId` |

## `GeoClient`

Archivo: `src/app/core/data-access/geo/geo.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/geo/geofence-events` |
| `POST` | `/geo/geofences` |
| `POST` | `/geo/tracked-subjects` |
| `GET` | `/geo/tracked-subjects/:trackedSubjectId/last-position` |
| `POST` | `/geo/tracked-subjects/:trackedSubjectId/pings` |
| `POST` | `/geo/tracked-subjects/:trackedSubjectId/revoke-consent` |
| `POST` | `/geo/tracking-sessions` |
| `POST` | `/geo/tracking-sessions/:sessionId/close` |
| `POST` | `/geo/trips` |
| `POST` | `/geo/trips/:tripId/close` |

## `HealthContextClient`

Archivo: `src/app/core/data-access/health-context/health-context.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/health-context/agents` |
| `POST` | `/health-context/collection-runs` |
| `POST` | `/health-context/collection-runs/:collectionRunId/finish` |
| `POST` | `/health-context/collection-runs/:collectionRunId/observations` |
| `POST` | `/health-context/contexts` |
| `POST` | `/health-context/contexts/:contextId/versions` |
| `GET` | `/health-context/contexts/resolve` |
| `POST` | `/health-context/schedules` |
| `POST` | `/health-context/sources` |
| `POST` | `/health-context/versions/:versionId/publish` |
| `POST` | `/health-context/versions/:versionId/quality-reviews` |
| `POST` | `/health-context/versions/:versionId/supersede` |

## `IamClient`

Archivo: `src/app/core/data-access/iam/iam.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/iam/auth/activate` |
| `POST` | `/iam/auth/forgot-password` |
| `POST` | `/iam/auth/login` |
| `POST` | `/iam/auth/logout` |
| `POST` | `/iam/auth/register-organization` |
| `POST` | `/iam/auth/register-patient` |
| `POST` | `/iam/auth/register-practitioner` |
| `POST` | `/iam/auth/resend-verification` |
| `POST` | `/iam/auth/reset-password` |
| `POST` | `/iam/auth/token/refresh` |
| `POST` | `/iam/auth/verify-email` |
| `GET` | `/iam/users` |
| `POST` | `/iam/users` |
| `POST` | `/iam/users/assisted-registration` |

## `IdentityAdminClient`

Archivo: `src/app/core/data-access/identity/identity-admin.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/identity/assertions/:assertionId/revoke` |
| `POST` | `/identity/authorities` |
| `POST` | `/identity/authorities/:authorityId/endpoints` |
| `POST` | `/identity/checks/:checkId/attempts` |
| `POST` | `/identity/checks/:checkId/results` |
| `POST` | `/identity/manual-review/:reviewId/decision` |
| `GET` | `/identity/verification-cases` |
| `POST` | `/identity/verification-cases` |
| `POST` | `/identity/verification-cases/:caseId/assertions` |
| `POST` | `/identity/verification-cases/:caseId/checks:plan` |
| `POST` | `/identity/verification-cases/:caseId/evidence` |
| `POST` | `/identity/verification-cases/:caseId/fraud-signals` |
| `POST` | `/identity/verification-cases/:caseId/manual-review` |
| `POST` | `/identity/verification-cases/expire-sweep` |
| `POST` | `/identity/verification-policies` |

## `IdentityClient`

Archivo: `src/app/core/data-access/identity/identity.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/identity/me/identity-verification` |
| `POST` | `/identity/me/practitioner/identity-verification` |
| `POST` | `/identity/me/practitioner/license-verification` |
| `POST` | `/identity/me/tenants/:tenantId/verification` |
| `GET` | `/identity/me/verification-cases` |
| `GET` | `/identity/me/verification-cases/:caseId` |

## `InsuranceClient`

Archivo: `src/app/core/data-access/insurance/insurance.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/insurance-brokers` |
| `GET` | `/insurance-brokers/:id` |
| `GET` | `/insurance-brokers/:id/clients` |
| `GET` | `/insurance-carrier-catalog` |
| `GET` | `/insurance-carriers` |
| `GET` | `/insurance-carriers/:id` |
| `GET` | `/insurance-claims` |
| `POST` | `/insurance-claims/:claimId/disputes` |
| `GET` | `/insurance-claims/:id` |

## `NotificationsClient`

Archivo: `src/app/core/data-access/notifications/notifications.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/notifications/in-app/:id/read` |
| `POST` | `/notifications/in-app/read-all` |
| `GET` | `/notifications/me` |
| `GET` | `/notifications/preferences/me` |
| `PUT` | `/notifications/preferences/me` |

## `PharmaLabClient`

Archivo: `src/app/core/data-access/pharma-lab/pharma-lab.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/pharma-labs` |
| `GET` | `/pharma-labs/:pharmaLabId` |
| `GET` | `/pharma-labs/:pharmaLabId/materials` |
| `GET` | `/pharma-labs/:pharmaLabId/medical-visitors` |
| `POST` | `/pharma-labs/:pharmaLabId/medical-visitors/:medicalVisitorId/unlink` |
| `GET` | `/pharma-labs/:pharmaLabId/pharmacovigilance/reports` |
| `GET` | `/pharma-labs/:pharmaLabId/products` |
| `GET` | `/pharma-labs/:pharmaLabId/regulatory-documents` |
| `GET` | `/pharma-labs/:pharmaLabId/staff` |
| `GET` | `/visit-agenda/doctors/:doctorUserId` |
| `GET` | `/visit-agenda/me` |
| `PUT` | `/visit-agenda/me` |
| `GET` | `/visit-records/inbox` |
| `GET` | `/visit-records/labs/:pharmaLabId` |
| `GET` | `/visit-records/labs/:pharmaLabId/rating-summary` |
| `POST` | `/visit-requests` |
| `POST` | `/visit-requests/:visitRequestId/accept` |
| `POST` | `/visit-requests/:visitRequestId/cancel` |
| `POST` | `/visit-requests/:visitRequestId/reject` |
| `GET` | `/visit-requests/inbox` |
| `GET` | `/visit-requests/mine` |

## `PharmaLabConcepts`

Archivo: `src/app/core/data-access/pharma-lab/pharma-lab-concepts.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/pharma-labs/reference/concepts` |

## `PharmacyClient`

Archivo: `src/app/core/data-access/pharmacy/pharmacy.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/pharmacy-inventory/availability` |
| `GET` | `/pharmacy/pharmacies` |
| `GET` | `/pharmacy/products` |

## `PharmacyOrdersClient`

Archivo: `src/app/core/data-access/pharmacy-orders/pharmacy-orders.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/pharmacy/orders` |
| `GET` | `/pharmacy/orders` |
| `POST` | `/pharmacy/orders` |
| `GET` | `/pharmacy/orders/me` |

## `MedicalOrganizationClient`

Archivo: `src/app/core/data-access/medical-organization/medical-organization.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/practices` |
| `GET` | `/practices/:practiceId/organization` |

## `PracticeSitesClient`

Archivo: `src/app/core/data-access/practice-sites/practice-sites.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/practices/:practiceId/role-assignments/self-request` |
| `GET` | `/practitioners/:practitionerProfileId/sites` |
| `GET` | `/practitioners/me/role-assignments` |
| `POST` | `/practitioners/me/sites` |
| `DELETE` | `/practitioners/me/sites/:siteId` |

## `PrescriptionFavoritesClient`

Archivo: `src/app/core/data-access/prescription-favorites/prescription-favorites.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/prescription-favorites` |
| `POST` | `/prescription-favorites` |
| `DELETE` | `/prescription-favorites/:id` |

## `ProfilesClient`

Archivo: `src/app/core/data-access/profiles/profiles.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/profiles/patients` |
| `POST` | `/profiles/patients` |
| `GET` | `/profiles/patients/:profileId` |
| `POST` | `/profiles/patients/:profileId/related-persons` |
| `GET` | `/profiles/patients/me` |
| `PATCH` | `/profiles/patients/me` |
| `DELETE` | `/profiles/patients/me/photo` |
| `PUT` | `/profiles/patients/me/photo` |
| `GET` | `/profiles/patients/me/summary` |
| `POST` | `/profiles/patients/merge` |
| `GET` | `/profiles/patients/merge-events` |
| `POST` | `/profiles/patients/merge/:eventId/reverse` |
| `POST` | `/profiles/persons/:personId/account-links` |
| `GET` | `/profiles/practitioners` |
| `POST` | `/profiles/practitioners` |
| `POST` | `/profiles/practitioners/:profileId/jurisdiction-authorizations` |
| `PUT` | `/profiles/practitioners/:profileId/photo` |
| `POST` | `/profiles/practitioners/:profileId/specialties` |
| `GET` | `/profiles/practitioners/:profileId/summary` |
| `PATCH` | `/profiles/practitioners/me` |
| `GET` | `/profiles/practitioners/me/affiliations` |
| `POST` | `/profiles/practitioners/me/affiliations` |
| `POST` | `/profiles/practitioners/me/credentials` |
| `DELETE` | `/profiles/practitioners/me/credentials/:credentialId` |
| `GET` | `/profiles/practitioners/me/linkable-organizations` |
| `GET` | `/profiles/practitioners/me/onboarding` |
| `GET` | `/profiles/practitioners/me/summary` |
| `GET` | `/profiles/practitioners/specialty-counts` |

## `PublicClient`

Archivo: `src/app/core/data-access/public/public.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/public/directory` |

## `PublicMarketplaceClient`

Archivo: `src/app/core/data-access/public-marketplace/public-marketplace.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/public/medications` |
| `GET` | `/public/medications/:conceptId/availability` |

## `PublicDirectoryClient`

Archivo: `src/app/core/data-access/public-directory/public-directory.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/public/posts` |
| `GET` | `/public/profiles/:prefijo/:slug` |

## `QuotationsClient`

Archivo: `src/app/core/data-access/quotations/quotations.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/quotations` |
| `POST` | `/quotations` |
| `GET` | `/quotations/:id` |
| `POST` | `/quotations/simulate` |

## `SchedulingClient`

Archivo: `src/app/core/data-access/scheduling/scheduling.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/scheduling/activity-types` |
| `POST` | `/scheduling/appointments/direct` |
| `POST` | `/scheduling/booking-policies` |
| `GET` | `/scheduling/bookings` |
| `GET` | `/scheduling/bookings/:bookingId` |
| `POST` | `/scheduling/bookings/:bookingId/:accion` |
| `POST` | `/scheduling/bookings/:bookingId/cancel` |
| `POST` | `/scheduling/bookings/:bookingId/check-in` |
| `POST` | `/scheduling/bookings/:bookingId/delay` |
| `PUT` | `/scheduling/bookings/:bookingId/payment-state` |
| `POST` | `/scheduling/bookings/:bookingId/reject` |
| `POST` | `/scheduling/bookings/:bookingId/reschedule` |
| `GET` | `/scheduling/exception-types` |
| `DELETE` | `/scheduling/exceptions/:exceptionId` |
| `PATCH` | `/scheduling/exceptions/:exceptionId` |
| `POST` | `/scheduling/holds/:holdToken/confirm` |
| `POST` | `/scheduling/holds/:holdToken/request` |
| `GET` | `/scheduling/resources` |
| `POST` | `/scheduling/resources` |
| `POST` | `/scheduling/resources/:resourceId/close-slots` |
| `POST` | `/scheduling/resources/:resourceId/delay` |
| `GET` | `/scheduling/resources/:resourceId/exceptions` |
| `POST` | `/scheduling/resources/:resourceId/exceptions` |
| `POST` | `/scheduling/resources/:resourceId/shift-slots` |
| `GET` | `/scheduling/resources/:resourceId/templates` |
| `POST` | `/scheduling/resources/:resourceId/templates` |
| `GET` | `/scheduling/slots` |
| `POST` | `/scheduling/slots/:slotId/holds` |
| `DELETE` | `/scheduling/templates/:templateId` |
| `POST` | `/scheduling/templates/:templateId/generate-slots` |
| `POST` | `/scheduling/templates/:templateId/reactivate` |
| `GET` | `/scheduling/waitlist` |
| `POST` | `/scheduling/waitlist` |

## `SurveysClient`

Archivo: `src/app/core/data-access/surveys/surveys.client.ts`

| Método | Ruta |
|---|---|
| `POST` | `/surveys/assignments` |
| `POST` | `/surveys/invitations` |
| `GET` | `/surveys/me/invitations` |
| `GET` | `/surveys/me/invitations/:invitationId` |
| `POST` | `/surveys/me/invitations/:invitationId/responses` |
| `GET` | `/surveys/templates` |
| `POST` | `/surveys/templates` |
| `GET` | `/surveys/templates/:surveyId` |
| `POST` | `/surveys/templates/:surveyId/deactivate` |
| `POST` | `/surveys/templates/:surveyId/questions` |
| `GET` | `/surveys/templates/:surveyId/responses` |
| `POST` | `/surveys/templates/:surveyId/versions` |
| `POST` | `/surveys/templates/:surveyId/versions/:versionNumber/publish` |

## `SystemContextClient`

Archivo: `src/app/core/data-access/system-context/system-context.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/system-context/dynamic-enums` |

## `TerminologyClient`

Archivo: `src/app/core/data-access/terminology/terminology.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `/terminology/code-systems` |
| `GET` | `/terminology/code-systems/:codeSystemId/versions` |
| `GET` | `/terminology/concepts` |
| `GET` | `/terminology/concepts` |
| `GET` | `/terminology/concepts` |
| `GET` | `/terminology/concepts/:conceptId` |
| `GET` | `/terminology/concepts/:conceptId` |
| `GET` | `/terminology/value-sets` |
| `GET` | `/terminology/value-sets/:valueSetId/$expand` |
| `POST` | `/terminology/versions/:versionId/import-file` |
| `POST` | `/terminology/versions/:versionId/publish` |

## `AssetsLiabilitiesClient`

Archivo: `src/app/core/data-access/assets-liabilities/assets-liabilities.client.ts`

| Método | Ruta |
|---|---|
| `GET` | `assets` |
| `POST` | `assets` |
| `PATCH` | `assets/:assetId/automation` |
| `POST` | `assets/:assetId/progress` |
| `GET` | `liabilities` |
| `POST` | `liabilities` |
| `PATCH` | `liabilities/:liabilityId/automation` |
| `POST` | `liabilities/:liabilityId/progress` |
