"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
// IMPORT FIX: Pull 'types' directly from the root package
import { Device, types } from 'mediasoup-client'; 
import { Socket } from 'socket.io-client';

// PRO ARCHITECTURE: Strictly Typed Socket Payloads
interface SFUResponse {
  error?: string;
  id?: string;
}

interface ConsumeResponse {
  error?: string;
  id: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: types.RtpParameters; // PREFIXED
}

interface NewProducerPayload {
  producerId: string;
  socketId: string;
}

export const useMediasoup = (socket: Socket | null, roomId: string, localStream: MediaStream | null) => {
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  
  const deviceRef = useRef<Device | null>(null);
  
  // PREFIXED with types.
  const sendTransportRef = useRef<types.Transport | null>(null);
  const recvTransportRef = useRef<types.Transport | null>(null);

  const initMediasoup = useCallback(async () => {
    if (!socket) return;

    try {
      // 1. Get Router Capabilities
      socket.emit('getRouterRtpCapabilities', { roomId }, async (rtpCapabilities: types.RtpCapabilities & { error?: string }) => {
        if (rtpCapabilities.error) {
          console.error('SFU Error:', rtpCapabilities.error);
          return;
        }

        const device = new Device();
        await device.load({ routerRtpCapabilities: rtpCapabilities });
        deviceRef.current = device;

        // 2. Create Send Transport
        socket.emit('createWebRtcTransport', { roomId }, async (params: types.TransportOptions & { error?: string }) => {
          if (params.error) return;

          const sendTransport = device.createSendTransport(params);
          sendTransportRef.current = sendTransport;

          sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            socket.emit('connectTransport', { transportId: sendTransport.id, dtlsParameters }, (response: SFUResponse) => {
              if (response.error) errback(new Error(response.error));
              else callback();
            });
          });

          sendTransport.on('produce', async ({ kind, rtpParameters, appData }, callback, errback) => {
            socket.emit('produce', { transportId: sendTransport.id, kind, rtpParameters, appData }, (response: SFUResponse) => {
              if (response.error) errback(new Error(response.error));
              else if (response.id) callback({ id: response.id });
            });
          });

          if (localStream) {
            const videoTrack = localStream.getVideoTracks()[0];
            const audioTrack = localStream.getAudioTracks()[0];

            if (videoTrack) await sendTransport.produce({ track: videoTrack, appData: { roomId } });
            if (audioTrack) await sendTransport.produce({ track: audioTrack, appData: { roomId } });
          }
        });

        // 3. Create Receive Transport
        socket.emit('createWebRtcTransport', { roomId }, async (params: types.TransportOptions & { error?: string }) => {
          if (params.error) return;

          const recvTransport = device.createRecvTransport(params);
          recvTransportRef.current = recvTransport;

          recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
            socket.emit('connectTransport', { transportId: recvTransport.id, dtlsParameters }, (response: SFUResponse) => {
              if (response.error) errback(new Error(response.error));
              else callback();
            });
          });
        });

      });
    } catch (err) {
      console.error('Mediasoup Init Error:', err);
    }
  }, [socket, roomId, localStream]);

  // 4. Listen for New Producers
  useEffect(() => {
    if (!socket || !deviceRef.current) return;

    // Strictly typed payload
    const handleNewProducer = async ({ producerId, socketId }: NewProducerPayload) => {
      const device = deviceRef.current;
      const recvTransport = recvTransportRef.current;
      if (!device || !recvTransport) return;

      socket.emit('consume', {
        transportId: recvTransport.id,
        producerId,
        rtpCapabilities: device.rtpCapabilities
      }, async (response: ConsumeResponse) => {
        if (response.error) return;

        const consumer = await recvTransport.consume({
          id: response.id,
          producerId: response.producerId,
          kind: response.kind,
          rtpParameters: response.rtpParameters
        });

        const newTrack = consumer.track;
        
        socket.emit('resume', { consumerId: consumer.id }, () => {
          setRemoteStreams(prev => {
            const newMap = new Map(prev);
            const existingStream = newMap.get(socketId) || new MediaStream();
            existingStream.addTrack(newTrack);
            newMap.set(socketId, existingStream);
            return newMap;
          });
        });
      });
    };

    socket.on('newProducer', handleNewProducer);
    
    return () => {
      socket.off('newProducer', handleNewProducer);
    };
  }, [socket]);

  useEffect(() => {
    if (socket && localStream && !deviceRef.current) {
      setTimeout(() => initMediasoup(), 500); 
    }
  }, [socket, localStream, initMediasoup]);

  return { remoteStreams };
};
