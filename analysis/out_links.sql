select
  count(*) as count
, from_topic_id
, topic.title
from link
inner join topic on topic.id = link.from_topic_id
group by from_topic_id
order by count desc
