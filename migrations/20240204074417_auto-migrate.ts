import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(`topic`, table => table.dropUnique([`slug`]))
  await knex.raw('alter table `topic` drop column `slug`')

  if (!(await knex.schema.hasTable('topic_slug'))) {
    await knex.schema.createTable('topic_slug', table => {
      table.increments('id')
      table.integer('topic_id').unsigned().notNullable().references('topic.id')
      table.text('slug').notNullable().unique()
      table.timestamps(false, true)
    })
  }
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('topic_slug')
  await knex.raw('alter table `topic` add column `slug` text not null')
  await knex.schema.alterTable(`topic`, table => table.unique([`slug`]))
}
