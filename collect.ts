import { chromium } from 'playwright'
import { proxy } from './proxy'
import { count, find, notNull, unProxy, clearCache } from 'better-sqlite3-proxy'
import { db } from './db'
import { later } from '@beenotung/tslib/async/wait'
import { ProgressCli } from '@beenotung/tslib/progress-cli'
import { format_time_duration } from '@beenotung/tslib/format'
import { GracefulPage } from 'graceful-playwright'
import { MINUTE } from '@beenotung/tslib/time'

const collect_interval = 1000
const clear_cache_interval = 30 * MINUTE

type Task = {
  topic_id: number
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

let select_pending_task = db
  .prepare<{ lang_id: number }, number>(
    /* sql */ `
select id
from topic
where lang_id = :lang_id
  and collect_time is null
`,
  )
  .pluck()

let select_topic_title = db
  .prepare<{ topic_id: number }, string>(
    /* sql */ `
select title
from topic
where id = :topic_id
`,
  )
  .pluck()

async function main() {
  let browser = await chromium.launch({ headless: true })
  let page = new GracefulPage({ from: browser })

  setInterval(() => {
    clearCache(proxy)
  }, clear_cache_interval)

  let lang_id =
    find(proxy.lang, { slug: 'en' })?.id ||
    proxy.lang.push({ slug: 'en', name: 'English' })

  let topic_id = select_topic_id_by_slug.get({ slug: 'TypeScript' })
  if (!topic_id) {
    let topic_id = proxy.topic.push({
      title: 'TypeScript',
      lang_id,
      collect_time: null,
    })
    proxy.topic_slug.push({ topic_id, slug: 'TypeScript' })
  }

  let stack: Task[] = select_pending_task.all({ lang_id }).map(topic_id => ({
    topic_id,
    get slug() {
      return findTopicSlug(topic_id)
    },
  }))

  let lastTime = Date.now()

  for (;;) {
    let task = stack.shift()
    if (!task) break
    let topic_title = select_topic_title.get({ topic_id: task.topic_id })
    let now = Date.now()
    let diff = now - lastTime
    if (diff < collect_interval) {
      await later(collect_interval - diff)
    }
    let { links, redirected_slug } = await collectTopic(page, task)
    lastTime = Date.now()
    if (links.length == 0) {
      cli.nextLine()
      console.error(
        'Error: no links found, topic:',
        unProxy(proxy.topic[task.topic_id]),
      )
      // throw new Error('no links found')
      find(proxy.no_link_topic, { topic_id: task.topic_id }) ||
        proxy.no_link_topic.push({
          topic_id: task.topic_id,
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
        ` in topic: "${topic_title}"`,
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

let select_topic_id_by_slug = db
  .prepare<{ slug: string }, number>(
    /* sql */ `
select topic_id
from topic_slug
where slug = :slug
`,
  )
  .pluck()

let select_topic_slug = db
  .prepare<{ topic_id: number }, string>(
    /* sql */ `
select slug from topic_slug
where topic_id = :topic_id
order by length(slug) asc
limit 1
`,
  )
  .pluck()

function findTopicSlug(topic_id: number) {
  let slug = select_topic_slug.get({ topic_id })
  if (!slug) {
    throw new Error(
      `topic slug not found, title: ${proxy.topic[topic_id].title}`,
    )
  }
  return slug
}

let select_link = db.prepare<
  { from_topic_id: number; to_topic_id: number },
  number
>(/* sql */ `
select id
from link
where from_topic_id = :from_topic_id
  and to_topic_id = :to_topic_id
`)

let storeTopic = (
  lang_id: number,
  task: Task,
  redirected_slug: string,
  links: Link[],
) => {
  let from_topic_id = task.topic_id

  if (task.slug !== redirected_slug) {
    let existing_topic_id = select_topic_id_by_slug.get({
      slug: redirected_slug,
    })
    if (existing_topic_id && existing_topic_id !== from_topic_id) {
      mergeTopic(from_topic_id, existing_topic_id)
      from_topic_id = existing_topic_id
    }
    if (!existing_topic_id) {
      proxy.topic_slug.push({ topic_id: from_topic_id, slug: redirected_slug })
    }
  }

  let newTasks: Task[] = []
  for (let link of links) {
    let to_topic_id = select_topic_id_by_slug.get({ slug: link.slug })
    if (!to_topic_id) {
      to_topic_id = proxy.topic.push({
        title: link.title,
        lang_id,
        collect_time: null,
      })
      proxy.topic_slug.push({ topic_id: to_topic_id, slug: link.slug })
      newTasks.push({ topic_id: to_topic_id, slug: link.slug })
    }

    select_link.get({
      from_topic_id,
      to_topic_id,
    }) ||
      proxy.link.push({
        from_topic_id,
        to_topic_id,
        text: link.text,
        navigation_not_searchable: link.navigation_not_searchable,
      })
  }

  proxy.topic[from_topic_id].collect_time = Date.now()

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

let mergeTopic = (old_id: number, new_id: number) => {
  // cli.nextLine()
  // cli.update(`merge topic "${from.title}" -> "${to.title}"`)
  // cli.nextLine()

  delete_duplicated_from_link.run({ old_id, new_id })
  delete_duplicated_to_link.run({ old_id, new_id })

  update_slug.run({ old_id, new_id })
  update_from_link.run({ old_id, new_id })
  update_to_link.run({ old_id, new_id })

  let old_no_link = find(proxy.no_link_topic, { topic_id: old_id })
  let new_no_link = find(proxy.no_link_topic, { topic_id: new_id })
  if (old_no_link && new_no_link) {
    // combine them, then delete the old one
    new_no_link.confirm_time ||= old_no_link.confirm_time
    delete proxy.no_link_topic[old_no_link.id!]
  } else if (old_no_link && !new_no_link) {
    // rename the old topic to new topic
    old_no_link.topic_id = new_id
  } else if (!old_no_link && new_no_link) {
    // no need to do anything
  }

  delete proxy.topic[old_id]
}
mergeTopic = db.transaction(mergeTopic)

main().catch(e => console.error(e))
