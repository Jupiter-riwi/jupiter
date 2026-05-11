"""
Script de evaluación de prompts para el Scoring Worker.

Uso:
    python scripts/prompt_eval.py                              # usa fixture por defecto
    python scripts/prompt_eval.py --fixture vendedor_solido    # fixture específico
    python scripts/prompt_eval.py --fixture vendedor_nervioso --output result.json

Requiere: OPENAI_API_KEY en entorno o .env
"""

import argparse
import json
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from scoring.llm import call_gpt4o, build_prompt
from scoring.models import ScoreResult

FIXTURES_DIR = Path(__file__).parent.parent / "scoring" / "tests" / "fixtures"


def load_fixture(name: str) -> dict:
    path = FIXTURES_DIR / f"{name}.json"
    if not path.exists():
        print(f"Fixtures disponibles: {[f.stem for f in FIXTURES_DIR.glob('*.json')]}")
        raise FileNotFoundError(f"Fixture no encontrado: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser(description="Evalúa el prompt de scoring con GPT-4o")
    parser.add_argument(
        "--fixture", default="vendedor_solido",
        help="Nombre del fixture sin extensión (default: vendedor_solido)",
    )
    parser.add_argument(
        "--output", "-o",
        help="Archivo JSON donde guardar el resultado",
    )
    args = parser.parse_args()

    if not os.getenv("OPENAI_API_KEY"):
        print("ERROR: OPENAI_API_KEY no configurada. Configúrala en el entorno o .env")
        sys.exit(1)

    data = load_fixture(args.fixture)
    print(f"Fixture: {args.fixture} — {data.get('scenario', 'sin descripción')}")
    print(f"Rango esperado de overall: {data.get('expected_overall_range', 'no definido')}")
    print()

    prompt = build_prompt(
        pose_features=data["pose"],
        transcript_features=data["transcript"],
        prosody_features=data["prosody"],
    )

    print(f"Prompt construido: {len(prompt)} caracteres")
    print("Llamando a GPT-4o...")
    print()

    try:
        score = call_gpt4o(prompt)
    except Exception as exc:
        print(f"ERROR: {exc}")
        sys.exit(1)

    result = score.model_dump()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print()

    expected = data.get("expected_overall_range", [0, 100])
    in_range = expected[0] <= score.overall <= expected[1]
    status = "DENTRO del rango esperado" if in_range else "FUERA del rango esperado"
    print(f"Overall: {score.overall} — {status} {expected}")

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"Resultado guardado en {args.output}")


if __name__ == "__main__":
    main()
