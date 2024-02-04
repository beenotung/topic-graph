import { db } from './db'
import { proxy } from './proxy'

let select_ids = db
  .prepare(
    /* sql */
    `select id from topic where slug like 'User_talk:%'`,
  )
  .pluck()

let delete_link = db.prepare(
  /* sql */
  `delete from link where from_topic_id = :id or to_topic_id = :id`,
)

let delete_sequence = db.prepare(
  /* sql */
  `delete from sqlite_sequence where name = :name`,
)

function removeTopic(id: number) {
  let topic = proxy.topic[id]
  console.log('delete topic:', { slug: topic.slug, title: topic.title })
  delete_link.run({ id })
  delete proxy.topic[id]
}

let ids = select_ids.all() as number[]
for (let id of ids) {
  removeTopic(id)
}

delete_sequence.run({ name: 'topic' })
delete_sequence.run({ name: 'link' })
