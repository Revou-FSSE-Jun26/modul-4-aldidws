"""add_labels_and_card_labels

Adds the ``labels`` and ``card_labels`` tables. Additive and backward
compatible: no existing table is changed and the previously deployed code never
references the new tables. Downgrade drops both tables (and all labels).

Revision ID: 43535c2f36bf
Revises: 421f6e5e8ae5
Create Date: 2026-11-25 05:01:37.991276

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '43535c2f36bf'
down_revision = '421f6e5e8ae5'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'labels',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('board_id', sa.Uuid(), nullable=False),
        sa.Column('name', sa.String(length=50), nullable=False),
        sa.Column('color', sa.String(length=16), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint(
            "color IN ('blue','sky','graphite','silver','red','orange','green','purple')",
            name='ck_labels_color',
        ),
        sa.CheckConstraint('length(btrim(name)) BETWEEN 1 AND 50', name='ck_labels_name_not_blank'),
        sa.ForeignKeyConstraint(['board_id'], ['boards.id'], name='fk_labels_board_id_boards', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id', name='pk_labels'),
    )
    op.create_index(
        'uq_labels_board_id_lower_name',
        'labels',
        ['board_id', sa.literal_column('lower(name)')],
        unique=True,
    )
    op.create_table(
        'card_labels',
        sa.Column('card_id', sa.Uuid(), nullable=False),
        sa.Column('label_id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['card_id'], ['cards.id'], name='fk_card_labels_card_id_cards', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['label_id'], ['labels.id'], name='fk_card_labels_label_id_labels', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('card_id', 'label_id', name='pk_card_labels'),
    )
    op.create_index('ix_card_labels_label_id', 'card_labels', ['label_id'], unique=False)


def downgrade():
    op.drop_index('ix_card_labels_label_id', table_name='card_labels')
    op.drop_table('card_labels')
    op.drop_index('uq_labels_board_id_lower_name', table_name='labels')
    op.drop_table('labels')
