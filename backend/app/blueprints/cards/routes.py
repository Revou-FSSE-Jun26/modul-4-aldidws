"""Cards route handlers."""

import uuid

from flask import jsonify, request

from app.blueprints.auth.decorators import token_required
from app.blueprints.cards import cards_bp
from app.blueprints.cards import service
from app.blueprints.cards.schema import (
    CardListQuerySchema,
    CardPositionSchema,
    CreateCardSchema,
    UpdateCardSchema,
    card_to_dict,
    card_with_context_to_dict,
)


# ---------------------------------------------------------------------------
# Create card
# Registered at /api/v1/columns/<column_id>/cards via the "cards_columns"
# registration in app/__init__.py (cards_bp registered a second time at
# url_prefix="/api/v1/columns" with name="cards_columns").
# ---------------------------------------------------------------------------


@cards_bp.route("/<column_id>/cards", methods=["POST"])
@token_required
def create_card(current_user, column_id):
    """Create a new card inside a column.
    ---
    tags:
      - Cards
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
            required:
              - title
            properties:
              title:
                type: string
                example: Implement login
              description:
                type: string
                example: Use JWT for authentication
              priority:
                type: string
                enum: [Low, Medium, High]
                example: Medium
              due_date:
                type: string
                format: date-time
                nullable: true
                description: ISO 8601 with a UTC offset, year 2000 to 2100.
                example: "2026-12-01T17:00:00Z"
              position:
                type: string
                enum: [top, bottom]
                default: bottom
                description: Place the new card at the top or bottom of the column.
    responses:
      201:
        description: Card created successfully.
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
    data = CreateCardSchema().load(request.get_json() or {})
    card = service.create_card(current_user, uuid.UUID(column_id), data)
    return jsonify({"data": card_to_dict(card)}), 201


@cards_bp.route("", methods=["GET"])
@token_required
def list_cards(current_user):
    """List live cards on boards owned by the caller, with search.
    ---
    tags:
      - Cards
    security:
      - BearerAuth: []
    parameters:
      - name: search
        in: query
        schema:
          type: string
          maxLength: 100
        description: Case-insensitive partial match on title or description.
      - name: board_id
        in: query
        schema:
          type: string
          format: uuid
      - name: mine
        in: query
        schema:
          type: boolean
          default: false
        description: When true, only cards created by the caller.
      - name: page
        in: query
        schema:
          type: integer
          minimum: 1
          default: 1
      - name: per_page
        in: query
        schema:
          type: integer
          minimum: 1
          maximum: 100
          default: 20
    responses:
      200:
        description: Cards (with board_id, board_name, column_name) and meta.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: array
                  items:
                    type: object
                meta:
                  type: object
                  properties:
                    page:
                      type: integer
                    per_page:
                      type: integer
                    total:
                      type: integer
      400:
        description: Invalid or unknown query parameter.
      401:
        description: Authentication required.
    """
    args = request.args
    params = {}
    for key in args.keys():
        values = args.getlist(key)
        # A repeated key is ambiguous; send a list so the schema rejects it.
        params[key] = values[0] if len(values) == 1 else values
    filters = CardListQuerySchema().load(params)
    rows, total = service.list_cards(current_user, filters)
    # Each row is now a 5-tuple: (card, column_name, board_id, board_name, assignee_ids)
    return jsonify({
        "data": [
            card_with_context_to_dict(
                (card, col_name, b_id, b_name, assignee_ids),
                assignee_ids=assignee_ids,
            )
            for (card, col_name, b_id, b_name, assignee_ids) in rows
        ],
        "meta": {
            "page": filters["page"],
            "per_page": filters["per_page"],
            "total": total,
        },
    }), 200


# ---------------------------------------------------------------------------
# Card-level routes
# Registered at /api/v1/cards/<card_id> via the primary cards_bp registration.
# ---------------------------------------------------------------------------


@cards_bp.route("/<card_id>", methods=["PATCH"])
@token_required
def update_card(current_user, card_id):
    """Update a card's title or description.
    ---
    tags:
      - Cards
    security:
      - BearerAuth: []
    parameters:
      - name: card_id
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
              title:
                type: string
                example: Updated title
              description:
                type: string
                example: Updated description
              due_date:
                type: string
                format: date-time
                nullable: true
                description: ISO 8601 with a UTC offset, year 2000 to 2100. Omitted keeps the value, null clears it.
                example: "2026-12-01T17:00:00Z"
    responses:
      200:
        description: Updated card data.
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
      404:
        description: Card not found.
    """
    data = UpdateCardSchema().load(request.get_json() or {}, partial=True)
    card = service.update_card(current_user, uuid.UUID(card_id), data)
    return jsonify({"data": card_to_dict(card)}), 200


@cards_bp.route("/<card_id>", methods=["DELETE"])
@token_required
def delete_card(current_user, card_id):
    """Soft-delete a card (sets deleted_at; hidden from all reads).
    ---
    tags:
      - Cards
    security:
      - BearerAuth: []
    parameters:
      - name: card_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      204:
        description: Card deleted successfully.
      404:
        description: Card not found.
    """
    service.delete_card(current_user, uuid.UUID(card_id))
    return "", 204


@cards_bp.route("/<card_id>/position", methods=["PATCH"])
@token_required
def move_card(current_user, card_id):
    """Move a card to a different column and/or position.
    ---
    tags:
      - Cards
    security:
      - BearerAuth: []
    parameters:
      - name: card_id
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
              - column_id
              - order
            properties:
              column_id:
                type: string
                format: uuid
                example: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
              order:
                type: number
                format: float
                example: 1.5
    responses:
      200:
        description: Card moved successfully.
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
        description: Card or column not found.
    """
    data = CardPositionSchema().load(request.get_json() or {})
    card = service.move_card(
        current_user,
        uuid.UUID(card_id),
        data["column_id"],   # already a uuid.UUID from marshmallow fields.UUID
        data["order"],
    )
    return jsonify({"data": card_to_dict(card)}), 200
