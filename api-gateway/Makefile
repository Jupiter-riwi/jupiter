.PHONY: run seed test build

run:
	go run cmd/api/main.go

seed:
	go run cmd/seed/main.go

test:
	go test ./...

build:
	go build -o bin/api cmd/api/main.go
