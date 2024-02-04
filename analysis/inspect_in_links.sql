select
  topic.id
, topic.title
, link.navigation_not_searchable
from link
inner join topic on topic.id = link.from_topic_id
where to_topic_id in (
  select id from topic
  where title = 'Digital marketing'
)
