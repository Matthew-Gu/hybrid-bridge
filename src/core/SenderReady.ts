export class SenderReady {
	private ready = false;
	private resolves: (() => void)[] = [];

	isReady() {
		return this.ready;
	}

	markReady() {
		if (this.ready) return;
		this.ready = true;
		this.resolves.forEach((r) => r());
		this.resolves.length = 0;
	}

	wait(): Promise<void> {
		if (this.ready) return Promise.resolve();
		return new Promise((res) => this.resolves.push(res));
	}

	reset() {
		this.ready = false;
		this.resolves.length = 0;
	}
}
