import { filter, find } from 'better-sqlite3-proxy'
import { Link, Topic, proxy } from './proxy'
import { db } from './db'
import { ProgressCli } from '@beenotung/tslib/progress-cli'

function exploreTopic(topic: Topic) {
  let links = filter(proxy.link, {
    from_topic_id: topic.id!,
    navigation_not_searchable: false,
  })
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

type Path = {
  topic: Topic
  link: Link | null
}

function findPath(options: {
  from: Topic
  to: Topic
  include_navigation_not_searchable?: boolean // default false
}): {
  searched: number
  steps: number
  paths: Path[][]
} {
  let { from, to, include_navigation_not_searchable } = options
  let searched = 0
  let paths: Path[][] = []
  if (from.id == to.id) {
    paths.push([{ topic: from, link: null }])
    return {
      searched,
      steps: 1,
      paths,
    }
  }
  type Item = {
    path: Path[]
    ids: Set<number> // to avoid loop
  }
  let stack: Item[] = [
    { path: [{ topic: from, link: null }], ids: new Set([from.id!]) },
  ]
  let final_to_topic_id = to.id!
  let cli = new ProgressCli()
  let found_depth = 0
  let next_searched = searched * 1.1
  for (;;) {
    let item = stack.shift()
    if (!item) break
    let { path, ids } = item
    if (found_depth && path.length + 1 > found_depth) {
      break
    }
    if (searched >= next_searched) {
      next_searched = searched * 1.1
      let msg =
        `searched: ${searched.toLocaleString()}` +
        ` | stack: ${stack.length.toLocaleString()}` +
        ` | depth: ${path.length + 1}`
      if (found_depth) {
        msg += ` | found ${paths.length} paths`
      }
      cli.update(msg)

      // FIXME speed up to allow retrieving all paths
      if (found_depth > 3 && searched > 10000) {
        break
      }
    }
    searched++
    let from_topic = path[path.length - 1].topic
    if (!from_topic.collect_time) {
      continue
      // throw new Error('topic not collected: ' + from_topic.title)
    }
    let from_topic_id = from_topic.id!
    let links = include_navigation_not_searchable
      ? filter(proxy.link, {
          from_topic_id,
        })
      : filter(proxy.link, {
          from_topic_id,
          navigation_not_searchable: false,
        })
    for (let link of links) {
      let to_topic_id = link.to_topic_id
      let to_topic = link.to_topic!
      if (to_topic_id == final_to_topic_id) {
        if (!found_depth) {
          found_depth = path.length + 1
        }
        paths.push([...path, { topic: to_topic, link }])
        break
      }
      if (ids.has(to_topic_id)) continue
      let new_ids = new Set(ids)
      new_ids.add(to_topic_id)
      stack.push({
        path: [...path, { topic: to_topic, link }],
        ids: new_ids,
      })
    }
  }
  cli.update('')
  if (found_depth) {
    return {
      searched,
      steps: found_depth,
      paths,
    }
  }
  throw new Error(`no path between "${from.title}" and "${to.title}"`)
}

function test() {
  let from = 'TypeScript'
  let to = 'Artificial intelligence'
  to = 'Design prototyping'
  // to = 'Great_man_theory'
  // to = 'Digital marketing'
  // to = 'Subset'
  let result = findPath({
    from: findTopic(from),
    to: findTopic(to),
    // include_navigation_not_searchable: true,
  })
  console.log({
    searched: result.searched,
    steps: result.steps,
    paths: result.paths.length,
  })
  result.paths.forEach((path, i) => {
    console.log(
      i + 1 + ':',
      path
        .map(item =>
          !item.link ||
          item.link.text.toLowerCase() == item.topic.title.toLowerCase()
            ? item.topic.title
            : `${item.topic.title} (${item.link.text})`,
        )
        .join(' -> '),
    )
  })
}
test()
