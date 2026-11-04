# @tendshare/types — reserved

**Nothing is implemented here yet, on purpose.** This folder is a placeholder so
domain types (care circles, roles, plans and limits) have one obvious home.

## What belongs here

Shared TypeScript types and constants that more than one workspace needs — for
example the care-circle roles (owner, family member, view-only, visiting helper) and
the plan identifiers and limits, which must be config values rather than literals
scattered across the app.

## What does not belong here

- Database types generated from Supabase (those come from a generated file, once
  Supabase is wired up).
- Anything that needs a runtime dependency on React, React Native or the network.
  This package should stay dependency-free and importable from Node, so it can be
  unit-tested directly.

## Status

Empty until the care-circle slice of Phase 1 needs the first shared type.
