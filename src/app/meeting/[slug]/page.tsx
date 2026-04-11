"use client";
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, 
  Copy, Check, Users, MonitorUp, MonitorOff 
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useLocalStream } from '@/hooks/useLocalStream';
import { AudioVisualizer } from '@/components/room/AudioVisualizer';

// PRO ARCHITECTURE: Defined interfaces for child components
interface ControlBtnProps {
  onClick: () => void;
  active: boolean;
  icon: React.ReactElement;
  label: string;
}

interface ParticipantItemProps {
  name: string;
  active: boolean;
}

export default function MeetingRoom() {
  const params = useParams();
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenRef = useRef<HTMLVideoElement>(null);
  
  const { stream, screenStream, startStream, toggleCamera, toggleMic, startScreenShare, stopScreenShare } = useLocalStream();
  
  const [participants, setParticipants] = useState<{id: string, name: string}[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { 
    startStream();
    socketRef.current = io("http://localhost:4000");
    
    socketRef.current.on('room:participant_list', (list) => setParticipants(list));
    socketRef.current.on('participant:joined', (p) => setParticipants(prev => [...prev, p]));

    return () => { socketRef.current?.disconnect(); };
  }, [startStream]);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (screenRef.current && screenStream) screenRef.current.srcObject = screenStream;
  }, [screenStream]);

  const handleCameraToggle = () => { setCamOff(!camOff); toggleCamera(camOff); };
  const handleMicToggle = () => { setIsMuted(!isMuted); toggleMic(!isMuted); };
  
  const handleScreenToggle = async () => {
    if (!isSharing) {
      const success = await startScreenShare();
      if (success) setIsSharing(true);
    } else {
      stopScreenShare();
      setIsSharing(false);
    }
  };

  const copyMeetingLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-screen bg-[#050505] text-white flex overflow-hidden font-sans">
      <div className="flex-1 flex flex-col relative">
        <header className="p-4 flex justify-between items-center bg-[#111111] border-b border-white/5">
            <div className="flex items-center gap-4">
              <div className="bg-red-600 px-3 py-1 rounded text-[10px] font-bold uppercase animate-pulse">Live</div>
              <h2 className="text-sm font-bold tracking-tight opacity-80 uppercase">ZYNDRX | {params.slug}</h2>
            </div>
            <button onClick={copyMeetingLink} className="flex items-center gap-2 bg-blue-600/10 hover:bg-blue-600/20 px-4 py-2 rounded-xl text-blue-500 text-xs font-black uppercase transition-all">
                {copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Copied" : "Copy Link"}
            </button>
        </header>

        <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-hidden">
          <div className="bg-[#0A0A0A] rounded-[32px] border border-white/5 overflow-hidden relative shadow-2xl">
            <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
               <div className="bg-black/60 px-4 py-2 rounded-2xl text-[10px] font-black tracking-widest uppercase border border-white/5 flex items-center gap-2">
                 {isMuted ? <MicOff size={12} className="text-red-500"/> : <Mic size={12} className="text-green-500"/>} YOU
               </div>
               {!isMuted && <AudioVisualizer stream={stream} />}
            </div>
            {camOff ? (
               <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 uppercase tracking-[0.2em] text-[10px]">Camera Privacy On</div>
            ) : (
               <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100" />
            )}
          </div>

          {isSharing && (
             <div className="bg-[#0A0A0A] rounded-[32px] border border-blue-500/20 overflow-hidden relative shadow-2xl">
                <video ref={screenRef} autoPlay playsInline className="w-full h-full object-contain" />
                <div className="absolute bottom-6 right-6 bg-blue-600 px-3 py-1 rounded-full text-[10px] font-bold">SCREENCASTING</div>
             </div>
          )}
        </main>

        <footer className="p-8 flex justify-center fixed bottom-0 w-[calc(100%-260px)]">
            <div className="bg-[#141414]/95 backdrop-blur-3xl px-8 py-5 rounded-[40px] border border-white/10 flex items-center gap-8 shadow-2xl">
              <ControlBtn onClick={handleMicToggle} active={isMuted} icon={isMuted ? <MicOff /> : <Mic />} label={isMuted ? "Unmute" : "Mute"} />
              <ControlBtn onClick={handleCameraToggle} active={camOff} icon={camOff ? <VideoOff /> : <VideoIcon />} label="Camera" />
              <ControlBtn onClick={handleScreenToggle} active={isSharing} icon={isSharing ? <MonitorOff /> : <MonitorUp />} label="Present" />
              
              <div className="w-[1px] h-10 bg-white/10" />
              
              <button onClick={() => router.push('/')} className="bg-red-600 hover:bg-red-500 px-8 py-5 rounded-3xl transition-all font-black text-xs tracking-widest flex items-center gap-3">
                 <PhoneOff size={18} /> END SESSION
              </button>
            </div>
        </footer>
      </div>

      <aside className="w-[260px] bg-[#0D0D0D] border-l border-white/5 p-6 hidden md:flex flex-col gap-6">
          <div className="flex items-center gap-3 text-slate-500 uppercase tracking-widest font-black text-[11px]">
             <Users size={16}/> Attendees ({participants.length + 1})
          </div>
          <div className="flex-1 space-y-3">
              <ParticipantItem name="Opeyemi (Host)" active={true} />
              {participants.map(p => <ParticipantItem key={p.id} name={p.name} active={false} />)}
          </div>
      </aside>
    </div>
  );
}

const ControlBtn = ({ onClick, active, icon, label }: ControlBtnProps) => (
  <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={onClick}>
     <div className={`p-5 rounded-3xl transition-all ${active ? 'bg-red-600 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>
        {React.cloneElement(icon, { size: 24 })}
     </div>
     <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span>
  </div>
);

const ParticipantItem = ({ name, active }: ParticipantItemProps) => (
  <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${active ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-slate-700'}`} />
      <span className="text-xs font-bold text-slate-200">{name}</span>
  </div>
);
