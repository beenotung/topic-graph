import { Page, chromium } from 'playwright'
import { Topic, proxy } from './proxy'
import { filter, find, unProxy } from 'better-sqlite3-proxy'
import { db } from './db'
import { later } from '@beenotung/tslib/async/wait'
import { ProgressCli } from '@beenotung/tslib/progress-cli'
import { format_time_duration } from '@beenotung/tslib/format'

const collect_interval = 1000

type Task = {
  slug: string
  title: string
}

async function main() {
  let cli = new ProgressCli()
  let browser = await chromium.launch({ headless: true })
  let page = await browser.newPage()

  let lang_id =
    find(proxy.lang, { slug: 'en' })?.id ||
    proxy.lang.push({ slug: 'en', name: 'English' })

  find(proxy.topic, { slug: 'TypeScript', lang_id }) ||
    proxy.topic.push({
      slug: 'TypeScript',
      title: 'TypeScript',
      lang_id,
      collect_time: null,
    })

  let stack: Topic[] = filter(proxy.topic, { lang_id, collect_time: null })

  let lastTime = Date.now()

  for (;;) {
    let topic = stack.pop()
    if (!topic) break
    let now = Date.now()
    let diff = now - lastTime
    if (diff < collect_interval) {
      await later(collect_interval - diff)
    }
    let links = await collectTopic(page, topic)
    lastTime = Date.now()
    if (links.length == 0) {
      cli.nextLine()
      console.error('Error: no links found, topic:', unProxy(topic))
      throw new Error('no links found')
    }
    let new_topics = storeTopic(lang_id, topic, links)
    stack.push(...new_topics)
    cli.update(
      `uptime: ${format_time_duration(process.uptime() * 1000)}` +
        ` | stack: ${stack.length.toLocaleString()}` +
        ` | ${links.length.toLocaleString()} links` +
        ` in topic: "${topic.title}"`,
    )
  }

  await page.close()
  await browser.close()
}

async function collectTopic(page: Page, task: Task) {
  let url = 'https://en.wikipedia.org/wiki/' + task.slug
  await page.goto(url)
  let topics = await page.evaluate(
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
      return links.filter(
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
    },
    { slug: task.slug },
  )
  return topics
}

let storeTopic = (lang_id: number, topic: Topic, links: Task[]) => {
  let from_topic_id = topic.id!
  topic.collect_time = Date.now()
  let new_topics: Topic[] = []
  for (let link of links) {
    let to_topic = find(proxy.topic, {
      slug: link.slug,
      lang_id,
    })
    if (to_topic) {
      proxy.link.push({ from_topic_id, to_topic_id: to_topic.id! })
      continue
    }
    let to_topic_id = proxy.topic.push({
      slug: link.slug,
      title: link.title,
      lang_id,
      collect_time: null,
    })
    to_topic = proxy.topic[to_topic_id]
    new_topics.push(to_topic)
    proxy.link.push({ from_topic_id, to_topic_id })
  }
  return new_topics
}
storeTopic = db.transaction(storeTopic)

main().catch(e => console.error(e))
