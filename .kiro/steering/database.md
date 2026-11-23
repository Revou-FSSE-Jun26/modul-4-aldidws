---
inclusion: fileMatch
fileMatchPattern: "{app/models,migrations}/**/*.py"
---

# Database Engineering Standards (PostgreSQL + SQLAlchemy)

## 1. Core Database Principles

All database implementation MUST follow these principles:

1. **Data Integrity:** The database MUST enforce critical data relationships and constraints.
2. **Consistency:** Database naming, types, relationships, and conventions MUST remain consistent.
3. **Normalization:** Avoid unnecessary duplication of data and update anomalies.
4. **Referential Integrity:** Foreign keys MUST accurately represent domain relationships.
5. **Security:** Database access MUST follow the principle of least privilege.
6. **Performance:** Queries, indexes, and relationships MUST reflect actual access patterns.
7. **Migration Safety:** Every schema change MUST be version-controlled and reviewed.
8. **Recoverability:** Important data MUST have an appropriate backup and recovery strategy.
9. **Explicit Lifecycle:** Deletion, retention, and restoration behavior MUST be defined by business requirements.
10. **Maintainability:** Prefer simple, understandable database designs over speculative optimization.

PostgreSQL is the primary relational database. SQLAlchemy is the ORM.

Do not introduce database complexity without a clear business or technical requirement.

## 2. Database Architecture and Naming Conventions

### Table Naming

RULE:

- Table names MUST use plural `snake_case`.
- Column names MUST use `snake_case`.
- Foreign-key columns MUST use the referenced entity name followed by `_id`.
- Association tables MUST use consistent, descriptive names.
- Avoid reserved SQL keywords and ambiguous names.

Examples:

| Database object | Naming |
|---|---|
| User table | `users` |
| Board table | `boards` |
| Column table | `board_columns` |
| Card table | `cards` |
| Comment table | `comments` |
| User identifier | `user_id` |
| Board identifier | `board_id` |
| Creation timestamp | `created_at` |

Use `board_columns` rather than `columns` to make the table's domain meaning explicit.

### Model Class Naming

- SQLAlchemy model classes MUST use singular `PascalCase`.
- Prefer descriptive domain names such as `User`, `Board`, `BoardColumn`, `Card`, and `Comment`.
- Do not add an `Entity` suffix unless the existing architecture has an established and justified convention.
- Model names MUST remain consistent with their corresponding table names.

Example:

```python
class Card(db.Model):
    __tablename__ = "cards"
```

### Naming Consistency

- Foreign-key names MUST identify the referenced entity.
- Constraint names MUST follow a consistent convention.
- Index names MUST be descriptive.
- Avoid abbreviations unless they are established domain terminology.

Recommended constraint naming:

```text
pk_<table>
fk_<table>_<column>_<reference>
uq_<table>_<column>
ix_<table>_<column>
ck_<table>_<description>
```

Use SQLAlchemy metadata naming conventions where practical so generated migrations produce predictable names.

## 3. Primary Keys and Identifiers

### Primary Key Standards

- Every persistent entity table MUST have a primary key.
- UUID primary keys SHOULD be used consistently for core domain entities when appropriate.
- Use Python's `uuid.uuid4` for application-generated UUIDs unless the project has an established database-generated UUID strategy.
- UUID columns MUST use a UUID-compatible database type.
- Foreign-key columns referencing UUID primary keys MUST use compatible types.
- Do not mix UUID and integer identifiers within the same relationship.

Example:

```python
import uuid

from sqlalchemy import Uuid
from sqlalchemy.orm import mapped_column, Mapped

id: Mapped[uuid.UUID] = mapped_column(
    Uuid(as_uuid=True),
    primary_key=True,
    default=uuid.uuid4,
)
```

For a PostgreSQL-only application, PostgreSQL's native UUID type MAY be used instead when the project deliberately chooses dialect-specific types.

