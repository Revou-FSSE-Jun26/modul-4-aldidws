"""Unit tests for the board-membership service layer.

These tests exercise the service functions directly (no HTTP) and mock the
database layer so they can run without a live Postgres instance.
"""

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.blueprints.members import service as members_service
from app.common.exceptions import (
    BoardNotFoundException,
    CardNotFoundException,
    ResourceConflictException,
    UserNotFoundException,
)
from app.models.board import Board
from app.models.board_member import BoardMember
from app.models.card import Card
from app.models.user import User

# Fixed UUIDs used throughout the test file.
BOARD_ID = uuid.UUID("11111111-aaaa-bbbb-cccc-111111111111")
OWNER_ID = uuid.UUID("22222222-aaaa-bbbb-cccc-222222222222")
MEMBER_ID = uuid.UUID("33333333-aaaa-bbbb-cccc-333333333333")
OTHER_ID = uuid.UUID("44444444-aaaa-bbbb-cccc-444444444444")
CARD_ID = uuid.UUID("55555555-aaaa-bbbb-cccc-555555555555")
COL_ID = uuid.UUID("66666666-aaaa-bbbb-cccc-666666666666")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_user(user_id: uuid.UUID, name="Test User"):
    u = MagicMock(spec=User)
    u.id = user_id
    u.name = name
    u.email = f"{user_id}@example.com"
    return u


def _mock_board(board_id: uuid.UUID, owner_id: uuid.UUID):
    b = MagicMock(spec=Board)
    b.id = board_id
    b.owner_id = owner_id
    b.name = "Test Board"
    return b


def _mock_card(card_id: uuid.UUID, column_id: uuid.UUID):
    c = MagicMock(spec=Card)
    c.id = card_id
    c.column_id = column_id
    c.owner_id = OWNER_ID
    return c


# ---------------------------------------------------------------------------
# invite_member
# ---------------------------------------------------------------------------

class TestInviteMember:
    def test_raises_when_no_user_with_email(self):
        """When no registered account matches the email, raise UserNotFound."""
        with patch.object(members_service, "get_board_for_user") as mock_get_board, \
             patch("app.blueprints.members.service.db") as mock_db:
            mock_get_board.return_value = _mock_board(BOARD_ID, OWNER_ID)
            mock_db.session.execute.return_value = MagicMock(
                scalar_one_or_none=lambda: None
            )

            with pytest.raises(UserNotFoundException):
                members_service.invite_member(
                    _mock_user(OWNER_ID), BOARD_ID, "nobody@example.com"
                )

    def test_raises_when_already_member(self):
        """When the target already has a membership row, raise 409."""
        existing = MagicMock(spec=BoardMember)
        with patch.object(members_service, "get_board_for_user") as mock_get_board, \
             patch("app.blueprints.members.service.db") as mock_db:
            mock_get_board.return_value = _mock_board(BOARD_ID, OWNER_ID)
            # First call: find invitee. Second call: check existing membership.
            mock_db.session.execute.side_effect = [
                MagicMock(scalar_one_or_none=lambda: _mock_user(MEMBER_ID)),
                MagicMock(scalar_one_or_none=lambda: existing),
            ]

            with pytest.raises(ResourceConflictException):
                members_service.invite_member(
                    _mock_user(OWNER_ID), BOARD_ID, "33333333@example.com"
                )

    def test_creates_membership_on_happy_path(self):
        """Happy path: creates a BoardMember row and stages a notification."""
        with patch.object(members_service, "get_board_for_user") as mock_get_board, \
             patch("app.blueprints.members.service.db") as mock_db, \
             patch.object(members_service, "notify_member_invited") as mock_notify:
            mock_get_board.return_value = _mock_board(BOARD_ID, OWNER_ID)
            mock_db.session.execute.side_effect = [
                MagicMock(scalar_one_or_none=lambda: _mock_user(MEMBER_ID)),
                MagicMock(scalar_one_or_none=lambda: None),
            ]
            mock_db.session.add = MagicMock()
            mock_db.session.commit = MagicMock()
            mock_db.session.rollback = MagicMock()

            result = members_service.invite_member(
                _mock_user(OWNER_ID), BOARD_ID, "33333333@example.com"
            )

            assert isinstance(result, BoardMember)
            mock_db.session.commit.assert_called_once()
            mock_notify.assert_called_once()


# ---------------------------------------------------------------------------
# list_members
# ---------------------------------------------------------------------------

