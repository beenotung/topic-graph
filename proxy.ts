import { proxySchema } from 'better-sqlite3-proxy'
import { db } from './db'

export type Lang = {
  id?: null | number
  name: string
}

export type Topic = {
  id?: null | number
  title: string
  lang_id: number
  lang?: Lang
}

export type Link = {
  id?: null | number
  from_topic_id: number
  from_topic?: Topic
  to_topic_id: number
  to_topic?: Topic
}

export type DBProxy = {
  lang: Lang[]
  topic: Topic[]
  link: Link[]
}

export let proxy = proxySchema<DBProxy>({
  db,
  tableFields: {
    lang: [],
    topic: [
      /* foreign references */
      ['lang', { field: 'lang_id', table: 'lang' }],
    ],
    link: [
      /* foreign references */
      ['from_topic', { field: 'from_topic_id', table: 'topic' }],
      ['to_topic', { field: 'to_topic_id', table: 'topic' }],
    ],
  },
})