### Identifier Security

- UUIDs are identifiers, not authorization mechanisms.
- Never assume that a UUID makes a resource inaccessible to unauthorized users.
- Every resource access MUST still enforce ownership or permission checks.
- Do not expose internal identifiers unnecessarily.

### Exceptions

Alternative primary-key strategies MAY be used for specialized tables, such as association tables or high-volume internal records, when justified.

Do not introduce multiple identifier strategies without a documented reason.

## 4. Standard Timestamp and Audit Columns

Timestamp conventions MUST be consistent across applicable models.

### Standard Timestamp Fields

Mutable domain entities SHOULD include:

- `created_at`: When the record was created.
- `updated_at`: When the record was last modified.

Soft-deletable entities MAY additionally include:

- `deleted_at`: When the record was logically deleted.

### Timestamp Rules

- Store timestamps in UTC.
- Use timezone-aware datetime columns.
- Prefer `DateTime(timezone=True)`.
- Do not use naive UTC timestamps.
- Do not use deprecated `datetime.utcnow()` for new implementations.
- Use `datetime.now(timezone.utc)` when Python generates timestamps.
- Use database server defaults when database-generated timestamps are preferred.
- Define consistent update behavior for `updated_at`.
- Do not assume SQLAlchemy's `onupdate` automatically covers bulk SQL updates or external database changes.

Example:

```python
from sqlalchemy import DateTime, func
from sqlalchemy.orm import mapped_column, Mapped

created_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True),
    nullable=False,
    server_default=func.now(),
)

updated_at: Mapped[datetime] = mapped_column(
    DateTime(timezone=True),
    nullable=False,
    server_default=func.now(),
    onupdate=func.now(),
)
```

`onupdate` is an ORM-side update behavior, not a guarantee that every database-level update will modify the timestamp. If multiple applications or direct SQL writers modify the same records, establish a database-level update strategy where necessary.

### Audit Fields

Additional audit fields MAY include:

- `created_by`: User responsible for creating the record.
- `updated_by`: User responsible for the latest modification.
- `deleted_by`: User responsible for deletion.

Add these fields only when required by audit, accountability, or business requirements.

Timestamps alone do not constitute a complete activity history.

### Applicability

Do not require all audit fields on every database table.

Examples:

- Core domain entities: Usually require `created_at` and `updated_at`.
- Immutable activity records: Usually require `created_at`, but not `updated_at`.
- Association tables: Require timestamps only when their lifecycle needs auditing.
- Temporary or internal tables: Follow their actual lifecycle requirements.

Use shared SQLAlchemy mixins for genuinely shared fields rather than copying definitions across models.

## 5. Data Types and Column Definitions

Choose database types according to the domain meaning and validation requirements.

### String Columns

- Use `String(length)` for bounded text.
- Define maximum lengths based on business requirements.
- Use `Text` for long free-form content.
- Avoid unbounded strings when the field has a known maximum length.

Examples:

```python
title = mapped_column(String(255), nullable=False)
email = mapped_column(String(255), nullable=False)
description = mapped_column(Text, nullable=True)
```

Do not automatically assign `String(255)` to every text field. Different fields have different constraints.

### Numeric Columns

- Use `Integer` for counters and integer ordering.
- Use `BigInteger` when the expected range exceeds a regular integer.
- Use `Numeric` for exact decimal values.
- Do not use floating-point types for values requiring exact decimal precision.
- Define appropriate minimum and maximum constraints.

### Date and Time Columns

Choose types based on business meaning:

- `Date`: Calendar dates without a specific time.
- `DateTime(timezone=True)`: A specific moment in time.
- `Time`: Time of day when independent of a date.

For example, a due date that represents a calendar day should generally use `Date`, while an exact deadline should use a timezone-aware timestamp.

### Boolean Columns

- Use `Boolean` for true/false values.
- Define explicit defaults where the business rules require them.
- Avoid nullable booleans unless a third state has a defined meaning.

