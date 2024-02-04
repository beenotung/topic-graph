import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  let rows = await knex.raw(/* sql */ `
  select id, from_topic_id, to_topic_id from link
  group by from_topic_id, to_topic_id
  having count(id) > 1
  `)
  for (let row of rows) {
    await knex.raw(
      /* sql */ `
    delete from link
    where from_topic_id = :from_topic_id
      and to_topic_id = :to_topic_id
      and id <> :id
    `,
      row,
    )
  }
  await knex.schema.alterTable('link', table => {
    table.unique(['from_topic_id', 'to_topic_id'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('link', table => {
    table.dropUnique(['from_topic_id', 'to_topic_id'])
  })
}
