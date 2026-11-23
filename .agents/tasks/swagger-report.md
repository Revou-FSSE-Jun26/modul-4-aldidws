# Swagger / Flasgger Integration Report

## 1. Flasgger Install Output

```
Requirement already satisfied: flasgger in .\venv\Lib\site-packages (0.9.7.1)
Requirement already satisfied: Flask>=0.10 in .\venv\Lib\site-packages (from flasgger) (3.1.3)
Requirement already satisfied: PyYAML>=3.0 in .\venv\Lib\site-packages (from flasgger) (6.0.4)
Requirement already satisfied: jsonschema>=3.0.1 in .\venv\Lib\site-packages (from flasgger) (4.26.0)
Requirement already satisfied: mistune in .\venv\Lib\site-packages (from flasgger) (3.4.0)
Requirement already satisfied: six>=1.10.0 in .\venv\Lib\site-packages (from flasgger) (1.17.0)
Requirement already satisfied: packaging in .\venv\Lib\site-packages (from flasgger) (26.3)
(flasgger was already installed — no installation required)
```

## 2. Route Files Modified

| File | Change |
|---|---|
| `app/__init__.py` | Fixed duplicate `create_app` syntax error; added `Swagger(app)` and `SWAGGER` config |
| `app/blueprints/auth/routes.py` | Added YAML docstrings to `register` and `login` |
| `app/blueprints/boards/routes.py` | Added YAML docstrings to all 5 board routes |
| `app/blueprints/columns/routes.py` | Added YAML docstrings to all 4 column routes |
| `app/blueprints/cards/routes.py` | Added YAML docstrings to all 4 card routes |
| `app/blueprints/comments/routes.py` | Added YAML docstrings to all 4 comment routes |
| `app/blueprints/notifications/routes.py` | Added YAML docstrings to both notification routes |
| `app/blueprints/analytics/routes.py` | Added YAML docstring to `board_summary` |
| `app/blueprints/users/routes.py` | Added YAML docstrings to `get_me` and `update_me` |

## 3. Swagger UI URL

**http://127.0.0.1:5000/apidocs**

Also available:
- OpenAPI JSON spec: http://127.0.0.1:5000/apispec_1.json

Registered Swagger routes confirmed:
```
/flasgger_static/<path:filename>
/apidocs/
/apidocs/index.html
/apispec_1.json
```

## 4. pytest Results

```
============================================================= test session starts =============================================================
platform win32 -- Python 3.14.6, pytest-9.2.0, pluggy-1.7.0
collected 13 items

tests/test_auth_service.py::test_register_user_success PASSED                           [  7%]
tests/test_auth_service.py::test_register_duplicate_email_raises_conflict PASSED        [ 15%]
tests/test_auth_service.py::test_login_user_success PASSED                              [ 23%]
tests/test_auth_service.py::test_login_wrong_password_raises_invalid_credentials PASSED [ 30%]
tests/test_cards_service.py::test_move_card_same_column PASSED                          [ 38%]
tests/test_cards_service.py::test_move_card_different_column PASSED                     [ 46%]
tests/test_cards_service.py::test_move_card_not_found PASSED                            [ 53%]
tests/test_cards_service.py::test_move_card_wrong_user_column_raises_column_not_found PASSED [ 61%]
tests/test_cards_service.py::test_move_card_renormalised_positions PASSED               [ 69%]
tests/test_comments.py::test_create_comment_returns_201 PASSED                          [ 76%]
tests/test_comments.py::test_missing_body_returns_400 PASSED                            [ 84%]
tests/test_comments.py::test_unauthenticated_returns_401 PASSED                         [ 92%]
tests/test_comments.py::test_forbidden_returns_403_or_404_for_other_users_card PASSED   [100%]

======================================================= 13 passed, 8 warnings in 3.52s ========================================================
```

All 13 tests pass. Warnings are non-critical (JWT HMAC key length advisory from the test config).

## 5. How to Authenticate in Swagger UI

### Step 1 — Start the backend

```bash
cd c:\Users\aldid\modulAIdevelopment
venv\Scripts\activate
flask run
```

### Step 2 — Obtain a token

Open Swagger UI at **http://127.0.0.1:5000/apidocs**.

Expand **Auth → POST /api/auth/login**, click **Try it out**, enter:

```json
{
  "email": "your@email.com",
  "password": "yourpassword"
}
```

Click **Execute**. Copy the `access_token` value from the response body.

### Step 3 — Authorize

a. Click the **Authorize** button (lock icon) at the top-right of the Swagger UI page.  
b. In the **BearerAuth** field, enter:

```
Bearer <your_access_token>
```

(Replace `<your_access_token>` with the token you copied.)

c. Click **Authorize**, then **Close**.

### Step 4 — Use protected endpoints

All protected endpoints now automatically send the `Authorization: Bearer <token>` header with every request you execute from the UI.

### Notes

- The `register` and `login` routes under **Auth** do not require a token and can be called without authorizing.
- Tokens expire according to the `JWT_ACCESS_TOKEN_EXPIRES` setting in `app/.env`. If a request returns 401, repeat steps 2–3 to get a fresh token.
