import { chromium } from 'playwright'
import { Topic, proxy } from './proxy'
import {
  count,
  filter,
  find,
  notNull,
  unProxy,
  clearCache,
} from 'better-sqlite3-proxy'
import { db } from './db'
import { later } from '@beenotung/tslib/async/wait'
import { ProgressCli } from '@beenotung/tslib/progress-cli'
import { format_time_duration } from '@beenotung/tslib/format'
import { GracefulPage } from 'graceful-playwright'
import { MINUTE } from '@beenotung/tslib/time'

const collect_interval = 1000
const clear_cache_interval = 30 * MINUTE

type Task = {
  topic: Topic
  slug: string
}
type Link = {
  title: string
  slug: string
  text: string
  navigation_not_searchable: boolean
  redirect_text: boolean
}

let cli = new ProgressCli()

async function main() {
  let browser = await chromium.launch({ headless: true })
  let page = new GracefulPage({ from: browser })

  setInterval(() => {
    clearCache(proxy)
  }, clear_cache_interval)

  let lang_id =
    find(proxy.lang, { slug: 'en' })?.id ||
    proxy.lang.push({ slug: 'en', name: 'English' })

  let seedTopic = findTopicBySlug('TypeScript')
  if (!seedTopic) {
    let topic_id = proxy.topic.push({
      title: 'TypeScript',
      lang_id,
      collect_time: null,
    })
    proxy.topic_slug.push({ topic_id, slug: 'TypeScript' })
  }

  let stack: Task[] = filter(proxy.topic, { lang_id, collect_time: null }).map(
    topic => ({
      topic,
      get slug() {
        return findTopicSlug(topic)
      },
    }),
  )

  let lastTime = Date.now()

  for (;;) {
    let task = stack.shift()
    if (!task) break
    let now = Date.now()
    let diff = now - lastTime
    if (diff < collect_interval) {
      await later(collect_interval - diff)
    }
    let { links, redirected_slug } = await collectTopic(page, task)
    lastTime = Date.now()
    if (links.length == 0) {
      cli.nextLine()
      console.error('Error: no links found, topic:', unProxy(task.topic))
      // throw new Error('no links found')
      find(proxy.no_link_topic, { topic_id: task.topic.id! }) ||
        proxy.no_link_topic.push({
          topic_id: task.topic.id!,
          discover_time: Date.now(),
          confirm_time: null,
        })
    } else {
      let newTasks = storeTopic(lang_id, task, redirected_slug, links)
      stack.push(...newTasks)
    }
    let collected =
      count(proxy.topic, { collect_time: notNull }) + proxy.no_link_topic.length
    let pending = stack.length
    let progress = (collected / (collected + pending)) * 100
    cli.update(
      `uptime: ${format_time_duration(process.uptime() * 1000)}` +
        ` | collected: ${collected.toLocaleString()}` +
        ` | pending: ${pending.toLocaleString()}` +
        ` | progress: ${progress.toFixed(2)}%` +
        ` | ${links.length.toLocaleString()} links` +
        ` in topic: "${task.topic.title}"`,
    )
  }

  await page.close()
  await browser.close()
}

async function collectTopic(page: GracefulPage, task: Task) {
  let slug = task.slug
  let url_prefix = 'https://en.wikipedia.org/wiki/'
  let url = url_prefix + slug
  await page.goto(url)
  let { links, href } = await page.evaluate(
    ({ slug }) => {
      let links: Link[] = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          '#bodyContent a[href*="/wiki/"][title]',
        ),
        a => {
          return {
            slug: a
              .getAttribute('href')
              ?.match(/^\/wiki\/(.*)$/)?.[1]
              .split('#')[0]!,
            title: a.title,
            text: a.innerText,
            rect: a.getBoundingClientRect(),
            navigation_not_searchable: !!a.closest(
              '.navigation-not-searchable',
            ),
            redirect_text: !!a.closest('.redirectText'),
          }
        },
      ).filter(link => link.rect.width * link.rect.height > 0)
      if (
        links.some(link => link.slug == 'Wikipedia:Project_namespace') &&
        slug != 'Wikify' &&
        slug != 'Japanese_Wikipedia' &&
        slug != 'Wikipedia_(disambiguation)'
      ) {
        throw new Error(`unexpected link, task.slug: ${slug}`)
      }
      links = links.filter(
        link =>
          link.slug &&
          !(
            link.slug == 'Wikipedia:Project_namespace' ||
            link.slug.startsWith('Wikipedia:') ||
            link.slug.startsWith('Category:') ||
            link.slug.startsWith('Help:') ||
            link.slug.startsWith('Template:') ||
            link.slug.startsWith('Template_talk:') ||
            link.slug.startsWith('Module:') ||
            link.slug.startsWith('User:') ||
            link.slug.startsWith('User_talk:') ||
            link.slug.startsWith('File:') ||
            link.slug.startsWith('MOS:') ||
            link.slug.startsWith('Talk:') ||
            link.slug.startsWith('Wikipedia_talk:') ||
            link.slug.startsWith('Portal_talk:') ||
            // link.slug.startsWith('Portal:') ||
            link.slug.startsWith('Special:')
          ),
      )
      return { links, href: location.href }
    },
    { slug: slug },
  )
  if (links.length == 0) {
    await later(1000)
    href = await page.evaluate(() => location.href)
  }
  let redirected_slug = href.replace(url_prefix, '').split('#')[0]
  // e.g. "https://en.wikipedia.org/w/index.php?title=One_person,_one_vote&redirect=no"
  if (href.startsWith('https://en.wikipedia.org/w/index.php?')) {
    links = await page.evaluate(() => {
      return Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          '.redirectMsg .redirectText a',
        ),
        a => {
          let href = a.getAttribute('href')
          let slug = href?.match(/^\/wiki\/(.*)$/)?.[1].split('#')[0]!
          let title = new URL(a.href).searchParams.get('title')
          if (!slug && !title) {
            throw new Error('slug not found, href: ' + href)
          }
          return {
            slug: slug || title!,
            title: a.title,
            text: a.innerText,
            rect: a.getBoundingClientRect(),
            navigation_not_searchable: !!a.closest(
              '.navigation-not-searchable',
            ),
            redirect_text: true,
          }
        },
      )
    })
  }
  let redirect_links = links.filter(link => link.redirect_text)
  if (redirect_links.length == 1) {
    redirected_slug = redirect_links[0].slug
  }
  return { links, redirected_slug }
}

