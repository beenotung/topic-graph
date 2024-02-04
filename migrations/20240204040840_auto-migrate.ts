import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw('alter table `lang` add column `slug` text not null')
  await knex.schema.alterTable(`lang`, table => table.unique([`slug`]))
}


export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable(`lang`, table => table.dropUnique([`slug`]))
  await knex.raw('alter table `lang` drop column `slug`')
}
