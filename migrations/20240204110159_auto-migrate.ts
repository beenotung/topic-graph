import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.raw(
    'alter table `link` add column `navigation_not_searchable` boolean not null',
  )
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('alter table `link` drop column `navigation_not_searchable`')
}
