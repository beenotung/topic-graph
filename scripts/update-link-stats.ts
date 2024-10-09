import { startTimer } from '@beenotung/tslib/timer'
import { db } from '../db'
import { proxy } from '../proxy'

let select_link = db.prepare<
  void[],
  { from_topic_id: number; to_topic_id: number }
>(/* sql */ `
select from_topic_id, to_topic_id from link
`)

let save_stats = db.prepare<{
  out_link_count: number
  in_link_count: number
  id: number
}>(/* sql */ `
update topic
set out_link_count = :out_link_count
  , in_link_count = :in_link_count
where id = :id
`)

function main() {
  let timer = startTimer('count links')
  let link_count = proxy.link.length

  timer.next('count topic')
  let topic_count = proxy.topic.length

  timer.next('scan links')
  timer.setEstimateProgress(link_count)
  let topics: [id: number, from: number, to: number][] = []
  for (let { from_topic_id, to_topic_id } of select_link.iterate()) {
    let from = topics[from_topic_id]
    if (!from) {
      from = [from_topic_id, 0, 0]
      topics[from_topic_id] = from
    }

    let to = topics[to_topic_id]
    if (!to) {
      to = [to_topic_id, 0, 0]
      topics[to_topic_id] = to
    }

    from[1]++
    to[2]++

    timer.tick()
  }

  timer.next('save link status')
  timer.setEstimateProgress(topic_count)
  topics.forEach(([id, from, to]) => {
    save_stats.run({
      out_link_count: from,
      in_link_count: to,
      id,
    })
    timer.tick()
  })
  timer.end()
}

db.transaction(main)()
