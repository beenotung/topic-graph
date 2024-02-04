import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

  if (!(await knex.schema.hasTable('lang'))) {
    await knex.schema.createTable('lang', table => {
      table.increments('id')
      table.text('name').notNullable()
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('topic'))) {
    await knex.schema.createTable('topic', table => {
      table.increments('id')
      table.text('title').notNullable()
      table.integer('lang_id').unsigned().notNullable().references('lang.id')
      table.timestamps(false, true)
    })
  }

  if (!(await knex.schema.hasTable('link'))) {
    await knex.schema.createTable('link', table => {
      table.increments('id')
      table.integer('from_topic_id').unsigned().notNullable().references('topic.id')
      table.integer('to_topic_id').unsigned().notNullable().references('topic.id')
      table.timestamps(false, true)
    })
  }
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('link')
  await knex.schema.dropTableIfExists('topic')
  await knex.schema.dropTableIfExists('lang')
}
