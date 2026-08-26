"""
Funnel comparison: 30 days pre-fix (Mar 20 - Apr 19) vs 3 days post-fix (Apr 20 - Apr 22).
"""
import csv
import sys

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange, Dimension, Filter, FilterExpression, FilterExpressionList,
    Metric, OrderBy, RunReportRequest,
)

PROPERTY_ID = "517108548"
PRE_START = "2026-03-20"
PRE_END = "2026-04-19"
POST_START = "2026-04-20"
POST_END = "2026-04-22"


def event_in(events):
    return FilterExpression(filter=Filter(field_name="eventName",
        in_list_filter=Filter.InListFilter(values=events)))


def ig_source():
    return FilterExpression(filter=Filter(field_name="sessionSource",
        string_filter=Filter.StringFilter(value="ig")))


def and_filters(*exprs):
    return FilterExpression(and_group=FilterExpressionList(expressions=list(exprs)))


FUNNEL_EVENTS = [
    "session_start", "begin_checkout", "date_selected",
    "form_start", "add_payment_info", "purchase", "checkout_abandoned",
]

QUERIES = [
    {
        "title": f"PRE-FIX event totals ({PRE_START} to {PRE_END}) - all traffic",
        "start_date": PRE_START, "end_date": PRE_END,
        "dimensions": ["eventName"],
        "metrics": ["eventCount", "totalUsers"],
        "filter": event_in(FUNNEL_EVENTS), "order_metric": "eventCount",
    },
    {
        "title": f"POST-FIX event totals ({POST_START} to {POST_END}) - all traffic",
        "start_date": POST_START, "end_date": POST_END,
        "dimensions": ["eventName"],
        "metrics": ["eventCount", "totalUsers"],
        "filter": event_in(FUNNEL_EVENTS), "order_metric": "eventCount",
    },
    {
        "title": f"PRE-FIX IG-only event funnel ({PRE_START} to {PRE_END})",
        "start_date": PRE_START, "end_date": PRE_END,
        "dimensions": ["eventName"],
        "metrics": ["eventCount", "totalUsers"],
        "filter": and_filters(ig_source(), event_in(FUNNEL_EVENTS)),
        "order_metric": "eventCount",
    },
    {
        "title": f"POST-FIX IG-only event funnel ({POST_START} to {POST_END})",
        "start_date": POST_START, "end_date": POST_END,
        "dimensions": ["eventName"],
        "metrics": ["eventCount", "totalUsers"],
        "filter": and_filters(ig_source(), event_in(FUNNEL_EVENTS)),
        "order_metric": "eventCount",
    },
    {
        "title": f"PRE-FIX sessions by source ({PRE_START} to {PRE_END})",
        "start_date": PRE_START, "end_date": PRE_END,
        "dimensions": ["sessionSource", "sessionMedium"],
        "metrics": ["sessions", "totalUsers"],
        "order_metric": "sessions", "limit": 25,
    },
    {
        "title": f"POST-FIX sessions by source ({POST_START} to {POST_END})",
        "start_date": POST_START, "end_date": POST_END,
        "dimensions": ["sessionSource", "sessionMedium"],
        "metrics": ["sessions", "totalUsers"],
        "order_metric": "sessions", "limit": 25,
    },
    {
        "title": f"PRE-FIX purchases ({PRE_START} to {PRE_END})",
        "start_date": PRE_START, "end_date": PRE_END,
        "dimensions": [], "metrics": ["transactions", "totalRevenue", "purchaseRevenue"],
    },
    {
        "title": f"POST-FIX purchases ({POST_START} to {POST_END})",
        "start_date": POST_START, "end_date": POST_END,
        "dimensions": [], "metrics": ["transactions", "totalRevenue", "purchaseRevenue"],
    },
    {
        "title": f"Day-by-day funnel events ({PRE_START} to {POST_END})",
        "start_date": PRE_START, "end_date": POST_END,
        "dimensions": ["date", "eventName"],
        "metrics": ["eventCount"],
        "filter": event_in(["begin_checkout", "date_selected", "form_start", "purchase"]),
        "order_metric": "eventCount", "limit": 500,
    },
]


def run_query(client, q):
    dimensions = [Dimension(name=d) for d in q["dimensions"]]
    metrics = [Metric(name=m) for m in q["metrics"]]
    order_metric = q.get("order_metric") or (q["metrics"][0] if q["metrics"] else None)
    order_bys = ([OrderBy(metric=OrderBy.MetricOrderBy(metric_name=order_metric), desc=True)]
                 if order_metric else [])
    req = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        date_ranges=[DateRange(start_date=q["start_date"], end_date=q["end_date"])],
        dimensions=dimensions, metrics=metrics,
        dimension_filter=q.get("filter"), order_bys=order_bys,
        limit=q.get("limit", 250),
    )
    return client.run_report(req)


def main():
    client = BetaAnalyticsDataClient()
    writer = csv.writer(sys.stdout)
    for q in QUERIES:
        writer.writerow([])
        writer.writerow([f"== {q['title']} =="])
        writer.writerow(q["dimensions"] + q["metrics"])
        resp = run_query(client, q)
        for row in resp.rows:
            writer.writerow(
                [dv.value for dv in row.dimension_values]
                + [mv.value for mv in row.metric_values]
            )


if __name__ == "__main__":
    main()
