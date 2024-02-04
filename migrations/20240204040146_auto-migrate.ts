import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw('alter table `topic` add column `slug` text not null')
  await knex.schema.alterTable(`topic`, table => table.unique([`slug`]))
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(`topic`, table => table.dropUnique([`slug`]))
  await knex.raw('alter table `topic` drop column `slug`')
}
