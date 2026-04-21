"use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  Mic, MicOff, Video as VideoIcon, VideoOff, PhoneOff, 
  Copy, Check, Users, MonitorUp, MonitorOff 
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useLocalStream } from '@/hooks/useLocalStream';
import { useMediasoup } from '@/hooks/useMediasoup'; // IMPORTED THE NEW HOOK
import { AudioVisualizer } from '@/components/room/AudioVisualizer';

// PRO ARCHITECTURE: Interfaces
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
  
  // FIXED: Changed from useRef to useState so useMediasoup triggers correctly
  const [socket, setSocket] = useState<Socket | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const roomId = params.slug as string;
  
  const { stream, startStream, toggleCamera, toggleMic, startScreenShare, stopScreenShare } = useLocalStream();
  
  // INJECT MEDIASOUP ENGINE
  const { remoteStreams } = useMediasoup(socket, roomId, stream);
  
  const [participants, setParticipants] = useState<{id: string, name: string}[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Initialize Connection
  useEffect(() => { 
    startStream();
    
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    const newSocket = io(apiBase, { withCredentials: true });
    setSocket(newSocket);

    const name = "User_" + Math.floor(Math.random() * 1000);

    newSocket.emit("request-join", { 
        roomId, 
        displayName: name 
    });
    
    // SFU specific: join the media routing room
    newSocket.emit('join-sfu-room', { roomId });
    
    newSocket.on('room:participant_list', (list) => setParticipants(list));
    newSocket.on('participant:joined', (p) => setParticipants(prev => [...prev, p]));
    newSocket.on('participant:left', (id) => setParticipants(prev => prev.filter(p => p.id !== id)));

    return () => { newSocket.disconnect(); };
  }, [startStream, roomId]);

  // Handle Video element source binding
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleCameraToggle = useCallback(() => { 
    const newState = !camOff;
    setCamOff(newState); 
    toggleCamera(!newState); 
  }, [camOff, toggleCamera]);

  const handleMicToggle = useCallback(() => { 
    const newState = !isMuted;
    setIsMuted(newState); 
    toggleMic(!newState); 
  }, [isMuted, toggleMic]);
  
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
              <h2 className="text-sm font-bold tracking-tight opacity-80 uppercase">ZYNDRX | {roomId}</h2>
            </div>
            <button onClick={copyMeetingLink} className="flex items-center gap-2 bg-blue-600/10 hover:bg-blue-600/20 px-4 py-2 rounded-xl text-blue-500 text-xs font-black uppercase">
                {copied ? <Check size={14}/> : <Copy size={14}/>} {copied ? "Copied" : "Copy Link"}
            </button>
        </header>

        <main className="flex-1 p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-hidden content-start">
          {/* HOST BOX (YOU) */}
          <div className="bg-[#0A0A0A] rounded-[32px] border border-white/5 overflow-hidden relative shadow-2xl transition-all min-h-[300px]">
            <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
               <div className="bg-black/60 px-4 py-2 rounded-2xl text-[10px] font-black tracking-widest uppercase border border-white/5 flex items-center gap-2">
                 {isMuted ? <MicOff size={12} className="text-red-500"/> : <Mic size={12} className="text-green-500"/>} YOU
               </div>
               {!isMuted && <AudioVisualizer stream={stream} />}
            </div>
            {camOff ? (
               <div className="w-full h-full flex flex-col items-center justify-center text-slate-700 bg-slate-900/10 uppercase tracking-widest text-[9px] font-black min-h-[300px]">Camera Disabled</div>
            ) : (
               <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100 min-h-[300px]" />
            )}
          </div>

          {/* REMOTE STREAMS (Other people) */}
          {Array.from(remoteStreams.entries()).map(([socketId, remoteStream]) => {
              const participantInfo = participants.find(p => p.id === socketId);
              const displayName = participantInfo ? participantInfo.name : "Guest";
              
              return <RemoteVideoPlayer key={socketId} stream={remoteStream} name={displayName} />;
          })}
        </main>

        <footer className="p-8 flex justify-center fixed bottom-0 w-[calc(100%-260px)] z-50">
            <div className="bg-[#141414]/95 backdrop-blur-3xl px-8 py-5 rounded-[40px] border border-white/10 flex items-center gap-8 shadow-2xl pointer-events-auto">
              <ControlBtn onClick={handleMicToggle} active={isMuted} icon={isMuted ? <MicOff /> : <Mic />} label={isMuted ? "Unmute" : "Mute"} />
              <ControlBtn onClick={handleCameraToggle} active={camOff} icon={camOff ? <VideoOff /> : <VideoIcon />} label="Video" />
              <ControlBtn onClick={handleScreenToggle} active={isSharing} icon={isSharing ? <MonitorOff /> : <MonitorUp />} label="Present" />
              
              <div className="w-[1px] h-10 bg-white/10" />
              
              <button onClick={() => router.push('/')} className="bg-red-600 hover:bg-red-700 px-10 py-5 rounded-3xl transition-all font-black text-xs tracking-widest flex items-center gap-3">
                 <PhoneOff size={18} /> DISCONNECT
              </button>
            </div>
        </footer>
      </div>

      {/* PARTICIPANTS SIDEBAR */}
      <aside className="w-[260px] bg-[#0D0D0D] border-l border-white/5 p-6 flex flex-col gap-6 z-10">
          <div className="flex items-center gap-3 text-slate-500 uppercase tracking-widest font-black text-[11px]">
             <Users size={16}/> Attendees ({participants.length + 1})
          </div>
          <div className="flex-1 space-y-3">
              <ParticipantItem name="You (Host)" active={true} />
              {participants.map(p => <ParticipantItem key={p.id} name={p.name} active={false} />)}
          </div>
      </aside>
    </div>
  );
}

// --- SUB-COMPONENTS ---

// Renders the actual video element for incoming Mediasoup streams
const RemoteVideoPlayer = ({ stream, name }: { stream: MediaStream, name: string }) => {
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (remoteVideoRef.current && stream) {
      remoteVideoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="bg-[#0A0A0A] rounded-[32px] border border-white/5 overflow-hidden relative shadow-2xl transition-all min-h-[300px]">
      <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
          <div className="bg-black/60 px-4 py-2 rounded-2xl text-[10px] font-black tracking-widest uppercase border border-white/5 flex items-center gap-2">
            {name}
          </div>
      </div>
      {/* Note: Do NOT mute remote videos, otherwise you won't hear them! */}
      <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover min-h-[300px]" />
    </div>
  );
};

const ControlBtn = ({ onClick, active, icon, label }: ControlBtnProps) => (
  <div className="flex flex-col items-center gap-2 group cursor-pointer" onClick={onClick}>
     <div className={`p-5 rounded-3xl transition-all shadow-md ${active ? 'bg-red-600 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>
        {React.cloneElement(icon, { size: 24 })}
     </div>
     <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span>
  </div>
);

const ParticipantItem = ({ name, active }: ParticipantItemProps) => (
  <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${active ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-slate-700'}`} />
      <span className="text-[11px] font-bold text-slate-300 tracking-tight">{name}</span>
  </div>
);
