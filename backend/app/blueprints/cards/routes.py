"""Cards route handlers."""

import uuid

from flask import jsonify, request

from app.blueprints.auth.decorators import token_required
from app.blueprints.cards import cards_bp
from app.blueprints.cards import service
from app.blueprints.cards.schema import (
    CardPositionSchema,
    CreateCardSchema,
    UpdateCardSchema,
    card_to_dict,
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
    """Delete a card.
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
