// Exported types


export interface QueryEntry {
  data: any
  error: any
  isLoading: boolean
  expiresAt: number
  lastRequestAt: number
  lastResponseAt: number
  subscribers: Array<[(entry: QueryEntryResponse) => void, (error: any) => void]>
}

export interface QueryEntryResponse {
  data: any
  error: any
  isLoading: boolean
}

export interface CacheStore {
  get: (key: string) => QueryEntry | null
  set: (key: string, value: QueryEntry) => QueryEntry
  serialize: (value: any) => string
}

export interface NetworkHandler<RequestConf> {
  request: (config: RequestConf) => Promise<any>
}

export interface QueryConfig {
  cacheExpiry: number
  ignoreCache: boolean
  ignoreCacheOnErrors: boolean
  errorRetryDelay: number
  errorRetryCount: number
}

export interface GraphQlRequestConf {
  type: 'query' | 'mutation'
  query: string
  variables: { [key: string]: any }
}
