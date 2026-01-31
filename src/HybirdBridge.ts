import { AsyncQueue } from './core/AsyncQueue';
import { SenderReady } from './core/SenderReady';
import { detectSender } from './core/SenderDetector';
import { safeParse, encodeMessage } from './core/MessageCodec';
import { RequestManager } from './core/RequestManager';
import { EventEmitter } from './core/EventEmitter';
import { HybridMessage, RequestOptions } from './types';

const BRIDGE_READY = '__bridge_ready__';

export class HybridBridge {
	private ready = new SenderReady();
	private sender?: (msg: string) => void;
	private sendQueue = new AsyncQueue<HybridMessage>();
	private requests = new RequestManager();
	private events = new EventEmitter();

	constructor() {
		window.addEventListener('message', this.onMessage);
		this.startSendLoop();
	}

	/* ===== sender 协程 ===== */
	private startSendLoop() {
		(async () => {
			for await (const msg of this.sendQueue.consume()) {
				// 等待 Native ready
				await this.ready.wait();

				// sender 此时一定存在
				this.sender!(encodeMessage(msg));
			}
		})();
	}

	/* ===== 接收 ===== */
	private onMessage = (event: MessageEvent) => {
		const msg = safeParse(event.data);
		if (!msg || typeof msg !== 'object' || !msg.type) return;

		if (msg.type === BRIDGE_READY) {
			this.sender = detectSender() ?? undefined;
			if (this.sender) {
				this.ready.markReady();
			}
			return;
		}

		if (msg.__bridge === 'response' && msg.requestId) {
			this.requests.resolve(msg.requestId, msg.data);
			return;
		}

		this.events.emit(msg.type, msg.data);
	};

	/* ===== API ===== */

	emit<T>(type: string, data?: T) {
		this.sendQueue.push({ type, data, __bridge: 'event' });
	}

	request<T, R>(options: RequestOptions<T>): Promise<R> {
		const id = this.genRequestId();
		const p = this.requests.create<R>(id, options.timeout);

		this.sendQueue.push({
			type: options.type,
			data: options.data,
			requestId: id,
			__bridge: 'request'
		});

		return p;
	}

	on = this.events.on.bind(this.events);
	off = this.events.off.bind(this.events);

	destroy() {
		window.removeEventListener('message', this.onMessage);
		this.requests.rejectAll();
		this.events.clear();
		this.ready.reset();
		this.sendQueue.close(false);
	}

	private genRequestId() {
		return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
	}
}
