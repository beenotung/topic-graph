import lmdb from 'node-lmdb'
import { proxy } from './proxy'
import { startTimer } from '@beenotung/tslib/timer'
import { db } from './db'
import { mkdirSync } from 'fs'

let timer = startTimer('init')

db.exec(/* sql */ `
create index if not exists "topic_slug__topic_id__idx" on "topic_slug" ("topic_id");
create index if not exists "link__from_topic_id__idx" on "link" ("from_topic_id");
`)

let env = new lmdb.Env()

mkdirSync('lmdb', { recursive: true })

env.open({
  path: 'lmdb',
  mapSize: 50 * 1024 ** 3,
})

let dbi = env.openDbi({
  name: 'topic',
  create: true,
})

let txn = env.beginTxn()

let select_slug = db
  .prepare(
    /* sql */ `
select slug from topic_slug
where topic_id = ?
`,
  )
  .pluck()

let select_link = db.prepare<
  number,
  { to_topic_id: number; text: string; navigation_not_searchable: boolean }
>(/* sql */ `
select to_topic_id, text, navigation_not_searchable
from link
where from_topic_id = ?
`)

timer.next('export topic')
timer.setEstimateProgress(proxy.topic.length)
for (let topic of proxy.topic) {
  txn.putString(dbi, topic.id + '.title', topic.title)
  if (topic.collect_time) {
    txn.putNumber(dbi, topic.id + '.collect_time', topic.collect_time)
  }
  txn.putString(dbi, topic.id + '.slugs', select_slug.all(topic.id).join('\n'))
  txn.putString(
    dbi,
    topic.id + '.links',
    JSON.stringify(
      select_link
        .all(topic.id!)
        .map(row => [row.to_topic_id, row.text, row.navigation_not_searchable]),
    ),
  )
  timer.tick()
}

timer.end()
dbi.close()
env.close()

env.resize
