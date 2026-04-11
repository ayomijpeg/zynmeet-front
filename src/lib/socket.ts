import { io } from 'socket.io-client';

// Standard Interface for $500k System Security
interface SfuResponse {
  rtpCapabilities?: unknown;
  error?: string;
}

export const apiSocket = io("http://localhost:4000", {
  autoConnect: false,
});

export const sfuSocket = io("http://localhost:4001", {
  autoConnect: false,
});

export const joinZynMeet = (roomId: string, userId: string) => {
  apiSocket.connect();
  
  apiSocket.emit('request-join', { roomId, userId });

  apiSocket.on('joined-successfully', () => {
    console.log("500k System Authorized. Connecting to Video Engine...");
    sfuSocket.connect();
    
    sfuSocket.emit('get-router-capabilities', { roomId }, (response: SfuResponse) => {
      if (response.error) {
        console.error("SFU Failure:", response.error);
        return;
      }
      console.log("SFU Capabilities Received:", response.rtpCapabilities);
    });
  });
};
