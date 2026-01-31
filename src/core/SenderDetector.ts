export type Sender = (msg: string) => void;

export function detectSender(): Sender | null {
	const w = window as any;

	if (w.Android?.postMessage) {
		return (msg) => w.Android.postMessage(msg);
	}

	if (w.webkit?.messageHandlers?.Bridge?.postMessage) {
		return (msg) => w.webkit.messageHandlers.Bridge.postMessage(msg);
	}

	return null;
}
