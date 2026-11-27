"""add board_members and card_assignees

Introduces two new tables:

- ``board_members`` (board_id, user_id, role): a user's membership in a
  board.  ``role`` is ``'owner'`` or ``'member'``.  Existing boards are
  backfilled with an owner row so every access check in the application
  can go through this table.
- ``card_assignees`` (card_id, user_id): tags linking a board member to
  a specific card they are allowed to move.

Both use ON DELETE CASCADE on their foreign keys so board/user/card
deletion cleans them up automatically.  The backfill is data-only and
non-destructive; the downgrade drops the two tables.

Revision ID: m0m1b0a2d5
Revises: d3f4v0r1t3
Create Date: 2026-11-27 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'm0m1b0a2d5'
down_revision = 'd3f4v0r1t3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'board_members',
        sa.Column('board_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('role', sa.String(length=16), nullable=False, server_default='member'),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.text('now()'),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint('board_id', 'user_id', name='pk_board_members'),
        sa.UniqueConstraint('board_id', 'user_id', name='uq_board_members_board_user'),
        sa.CheckConstraint("role IN ('owner','member')", name='ck_board_members_role'),
        sa.ForeignKeyConstraint(
            ['board_id'], ['boards.id'], name='fk_board_members_board_id_boards',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['user_id'], ['users.id'], name='fk_board_members_user_id_users',
            ondelete='CASCADE',
        ),
    )
    op.create_index('ix_board_members_user_id', 'board_members', ['user_id'])

    # Backfill: every existing board's owner gets a first-class membership
    # row.  Data-only, non-destructive; runs once.
    op.execute(
        "INSERT INTO board_members (board_id, user_id, role, created_at) "
        "SELECT id, owner_id, 'owner', now() FROM boards"
    )

    op.create_table(
        'card_assignees',
        sa.Column('card_id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.PrimaryKeyConstraint('card_id', 'user_id', name='pk_card_assignees'),
        sa.ForeignKeyConstraint(
            ['card_id'], ['cards.id'], name='fk_card_assignees_card_id_cards',
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['user_id'], ['users.id'], name='fk_card_assignees_user_id_users',
            ondelete='CASCADE',
        ),
    )
    op.create_index('ix_card_assignees_user_id', 'card_assignees', ['user_id'])


def downgrade():
    op.drop_table('card_assignees')
    op.drop_table('board_members')
