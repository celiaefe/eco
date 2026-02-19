import os
from dotenv import load_dotenv
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager

load_dotenv()

db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
login_manager.login_view = "auth.login"


def create_app():
    app = Flask(__name__, template_folder="../templates", static_folder="../static")
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-me")

    # Local: sqlite. Render/prod: DATABASE_URL obligatorio.
    db_url = os.getenv("DATABASE_URL")
    running_on_render = bool(os.getenv("RENDER") or os.getenv("RENDER_EXTERNAL_URL"))
    if not db_url:
        if running_on_render:
            raise RuntimeError("DATABASE_URL no configurada en Render.")
        db_url = "sqlite:///eco.db"
    # Render a veces da postgres://, SQLAlchemy prefiere postgresql://
    if db_url.startswith("postgres://"):
        db_url = db_url.replace("postgres://", "postgresql://", 1)

    app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)
    migrate.init_app(app, db)
    login_manager.init_app(app)

    from .auth import auth_bp
    from .main import main_bp
    app.register_blueprint(auth_bp)
    app.register_blueprint(main_bp)

    return app


# WSGI callable for production servers (e.g. gunicorn app:app)
app = create_app()
