import {once} from 'node:events';
import type {Server} from 'node:http';
import type {Socket, AddressInfo} from 'node:net';
import type {TestContext} from 'node:test';

export const bindLoopback = async (test: TestContext, service: Server): Promise<URL> => {
    const connections = new Set<Socket>();
    service.on('connection', connection => {
        connections.add(connection);
        connection.on('close', () => connections.delete(connection));
    });
    const ready = once(service, 'listening');
    service.listen({host: '127.0.0.1', port: 0});
    await ready;
    test.after(async () => {
        const closed = once(service, 'close');
        service.close();
        connections.forEach(connection => connection.destroy());
        await closed;
    });
    return new URL(`http://127.0.0.1:${(service.address() as AddressInfo).port}`);
};
