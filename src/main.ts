import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.ts'
import {Query} from "./Query";
import {GraphQLHandler} from "./GraphQLHandler";
import {CacheHandler} from "./CacheHandler";
import {GraphQlRequestConf} from "./types";

const query = new Query<GraphQlRequestConf>({ config: {}, networkHandler: new GraphQLHandler({url: 'https://swapi-graphql.netlify.app/.netlify/functions/index', headers: {}}), cache: new CacheHandler()})
const requestParams = {type: 'query' as 'query' | 'mutation', query: `query { allFilms { films { title } } }`, variables: {}}
// console.log(query.getCurrentStateForEntry(requestParams))
// query.subscribeToCacheKey(requestParams, (entry) => {
//   console.log(entry)
// })

function fetchFilms() {
  const [response, unsubscribe] = query.requestAndSubscribe(requestParams, (entry) => console.log(entry))
  response.then((entry) => {
    console.log(`entry: ${entry}`)
  })

}

fetchFilms()

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="${viteLogo}" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <h1>Vite + TypeScript</h1>
    <div class="card">
      <button id="counter" type="button"></button>
    </div>
    <p class="read-the-docs">
      Click on the Vite and TypeScript logos to learn more
    </p>
  </div>
`

setupCounter(document.querySelector<HTMLButtonElement>('#counter')!)
