"use client";
import React, { useState, useEffect, useRef } from 'react';
import { Camera, Mic, ShieldCheck, Zap, Users, Globe, Layout, VideoOff, MicOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { useLocalStream } from '@/hooks/useLocalStream';
import { AudioVisualizer } from '@/components/room/AudioVisualizer';

interface StatItemProps {
  icon: React.ReactNode;
  label: string;
}

export default function LandingPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Use hardware hook for live feedback
  const { stream, startStream, toggleCamera, toggleMic } = useLocalStream();
  
  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [step, setStep] = useState<'landing' | 'lobby'>('landing');

  // Trigger hardware when transitioning to the lobby
  useEffect(() => {
    if (step === 'lobby') {
      startStream();
    }
  }, [step, startStream]);

  // Handle Video element source binding
  useEffect(() => {
    if (videoRef.current && stream && camActive) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, camActive, step]);

  const handleEstablishLink = () => {
    setIsConnecting(true);
    // Standard delay for $500k app feel (Auth handshake)
    setTimeout(() => {
        router.push('/meeting/general-hall');
    }, 800);
  };

  const handleToggleCam = () => {
    const newState = !camActive;
    setCamActive(newState);
    toggleCamera(newState);
  };

  const handleToggleMic = () => {
    const newState = !micActive;
    setMicActive(newState);
    toggleMic(newState);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans">
      <nav className="px-8 py-6 flex justify-between items-center bg-black/40 backdrop-blur-xl sticky top-0 z-50 border-b border-white/5">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setStep('landing')}>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-black tracking-tighter shadow-[0_0_15px_rgba(37,99,235,0.4)]">Z</div>
            <h1 className="text-xl font-bold tracking-tighter uppercase">ZynMeet</h1>
        </div>
        <div className="hidden md:flex gap-8 text-[11px] font-black uppercase tracking-widest text-slate-500">
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#enterprise" className="hover:text-white transition-colors">Enterprise</a>
            <a href="#governance" className="hover:text-white transition-colors">Governance</a>
        </div>
        <button type="button" className="bg-white/5 px-5 py-2 rounded-full border border-white/10 text-xs font-bold hover:bg-white/10 transition-all">Support</button>
      </nav>

      {step === 'landing' ? (
        /* HERO LANDING SECTION */
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-700">
            <div className="max-w-4xl space-y-8">
                <div className="inline-flex items-center gap-2 bg-blue-600/10 px-4 py-2 rounded-full border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest">
                    <Globe size={14}/> 250+ Participant Capacity | 4G Optimized
                </div>
                <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-none italic uppercase">
                    Your Premium <br /> <span className="text-blue-600 underline">Virtual Venue</span>
                </h1>
                <p className="text-slate-400 text-lg md:text-xl font-medium max-w-2xl mx-auto leading-relaxed">
                   {/* FIXED: &apos; for proper JSX escaping */}
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
                    <div className="bg-[#111] p-[1px] rounded-2xl overflow-hidden ring-1 ring-white/10">
                        {/* FIXED: Included CredentialResponse type mapping */}
                         <GoogleLogin 
                            onSuccess={async (credentialResponse: CredentialResponse) => {
                                const result = await fetch("http://localhost:4000/api/v1/auth/google", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ token: credentialResponse.credential })
                                });
                                const data = await result.json();
                                if(data.success) { setStep('lobby'); }
                            }} 
                            shape="pill" 
                            theme="filled_black" 
                            text="signin_with" 
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
        /* LOBBY / GREEN ROOM PREVIEW - ACTIVE UI FEEDBACK */
        <main className="flex-1 flex flex-col items-center justify-center p-4 max-w-5xl mx-auto w-full gap-12 animate-in slide-in-from-bottom-8 duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 w-full items-center">
                
                <div className="space-y-6">
                    <div className="aspect-video bg-[#080808] rounded-[40px] border border-white/10 shadow-2xl overflow-hidden relative group ring-1 ring-white/5">
                       
                       {camActive ? (
                         <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover -scale-x-100" />
                       ) : (
                         <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-900/20 italic text-xs uppercase tracking-widest font-black">
                            <VideoOff size={48} className="mb-4 opacity-10" />
                            Camera Privacy On
                         </div>
                       )}

                       <div className="absolute top-6 right-6 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-2 border border-white/10 shadow-lg">
                          {micActive && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                          {micActive ? "Capture Hot" : "No Mic Capture"}
                       </div>

                       <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 bg-black/40 backdrop-blur-2xl p-3 rounded-[32px] border border-white/10 transition-opacity">
                          <button 
                            type="button"
                            aria-label={micActive ? "Mute Mic" : "Unmute Mic"}
                            title={micActive ? "Mute Microphone" : "Activate Microphone"}
                            onClick={handleToggleMic} 
                            className={`p-5 rounded-full transition-all hover:scale-110 active:scale-95 ${micActive ? 'bg-white/10 text-white' : 'bg-red-500 text-white'}`}
                          >
                             {micActive ? <Mic size={22} /> : <MicOff size={22} />}
                          </button>
                          
                          <button 
                            type="button"
                            aria-label={camActive ? "Hide Video" : "Show Video"}
                            title={camActive ? "Privacy Toggle: Off" : "Privacy Toggle: On"}
                            onClick={handleToggleCam} 
                            className={`p-5 rounded-full transition-all hover:scale-110 active:scale-95 ${camActive ? 'bg-white/10 text-white' : 'bg-red-500 text-white'}`}
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
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Guest Proxy?</span>
                        <input className="bg-transparent border-b border-white/10 text-xs font-black tracking-widest text-blue-400 focus:border-blue-600 outline-none w-40 text-right transition-colors" placeholder="DISPLAY NAME" />
                    </div>
                </div>

                <div className="bg-[#111624] p-10 rounded-[50px] border border-white/5 space-y-8 relative overflow-hidden shadow-2xl">
                    <div className="space-y-2">
                        <h2 className="text-4xl font-black italic tracking-tighter uppercase">Reception</h2>
                        <p className="text-blue-500 font-bold uppercase text-[10px] tracking-widest flex items-center gap-2">
                           <Zap size={14} fill="currentColor" /> Ready to Broadcast 
                        </p>
                    </div>

                    <div className="space-y-6 pt-6 border-t border-white/10 font-bold">
                        <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-slate-500">
                           <span>Naira Block</span>
                           <span className="text-green-400">Verified</span>
                        </div>
                        
                        <button 
                            type="button"
                            disabled={isConnecting}
                            onClick={handleEstablishLink}
                            className="w-full bg-blue-600 hover:bg-blue-500 py-6 rounded-3xl text-[12px] font-black tracking-[0.4em] transition-all flex items-center justify-center gap-3 uppercase shadow-[0_20px_50px_rgba(37,99,235,0.3)] active:scale-95 disabled:opacity-50"
                        >
                            {isConnecting ? "LINKING NODE..." : "JOIN THE CALL"} <ShieldCheck size={20} />
                        </button>
                        <button onClick={() => setStep('landing')} className="w-full text-slate-500 text-[10px] uppercase font-bold hover:text-red-400 transition-colors tracking-widest">Abort Handshake</button>
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
        <div className="flex flex-col items-center gap-2 font-black text-[9px] uppercase tracking-[0.3em] text-slate-500 hover:text-white transition-all cursor-default group">
            <div className="p-3 bg-white/2 rounded-full group-hover:bg-blue-600/20 group-hover:ring-1 ring-blue-500 transition-all">{icon}</div>
            {label}
        </div>
    );
}
