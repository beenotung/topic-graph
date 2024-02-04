import { filter, find } from 'better-sqlite3-proxy'
import { Topic, proxy } from './proxy'
import { db } from './db'
import { ProgressCli } from '@beenotung/tslib/progress-cli'

function exploreTopic(topic: Topic) {
  let links = filter(proxy.link, { from_topic_id: topic.id! })
  console.log('from:', topic.title)
  console.log('to:')
  for (let link of links) {
    console.log('->', link.to_topic?.title)
  }
}

let find_topic_id = db
  .prepare(
    /* sql */ `
select id from topic
where title like :title
`,
  )
  .pluck()

function findTopic(title: string) {
  let id = find_topic_id.get({ title }) as number
  if (!id) throw new Error('topic not found: ' + title)
  return proxy.topic[id]
}

function findPath(from: Topic, to: Topic): Topic[] {
  if (from.id == to.id) {
    return [from]
  }
  type Item = {
    path: Topic[]
    ids: Set<number> // to avoid loop
  }
  let stack: Item[] = [{ path: [from], ids: new Set([from.id!]) }]
  let final_to_topic_id = to.id!
  let cli = new ProgressCli()
  for (;;) {
    cli.update(`stack: ${stack.length.toLocaleString()}`)
    let item = stack.shift()
    if (!item) break
    let { path, ids } = item
    let from_topic = path[item.path.length - 1]
    if (!from_topic.collect_time) {
      continue
      // throw new Error('topic not collected: ' + from_topic.title)
    }
    let from_topic_id = from_topic.id!
    let links = filter(proxy.link, { from_topic_id })
    for (let link of links) {
      let to_topic_id = link.to_topic_id
      let to_topic = link.to_topic!
      if (to_topic_id == final_to_topic_id) {
        cli.update('')
        return [...path, to_topic]
      }
      if (ids.has(to_topic_id)) continue
      let new_ids = new Set(ids)
      new_ids.add(to_topic_id)
      stack.push({
        path: [...path, to_topic],
        ids: new_ids,
      })
    }
  }
  throw new Error(`no path between "${from.title}" and "${to.title}"`)
}

function test() {
  let from = 'TypeScript'
  let to = 'Artificial intelligence'
  let path = findPath(findTopic(from), findTopic(to))
  console.log(
    path.map(topic => ({
      id: topic.id,
      title: topic.title,
      slug: find(proxy.topic_slug, { topic_id: topic.id! }),
    })),
  )
}
test()
