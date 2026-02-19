PYTHON ?= python3
PORT ?= 5000

.PHONY: install-dev test test-capsules run migrate backup package-safe

install-dev:
	$(PYTHON) -m pip install -r requirements-dev.txt

test:
	$(PYTHON) -m pytest -q

test-capsules:
	$(PYTHON) -m pytest -q tests/test_capsules.py

run:
	PORT=$(PORT) $(PYTHON) app.py

migrate:
	$(PYTHON) -m flask --app app.py db upgrade

backup:
	@mkdir -p backups
	@ts=$$(date +%Y%m%d_%H%M%S); \
	if [ -f instance/eco.db ]; then cp instance/eco.db backups/eco_db_$$ts.db; fi; \
	if [ -f data/backup/recuerdos_legacy.json ]; then cp data/backup/recuerdos_legacy.json backups/recuerdos_legacy_$$ts.json; fi; \
	echo "Backup creado en /Users/Celia/Desktop/eco/backups"

package-safe:
	@mkdir -p dist
	@ts=$$(date +%Y%m%d_%H%M%S); \
	out="dist/eco_release_$$ts.zip"; \
	zip -r "$$out" . \
		-x ".git/*" ".git" \
		-x ".env" ".env.*" \
		-x ".DS_Store" "*/.DS_Store" \
		-x "__pycache__/*" "*.pyc" ".pytest_cache/*" \
		-x "instance/*" "backups/*" "dist/*" \
		-x "static/uploads/*" \
		-x "data/*.sqlite3" "data/usuarios.json" "data/backup/*"; \
	echo "Zip seguro creado: $$out"
