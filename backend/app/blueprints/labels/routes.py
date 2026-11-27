"""Labels route handlers (routes 27 to 31)."""
import uuid

from flask import jsonify, request

from app.blueprints.auth.decorators import token_required
from app.blueprints.cards.schema import card_to_dict
from app.blueprints.labels import labels_bp, service
from app.blueprints.labels.schema import (
    CreateLabelSchema,
    SetCardLabelsSchema,
    UpdateLabelSchema,
    label_to_dict,
    sort_labels,
)


@labels_bp.route("/boards/<uuid:board_id>/labels", methods=["GET"])
@token_required
def list_labels(current_user, board_id):
    """List the labels of a board.
    ---
    tags:
      - Labels
    security:
      - BearerAuth: []
    parameters:
      - name: board_id
        in: path
        required: true
        schema: {type: string, format: uuid}
    responses:
      200:
        description: Labels of the board, sorted by name.
      404:
        description: Board not found.
    """
    labels = sort_labels(service.list_labels(current_user, board_id))
    return jsonify({"data": [label_to_dict(l) for l in labels]}), 200


@labels_bp.route("/boards/<uuid:board_id>/labels", methods=["POST"])
@token_required
def create_label(current_user, board_id):
    """Create a label on a board.
    ---
    tags:
      - Labels
    security:
      - BearerAuth: []
    parameters:
      - name: board_id
        in: path
        required: true
        schema: {type: string, format: uuid}
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [name, color]
            properties:
              name: {type: string, maxLength: 50}
              color: {type: string, enum: [blue, sky, graphite, silver, red, orange, green, purple]}
    responses:
      201:
        description: Label created.
      400:
        description: Validation error.
      404:
        description: Board not found.
      409:
        description: A label with that name already exists.
    """
    data = CreateLabelSchema().load(request.get_json(silent=True) or {})
    label = service.create_label(current_user, board_id, data)
    return jsonify({"data": label_to_dict(label)}), 201


@labels_bp.route("/labels/<uuid:label_id>", methods=["PATCH"])
@token_required
def update_label(current_user, label_id):
    """Rename or recolour a label.
    ---
    tags:
      - Labels
    security:
      - BearerAuth: []
    parameters:
      - name: label_id
        in: path
        required: true
        schema: {type: string, format: uuid}
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              name: {type: string, maxLength: 50}
              color: {type: string, enum: [blue, sky, graphite, silver, red, orange, green, purple]}
    responses:
      200:
        description: Label updated.
      400:
        description: Validation error (at least one field is required).
      404:
        description: Label not found.
      409:
        description: A label with that name already exists.
    """
    data = UpdateLabelSchema().load(request.get_json(silent=True) or {})
    label = service.update_label(current_user, label_id, data)
    return jsonify({"data": label_to_dict(label)}), 200


@labels_bp.route("/labels/<uuid:label_id>", methods=["DELETE"])
@token_required
def delete_label(current_user, label_id):
    """Delete a label and remove it from all cards.
    ---
    tags:
      - Labels
    security:
      - BearerAuth: []
    parameters:
      - name: label_id
        in: path
        required: true
        schema: {type: string, format: uuid}
    responses:
      204:
        description: Label deleted.
      404:
        description: Label not found.
    """
    service.delete_label(current_user, label_id)
    return "", 204


@labels_bp.route("/v1/cards/<uuid:card_id>/labels", methods=["PUT"])
@token_required
def set_card_labels(current_user, card_id):
    """Replace the labels of a card.
    ---
    tags:
      - Labels
    security:
      - BearerAuth: []
    parameters:
      - name: card_id
        in: path
        required: true
        schema: {type: string, format: uuid}
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required: [label_ids]
            properties:
              label_ids:
                type: array
                maxItems: 20
                items: {type: string, format: uuid}
    responses:
      200:
        description: The card with its labels.
      400:
        description: Validation error.
      404:
        description: Card or label not found.
    """
    data = SetCardLabelsSchema().load(request.get_json(silent=True) or {})
    card = service.set_card_labels(current_user, card_id, data["label_ids"])
    return jsonify({"data": card_to_dict(card)}), 200
