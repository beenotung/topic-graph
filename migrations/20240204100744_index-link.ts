import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('link', table => {
    table.unique(['from_topic_id', 'to_topic_id'])
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('link', table => {
    table.dropUnique(['from_topic_id', 'to_topic_id'])
  })
}
