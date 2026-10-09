/**
 * Maps asset ids to runtime object URLs. The editor fills it from stored blobs;
 * components read it to load their image. It owns the object-URL lifecycle so
 * replacing or clearing an asset never leaks a blob URL.
 */
export class AssetRegistry {
	private readonly urls = new Map<string, string>();

	public set(id: string, url: string): void {
		const previous = this.urls.get(id);
		if (previous && previous !== url) URL.revokeObjectURL(previous);
		this.urls.set(id, url);
	}

	public get(id: string): string | undefined {
		return this.urls.get(id);
	}

	public delete(id: string): void {
		const url = this.urls.get(id);
		if (url) URL.revokeObjectURL(url);
		this.urls.delete(id);
	}

	public clear(): void {
		for (const url of this.urls.values()) URL.revokeObjectURL(url);
		this.urls.clear();
	}
}
