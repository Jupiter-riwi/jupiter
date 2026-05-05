from pathlib import Path

OUTPUT_PATH = Path("output.json")
MODEL_DIR = Path("models")
MEDIAPIPE_MODEL_PATH = MODEL_DIR / "pose_landmarker_full.task"
MEDIAPIPE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/"
    "pose_landmarker_full/float16/latest/pose_landmarker_full.task"
)
DEFAULT_CAMERA_INDEX = 0
DEFAULT_MAX_FRAMES = 300
DEFAULT_MAX_PEOPLE = 5
DEFAULT_SHOULDER_THRESHOLD = 0.16
DEFAULT_DETECTION_CONFIDENCE = 0.5
DEFAULT_TRACKING_CONFIDENCE = 0.5
DEFAULT_BACKEND = "auto"
WINDOW_NAME = "Jupiter Pose Module"
