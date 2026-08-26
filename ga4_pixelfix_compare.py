"""Before/after the 2026-08-15 Meta pixel deploy. Property 517108548."""
import csv, sys
from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange, Dimension, Filter, FilterExpression, Metric, OrderBy, RunReportRequest,
)

PROPERTY_ID = "517108548"

def host_equals(h):
    return FilterExpression(filter=Filter(field_name="hostName",
        string_filter=Filter.StringFilter(value=h)))

def event_equals(e):
    return FilterExpression(filter=Filter(field_name="eventName",
        string_filter=Filter.StringFilter(value=e)))

BEFORE = ("2026-08-09", "2026-08-14")   # 6 days pre-deploy
AFTER  = ("2026-08-15", "2026-08-20")   # 6 days post-deploy
BASE   = ("2026-07-16", "2026-08-20")   # 5-week context

QUERIES = [
    {"title": "Daily trend (Jul 16 - today)", "start_date": BASE[0], "end_date": BASE[1],
     "dimensions": ["date"], "metrics": ["sessions", "totalUsers", "conversions", "eventCount"]},
    {"title": "Daily purchases (Jul 16 - today)", "start_date": BASE[0], "end_date": BASE[1],
     "dimensions": ["date"], "metrics": ["eventCount", "totalUsers"], "filter": event_equals("purchase")},
    {"title": "INTEGRITY: checkout subdomain session source", "start_date": BASE[0], "end_date": BASE[1],
     "dimensions": ["sessionSource", "sessionMedium"], "metrics": ["sessions", "totalUsers"],
     "filter": host_equals("checkout.denartny.com")},
    {"title": "BEFORE funnel - events by hostname", "start_date": BEFORE[0], "end_date": BEFORE[1],
     "dimensions": ["hostName", "eventName"], "metrics": ["eventCount", "totalUsers"], "order_metric": "eventCount"},
    {"title": "AFTER funnel - events by hostname", "start_date": AFTER[0], "end_date": AFTER[1],
     "dimensions": ["hostName", "eventName"], "metrics": ["eventCount", "totalUsers"], "order_metric": "eventCount"},
    {"title": "BEFORE traffic by source/medium/campaign", "start_date": BEFORE[0], "end_date": BEFORE[1],
     "dimensions": ["sessionSource", "sessionMedium", "sessionCampaignName"],
     "metrics": ["sessions", "totalUsers", "conversions", "engagementRate"]},
    {"title": "AFTER traffic by source/medium/campaign", "start_date": AFTER[0], "end_date": AFTER[1],
     "dimensions": ["sessionSource", "sessionMedium", "sessionCampaignName"],
     "metrics": ["sessions", "totalUsers", "conversions", "engagementRate"]},
    {"title": "AFTER landing pages", "start_date": AFTER[0], "end_date": AFTER[1],
     "dimensions": ["landingPage"], "metrics": ["sessions", "conversions", "engagementRate"]},
    {"title": "BEFORE landing pages", "start_date": BEFORE[0], "end_date": BEFORE[1],
     "dimensions": ["landingPage"], "metrics": ["sessions", "conversions", "engagementRate"]},
]

def run_query(client, q):
    om = q.get("order_metric") or (q["metrics"][0] if q["metrics"] else None)
    req = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        date_ranges=[DateRange(start_date=q["start_date"], end_date=q["end_date"])],
        dimensions=[Dimension(name=d) for d in q["dimensions"]],
        metrics=[Metric(name=m) for m in q["metrics"]],
        dimension_filter=q.get("filter"),
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name=om), desc=True)] if om else [],
        limit=q.get("limit", 250),
    )
    return client.run_report(req)

def main():
    client = BetaAnalyticsDataClient()
    w = csv.writer(sys.stdout)
    for q in QUERIES:
        w.writerow([])
        w.writerow([f"== {q['title']} ({q['start_date']} to {q['end_date']}) =="])
        w.writerow(q["dimensions"] + q["metrics"])
        rows = [[dv.value for dv in r.dimension_values] + [mv.value for mv in r.metric_values]
                for r in run_query(client, q).rows]
        if q["dimensions"][:1] == ["date"]:
            rows.sort(key=lambda r: r[0])
        for r in rows:
            w.writerow(r)

if __name__ == "__main__":
    main()
