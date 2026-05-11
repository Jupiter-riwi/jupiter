.PHONY: upgrade downgrade history current revision test

upgrade:
	alembic upgrade head

downgrade:
	alembic downgrade -1

history:
	alembic history --verbose

current:
	alembic current

# usage: make revision msg="add users table"
revision:
	alembic revision --autogenerate -m "$(msg)"

test:
	pytest tests/ -v
