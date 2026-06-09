import os
import secrets
from dotenv import load_dotenv
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager, current_user, login_user

load_dotenv()

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
login_manager.login_view = "main.index"


def _env_bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def create_app():
    running_on_vercel = bool(os.getenv("VERCEL"))
    instance_path = "/tmp/eco-instance" if running_on_vercel else None
    app = Flask(
        __name__,
        template_folder="../templates",
        static_folder="../static",
        instance_path=instance_path,
    )
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-me")

    # Local: sqlite. Render/prod: DATABASE_URL obligatorio.
    db_url = os.getenv("DATABASE_URL")
    running_on_render = bool(os.getenv("RENDER") or os.getenv("RENDER_EXTERNAL_URL"))
    if not db_url:
        if running_on_render:
            # Fallback defensivo para que el servicio arranque y responda health checks.
            db_url = "sqlite:////tmp/eco_render_fallback.db"
            app.logger.warning("DATABASE_URL no configurada en Render; usando SQLite temporal en /tmp.")
        elif running_on_vercel:
            db_url = "sqlite:////tmp/eco_vercel.db"
        else:
            db_url = "sqlite:///eco.db"
    # Render a veces da postgres://, SQLAlchemy prefiere postgresql://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["PREMIUM_ENABLED"] = _env_bool("PREMIUM_ENABLED", default=False)
    app.config["AUTH_ENABLED"] = _env_bool("AUTH_ENABLED", default=False)
    app.config["AUTH_BYPASS_EMAIL"] = os.getenv("AUTH_BYPASS_EMAIL", "celiafm17@gmail.com").strip().lower()

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)

    from .auth import auth_bp
    from .main import main_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)

    if running_on_vercel and not os.getenv("DATABASE_URL"):
        with app.app_context():
            db.create_all()

    @app.before_request
    def auto_login_when_auth_is_disabled():
        if app.config["AUTH_ENABLED"] or current_user.is_authenticated:
            return None

        from .models import User

        email = app.config["AUTH_BYPASS_EMAIL"]
        user = User.query.filter_by(email=email).first()
        if user is None:
            user = User(email=email)
            user.set_password(secrets.token_urlsafe(32))
            db.session.add(user)
            db.session.commit()
        login_user(user, remember=True)
        return None

    @app.context_processor
    def expose_auth_status():
        return {"auth_enabled": app.config["AUTH_ENABLED"]}

    @app.get("/healthz")
    def healthz():
        return {"ok": True}, 200

    return app


# WSGI callable for production servers (e.g. gunicorn app:app)
app = create_app()
