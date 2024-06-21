import { proxySchema } from 'better-sqlite3-proxy'
import { db } from './db'

export type Lang = {
  id?: null | number
  slug: string
  name: string
}

export type Topic = {
  id?: null | number
  title: string
  lang_id: number
  lang?: Lang
  collect_time: null | number
}

export type TopicSlug = {
  id?: null | number
  topic_id: number
  topic?: Topic
  slug: string
}

export type Link = {
  id?: null | number
  from_topic_id: number
  from_topic?: Topic
  to_topic_id: number
  to_topic?: Topic
  text: string
  navigation_not_searchable: boolean
}

export type NoLinkTopic = {
  id?: null | number
  topic_id: number
  topic?: Topic
  discover_time: number
  confirm_time: null | number
}

export type DBProxy = {
  lang: Lang[]
  topic: Topic[]
  topic_slug: TopicSlug[]
  link: Link[]
  no_link_topic: NoLinkTopic[]
}

export let proxy = proxySchema<DBProxy>({
  db,
  tableFields: {
    lang: [],
    topic: [
      /* foreign references */
      ['lang', { field: 'lang_id', table: 'lang' }],
    ],
    topic_slug: [
      /* foreign references */
      ['topic', { field: 'topic_id', table: 'topic' }],
    ],
    link: [
      /* foreign references */
      ['from_topic', { field: 'from_topic_id', table: 'topic' }],
      ['to_topic', { field: 'to_topic_id', table: 'topic' }],
    ],
    no_link_topic: [
      /* foreign references */
      ['topic', { field: 'topic_id', table: 'topic' }],
    ],
  },
})
