FROM golang:1.21-alpine AS builder

ENV GONOSUMCHECK=*
ENV GONOSUMDB=*
ENV GOINSECURE=*

WORKDIR /app

COPY go.mod ./
RUN go mod download

COPY . .
RUN touch go.sum && CGO_ENABLED=0 GOOS=linux GOFLAGS=-mod=mod go build -o /gateway cmd/api/main.go
RUN CGO_ENABLED=0 GOOS=linux GOFLAGS=-mod=mod go build -o /seed cmd/seed/main.go

# ── Runtime ────────────────────────────────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache wget ca-certificates

WORKDIR /app
COPY --from=builder /gateway .
COPY --from=builder /seed .

EXPOSE 8080
CMD ["./gateway"]
