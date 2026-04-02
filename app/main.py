from fastapi import FastAPI

app = FastAPI(title="Júpiter AI Workers", version="1.0.0")

@app.get("/")
def root():
    return {"status": "ok", "service": "Júpiter AI Workers"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
