FROM golang:1.21-alpine AS builder

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /gateway cmd/api/main.go

# ── Runtime ────────────────────────────────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache wget ca-certificates

WORKDIR /app
COPY --from=builder /gateway .

EXPOSE 8080
CMD ["./gateway"]
