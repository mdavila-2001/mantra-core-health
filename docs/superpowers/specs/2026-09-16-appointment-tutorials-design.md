# Appointment tutorials: reliable, state-aware journeys

## Context

The current tutorials center offers a single appointment-related journey, **Tu
agenda del día**. It describes the agenda list but does not teach a practitioner
how to create an appointment, respond to a patient request, or close an
appointment. The mock agenda can also render rows with an unresolved status,
which means its action buttons are absent and cannot be a dependable tutorial
target.

The tutorial engine currently waits for a target for up to four seconds and
then skips its step silently. This prevents a permanent hang, but it can leave
a person with neither the action nor an explanation of why it was unavailable.

## Goals

- Make the appointment workflows discoverable from the tutorials center.
- Teach practitioners the real appointment lifecycle:
  - create an appointment;
  - accept or reject a request;
  - start an accepted appointment;
  - continue or complete an appointment in progress;
  - cancel an active appointment.
- Keep every tutorial usable when the current agenda has no row in the state
  that a step needs.
- Preserve the existing safety property: a missing target must never trap the
  person in a tutorial.
- Cover the engine behavior and real journeys with unit and Playwright tests.

## Non-goals

- Changing scheduling API contracts, appointment lifecycle rules, or mock data
  persistence.
- Adding a fake appointment UI solely for tutorials.
- Completing, rejecting, cancelling, or creating an appointment automatically
  on a person's behalf.

## Design

### Tutorial definitions

Add two practitioner-only definitions to the existing declarative registry:

1. **Crear una cita** starts at `/schedule/appointment/new`. It highlights the
   patient, schedule (when selectable), time, duration, modality, reason, and
   submit action. The submit step explains that the real form stays in control:
   the person must provide valid data and deliberately press the button.
2. **Gestionar una cita** starts at `/schedule`. It explains the actions by
   lifecycle state, in this order: request (detail, accept, reject), confirmed
   (start), in progress (continue and complete), and active (cancel).

The existing **Tu agenda del día** remains a short orientation journey. It no
longer claims to teach operational actions.

### State-aware steps

Extend a `TutorialStep` with an optional unavailable message. When a targeted
step cannot find its element by the configured timeout, the engine records the
failure but keeps that step active without an anchor. The overlay displays the
step's explanation plus its unavailable message and a normal **Siguiente**
button. It does not wait forever, silently advance, or pretend that the action
was demonstrated.

Only state-dependent appointment-action steps use this behavior. Ordinary
tutorial steps retain the current skip-on-missing-target behavior so existing
tours do not change unexpectedly.

### Stable targets

The appointment form receives targets for its semantic field groups and
submit action. Agenda action buttons receive literal targets for request,
accept, reject, start, continue, complete, and cancel. The targets remain
inside the existing components and do not change authorization or state
gates: a tutorial can only point to a button already rendered for the current
session and booking.

### Engine safety

Add a monotonically increasing run token. Any asynchronous route navigation or
target wait verifies it still belongs to the active run before mutating
tutorial state. Starting, ending, skipping, or moving a tutorial invalidates
earlier waits. This prevents a late lookup from a prior step or a prior tour
from advancing the current one.

### Center prioritization

The two new tutorials are listed in the Atención category and eligible for the
practitioner's recommendations. The creation tutorial appears before the
management tutorial because it establishes the appointment being managed.

## Error handling and accessibility

- A missing state-dependent target is announced with `role=status`; the overlay
  remains keyboard-operable and explains how to find the state later.
- The unavailable state has no interactive hole, so it cannot trigger an
  unrelated action below the overlay.
- No controls are enabled or invoked by the tutorial. Existing validation,
  confirmation dialogs, authorization, and request handling remain the source
  of truth.

## Test strategy

- Tutorial definition test: every new literal target exists in a real template
  and practitioner visibility includes the two new tutorials.
- Engine tests: an unavailable-aware step remains visible with no anchor; a
  legacy missing step still skips; a stale wait cannot advance a newer run.
- Overlay test: unavailable copy is announced and the person can continue.
- Playwright: capture the center and each tutorial entry; test the creation
  walkthrough without submitting data; use fixture-backed agenda rows for each
  lifecycle action and assert that unavailable states present a clear recovery
  path rather than hanging.

## Verification

`corepack yarn typecheck`, `corepack yarn lint`, targeted Vitest specs,
targeted Playwright with `--workers=1`, complete unit suite, route-health
Playwright, and before/after screenshots reviewed manually.
