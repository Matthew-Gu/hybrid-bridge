export class SenderReady {
	private ready = false;
	private waiters: Array<{
		resolve: () => void;
		reject: (error: Error) => void;
	}> = [];
	private closed = false;

	markReady() {
		if (this.ready || this.closed) return;
		this.ready = true;
		this.waiters.forEach(({ resolve }) => resolve());
		this.waiters.length = 0;
	}

	wait(): Promise<void> {
		if (this.ready) return Promise.resolve();
		if (this.closed) return Promise.reject(new Error('Bridge destroyed'));
		return new Promise((resolve, reject) => {
			this.waiters.push({ resolve, reject });
		});
	}

	close(reason = 'Bridge destroyed') {
		if (this.closed) return;
		this.ready = false;
		this.closed = true;
		this.waiters.forEach(({ reject }) => reject(new Error(reason)));
		this.waiters.length = 0;
	}
}