### JSON Columns

- Use PostgreSQL `JSONB` only when flexible structured data is genuinely required.
- Do not use JSONB to avoid designing relational tables for core entities.
- Frequently queried JSON fields may require specialized indexes.
- Validate JSON structures at the application boundary.
- Keep frequently accessed relationships in relational columns and tables.

## 6. Foreign Keys and Referential Integrity

Every relationship between persistent entities MUST be represented by an appropriate foreign key.

### Rules

- Define explicit foreign-key constraints.
- Use compatible primary-key and foreign-key types.
- Define nullability according to business requirements.
- Choose `ondelete` behavior intentionally.
- Avoid orphaned records.
- Do not rely exclusively on ORM relationships to enforce database integrity.
- Add indexes to foreign-key columns when justified by query patterns.

Example:

```python
board_id = mapped_column(
    Uuid(as_uuid=True),
    ForeignKey("boards.id", ondelete="CASCADE"),
    nullable=False,
    index=True,
)
```

### Referential Integrity

The database MUST prevent invalid relationships.

Examples:

- A card MUST reference an existing board column.
- A board column MUST reference an existing board.
- A comment MUST reference an existing card.
- A private board MUST have a valid owner.
- A card MUST NOT reference a column belonging to an unrelated board.

Where a relationship spans multiple parent entities, validate the complete relationship in the service layer and use database constraints where practical.

Do not assume that a valid foreign key alone guarantees that a resource belongs to the correct parent.

## 7. SQLAlchemy Relationship Standards

Use explicit relationship definitions.

### Preferred Pattern: `back_populates`

RULE:

- Define both sides of bidirectional relationships explicitly.
- Prefer `back_populates` over dynamically generated `backref`.
- Define `uselist`, `cascade`, `passive_deletes`, and loading strategies only when their behavior is understood and required.
- Avoid unnecessary bidirectional relationships.
- Ensure relationship behavior matches the database foreign-key behavior.

Example:

```python
class BoardColumn(db.Model):
    __tablename__ = "board_columns"

    cards = db.relationship(
        "Card",
        back_populates="column",
        lazy="select",
    )


class Card(db.Model):
    __tablename__ = "cards"

    column_id = db.Column(
        db.Uuid,
        db.ForeignKey("board_columns.id", ondelete="CASCADE"),
        nullable=False,
    )

    column = db.relationship(
        "BoardColumn",
        back_populates="cards",
    )
```

Adapt the type declarations to the SQLAlchemy version and model style already used by the project.

### Cascade Rules

- ORM cascade behavior MUST be chosen intentionally.
- Database `ON DELETE` behavior and SQLAlchemy cascade behavior MUST be compatible.
- Do not use `cascade="all, delete-orphan"` without confirming that the child cannot exist independently of its parent.
- Avoid cascading deletion across unrelated domain entities.
- Use `passive_deletes=True` when appropriate for database-managed cascade behavior.
- Test deletion behavior with actual database relationships.

A board deletion MUST follow the business retention policy for its columns, cards, comments, and activity records.

### Relationship Loading

Do not enforce one global loading strategy for every relationship.

Use:

- `select`: Appropriate for collections or relationships loaded when accessed.
- `joined`: Useful for selected relationships when joining does not create excessive result duplication.
- `selectin`: Often appropriate for collections and avoiding N+1 queries.
- `raise` or equivalent strict loading behavior where accidental lazy loading should be prevented.

Rules:

- Select loading strategies based on actual query patterns.
- Avoid blanket `lazy="joined"` configurations.
- Use explicit eager-loading options in query functions when needed.
- Review collection joins for duplicated rows and unnecessary data transfer.
- Test query counts for performance-sensitive endpoints.

Prevent N+1 queries without creating unnecessarily large joined queries.

## 8. Database Constraints

Critical data integrity rules MUST be enforced at the database level whenever possible.

