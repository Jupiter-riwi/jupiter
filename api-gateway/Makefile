.PHONY: run seed test build

run:
	uvicorn app.main:app --reload --port 8080

seed:
	python seed.py

test:
	pytest -q

build:
	docker build -t jupiter-gateway .
