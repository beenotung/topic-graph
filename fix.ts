import { startTimer } from '@beenotung/tslib/timer'
import { db } from './db'
import { proxy } from './proxy'

let prefix = 'Portal_talk'

let timer = startTimer('init')

let select_ids = db
  .prepare(
    /* sql */
    `select id from topic where slug like '${prefix}:%'`,
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
  delete_link.run({ id })
  delete proxy.topic[id]
}

db.transaction(() => {
  timer.next('scan non-topics')
  let ids = select_ids.all() as number[]
  timer.next('delete non-topics')
  timer.setEstimateProgress(ids.length)
  for (let id of ids) {
    removeTopic(id)
    timer.tick()
  }
})()

timer.next('reset sequence')
delete_sequence.run({ name: 'topic' })
delete_sequence.run({ name: 'link' })

timer.end()
