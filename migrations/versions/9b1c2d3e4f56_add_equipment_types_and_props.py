"""add equipment types and equipment properties

Revision ID: 9b1c2d3e4f56
Revises: f3a1d2b4c6e7
Create Date: 2025-08-23

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '9b1c2d3e4f56'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # Create equipment_types table
    op.create_table(
        'equipment_types',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('fields', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
    )
    op.create_unique_constraint('uq_equipment_types_name', 'equipment_types', ['name'])

    # Add columns to equipment
    with op.batch_alter_table('equipment') as batch:
        batch.add_column(sa.Column('equipment_type_id', sa.Integer(), nullable=True))
        batch.add_column(sa.Column('properties', sa.JSON(), nullable=True))
        batch.create_index('ix_equipment_equipment_type_id', ['equipment_type_id'])
        batch.create_foreign_key('fk_equipment_equipment_type', 'equipment_types', ['equipment_type_id'], ['id'])


def downgrade():
    # Drop columns and constraints from equipment
    with op.batch_alter_table('equipment') as batch:
        batch.drop_constraint('fk_equipment_equipment_type', type_='foreignkey')
        batch.drop_index('ix_equipment_equipment_type_id')
        batch.drop_column('properties')
        batch.drop_column('equipment_type_id')

    # Drop equipment_types table
    op.drop_constraint('uq_equipment_types_name', 'equipment_types', type_='unique')
    op.drop_table('equipment_types')
