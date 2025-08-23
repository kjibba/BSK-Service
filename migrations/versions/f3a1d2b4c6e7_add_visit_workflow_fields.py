"""add visit workflow fields

Revision ID: f3a1d2b4c6e7
Revises: ed08a9a8007b_add_materials_material_usage_employees_
Create Date: 2025-08-22

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f3a1d2b4c6e7'
down_revision = 'ed08a9a8007b'
branch_labels = None
depends_on = None


def upgrade():
    # Add workflow-related columns to visits
    with op.batch_alter_table('visits') as batch:
        batch.add_column(sa.Column('status', sa.String(length=20), nullable=True, server_default='Planlagt'))
        batch.add_column(sa.Column('assigned_technician_id', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('owner_technician_id', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('started_at', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('completed_at', sa.DateTime(), nullable=True))
        batch.add_column(sa.Column('oppsummering_notat', sa.Text(), nullable=True))
        batch.add_column(sa.Column('sjekk_advarselskilt', sa.Boolean(), nullable=True))
        batch.add_column(sa.Column('sjekk_agnstasjoner', sa.Boolean(), nullable=True))
        batch.add_column(sa.Column('sjekk_inngangspunkter', sa.Boolean(), nullable=True))
        batch.add_column(sa.Column('sjekk_fellefangst', sa.Boolean(), nullable=True))

    # Create helpful indexes
    op.create_index('ix_visits_status', 'visits', ['status'], unique=False)
    op.create_index('ix_visits_assigned_technician_id', 'visits', ['assigned_technician_id'], unique=False)
    op.create_index('ix_visits_owner_technician_id', 'visits', ['owner_technician_id'], unique=False)


def downgrade():
    # Drop indexes first
    op.drop_index('ix_visits_owner_technician_id', table_name='visits')
    op.drop_index('ix_visits_assigned_technician_id', table_name='visits')
    op.drop_index('ix_visits_status', table_name='visits')

    with op.batch_alter_table('visits') as batch:
        batch.drop_column('sjekk_fellefangst')
        batch.drop_column('sjekk_inngangspunkter')
        batch.drop_column('sjekk_agnstasjoner')
        batch.drop_column('sjekk_advarselskilt')
        batch.drop_column('oppsummering_notat')
        batch.drop_column('completed_at')
        batch.drop_column('started_at')
        batch.drop_column('owner_technician_id')
        batch.drop_column('assigned_technician_id')
        batch.drop_column('status')
