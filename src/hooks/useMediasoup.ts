"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { Device, types } from 'mediasoup-client';
import { Socket } from 'socket.io-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SFUResponse {
  error?: string;
  id?: string;
}

interface ConsumeResponse {
  error?: string;
  id: string;
  producerId: string;
  kind: 'audio' | 'video';
  rtpParameters: types.RtpParameters;
}

interface ProducerEntry {
  producerId: string;
  socketId: string;
  kind: 'audio' | 'video';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Wrap socket.emit with a callback into a Promise so we can await it cleanly.
function emitWithAck<T>(socket: Socket, event: string, data: unknown): Promise<T> {
  return new Promise((resolve) => {
    socket.emit(event, data, (response: T) => resolve(response));
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const useMediasoup = (
  socket: Socket | null,
  roomId: string,
  localStream: MediaStream | null
) => {
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  const deviceRef           = useRef<Device | null>(null);
  const recvTransportRef    = useRef<types.Transport | null>(null);
  const isReadyRef          = useRef(false);
  const pendingProducersRef = useRef<ProducerEntry[]>([]);

  // ---------------------------------------------------------------------------
  // consumeProducer
  // FIX: Always create a NEW MediaStream reference so React detects the change.
  // ---------------------------------------------------------------------------
  const consumeProducer = useCallback(
    async ({ producerId, socketId }: ProducerEntry) => {
      const device        = deviceRef.current;
      const recvTransport = recvTransportRef.current;
      if (!socket || !device || !recvTransport) return;

      const response = await emitWithAck<ConsumeResponse>(socket, 'consume', {
        transportId:     recvTransport.id,
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      });

      if (response.error) {
        console.error('[Mediasoup] Consume error:', response.error);
        return;
      }

      try {
        const consumer = await recvTransport.consume({
          id:            response.id,
          producerId:    response.producerId,
          kind:          response.kind,
          rtpParameters: response.rtpParameters,
        });

        await emitWithAck(socket, 'resume', { consumerId: consumer.id });

        setRemoteStreams((prev) => {
          const next     = new Map(prev);
          const existing = next.get(socketId);
          // Always a new MediaStream reference so React re-renders
          if (existing) {
            next.set(socketId, new MediaStream([...existing.getTracks(), consumer.track]));
          } else {
            next.set(socketId, new MediaStream([consumer.track]));
          }
          return next;
        });
      } catch (err) {
        console.error('[Mediasoup] recvTransport.consume() failed:', err);
      }
    },
    [socket]
  );

  // ---------------------------------------------------------------------------
  // initMediasoup — fully sequential so recv transport is created AFTER
  // all local tracks are produced. This prevents getExistingProducers from
  // being called before this peer's own producers are registered on the server.
  // ---------------------------------------------------------------------------
  const initMediasoup = useCallback(async () => {
    if (!socket || !localStream) return;

    try {
      // 1. Join SFU room first
      socket.emit('join-sfu-room', { roomId });

      // 2. Get router capabilities
      const rtpCapabilities = await emitWithAck<types.RtpCapabilities & { error?: string }>(
        socket, 'getRouterRtpCapabilities', { roomId }
      );
      if (rtpCapabilities.error) {
        console.error('[Mediasoup] getRouterRtpCapabilities error:', rtpCapabilities.error);
        return;
      }

      const device = new Device();
      await device.load({ routerRtpCapabilities: rtpCapabilities });
      deviceRef.current = device;

      // 3. Create send transport
      const sendParams = await emitWithAck<types.TransportOptions & { error?: string }>(
        socket, 'createWebRtcTransport', { roomId }
      );
      if (sendParams.error) {
        console.error('[Mediasoup] createWebRtcTransport (send) error:', sendParams.error);
        return;
      }

      const sendTransport = device.createSendTransport(sendParams);

      sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        emitWithAck<SFUResponse>(socket, 'connectTransport', {
          transportId: sendTransport.id,
          dtlsParameters,
        }).then((res) => {
          if (res.error) errback(new Error(res.error));
          else callback();
        });
      });

      sendTransport.on('produce', ({ kind, rtpParameters, appData }, callback, errback) => {
        emitWithAck<SFUResponse>(socket, 'produce', {
          transportId: sendTransport.id,
          kind,
          rtpParameters,
          appData,
        }).then((res) => {
          if (res.error) errback(new Error(res.error));
          else if (res.id) callback({ id: res.id });
        });
      });

      // 4. Produce local tracks — await BOTH before moving on
      const videoTrack = localStream.getVideoTracks()[0];
      const audioTrack = localStream.getAudioTracks()[0];
      await Promise.all([
        videoTrack ? sendTransport.produce({ track: videoTrack }) : Promise.resolve(),
        audioTrack ? sendTransport.produce({ track: audioTrack }) : Promise.resolve(),
      ]);

      console.log('[Mediasoup] Local tracks produced — creating recv transport');

      // 5. Create recv transport AFTER producing so getExistingProducers sees
      //    this peer's producers already registered on the server.
      const recvParams = await emitWithAck<types.TransportOptions & { error?: string }>(
        socket, 'createWebRtcTransport', { roomId }
      );
      if (recvParams.error) {
        console.error('[Mediasoup] createWebRtcTransport (recv) error:', recvParams.error);
        return;
      }

      const recvTransport = device.createRecvTransport(recvParams);
      recvTransportRef.current = recvTransport;

      recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
        emitWithAck<SFUResponse>(socket, 'connectTransport', {
          transportId: recvTransport.id,
          dtlsParameters,
        }).then((res) => {
          if (res.error) errback(new Error(res.error));
          else callback();
        });
      });

      // 6. Mark ready and drain any queued producers
      isReadyRef.current = true;
      for (const pending of pendingProducersRef.current) {
        await consumeProducer(pending);
      }
      pendingProducersRef.current = [];

      // 7. Ask for existing producers — now guaranteed to run after this peer
      //    has finished producing, so other peers' getExistingProducers calls
      //    will correctly see this peer's tracks too.
      const existingProducers = await emitWithAck<ProducerEntry[]>(
        socket, 'getExistingProducers', { roomId }
      );
      console.log(`[Mediasoup] Consuming ${existingProducers.length} existing producer(s)`);
      for (const entry of existingProducers) {
        await consumeProducer(entry);
      }

    } catch (err) {
      console.error('[Mediasoup] Init error:', err);
    }
  }, [socket, roomId, localStream, consumeProducer]);

  // ---------------------------------------------------------------------------
  // Always register newProducer listener — queue if not ready yet
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const handleNewProducer = async (payload: ProducerEntry) => {
      if (!isReadyRef.current) {
        pendingProducersRef.current.push(payload);
        return;
      }
      await consumeProducer(payload);
    };

    const handlePeerDisconnected = ({ socketId }: { socketId: string }) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(socketId);
        return next;
      });
    };

    socket.on('newProducer',      handleNewProducer);
    socket.on('peerDisconnected', handlePeerDisconnected);

    return () => {
      socket.off('newProducer',      handleNewProducer);
      socket.off('peerDisconnected', handlePeerDisconnected);
    };
  }, [socket, consumeProducer]);

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (socket && localStream && !deviceRef.current) {
      initMediasoup();
    }
  }, [socket, localStream, initMediasoup]);

  return { remoteStreams };
};