function findTopicBySlug(slug: string) {
  return find(proxy.topic_slug, { slug })?.topic
}

let select_topic_slug = db
  .prepare(
    /* sql */ `
select slug from topic_slug
where topic_id = :topic_id
order by length(slug) asc
limit 1
`,
  )
  .pluck()

function findTopicSlug(topic: Topic) {
  let slug = select_topic_slug.get({ topic_id: topic.id! }) as string
  if (!slug) throw new Error(`topic slug not found, title: ${topic.title}`)
  return slug
}

let storeTopic = (
  lang_id: number,
  task: Task,
  redirected_slug: string,
  links: Link[],
) => {
  let from_topic = task.topic

  if (task.slug !== redirected_slug) {
    let existing_topic = findTopicBySlug(redirected_slug)
    if (existing_topic && existing_topic.id !== from_topic.id) {
      mergeTopic(from_topic, existing_topic)
      from_topic = existing_topic
    }
    if (!existing_topic) {
      proxy.topic_slug.push({ topic_id: from_topic.id!, slug: redirected_slug })
    }
  }

  let newTasks: Task[] = []
  for (let link of links) {
    let to_topic = findTopicBySlug(link.slug)

    if (!to_topic) {
      let to_topic_id = proxy.topic.push({
        title: link.title,
        lang_id,
        collect_time: null,
      })
      proxy.topic_slug.push({ topic_id: to_topic_id, slug: link.slug })
      to_topic = proxy.topic[to_topic_id]
      newTasks.push({ topic: to_topic, slug: link.slug })
    }

    find(proxy.link, {
      from_topic_id: from_topic.id!,
      to_topic_id: to_topic.id!,
    }) ||
      proxy.link.push({
        from_topic_id: from_topic.id!,
        to_topic_id: to_topic.id!,
        text: link.text,
        navigation_not_searchable: link.navigation_not_searchable,
      })
  }

  from_topic.collect_time = Date.now()

  return newTasks
}
storeTopic = db.transaction(storeTopic)

let update_slug = db.prepare(/* sql */ `
update topic_slug
set topic_id = :new_id
where topic_id = :old_id
`)

let update_from_link = db.prepare(/* sql */ `
update link
set from_topic_id = :new_id
where from_topic_id = :old_id
`)

let update_to_link = db.prepare(/* sql */ `
update link
set to_topic_id = :new_id
where to_topic_id = :old_id
`)

let delete_duplicated_to_link = db.prepare(/* sql */ `
with list1 as (
  select to_topic_id from link
  where from_topic_id = :old_id or from_topic_id = :new_id
  group by to_topic_id
  having count(id) > 1
)
, list2 as (
  select id from link
  inner join list1 on list1.to_topic_id = link.to_topic_id
  where from_topic_id = :old_id
)
delete from link where id in (select id from list2)
`)

let delete_duplicated_from_link = db.prepare(/* sql */ `
with list1 as (
  select from_topic_id from link
  where to_topic_id = :old_id or to_topic_id = :new_id
  group by from_topic_id
  having count(id) > 1
)
, list2 as (
  select id from link
  inner join list1 on list1.from_topic_id = link.from_topic_id
  where to_topic_id = :old_id
)
delete from link where id in (select id from list2)
`)

let mergeTopic = (from: Topic, to: Topic) => {
  // cli.nextLine()
  // cli.update(`merge topic "${from.title}" -> "${to.title}"`)
  // cli.nextLine()

  delete_duplicated_from_link.run({ old_id: from.id, new_id: to.id })
  delete_duplicated_to_link.run({ old_id: from.id, new_id: to.id })

  update_slug.run({ old_id: from.id, new_id: to.id })
  update_from_link.run({ old_id: from.id, new_id: to.id })
  update_to_link.run({ old_id: from.id, new_id: to.id })

  delete proxy.topic[from.id!]
}
mergeTopic = db.transaction(mergeTopic)

main().catch(e => console.error(e))
