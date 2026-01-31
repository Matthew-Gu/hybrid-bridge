interface Pending {
	resolve: (v: any) => void;
	reject: (e: Error) => void;
	timeoutId: number;
}

export class RequestManager {
	private pending = new Map<string, Pending>();

	constructor(private defaultTimeout = 5000) {}

	create<T>(requestId: string, timeout?: number) {
		const effective = timeout && timeout > 0 ? timeout : this.defaultTimeout;

		return new Promise<T>((resolve, reject) => {
			const timeoutId = window.setTimeout(() => {
				this.pending.delete(requestId);
				reject(new Error(`Request timeout: ${requestId}`));
			}, effective);

			this.pending.set(requestId, { resolve, reject, timeoutId });
		});
	}

	resolve(requestId: string, data: any) {
		const item = this.pending.get(requestId);
		if (!item) return;
		clearTimeout(item.timeoutId);
		this.pending.delete(requestId);
		item.resolve(data);
	}

	rejectAll(reason = 'destroyed') {
		this.pending.forEach((p) => {
			clearTimeout(p.timeoutId);
			p.reject(new Error(reason));
		});
		this.pending.clear();
	}
}
