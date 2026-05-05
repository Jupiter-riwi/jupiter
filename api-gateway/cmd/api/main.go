package main

import (
	"fmt"
	"log"
	"net/http"
)

func main() {
	fmt.Println("🚀 Iniciando Apex Vision API Gateway en el puerto 8080...")

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status": "ok", "service": "apex-vision-api-gateway"}`))
	})

	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatalf("Error al arrancar el servidor: %v", err)
	}
}
