import { startTimer } from '@beenotung/tslib/timer'
import { Knex } from 'knex'

// prettier-ignore
export async function up(knex: Knex): Promise<void> {
  await knex.raw('alter table `topic` add column `out_link_count` integer null')
  await knex.raw('alter table `topic` add column `in_link_count` integer null')
}

// prettier-ignore
export async function down(knex: Knex): Promise<void> {
  await knex.raw('alter table `topic` drop column `in_link_count`')
  await knex.raw('alter table `topic` drop column `out_link_count`')
}
