export function safeParse(data: any) {
	if (typeof data === 'string') {
		try {
			return JSON.parse(data);
		} catch {
			return null;
		}
	}
	return data ?? null;
}

export function encodeMessage(obj: any) {
	return JSON.stringify(obj);
}
