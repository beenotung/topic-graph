import { Page, chromium } from 'playwright'
import { Topic, proxy } from './proxy'
import { count, filter, find, notNull, unProxy } from 'better-sqlite3-proxy'
import { db } from './db'
import { later } from '@beenotung/tslib/async/wait'
import { ProgressCli } from '@beenotung/tslib/progress-cli'
import { format_time_duration } from '@beenotung/tslib/format'

const collect_interval = 1000

type Task = {
  slug: string
  title: string
}

let cli = new ProgressCli()

async function main() {
  let browser = await chromium.launch({ headless: true })
  let page = await browser.newPage()

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

  let stack: Topic[] = filter(proxy.topic, { lang_id, collect_time: null })

  let lastTime = Date.now()

  for (;;) {
    let topic = stack.shift()
    if (!topic) break
    let now = Date.now()
    let diff = now - lastTime
    if (diff < collect_interval) {
      await later(collect_interval - diff)
    }
    let slug = find(proxy.topic_slug, { topic_id: topic.id! })?.slug
    if (!slug) throw new Error('topic slug not found, title: ' + topic.title)
    let { links, redirected_slug } = await collectTopic(page, slug)
    lastTime = Date.now()
    if (links.length == 0) {
      cli.nextLine()
      console.error('Error: no links found, topic:', unProxy(topic))
      throw new Error('no links found')
    }
    let new_topics = storeTopic(lang_id, topic, redirected_slug, links)
    stack.push(...new_topics)
    let collected = count(proxy.topic, { collect_time: notNull })
    let pending = stack.length
    let progress = (collected / (collected + pending)) * 100
    cli.update(
      `uptime: ${format_time_duration(process.uptime() * 1000)}` +
        ` | collected: ${collected.toLocaleString()}` +
        ` | pending: ${pending.toLocaleString()}` +
        ` | progress: ${progress.toFixed(2)}%` +
        ` | ${links.length.toLocaleString()} links` +
        ` in topic: "${topic.title}"`,
    )
  }

  await page.close()
  await browser.close()
}

async function collectTopic(page: Page, slug: string) {
  let url_prefix = 'https://en.wikipedia.org/wiki/'
  let url = url_prefix + slug
  await page.goto(url)
  let { links, href } = await page.evaluate(
    ({ slug }) => {
      let links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          '#bodyContent a[href*="/wiki/"][title]',
        ),
        a => ({
          slug: a
            .getAttribute('href')
            ?.match(/^\/wiki\/(.*)$/)?.[1]
            .split('#')[0]!,
          title: a.title,
        }),
      )
      if (links.some(link => link.slug == 'Wikipedia:Project_namespace')) {
        throw new Error(`unexpected link, task.slug: ${slug}`)
      }
      links = links.filter(
        link =>
          link.slug &&
          !(
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
  let redirected_slug = href.replace(url_prefix, '').split('#')[0]
  if (redirected_slug != slug) {
    cli.nextLine()
    cli.writeln(`topic slug redirected: "${slug}" -> "${redirected_slug}"`)
  }
  return { links, redirected_slug }
}

function findTopicBySlug(slug: string) {
  return find(proxy.topic_slug, { slug })?.topic
}

let storeTopic = (
  lang_id: number,
  topic: Topic,
  redirected_slug: string,
  links: Task[],
) => {
  let from_topic_id = topic.id!
  topic.collect_time = Date.now()
  find(proxy.topic_slug, { topic_id: from_topic_id, slug: redirected_slug }) ||
    proxy.topic_slug.push({ topic_id: from_topic_id, slug: redirected_slug })
  let new_topics: Topic[] = []
  for (let link of links) {
    let to_topic = findTopicBySlug(link.slug)
    if (to_topic) {
      proxy.link.push({ from_topic_id, to_topic_id: to_topic.id! })
      continue
    }
    let to_topic_id = proxy.topic.push({
      title: link.title,
      lang_id,
      collect_time: null,
    })
    proxy.topic_slug.push({ topic_id: to_topic_id, slug: link.slug })
    to_topic = proxy.topic[to_topic_id]
    new_topics.push(to_topic)
    proxy.link.push({ from_topic_id, to_topic_id })
  }
  return new_topics
}
storeTopic = db.transaction(storeTopic)

main().catch(e => console.error(e))
