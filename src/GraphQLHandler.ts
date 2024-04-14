import wretch, { Wretch } from "wretch";
import { NetworkHandler, GraphQlRequestConf } from "./types";


export class GraphQLHandler implements NetworkHandler<GraphQlRequestConf> {
  api: Wretch

  constructor(config: { url: string, headers: { [key: string]: string } }) {
    this.api = wretch(config.url).headers(config.headers)
  }

  async request(config: GraphQlRequestConf) {
    // make the request to the GraphQL server
    return await this.api.post({ query: config.query, variables: config.variables }).json()
  }
}
