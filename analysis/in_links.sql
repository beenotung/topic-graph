select
  count(*) as count
, to_topic_id
, topic.title
from link
inner join topic on topic.id = link.to_topic_id
group by to_topic_id
order by count desc