### Primary Key Constraints

Every entity table MUST have a primary key.

### Unique Constraints

Use unique constraints for values that must not be duplicated.

Examples:

- User email.
- Unique membership combinations.
- Board or column ordering combinations where required by the ordering strategy.

Example:

```python
__table_args__ = (
    UniqueConstraint("email", name="uq_users_email"),
)
```

Consider case-insensitive uniqueness for user email if that is the application's identity policy. Define normalization and uniqueness behavior consistently rather than relying on frontend checks.

### Check Constraints

Use database check constraints for persistent invariants.

Examples:

- Position must not be negative.
- Numeric values must be within valid ranges.
- Required state values must belong to the supported domain.

Example:

```python
CheckConstraint(
    "position >= 0",
    name="ck_board_columns_position_nonnegative",
)
```

### Nullability

- Use `nullable=False` for required fields.
- Allow `NULL` only when absence has a defined business meaning.
- Do not use empty strings as a substitute for missing values without a deliberate convention.
- Ensure application defaults and database defaults are consistent.

### Defaults

- Use application defaults when values are generated by application logic.
- Use server defaults when values should be generated by the database.
- Do not assume Python-side defaults apply to direct SQL statements.
- Avoid contradictory application and database defaults.

## 9. Indexing and Query Performance

Indexes MUST support actual query patterns.

### Indexing Rules

- Primary keys are indexed by default.
- Add indexes to frequently filtered, joined, or sorted columns when justified.
- Consider composite indexes for common multi-column query patterns.
- Index foreign-key columns when they are used frequently in joins or filters.
- Avoid creating indexes for every column.
- Consider write overhead and storage cost before adding indexes.
- Review query plans for slow or high-volume queries.

### Composite Indexes

Composite indexes MUST reflect the order and conditions of actual queries.

For example, if cards are frequently retrieved by column and ordered by position, consider an index on:

```text
(column_id, position)
```

Do not create composite indexes based only on assumptions.

### Partial and Specialized Indexes

PostgreSQL partial indexes MAY be used when only a subset of records needs indexing.

Examples include:

- Active records where `deleted_at IS NULL`.
- Pending records in frequently queried workflows.

Use specialized indexes such as GIN only when the application's query requirements justify them.

### Query Rules

- Filter, sort, and paginate at the database level.
- Avoid loading entire tables for ordinary collection endpoints.
- Avoid N+1 query patterns.
- Use eager loading when justified.
- Select only required columns for specialized read operations.
- Avoid unnecessary repeated queries.
- Inspect query plans when performance problems appear.

## 10. Soft Delete and Data Lifecycle

Soft deletion MUST be an explicit domain decision, not a mandatory column on every model.

### Soft Delete Rules

Use `deleted_at` only when the business requires logical deletion, recovery, retention, or historical visibility.

Examples:

- Boards that users may restore.
- Cards that need recovery.
- Records that must remain available for audit or retention purposes.

Do not automatically apply soft deletion to:

- Temporary association records.
- Disposable join records.
- Records that must be permanently removed.
- Immutable records whose retention policy requires a different lifecycle.

### Required Soft Delete Behavior

When soft deletion is used, define:

- Which entities support restoration.
- Whether deleted records are hidden by default.
- Whether child records are also soft-deleted.
- Whether child records remain accessible through historical views.
- Whether deleted records can be restored.
- How unique constraints behave for deleted records.
- When permanent deletion is permitted.

### Query Behavior

- Ordinary application queries MUST exclude soft-deleted records when that is the defined application policy.
- Administrative and recovery operations MAY explicitly include deleted records.
- Avoid hiding soft-delete filters inside unclear global behavior.
- Make queries that include deleted records explicit.
- Prevent accidental updates to deleted records unless restoration is intended.

### Uniqueness with Soft Deletes

When a deleted record's unique value may be reused, consider PostgreSQL partial unique indexes.

