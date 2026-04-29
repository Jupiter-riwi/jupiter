FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download && go mod verify

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/bin/gateway ./cmd/api

FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/bin/gateway /usr/local/bin/gateway

EXPOSE 8080

ENTRYPOINT ["gateway"]
