import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('link', table => {
    table.index('to_topic_id')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('link', table => {
    table.dropIndex('to_topic_id')
  })
}
