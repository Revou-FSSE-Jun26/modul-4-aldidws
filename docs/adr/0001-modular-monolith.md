# ADR-0001: Modular monolith with separate frontend/backend deployments

**Status:** Accepted  
**Date:** 2026-11-28  

## Context

The project needed a scalable architecture that kept UI and API concerns separate without introducing unnecessary operational complexity. Three broad options were evaluated: microservices, a classic monolith, and a modular monolith with separately deployable frontend and backend.

## Decision

Deploy a Next.js frontend and a Flask backend as two independent applications communicating over a JSON REST API. The Flask backend is organised internally by domain blueprints: `auth`, `boards`, `columns`, `cards`, `comments`, `labels`, `members`, `notifications`, `analytics`, and `users`. Each blueprint owns its routes, schemas, and service logic.

## Alternatives Considered

- **Microservices** — each domain as an independent service. Rejected: the operational overhead (service discovery, inter-service auth, distributed tracing) is disproportionate for a small team and an application of this scale.
- **Django** — a fuller Python web framework. Rejected: Flask was preferred for a lightweight, explicit API layer with less prescribed structure.
- **Next.js API routes handling backend logic** — serving both UI and API from the same Next.js process. Rejected: it violates separation of concerns, makes independent scaling impossible, and ties backend logic to the frontend deployment lifecycle.

## Consequences

- Clear frontend/backend boundaries: the frontend never accesses PostgreSQL directly, and the backend never imports frontend modules.
- Each layer is independently testable (Vitest/RTL for frontend, Pytest for backend, Playwright for E2E).
- Blueprint isolation means adding or removing a feature domain is low-risk and contained.
- Two separate deployment targets must be maintained; CORS and API base URL configuration must be managed per environment.
