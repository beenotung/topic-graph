import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw('alter table `link` add column `text` text not null')
}


export async function down(knex: Knex): Promise<void> {
  await knex.raw('alter table `link` drop column `text`')
}
