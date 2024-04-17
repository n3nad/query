import { CacheStore, NetworkHandler, QueryConfig, QueryEntry, QueryEntryResponse } from "./types";

const defaultConfig: QueryConfig = {
  cacheExpiry: 1000 * 60 * 5,
  ignoreCache: false,
  ignoreCacheOnErrors: false,
  errorRetryDelay: 1000,
  errorRetryCount: 3
}

export class Query<RequestConf> {
  config: QueryConfig
  cache
  networkHandler: NetworkHandler<RequestConf>
  cacheSubscribers: { [key: string]: Array<(entry: QueryEntryResponse) => void> } = {}
  constructor(settings: { config: Partial<QueryConfig>, cache: CacheStore, networkHandler: NetworkHandler<RequestConf>}) {
    this.config = { ...defaultConfig, ...settings.config };
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

  getCacheKey(config: RequestConf, localQueryConfig: Partial<QueryConfig> = {}) {
    const mergedConfig = { ...this.config, ...localQueryConfig }
    return this.cache.serialize({...config, ...mergedConfig})
  }

  async request(config: RequestConf, localQueryConfig: Partial<QueryConfig> = {}): Promise<QueryEntryResponse> {
    // merge the default config with the provided config
    const mergedConfig = { ...this.config, ...localQueryConfig }
    const key = this.getCacheKey(config, localQueryConfig)
    let entry = this.cache.get(key)
    if (!entry) {
      entry = this.cache.set(key, this.createEmptyEntry())
    }

    if (this.shouldMakeRequest(entry, mergedConfig)) {
      const thisRequestAt = Date.now()
      try {
        entry.isLoading = true;
        entry.lastRequestAt = thisRequestAt
        this.notifyCacheSubscribers(key, this.entryToResponse(entry))

        const newData = await this.networkHandler.request(config)
        if (entry.lastRequestAt > thisRequestAt) {
          return new Promise((resolve, reject) => {
            entry!.subscribers.push([resolve, reject])
          })
        }
        entry = this.cache.set(key, {...entry, data: newData, error: null, isLoading: false, expiresAt: Date.now() + mergedConfig.cacheExpiry, lastResponseAt: Date.now() })

        const newEntryResponse = this.entryToResponse(entry)
        await this.notifyAndClearRequestSubscribers(entry, newEntryResponse)
        return newEntryResponse
      } catch (error) {
        if (entry.lastRequestAt > thisRequestAt) {
          return new Promise((resolve, reject) => {
            entry!.subscribers.push([resolve, reject])
          })
        }
        entry = this.cache.set(key, { ...entry, data: null, error, isLoading: false, expiresAt: Date.now() + mergedConfig.cacheExpiry, lastResponseAt: Date.now() })
        const newEntryResponse = this.entryToResponse(entry)
        await this.notifyAndClearRequestSubscribers(entry, newEntryResponse)
        throw newEntryResponse
      } finally {
        if (thisRequestAt === entry.lastRequestAt) {
          this.notifyCacheSubscribers(key, this.entryToResponse(entry))
        }
      }
    }

    if (entry.isLoading) {
      return new Promise((resolve, reject) => {
        entry.subscribers.push([resolve, reject])
      })
    }

    return this.entryToResponse(entry)
  }

  requestAndSubscribe(
    { config, callback, localConfig = {} }: { config: RequestConf, localConfig?: Partial<QueryConfig>, callback: (entry: QueryEntryResponse) => void }
  ): [Promise<QueryEntryResponse>, () => void] {
    const key = this.getCacheKey(config, localConfig)
    const unsubscribe = this.subscribeToCacheKey(key, callback)
    const responsePromise = this.request(config)

    return [responsePromise, unsubscribe]
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
      lastResponseAt: 0,
      subscribers: []
    }
  }

  subscribeToCacheKey(key: string, callback: (entry: QueryEntryResponse) => void) {
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

  private shouldMakeRequest(entry: QueryEntry, queryConfig: QueryConfig) {
    if (queryConfig.ignoreCache) return true

    return !entry.isLoading && (entry.expiresAt < Date.now()  || queryConfig.ignoreCacheOnErrors && entry.error)
  }

  private entryToResponse(entry: QueryEntry): QueryEntryResponse {
    return {
      data: entry.data,
      error: entry.error,
      isLoading: entry.isLoading
    }
  }
}
