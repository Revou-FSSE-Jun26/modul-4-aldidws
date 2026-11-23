"""Columns route handlers."""

import uuid

from flask import jsonify, request

from app.blueprints.auth.decorators import token_required
from app.blueprints.columns import columns_bp
from app.blueprints.columns import service
from app.blueprints.columns.schema import (
    CreateColumnSchema,
    ReorderColumnsSchema,
    UpdateColumnSchema,
    column_to_dict,
)


# ---------------------------------------------------------------------------
# Create column
# Registered at /api/boards/<board_id>/columns via the "columns_boards"
# registration in app/__init__.py.
# ---------------------------------------------------------------------------


@columns_bp.route("/<board_id>/columns", methods=["POST"])
@token_required
def create_column(current_user, board_id):
    """Create a new column inside a board.
    ---
    tags:
      - Columns
    security:
      - BearerAuth: []
    parameters:
      - name: board_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - name
            properties:
              name:
                type: string
                example: To Do
              position:
                type: number
                example: 1
    responses:
      201:
        description: Column created successfully.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
      400:
        description: Validation error.
      404:
        description: Board not found.
    """
    data = CreateColumnSchema().load(request.get_json() or {})
    col = service.create_column(current_user, uuid.UUID(board_id), data)
    return jsonify({"data": column_to_dict(col)}), 201


# ---------------------------------------------------------------------------
# Column-level routes
# Registered at /api/columns/<column_id> via the primary columns_bp
# registration in app/__init__.py.
# ---------------------------------------------------------------------------


@columns_bp.route("/<column_id>", methods=["PATCH"])
@token_required
def update_column(current_user, column_id):
    """Rename a column.
    ---
    tags:
      - Columns
    security:
      - BearerAuth: []
    parameters:
      - name: column_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              name:
                type: string
                example: In Progress
    responses:
      200:
        description: Updated column data.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
      404:
        description: Column not found.
    """
    data = UpdateColumnSchema().load(request.get_json() or {}, partial=True)
    col = service.update_column(current_user, uuid.UUID(column_id), data)
    return jsonify({"data": column_to_dict(col)}), 200


@columns_bp.route("/<column_id>", methods=["DELETE"])
@token_required
def delete_column(current_user, column_id):
    """Delete a column.
    ---
    tags:
      - Columns
    security:
      - BearerAuth: []
    parameters:
      - name: column_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      204:
        description: Column deleted successfully.
      404:
        description: Column not found.
    """
    service.delete_column(current_user, uuid.UUID(column_id))
    return "", 204


# ---------------------------------------------------------------------------
# Reorder columns
# Registered at /api/boards/<board_id>/columns/reorder via the "columns_boards"
# registration in app/__init__.py.
# ---------------------------------------------------------------------------


@columns_bp.route("/<board_id>/columns/reorder", methods=["PATCH"])
@token_required
def reorder_columns(current_user, board_id):
    """Reorder all columns within a board.
    ---
    tags:
      - Columns
    security:
      - BearerAuth: []
    parameters:
      - name: board_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - ordered_ids
            properties:
              ordered_ids:
                type: array
                items:
                  type: string
                  format: uuid
                example:
                  - "11111111-1111-1111-1111-111111111111"
                  - "22222222-2222-2222-2222-222222222222"
    responses:
      200:
        description: Reordered column list.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: array
                  items:
                    type: object
      400:
        description: Validation error.
      404:
        description: Board not found.
    """
    data = ReorderColumnsSchema().load(request.get_json() or {})
    cols = service.reorder(uuid.UUID(board_id), current_user.id, data["ordered_ids"])
    return jsonify({"data": [column_to_dict(c) for c in cols]}), 200