class TestListMembers:
    def test_returns_pairs(self):
        """Returns a list of (BoardMember, User) tuples, owner first."""
        owner_m = MagicMock(spec=BoardMember)
        owner_m.role = "owner"
        member_m = MagicMock(spec=BoardMember)
        member_m.role = "member"
        owner_u = _mock_user(OWNER_ID)
        member_u = _mock_user(MEMBER_ID)

        with patch.object(members_service, "get_board_for_user") as mock_get_board, \
             patch("app.blueprints.members.service.db") as mock_db:
            mock_get_board.return_value = _mock_board(BOARD_ID, OWNER_ID)
            mock_db.session.execute.return_value = MagicMock(
                all=lambda: [(owner_m, owner_u), (member_m, member_u)]
            )

            result = members_service.list_members(_mock_user(OWNER_ID), BOARD_ID)

            assert len(result) == 2
            assert result[0][0].role == "owner"
            assert result[1][0].role == "member"


# ---------------------------------------------------------------------------
# remove_member
# ---------------------------------------------------------------------------

class TestRemoveMember:
    def test_raises_when_removing_owner(self):
        """The owner row cannot be removed; must transfer ownership first."""
        owner_row = MagicMock(spec=BoardMember)
        owner_row.role = "owner"

        with patch.object(members_service, "get_board_for_user") as mock_get_board, \
             patch("app.blueprints.members.service.db") as mock_db:
            mock_get_board.return_value = _mock_board(BOARD_ID, OWNER_ID)
            mock_db.session.execute.return_value = MagicMock(
                scalar_one_or_none=lambda: owner_row
            )

            with pytest.raises(ResourceConflictException):
                members_service.remove_member(
                    _mock_user(OWNER_ID), BOARD_ID, OWNER_ID
                )

    def test_raises_when_member_does_not_exist(self):
        """When no membership row exists, raise 404 (non-disclosing)."""
        with patch.object(members_service, "get_board_for_user") as mock_get_board, \
             patch("app.blueprints.members.service.db") as mock_db:
            mock_get_board.return_value = _mock_board(BOARD_ID, OWNER_ID)
            mock_db.session.execute.return_value = MagicMock(
                scalar_one_or_none=lambda: None
            )

            with pytest.raises(BoardNotFoundException):
                members_service.remove_member(
                    _mock_user(OWNER_ID), BOARD_ID, OTHER_ID
                )

    def test_removes_membership_on_happy_path(self):
        """Happy path: removes the membership row and commits."""
        member_row = MagicMock(spec=BoardMember)
        member_row.role = "member"

        with patch.object(members_service, "get_board_for_user") as mock_get_board, \
             patch("app.blueprints.members.service.db") as mock_db:
            mock_get_board.return_value = _mock_board(BOARD_ID, OWNER_ID)
            mock_db.session.execute.return_value = MagicMock(
                scalar_one_or_none=lambda: member_row
            )
            mock_db.session.delete = MagicMock()
            mock_db.session.commit = MagicMock()

            members_service.remove_member(
                _mock_user(OWNER_ID), BOARD_ID, MEMBER_ID
            )
            mock_db.session.delete.assert_called_once_with(member_row)
            mock_db.session.commit.assert_called_once()


# ---------------------------------------------------------------------------
# set_card_assignees
# ---------------------------------------------------------------------------

class TestSetCardAssignees:
    def test_raises_when_user_not_board_member(self):
        """Tagging a user who is not a board member raises CardNotFound."""
        card = _mock_card(CARD_ID, COL_ID)
        with patch.object(members_service, "get_card_for_user") as mock_get_card, \
             patch.object(members_service, "get_board_for_user") as mock_get_board, \
             patch("app.blueprints.members.service.db") as mock_db:
            mock_get_card.return_value = card
            # db.session.execute calls inside set_card_assignees:
            #   1. find board_id from column_id
            #   2. get member ids
            mock_db.session.execute.side_effect = [
                MagicMock(scalar_one=lambda: BOARD_ID),
                MagicMock(scalars=lambda: MagicMock(all=lambda: [OWNER_ID])),
            ]

            with pytest.raises(CardNotFoundException):
                members_service.set_card_assignees(
                    _mock_user(OWNER_ID), CARD_ID, [OTHER_ID]
                )

    def test_replaces_tags_on_happy_path(self):
        """Calling with a new user list removes old tags and adds new ones."""
        card = _mock_card(CARD_ID, COL_ID)
        with patch.object(members_service, "get_card_for_user") as mock_get_card, \
             patch.object(members_service, "get_board_for_user") as mock_get_board, \
             patch("app.blueprints.members.service.db") as mock_db:
            mock_get_card.return_value = card
            mock_db.session.execute.side_effect = [
                MagicMock(scalar_one=lambda: BOARD_ID),       # 1. find board_id
                MagicMock(scalars=lambda: MagicMock(all=lambda: [OWNER_ID, MEMBER_ID])),  # 2. member ids
                MagicMock(),                                   # 3. DELETE card_assignees
            ]
            mock_db.session.add = MagicMock()
            mock_db.session.commit = MagicMock()
            mock_db.session.refresh = MagicMock()

            members_service.set_card_assignees(
                _mock_user(OWNER_ID), CARD_ID, [MEMBER_ID]
            )
            mock_db.session.commit.assert_called_once()

