// src/voice/useWhisperRecorder.js
/**
 * useWhisperRecorder — Graba audio con MediaRecorder y transcribe con Whisper.
 *
 * Uso:
 *   const { startRecording, stopRecording, isRecording, transcribe } = useWhisperRecorder()
 *
 *   startRecording()           // arranca grabacion
 *   const blob = stopRecording() // para grabacion, devuelve Blob
 *   const text = await transcribe(blob) // manda a Whisper, devuelve texto
 *
 * Modelo C (hibrido):
 *   - Web Speech API sigue mostrando transcripcion provisional en UI.
 *   - MediaRecorder graba en paralelo.
 *   - Al terminar silencio: stopRecording() + transcribe() -> texto preciso.
 *   - El texto de Whisper reemplaza al provisional antes de processCommand().
 *
 * Fallback:
 *   - Si MediaRecorder no disponible -> transcribe() devuelve null.
 *   - El engine usa el texto de Web Speech como fallback.
 *   - Si Whisper falla -> devuelve null -> fallback a Web Speech.
 */

import { useRef, useState, useCallback } from 'react';
import apiClient from '../services/apiClient';

// Formato preferido segun soporte del navegador
function getBestMimeType() {
    const types = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
    ];
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
    }
    return '';
}

export default function useWhisperRecorder() {
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorderRef = useRef(null);
    const chunksRef = useRef([]);
    const streamRef = useRef(null);
    const mimeTypeRef = useRef('audio/webm');

    // Arranca grabacion — solicita acceso al microfono si no lo tiene
    const startRecording = useCallback(async () => {
        try {
            // Reutilizar stream si ya existe (evita pedir permiso repetidamente)
            if (!streamRef.current) {
                streamRef.current = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        channelCount: 1,
                        sampleRate: 16000,
                        echoCancellation: true,
                        noiseSuppression: true,
                    },
                });
            }

            const mimeType = getBestMimeType();
            mimeTypeRef.current = mimeType;

            const recorder = new MediaRecorder(
                streamRef.current,
                mimeType ? { mimeType } : {}
            );

            chunksRef.current = [];

            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            recorder.start(100); // chunk cada 100ms
            mediaRecorderRef.current = recorder;
            setIsRecording(true);

            console.log('[Whisper] Grabacion iniciada, mimeType:', mimeType || 'default');
        } catch (err) {
            console.warn('[Whisper] Error iniciando grabacion:', err.message);
            setIsRecording(false);
        }
    }, []);

    // Para grabacion y devuelve Blob con el audio
    const stopRecording = useCallback(() => {
        return new Promise((resolve) => {
            const recorder = mediaRecorderRef.current;
            if (!recorder || recorder.state === 'inactive') {
                setIsRecording(false);
                resolve(null);
                return;
            }

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, {
                    type: mimeTypeRef.current || 'audio/webm',
                });
                chunksRef.current = [];
                mediaRecorderRef.current = null;
                setIsRecording(false);
                console.log('[Whisper] Grabacion parada, size:', blob.size, 'bytes');
                resolve(blob);
            };

            recorder.stop();
        });
    }, []);

    // Manda el Blob a Whisper y devuelve texto transcrito
    // Devuelve null si falla (el engine usara fallback a Web Speech)
    const transcribe = useCallback(async (audioBlob, prompt = '') => {
        if (!audioBlob || audioBlob.size < 1000) {
            console.warn('[Whisper] Audio demasiado corto, usando fallback');
            return null;
        }

        try {
            const ext = mimeTypeRef.current.includes('ogg') ? 'ogg'
                : mimeTypeRef.current.includes('mp4') ? 'mp4'
                : 'webm';

            const formData = new FormData();
            formData.append('audio', audioBlob, `command.${ext}`);
            formData.append('language', 'es');
            if (prompt) formData.append('prompt', prompt);

            console.log('[Whisper] Enviando audio a transcribir:', audioBlob.size, 'bytes');

            const response = await apiClient.post('/voice/transcribe', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 15000,
            });

            const text = response.data?.data?.text || '';
            console.log('[Whisper] Transcripcion:', text);
            return text || null;

        } catch (err) {
            console.warn('[Whisper] Transcripcion fallida, usando fallback:', err.message);
            return null;
        }
    }, []);

    // Liberar stream al desmontar
    const releaseStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    return {
        isRecording,
        startRecording,
        stopRecording,
        transcribe,
        releaseStream,
        isSupported: typeof MediaRecorder !== 'undefined',
    };
}