Example concept:

```text
Unique email among active users only.
```

Do not weaken uniqueness constraints merely to make soft deletion easier.

### Physical Deletion

Physical deletion MUST follow the application's retention and referential-integrity policies.

Do not permanently delete historical or auditable records without explicit business approval.

## 11. Ordering and Reordering

The Task Management Application uses ordered columns and cards.

Ordering MUST be deterministic and safe under concurrent operations.

### Rules

- Use an integer or another deliberately chosen ordering representation.
- Do not use floating-point values for ordering.
- Define a stable secondary sort key.
- Define how positions are initialized.
- Define how gaps are handled.
- Define how records are moved between columns.
- Ensure the database and service layer preserve valid ordering.
- Handle concurrent reordering operations safely.

### Integer Position Strategy

A basic implementation may use:

```text
column_id
position
```

with zero-based or one-based integer positions, chosen consistently.

For ordering within a column, a composite uniqueness constraint may be appropriate:

```text
UNIQUE(column_id, position)
```

However, this constraint requires a safe reorder strategy because intermediate updates may temporarily produce duplicate positions.

Use an appropriate approach, such as:

- A transaction with temporary position offsets.
- A deferrable unique constraint where supported and appropriate.
- A carefully designed sparse ordering strategy.

Do not blindly add a unique constraint without implementing and testing the corresponding reorder operation.

### Cross-Column Movement

When a card moves between columns:

- Verify access to the source and destination board.
- Verify that the destination column belongs to the intended board.
- Update the card's column and ordering atomically.
- Ensure the source and destination positions remain valid.
- Prevent partial updates if any operation fails.

## 12. Concurrency and Transaction Safety

Database writes MUST preserve consistency under concurrent requests.

### Transaction Rules

- Every logical write operation MUST have a clear transaction boundary.
- Multiple related updates MUST be committed atomically.
- Roll back failed transactions.
- Avoid committing inside helper functions participating in a larger operation.
- Use database transactions for operations that affect multiple records.
- Do not assume that application-level validation prevents concurrent conflicts.

### Concurrent Updates

Consider optimistic or pessimistic concurrency control where simultaneous changes could overwrite data or violate invariants.

Possible approaches:

- Optimistic version columns.
- Row-level locking using `SELECT ... FOR UPDATE`.
- Unique constraints.
- Atomic SQL updates.
- Transaction isolation appropriate to the operation.

Use the simplest strategy that protects the actual business invariant.

### Optimistic Locking

For records where lost updates are unacceptable, consider a version column and SQLAlchemy version tracking.

Example concept:

```text
version = 1
```

The version is checked and incremented during updates. Conflicting updates should produce a recognizable conflict response rather than silently overwriting newer data.

Do not introduce optimistic locking on every table without a clear requirement.

## 13. Model Design for the Task Management Domain

Database models MUST reflect the approved requirements and design documents.

The following entities are examples of the current application domain, not permission to create every table without validating requirements.

| Entity | Purpose |
|---|---|
| User | Account and identity |
| Board | Container for a user's or team's work |
| BoardColumn | Ordered workflow stage within a board |
| Card | Task or work item within a column |
| Comment | Discussion attached to a card |
| ActivityLog | Historical record of relevant actions, if required |
| BoardMember | Board membership and permissions, if collaboration is required |

### Domain Integrity Rules

- Every private board MUST have a valid owner.
- A board column MUST belong to an existing board.
- A card MUST belong to a valid column.
- A comment MUST reference a valid card.
- Membership records MUST reference valid users and boards.
- A user MUST NOT gain resource access merely by knowing a UUID.
- Parent-child relationships MUST be validated when moving resources.
- Activity records MUST preserve the required historical context.

### Avoid Premature Tables

Do not introduce tables for speculative functionality such as:

- Teams.
- Workspaces.
- Invitations.
- Attachments.
- Notifications.
- Recurring tasks.

