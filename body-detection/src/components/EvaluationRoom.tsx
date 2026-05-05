import React, { useEffect, useRef, useState } from 'react';
import Button from './common/Button.tsx';
import './EvaluationRoom.css';

type RecordingState = 'idle' | 'recording' | 'paused';

interface RecordingMetrics {
  duration: number;
  chunks: Blob[];
}

const EvaluationRoom: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Request camera and microphone access
  useEffect(() => {
    const initializeCamera = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        // Initialize MediaRecorder
        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9,opus',
        });

        mediaRecorder.ondataavailable = (event: BlobEvent) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'video/webm' });
          handleRecordingComplete(blob);
        };

        mediaRecorderRef.current = mediaRecorder;
        setIsLoading(false);
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to access camera and microphone';
        setError(errorMessage);
        setIsLoading(false);
      }
    };

    initializeCamera();

    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Timer effect for recording duration
  useEffect(() => {
    if (recordingState === 'recording') {
      timerIntervalRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [recordingState]);

  const handleStartRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'idle') {
      chunksRef.current = [];
      setDuration(0);
      mediaRecorderRef.current.start();
      setRecordingState('recording');
    }
  };

  const handlePauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
    }
  };

  const handleResumeRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && recordingState !== 'idle') {
      mediaRecorderRef.current.stop();
      setRecordingState('idle');
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const handleRecordingComplete = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording-${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="evaluation-room loading">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Iniciando cámara...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="evaluation-room error">
        <div className="error-container">
          <h2>Error de Acceso</h2>
          <p>{error}</p>
          <p className="error-hint">
            Por favor, verifica que tu navegador tenga permisos para acceder a la cámara y micrófono.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="evaluation-room">
      <div className="header">
        <h1>Sala de Evaluación</h1>
        <p>Graba tu presentación aquí</p>
      </div>

      <div className="main-content">
        <div className="video-container">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsinline
            className="video-stream"
          />
          {recordingState !== 'idle' && (
            <div className={`recording-indicator ${recordingState}`}>
              <span className="dot"></span>
              REC
            </div>
          )}
        </div>

        <div className="controls-panel">
          <div className="timer">
            <span className="timer-label">Duración:</span>
            <span className={`timer-value ${recordingState === 'recording' ? 'recording' : ''}`}>
              {formatDuration(duration)}
            </span>
          </div>

          <div className="buttons-group">
            <Button
              onClick={handleStartRecording}
              disabled={recordingState !== 'idle'}
              variant="primary"
              className="control-button"
            >
              ▶ Iniciar Grabación
            </Button>

            <Button
              onClick={
                recordingState === 'recording'
                  ? handlePauseRecording
                  : handleResumeRecording
              }
              disabled={recordingState === 'idle'}
              variant="secondary"
              className="control-button"
            >
              {recordingState === 'recording' ? '⏸ Pausar' : '▶ Reanudar'}
            </Button>

            <Button
              onClick={handleStopRecording}
              disabled={recordingState === 'idle'}
              variant="outline"
              className="control-button"
            >
              ⏹ Finalizar
            </Button>
          </div>
        </div>
      </div>

      <div className="status-bar">
        <span className="status-text">
          Estado: {recordingState === 'idle' ? 'Listo' : recordingState === 'recording' ? 'Grabando' : 'En pausa'}
        </span>
      </div>
    </div>
  );
};

export default EvaluationRoom;
