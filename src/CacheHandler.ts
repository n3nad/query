import hash from 'stable-hash'
import {CacheStore, QueryEntry} from "./types";


export class CacheHandler implements CacheStore {
  cache: Map<string, QueryEntry> = new Map()

  get(key: string) {
    return this.cache.get(key) || null
  }

  set(key: string, value: QueryEntry) {
    this.cache.set(key, value)
    return value
  }

  serialize(value: any) {
    return hash(value)
  }
}
