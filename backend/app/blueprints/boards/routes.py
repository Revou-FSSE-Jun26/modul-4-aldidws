"""Boards route handlers."""

import uuid

from flask import jsonify, request

from app.blueprints.auth.decorators import token_required
from app.blueprints.boards import boards_bp
from app.blueprints.boards import service
from app.blueprints.boards.schema import (
    CreateBoardSchema,
    UpdateBoardSchema,
    board_detail_to_dict,
    board_to_dict,
)


@boards_bp.route("", methods=["POST"])
@token_required
def create_board(current_user):
    """Create a new board.
    ---
    tags:
      - Boards
    security:
      - BearerAuth: []
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
                example: My Board
    responses:
      201:
        description: Board created successfully.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
      400:
        description: Validation error.
    """
    data = CreateBoardSchema().load(request.get_json() or {})
    board = service.create_board(current_user, data["name"])
    return jsonify({"data": board_to_dict(board)}), 201


@boards_bp.route("", methods=["GET"])
@token_required
def list_boards(current_user):
    """List all boards accessible to the authenticated user.
    ---
    tags:
      - Boards
    security:
      - BearerAuth: []
    responses:
      200:
        description: Array of boards.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: array
                  items:
                    type: object
    """
    boards, roles = service.list_boards(current_user)
    return (
        jsonify({"data": [board_to_dict(b, role=roles.get(b.id)) for b in boards]}),
        200,
    )


@boards_bp.route("/<board_id>", methods=["GET"])
@token_required
def get_board(current_user, board_id):
    """Retrieve a board with its columns (by position) and live cards (by order).
    ---
    tags:
      - Boards
    security:
      - BearerAuth: []
    parameters:
      - name: board_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      200:
        description: Board data.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
      404:
        description: Board not found.
    """
    board, columns, cards_by_column, labels, members, can_move_by_card, assignees_by_card = (
        service.get_board_detail(current_user, uuid.UUID(board_id))
    )
    return (
        jsonify(
            {
                "data": board_detail_to_dict(
                    board,
                    columns,
                    cards_by_column,
                    labels,
                    members=members,
                    can_move_by_card=can_move_by_card,
                    assignees_by_card=assignees_by_card,
                    caller_id=str(current_user.id),
                )
            }
        ),
        200,
    )


@boards_bp.route("/<board_id>", methods=["PATCH"])
@token_required
def update_board(current_user, board_id):
    """Update board information.
    ---
    tags:
      - Boards
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
            properties:
              name:
                type: string
                example: Renamed Board
    responses:
      200:
        description: Updated board data.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
      404:
        description: Board not found.
    """
    data = UpdateBoardSchema().load(request.get_json() or {})
    board = service.update_board(current_user, uuid.UUID(board_id), data)
    return jsonify({"data": board_to_dict(board)}), 200


@boards_bp.route("/<board_id>", methods=["DELETE"])
@token_required
def delete_board(current_user, board_id):
    """Delete a board.
    ---
    tags:
      - Boards
    security:
      - BearerAuth: []
    parameters:
      - name: board_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      204:
        description: Board deleted successfully.
      404:
        description: Board not found.
    """
    service.delete_board(current_user, uuid.UUID(board_id))
    return "", 204
