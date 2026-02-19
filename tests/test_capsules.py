from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from app import create_app, db
from app.models import Capsule, User


@pytest.fixture()
def app(tmp_path, monkeypatch):
    db_path = tmp_path / "test_eco.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    flask_app = create_app()
    flask_app.config.update(TESTING=True)

    with flask_app.app_context():
        db.create_all()

    yield flask_app

    with flask_app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _create_user(app, email: str = "caps@test.local") -> User:
    with app.app_context():
        u = User(email=email)
        u.set_password("123456")
        db.session.add(u)
        db.session.commit()
        db.session.refresh(u)
        return u


def _login(client, user: User) -> None:
    with client.session_transaction() as session:
        session["_user_id"] = str(user.id)
        session["_fresh"] = True


def _create_capsule(app, user_id: int, **kwargs) -> Capsule:
    defaults = {
        "title": "Mi capsula",
        "message": "Mensaje sellado",
        "open_date": datetime.utcnow() + timedelta(hours=2),
    }
    defaults.update(kwargs)
    with app.app_context():
        c = Capsule(user_id=user_id, **defaults)
        db.session.add(c)
        db.session.commit()
        db.session.refresh(c)
        return c


def test_capsules_create_and_list(client, app):
    user = _create_user(app)
    _login(client, user)

    open_date = (datetime.utcnow() + timedelta(hours=1)).isoformat()
    resp = client.post(
        "/capsulas",
        json={
            "title": "Carta 2026",
            "artist": "Leiva",
            "message": "Abrir mas tarde",
            "open_date": open_date,
        },
    )
    assert resp.status_code == 201
    payload = resp.get_json()
    assert payload["ok"] is True
    assert payload["capsula"]["title"] == "Carta 2026"

    listed = client.get("/capsulas")
    assert listed.status_code == 200
    data = listed.get_json()
    assert data["ok"] is True
    assert data["total"] == 1
    assert len(data["cerradas"]) == 1
    assert len(data["abiertas"]) == 0


def test_capsules_free_plan_only_one_closed_active(client, app):
    user = _create_user(app, email="limit@test.local")
    _login(client, user)

    first_open_date = (datetime.utcnow() + timedelta(hours=2)).isoformat()
    second_open_date = (datetime.utcnow() + timedelta(hours=3)).isoformat()

    first = client.post("/capsulas", json={"title": "Uno", "open_date": first_open_date})
    assert first.status_code == 201

    second = client.post("/capsulas", json={"title": "Dos", "open_date": second_open_date})
    assert second.status_code == 403
    assert "Plan Free" in second.get_json()["error"]


def test_capsules_open_denied_before_open_date_even_if_client_forces(client, app):
    user = _create_user(app, email="gate@test.local")
    _login(client, user)
    capsule = _create_capsule(
        app,
        user.id,
        title="Sagrada",
        open_date=datetime.utcnow() + timedelta(days=1),
    )

    resp = client.post(f"/capsulas/{capsule.id}/abrir", json={"force_open": True})
    assert resp.status_code == 403
    assert "aún no puede abrirse" in resp.get_json()["error"]


def test_capsules_open_success_when_server_time_allows(client, app):
    user = _create_user(app, email="open@test.local")
    _login(client, user)
    capsule = _create_capsule(
        app,
        user.id,
        title="Ya toca",
        open_date=datetime.utcnow() - timedelta(minutes=5),
    )

    opened = client.post(f"/capsulas/{capsule.id}/abrir")
    assert opened.status_code == 200
    opened_payload = opened.get_json()
    assert opened_payload["ok"] is True
    assert opened_payload["capsula"]["opened_at"] is not None

    listed = client.get("/capsulas")
    data = listed.get_json()
    assert len(data["abiertas"]) == 1
    assert len(data["cerradas"]) == 0
