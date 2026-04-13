import { AsyncQueue } from './core/AsyncQueue';
import { SenderReady } from './core/SenderReady';
import { detectSender } from './core/SenderDetector';
import { safeParse, encodeMessage } from './core/MessageCodec';
import { RequestManager } from './core/RequestManager';
import { EventEmitter } from './core/EventEmitter';
import { HybridMessage, RequestOptions } from './types';

const BRIDGE_READY = '__bridge_ready__';

const canUseWindow = () => typeof window !== 'undefined';

export class HybridBridge {
	private ready = new SenderReady();
	private sender?: (msg: string) => void;
	private sendQueue = new AsyncQueue<HybridMessage>();
	private requests = new RequestManager();
	private events = new EventEmitter();
	private destroyed = false;

	constructor() {
		if (!canUseWindow()) return;

		window.addEventListener('message', this.onMessage);
		this.startSendLoop();
	}

	private startSendLoop() {
		void (async () => {
			try {
				for await (const message of this.sendQueue.consume()) {
					await this.ready.wait();
					this.send(message);
				}
			} catch (error) {
				if (!this.destroyed) {
					console.error('[HybridBridge send loop error]', error);
				}
			}
		})();
	}

	private send(message: HybridMessage) {
		if (message.requestId && !this.requests.has(message.requestId)) return;

		const sender = this.sender;
		if (!sender) {
			if (message.requestId) {
				this.requests.reject(message.requestId, new Error('Native sender is not available'));
			}
			return;
		}

		try {
			sender(encodeMessage(message));
		} catch (error) {
			if (message.requestId) {
				this.requests.reject(message.requestId, error);
				return;
			}

			console.error('[HybridBridge send error]', error);
		}
	}

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

	emit<T>(type: string, data?: T) {
		this.sendQueue.push({ type, data, __bridge: 'event' });
	}

	request<T, R>(options: RequestOptions<T>): Promise<R> {
		const id = this.genRequestId();
		const promise = this.requests.create<R>(id, options.timeout);

		this.sendQueue.push({
			type: options.type,
			data: options.data,
			requestId: id,
			__bridge: 'request'
		});

		return promise;
	}

	on = this.events.on.bind(this.events);
	off = this.events.off.bind(this.events);

	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;

		if (canUseWindow()) {
			window.removeEventListener('message', this.onMessage);
		}

		this.requests.rejectAll();
		this.events.clear();
		this.ready.close();
		this.sendQueue.close(false);
		this.sender = undefined;
	}

	private genRequestId() {
		return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
	}
}
