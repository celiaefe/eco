from datetime import datetime
import uuid
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from . import db, login_manager


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    is_premium = db.Column(db.Boolean, default=False, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    capsules = db.relationship("Capsule", backref="user", lazy=True)
    memories = db.relationship("Memory", backref="user", lazy=True, cascade="all, delete-orphan")

    def set_password(self, password: str):
        self.password_hash = generate_password_hash(password, method="pbkdf2:sha256")

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


class Capsule(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)

    spotify_id = db.Column(db.String(64), nullable=True)
    title = db.Column(db.String(255), nullable=False)
    artist = db.Column(db.String(255), nullable=True)
    cover_url = db.Column(db.String(500), nullable=True)

    message = db.Column(db.Text, nullable=True)

    open_date = db.Column(db.DateTime, nullable=False)
    opened_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    @property
    def is_opened(self):
        return self.opened_at is not None


class Memory(db.Model):
    id = db.Column(db.String(32), primary_key=True, default=lambda: uuid.uuid4().hex)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False, index=True)

    titulo = db.Column(db.String(255), nullable=False)
    cancion = db.Column(db.String(255), nullable=False)
    artista = db.Column(db.String(255), nullable=True)
    spotify_url = db.Column(db.String(500), nullable=True)
    portada = db.Column(db.String(500), nullable=True)
    preview_url = db.Column(db.String(500), nullable=True)
    nota = db.Column(db.Text, nullable=False)
    foto_personal = db.Column(db.String(500), nullable=True)
    fecha = db.Column(db.String(20), nullable=False)
    favorito = db.Column(db.Boolean, default=False, nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
