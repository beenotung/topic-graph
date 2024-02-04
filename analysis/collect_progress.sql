with list1 as (
select
  case when collect_time is null
    then 'pending'
	else 'done'
  end as status
, count(*) as count
from topic
group by status
)
, list2 as (
select sum(count) as total from list1
)
select
  status
, count
, 100.0 * count / (select total from list2) as percentage
from list1
