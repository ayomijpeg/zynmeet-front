import { useState, useCallback } from 'react';

export const useLocalStream = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const startStream = useCallback(async () => {
    try {
      if (stream?.active) return;
      const media = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: 30 },
        audio: { echoCancellation: true, noiseSuppression: true }
      });
      setStream(media);
    } catch (err) {
      console.error("Hardware initialization failed:", err);
    }
  }, [stream]);

  const toggleCamera = useCallback(async (shouldEnable: boolean) => {
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];

    if (!shouldEnable && videoTrack) {
      videoTrack.stop(); 
      stream.removeTrack(videoTrack);
    } else if (shouldEnable && !videoTrack) {
      try {
        const newVideo = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = newVideo.getVideoTracks()[0];
        if (newTrack) stream.addTrack(newTrack);
      } catch (err) {
        console.error("Failed to restart camera hardware:", err);
      }
    }
    setStream(new MediaStream(stream.getTracks()));
  }, [stream]);

  const toggleMic = useCallback((shouldEnable: boolean) => {
    if (!stream) return;
    stream.getAudioTracks().forEach(track => { track.enabled = shouldEnable; });
    setStream(new MediaStream(stream.getTracks()));
  }, [stream]);

  const startScreenShare = useCallback(async () => {
    try {
      // Corrected Type Casting for modern browser display constraints
      const media = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" } as MediaTrackConstraints,
        audio: false 
      });
      setScreenStream(media);
      media.getVideoTracks()[0].onended = () => setScreenStream(null);
      return media;
    } catch (err) {
      console.error("Screen share failed", err);
      return null;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    screenStream?.getTracks().forEach(t => t.stop());
    setScreenStream(null);
  }, [screenStream]);

  return { stream, screenStream, startStream, toggleCamera, toggleMic, startScreenShare, stopScreenShare };
};
