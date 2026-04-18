"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Mic, ShieldCheck, Zap, Users, Globe, Layout, VideoOff, MicOff } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useLocalStream } from '@/hooks/useLocalStream';
import { AudioVisualizer } from '@/components/room/AudioVisualizer';

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
}

export default function LandingPage() {
  const router = useRouter();
  const params = useParams(); // Using params safely
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // FIXED: Logic uses roomId to either resume a session or start a new unique hall
  const roomId = (params?.slug as string) || "general-hall";

  const { stream, startStream, toggleCamera, toggleMic } = useLocalStream();
  
  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [step, setStep] = useState<'landing' | 'lobby'>('landing');

  useEffect(() => {
    if (step === 'lobby') {
      startStream();
    }
  }, [step, startStream]);

  useEffect(() => {
    const videoElem = videoRef.current;
    if (videoElem && stream && camActive) {
      videoElem.srcObject = stream;
    }
  }, [stream, camActive]);

  const handleEstablishLink = () => {
    setIsConnecting(true);
    // FIXED: Use the roomId variable here.
    // Logic: if on root, generate unique, if not, join the params room.
    const finalRoom = (params?.slug as string) || Math.random().toString(36).substring(2, 12);
    
    setTimeout(() => {
        router.push(`/meeting/${finalRoom}`);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans">
      <nav className="px-8 py-6 flex justify-between items-center bg-black/40 backdrop-blur-xl sticky top-0 z-50 border-b border-white/5">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setStep('landing')}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black tracking-tighter">Z</div>
            <h1 className="text-xl font-bold tracking-tighter uppercase">ZynMeet</h1>
        </div>
        <div className="hidden md:flex gap-8 text-[11px] font-black uppercase tracking-widest text-slate-500">
            <a href="#pricing">Pricing</a>
            <a href="#enterprise">Enterprise</a>
            <a href="#governance">Governance</a>
        </div>
        <button type="button" className="bg-white/5 px-5 py-2 rounded-full border border-white/10 text-xs font-bold hover:bg-white/10 transition-all">Support</button>
      </nav>

      {step === 'landing' ? (
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-700">
            <div className="max-w-4xl space-y-8">
                <div className="inline-flex items-center gap-2 bg-blue-600/10 px-4 py-2 rounded-full border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest">
                    <Globe size={14}/> Room Instance: {roomId}
                </div>
                <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none italic uppercase">
                    Your Premium <br /> <span className="text-blue-600 underline">Virtual Venue</span>
                </h1>
                <p className="text-slate-400 text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
                    Automated ₦100/30-min micro-billing. Nigeria&apos;s standard for secure, reliable virtual events.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
                    <button 
                        type="button"
                        onClick={() => setStep('lobby')}
                        className="px-12 py-6 bg-white text-black rounded-2xl font-black tracking-widest uppercase hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)] active:scale-95"
                    >
                        Enter Meeting Room
                    </button>
                    <div className="bg-[#111] p-[1px] rounded-2xl overflow-hidden">
                         <GoogleLogin 
                            onSuccess={async (credentialResponse: CredentialResponse) => {
                                const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
                                const result = await fetch(`${apiBase}/api/v1/auth/google`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    credentials: "include",
                                    body: JSON.stringify({ token: credentialResponse.credential })
                                });
                                const data = await result.json();
                                if(data.success) { setStep('lobby'); }
                            }} 
                            shape="pill" theme="filled_black" text="signin_with" 
                        />
                    </div>
                </div>
            </div>
            <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 opacity-40">
                <StatItem icon={<Layout size={16}/>} label="Full Venue HD" />
                <StatItem icon={<Users size={16}/>} label="250 Seats" />
                <StatItem icon={<Zap size={16}/>} label="Low Latency" />
                <StatItem icon={<ShieldCheck size={16}/>} label="NDPR Secure" />
            </div>
        </main>
      ) : (
        <main className="flex-1 flex flex-col items-center justify-center p-4 max-w-5xl mx-auto w-full gap-12 animate-in fade-in duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full items-center">
                <div className="space-y-6">
                    <div className="aspect-video bg-[#080808] rounded-[40px] border border-white/10 shadow-2xl overflow-hidden relative group ring-1 ring-white/5">
                       {camActive ? (
                         <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100" />
                       ) : (
                         <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-900/20 italic text-xs font-black">
                            <VideoOff size={48} className="mb-4 opacity-10" />
                            Privacy Shield Enabled
                         </div>
                       )}

                       <div className="absolute top-6 right-6 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-white/10">
                          {micActive && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                          {micActive ? "Capture Hot" : "Muted"}
                       </div>

                       <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 bg-black/40 backdrop-blur-2xl p-3 rounded-[32px] border border-white/10">
                          <button 
                            type="button" 
                            title={micActive ? "Mute" : "Unmute"} 
                            aria-label="Toggle Mic"
                            onClick={() => { const s = !micActive; setMicActive(s); toggleMic(s); }} 
                            className={`p-5 rounded-full transition-all ${micActive ? 'bg-white/10 text-white' : 'bg-red-500'}`}
                          >
                             {micActive ? <Mic size={22} /> : <MicOff size={22} />}
                          </button>
                          <button 
                            type="button" 
                            title={camActive ? "Off" : "On"}
                            aria-label="Toggle Video"
                            onClick={() => { const s = !camActive; setCamActive(s); toggleCamera(s); }} 
                            className={`p-5 rounded-full transition-all ${camActive ? 'bg-white/10 text-white' : 'bg-red-500'}`}
                          >
                             {camActive ? <Camera size={22} /> : <VideoOff size={22} />}
                          </button>
                       </div>

                       {micActive && (
                         <div className="absolute bottom-10 left-10 opacity-60">
                            <AudioVisualizer stream={stream} />
                         </div>
                       )}
                    </div>
                    
                    <div className="flex justify-between items-center px-6 bg-white/5 py-4 rounded-3xl border border-white/5">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Guest Sync</span>
                        <input className="bg-transparent border-b border-white/10 text-xs font-black tracking-widest text-blue-400 focus:border-blue-600 outline-none w-40 text-right transition-colors uppercase" placeholder="NAME" />
                    </div>
                </div>

                <div className="bg-[#111624] p-10 rounded-[50px] border border-white/5 space-y-8 relative shadow-2xl">
                    <div className="space-y-2 text-left">
                        <h2 className="text-4xl font-black italic tracking-tighter uppercase">Reception</h2>
                        <p className="text-blue-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                           <Zap size={14} fill="currentColor" /> Active Session Ready
                        </p>
                    </div>

                    <div className="space-y-6 pt-6 border-t border-white/10">
                        <div className="flex justify-between items-center text-[10px] uppercase font-black text-slate-500">
                           <span>Connection ID</span>
                           <span className="text-slate-200">#{roomId.substring(0,6)}</span>
                        </div>
                        
                        <button 
                            type="button"
                            disabled={isConnecting}
                            onClick={handleEstablishLink}
                            className="w-full bg-blue-600 hover:bg-blue-700 py-6 rounded-3xl text-[12px] font-black tracking-[0.4em] transition-all flex items-center justify-center gap-3 uppercase shadow-[0_20px_50px_rgba(37,99,235,0.3)] active:scale-95 disabled:opacity-50"
                        >
                            {isConnecting ? "SYNCHRONIZING..." : "JOIN CONFERENCE"} <ShieldCheck size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </main>
      )}
    </div>
  );
}

function StatItem({ icon, label }: StatItemProps) {
    return (
        <div className="flex flex-col items-center gap-2 font-black text-[9px] uppercase tracking-[0.3em] text-slate-500 transition-all cursor-default group">
            <div className="p-3 bg-white/2 rounded-full group-hover:bg-blue-600/10 group-hover:text-blue-400">{icon}</div>
            {label}
        </div>
    );
}
