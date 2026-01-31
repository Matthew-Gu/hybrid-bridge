export type Handler = (data: any) => void;

export class EventEmitter {
	private map = new Map<string, Set<Handler>>();

	on(type: string, handler: Handler) {
		if (!this.map.has(type)) this.map.set(type, new Set());
		this.map.get(type)!.add(handler);
		return () => this.off(type, handler);
	}

	off(type: string, handler?: Handler) {
		const set = this.map.get(type);
		if (!set) return;

		if (!handler) {
			this.map.delete(type);
			return;
		}

		set.delete(handler);
		if (!set.size) this.map.delete(type);
	}

	emit(type: string, data: any) {
		this.map.get(type)?.forEach((fn) => {
			try {
				fn(data);
			} catch (e) {
				console.error('[HybridBridge handler error]', e);
			}
		});
	}

	clear() {
		this.map.clear();
	}
}
