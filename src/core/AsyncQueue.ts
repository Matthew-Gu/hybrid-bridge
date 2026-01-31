export class AsyncQueue<T> {
	private queue: T[] = [];
	private wake: (() => void) | null = null;
	private closed = false;

	constructor(initial: T[] = []) {
		this.queue = [...initial];
	}

	async *consume() {
		while (true) {
			if (this.queue.length) {
				yield this.queue.shift()!;
				continue;
			}

			if (this.closed) return;

			await new Promise<void>((res) => {
				this.wake = res;
			});

			this.wake = null;
		}
	}

	push(items: T | T[]) {
		if (this.closed) return;
		const list = Array.isArray(items) ? items : [items];
		this.queue.push(...list);
		this.wake?.();
	}

	close(flush = true) {
		if (this.closed) return;
		this.closed = true;

		if (!flush) this.queue.length = 0;
		this.wake?.();
	}

	size() {
		return this.queue.length;
	}
}
