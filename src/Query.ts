import {CacheStore, NetworkHandler, QueryConfig, QueryEntry, QueryEntryResponse} from "./types";


export class Query<RequestConf> {
  config: QueryConfig
  cache
  networkHandler: NetworkHandler<RequestConf>
  cacheSubscribers: { [key: string]: Array<(entry: QueryEntryResponse) => void> } = {}
  constructor(settings: { config: QueryConfig, cache: CacheStore, networkHandler: NetworkHandler<RequestConf>}) {
    this.config = settings.config;
    this.cache = settings.cache;
    this.networkHandler = settings.networkHandler
  }

  getCurrentStateForEntry(config: RequestConf) {
    const key = this.cache.serialize(config)
    const entry = this.cache.get(key)
    if (entry) {
      return this.entryToResponse(entry)
    }
    const emptyEntry = this.cache.set(key, this.createEmptyEntry())

    return this.entryToResponse(emptyEntry)
  }

  async request(config: RequestConf) {
    const key = this.cache.serialize(config)
    let entry = this.cache.get(key)
    if (!entry) {
      entry = this.cache.set(key, this.createEmptyEntry())
    }

    if (this.shouldMakeRequest(entry)) {
      try {
        entry.isLoading = true;
        this.notifyCacheSubscribers(key, this.entryToResponse(entry))
        const newData = await this.networkHandler.request(config)
        entry = this.cache.set(key, {...entry, data: newData, error: null, isLoading: false, expiresAt: Date.now() + this.config.cacheExpiry, lastRequestAt: Date.now() })
        const newEntryResponse = this.entryToResponse(entry)
        await this.notifyAndClearRequestSubscribers(entry, newEntryResponse)
        return newEntryResponse
      } catch (error) {
        entry = this.cache.set(key, { ...entry, data: null, error, isLoading: false, expiresAt: Date.now() + this.config.cacheExpiry, lastRequestAt: Date.now() })
        const newEntryResponse = this.entryToResponse(entry)
        await this.notifyAndClearRequestSubscribers(entry, newEntryResponse)
        throw newEntryResponse
      } finally {
        this.notifyCacheSubscribers(key, this.entryToResponse(entry))
      }
    }

    if (entry.isLoading) {
      return new Promise((resolve, reject) => {
        entry.subscribers.push([resolve, reject])
      })
    }

    return this.entryToResponse(entry)
  }

  async notifyAndClearRequestSubscribers(entry: QueryEntry, entryResponse: QueryEntryResponse) {
    return await Promise.all(
      entry.subscribers.map(([resolve, reject]) => entryResponse.error ? reject(entryResponse) : resolve(entryResponse))
    ).then(() => (entry.subscribers = []));
  }

  createEmptyEntry() {
    return {
      data: null,
      error: null,
      isLoading: false,
      expiresAt: 0,
      lastRequestAt: 0,
      subscribers: []
    }
  }

  subscribeToCacheKey(config: RequestConf, callback: (entry: QueryEntryResponse) => void) {
    const key = this.cache.serialize(config)
    if (!this.cacheSubscribers[key]) {
      this.cacheSubscribers[key] = []
    }
    this.cacheSubscribers[key].push(callback)

    return () => {
      this.cacheSubscribers[key] = this.cacheSubscribers[key].filter(sub => sub !== callback)
    }
  }

  private notifyCacheSubscribers(key: string, entryResponse: QueryEntryResponse) {
    if (this.cacheSubscribers[key]) {
      this.cacheSubscribers[key].forEach(sub => sub(entryResponse))
    }
  }

  private shouldMakeRequest(entry: QueryEntry) {
    // TODO: Add support for checking against error
    return entry.expiresAt < Date.now() && !entry.isLoading
  }

  private entryToResponse(entry: QueryEntry): QueryEntryResponse {
    return {
      data: entry.data,
      error: entry.error,
      isLoading: entry.isLoading
    }
  }
}
