"use client";
import { useEffect, useRef } from "react";

export const AudioVisualizer = ({ stream }: { stream: MediaStream | null }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    // Define the shape for legacy WebKit support to avoid 'any'
    interface LegacyWindow extends Window {
      webkitAudioContext?: typeof AudioContext;
    }

    const AudioContextClass = window.AudioContext || (window as unknown as LegacyWindow).webkitAudioContext;
    
    if (!AudioContextClass) {
      console.warn("Audio Context not supported in this browser.");
      return;
    }

    const audioContext = new AudioContextClass();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 64; 
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const ctx = canvasRef.current.getContext("2d")!;

    const draw = () => {
      requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      
      const barCount = 4;
      const spacing = 3;
      const barWidth = 3;
      
      for(let i = 0; i < barCount; i++) {
        // Data frequency analysis for visual feedback
        const level = dataArray[i * 2] || 0; 
        const barHeight = (level / 255) * ctx.canvas.height + 2;
        
        ctx.fillStyle = level > 50 ? "#22c55e" : "#475569";
        ctx.fillRect(i * (barWidth + spacing), ctx.canvas.height - barHeight, barWidth, barHeight);
      }
    };

    draw();

    return () => {
      // Correct cleanup of Web Audio resources
      if (audioContext.state !== 'closed') {
        audioContext.close().catch(console.error);
      }
    };
  }, [stream]);

  return (
    <div className="flex items-center h-4 w-10 overflow-hidden">
      <canvas ref={canvasRef} width={24} height={16} />
    </div>
  );
};
