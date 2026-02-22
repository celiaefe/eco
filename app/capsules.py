from datetime import datetime

from flask import abort
from . import db
from .models import Capsule


def can_create_capsule(user):
    if bool(user.is_premium):
        return True

    active_closed = Capsule.query.filter(
        Capsule.user_id == user.id,
        Capsule.opened_at.is_(None),
        Capsule.open_date > datetime.utcnow(),
    ).count()
    return active_closed < 1


def open_capsule_or_403(capsule):
    now = datetime.utcnow()
    if now < capsule.open_date:
        abort(403)
    if capsule.opened_at is None:
        capsule.opened_at = now
        db.session.commit()
