import { useEffect, useState } from 'react';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export const useIntelSocket = (onReportReceived) => {
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        const backendBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
        const socketUrl = `${backendBaseUrl}/ws`;

        const socket = new SockJS(socketUrl);
        const client = new Client({
            webSocketFactory: () => socket,
            debug: (str) => console.log('STOMP:', str),
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
            onConnect: () => {
                setConnected(true);
                client.subscribe('/topic/intel', (message) => {
                    if (message.body) {
                        const payload = JSON.parse(message.body);
                        onReportReceived(payload);
                    }
                });
            },
            onDisconnect: () => {
                setConnected(false);
            },
        });

        client.activate();

        return () => {
            if (client.active) {
                client.deactivate();
            }
        };
    }, [onReportReceived]);

    return { connected };
};