import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw('alter table `topic` add column `collect_time` integer null')
}


export async function down(knex: Knex): Promise<void> {
  await knex.raw('alter table `topic` drop column `collect_time`')
}
