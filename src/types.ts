export interface HybridMessage<T = any> {
	type: string;
	data?: T;
	requestId?: string;
	__bridge?: 'request' | 'response' | 'event';
}

export interface RequestOptions<T = any> {
	type: string;
	data?: T;
	timeout?: number;
}
