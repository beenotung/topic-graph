import { Knex } from 'knex'

// prettier-ignore
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('no_link_topic'))) {
    await knex.schema.createTable('no_link_topic', table => {
      table.increments('id')
      table.integer('topic_id').unsigned().notNullable().references('topic.id')
      table.integer('discover_time').notNullable()
      table.integer('confirm_time').nullable()
      table.timestamps(false, true)
    })
  }
}

// prettier-ignore
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('no_link_topic')
}