Add them only when approved requirements justify their existence.

## 14. Database Migrations (Alembic / Flask-Migrate)

All database schema changes MUST be version-controlled.

### Migration Rules

- Use Flask-Migrate/Alembic.
- Every schema change MUST include a migration.
- Never rely on production `db.create_all()` as a migration strategy.
- Review generated migration files before applying them.
- Do not blindly trust autogenerated migrations.
- Preserve existing data unless destructive changes are explicitly required.
- Keep migrations committed to version control.
- Test migrations against a representative database state.
- Do not edit an already-applied migration as a way to modify production schema history.

### Migration Safety

For potentially destructive changes:

1. Inspect existing data and dependencies.
2. Define the data transformation.
3. Determine whether the change requires multiple deployment stages.
4. Preserve compatibility with the currently deployed application.
5. Test the upgrade against a representative database.
6. Define a recovery or forward-fix strategy.
7. Verify the resulting schema and data.

### Backward-Compatible Changes

Prefer expand-and-contract migrations for changes that cannot safely be deployed in one step.

Example:

1. Add a new nullable column.
2. Deploy code that supports both old and new representations.
3. Backfill existing records.
4. Verify data consistency.
5. Enforce the new constraint.
6. Remove the obsolete column in a later migration.

### Rollback

- Migration downgrade functions SHOULD be implemented where a safe reversal is possible.
- Never assume a destructive migration can be fully reversed.
- Document irreversible transformations.
- Do not use downgrade as a substitute for a database backup.
- Production rollback plans MUST consider application-version compatibility.

## 15. Database Security

Database access MUST follow least-privilege principles.

### Credentials

- Store database credentials in environment variables or an approved secret manager.
- Never commit credentials to source control.
- Use separate credentials for development, testing, and production.
- Do not expose database URLs or credentials in logs.
- Rotate credentials when compromise is suspected.

### Permissions

- The application database user MUST have only the permissions required by the application.
- Avoid using PostgreSQL superuser accounts for application connections.
- Restrict migration privileges where the deployment architecture supports a separate migration identity.
- Do not expose the database directly to public networks unless explicitly required and securely controlled.

### Sensitive Data

- Store password hashes, never plaintext passwords.
- Do not log sensitive personal information unnecessarily.
- Do not store secrets in ordinary database fields without an approved security design.
- Define retention and deletion policies for sensitive data.
- Avoid returning sensitive model fields through API serialization.

## 16. Backup and Recovery

Production data MUST have a documented backup and recovery strategy.

### Rules

- Define backup frequency according to business recovery requirements.
- Define recovery point objective (RPO) and recovery time objective (RTO) when the application requires them.
- Protect backups with appropriate access controls and encryption.
- Keep backup access separate from ordinary application access.
- Test restoration periodically.
- Document the recovery procedure.
- Do not treat successful backup creation as proof that recovery works.

Backup retention and restore testing MUST align with the deployment environment and operational requirements.

## 17. Database Testing Standards

Use Pytest with an isolated PostgreSQL test database where database-specific behavior matters.

### Model Tests

Test:

- Table and column definitions.
- Primary-key generation.
- Required and nullable fields.
- Defaults.
- Relationships.
- Foreign-key behavior.
- Unique constraints.
- Check constraints.
- Deletion behavior.
- Timestamp behavior.

### Integrity Tests

Verify:

- Invalid foreign keys are rejected.
- Duplicate unique values are rejected.
- Required fields cannot be omitted.
- Invalid parent-child relationships are prevented.
- Soft-deleted records follow the defined visibility rules.
- Cascade behavior does not remove unrelated records.
- Ordering constraints remain valid after reordering.

### Transaction Tests

Verify:

- Failed operations roll back correctly.
- Multi-record operations are atomic.
- Concurrent updates do not silently corrupt important state.
- Unique constraint conflicts are handled correctly.
- Failed migrations do not leave an unexpected partial schema.

