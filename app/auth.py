from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_user, logout_user, login_required
from .models import User
from . import db

auth_bp = Blueprint("auth", __name__)


@auth_bp.get("/register")
def register():
    return render_template("register.html")


@auth_bp.post("/register")
def register_post():
    email = request.form.get("email", "").strip().lower()
    password = request.form.get("password", "")

    if not email or not password:
        flash("Email y contraseña son obligatorios.")
        return redirect(url_for("auth.register"))

    if User.query.filter_by(email=email).first():
        flash("Ese email ya está registrado.")
        return redirect(url_for("auth.register"))

    u = User(email=email)
    u.set_password(password)
    db.session.add(u)
    db.session.commit()
    login_user(u)
    return redirect(url_for("main.index"))


@auth_bp.get("/login")
def login():
    return redirect(url_for("main.index", auth="login"))


@auth_bp.post("/login")
def login_post():
    email = request.form.get("email", "").strip().lower()
    password = request.form.get("password", "")
    remember = request.form.get("remember") == "1"
    u = User.query.filter_by(email=email).first()
    if not u or not u.check_password(password):
        flash("Credenciales incorrectas.")
        return redirect(url_for("main.index", auth="login"))

    login_user(u, remember=remember)
    return redirect(url_for("main.index"))


@auth_bp.get("/forgot-password")
def forgot_password():
    return render_template("forgot_password.html")


@auth_bp.post("/forgot-password")
def forgot_password_post():
    email = request.form.get("email", "").strip().lower()
    password = request.form.get("password", "")
    password2 = request.form.get("password2", "")

    if not email or not password or not password2:
        flash("Completa todos los campos.")
        return redirect(url_for("auth.forgot_password"))

    if len(password) < 6:
        flash("La contraseña debe tener al menos 6 caracteres.")
        return redirect(url_for("auth.forgot_password"))

    if password != password2:
        flash("Las contraseñas no coinciden.")
        return redirect(url_for("auth.forgot_password"))

    u = User.query.filter_by(email=email).first()
    if not u:
        flash("No encontramos una cuenta con ese email.")
        return redirect(url_for("auth.forgot_password"))

    u.set_password(password)
    db.session.commit()
    flash("Contraseña actualizada. Ya puedes entrar.")
    return redirect(url_for("main.index", auth="login"))


@auth_bp.post("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("main.index"))