### Migration Tests

- Test fresh database creation from migrations.
- Test upgrades from representative previous schema versions.
- Verify data preservation during migrations.
- Test destructive migration plans before production rollout.

### Test Isolation

- Never run automated tests against production.
- Use predictable fixtures.
- Clean up test data reliably.
- Avoid sharing mutable database state across tests.
- Use PostgreSQL when tests depend on PostgreSQL-specific behavior; SQLite is not a complete substitute for PostgreSQL.

## 18. Performance and Maintenance

- Monitor slow queries and database resource usage.
- Inspect query plans for expensive queries.
- Review index effectiveness.
- Remove unused indexes only after verifying they are not required by other workloads.
- Avoid unbounded collection queries.
- Use pagination for potentially large datasets.
- Avoid loading unnecessary relationships.
- Keep database connection pooling appropriately configured.
- Avoid long-running transactions.
- Use database maintenance features appropriate to PostgreSQL and the deployment environment.
- Do not optimize based on assumptions without evidence.

## 19. AI Coding Agent Instructions

AI coding agents MUST follow these rules when creating or modifying database code.

### Before Implementation

1. Inspect the existing SQLAlchemy version and model conventions.
2. Read the relevant model files.
3. Inspect related foreign keys and relationships.
4. Read the applicable requirements and design documents.
5. Identify affected service operations and API contracts.
6. Check existing migrations before changing the schema.
7. Identify data-retention, deletion, and ownership implications.

### During Implementation

- Reuse existing model mixins and conventions.
- Use the established SQLAlchemy style.
- Do not mix SQLAlchemy 1.x and 2.x patterns unnecessarily.
- Do not rename existing tables or columns without explicit justification.
- Do not add `deleted_at` to every model automatically.
- Do not add relationships or cascade behavior without understanding their lifecycle.
- Do not apply `lazy="joined"` globally.
- Do not add indexes or constraints without understanding their effects.
- Do not create speculative tables or columns.
- Do not modify production data through ad-hoc scripts.
- Include migrations for schema changes.
- Preserve existing data and API compatibility.
- Add tests for changed database behavior.

### After Implementation

- Run relevant model and integration tests.
- Verify foreign keys and constraints.
- Verify relationships and deletion behavior.
- Review generated migrations.
- Test migrations where practical.
- Check that affected queries still behave correctly.
- Report:
  - Models and files changed.
  - Schema changes.
  - Migration files created.
  - Constraints and indexes added.
  - Data-retention or deletion implications.
  - Tests actually executed.
  - Known limitations.

Never claim a migration or database operation succeeded unless it was actually executed and verified.

## 20. Definition of Done

A database change is complete only when:

- [ ] Table and column names follow established conventions.
- [ ] Primary keys and foreign keys use compatible types.
- [ ] Relationships accurately represent domain ownership.
- [ ] Nullability and defaults are intentional.
- [ ] Important integrity rules are enforced by database constraints.
- [ ] Indexes support justified query patterns.
- [ ] Timestamp behavior is consistent.
- [ ] Deletion and retention behavior is defined.
- [ ] Transactions preserve data integrity.
- [ ] Concurrent updates are handled where necessary.
- [ ] Migrations are included and reviewed.
- [ ] Existing data is preserved or transformed safely.
- [ ] Relevant database tests are implemented and pass.
- [ ] No unrelated schema changes have been introduced.

## 21. Engineering Decision Priority

When database decisions conflict, follow this priority:

1. Data integrity and security.
2. Correctness of domain relationships.
3. Safe migrations and data preservation.
4. Transaction and concurrency safety.
5. Maintainability and consistency.
6. Query correctness and performance.
7. Storage efficiency.
8. Developer convenience and stylistic preferences.

Never sacrifice data integrity or migration safety for arbitrary naming preferences, premature optimization, or unnecessary abstraction.