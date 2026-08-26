"""
denartny-ga4 pull: full site performance + funnel health check, last 30 days.
"""
import csv
import sys

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Filter,
    FilterExpression,
    FilterExpressionList,
    Metric,
    OrderBy,
    RunReportRequest,
)

PROPERTY_ID = "517108548"


def host_equals(hostname):
    return FilterExpression(
        filter=Filter(field_name="hostName", string_filter=Filter.StringFilter(value=hostname))
    )


def event_equals(event_name):
    return FilterExpression(
        filter=Filter(field_name="eventName", string_filter=Filter.StringFilter(value=event_name))
    )


ig_paid_filter = FilterExpression(
    and_group=FilterExpressionList(expressions=[
        FilterExpression(filter=Filter(
            field_name="sessionSource",
            string_filter=Filter.StringFilter(value="ig"),
        )),
        FilterExpression(filter=Filter(
            field_name="sessionMedium",
            string_filter=Filter.StringFilter(value="paid"),
        )),
    ])
)

QUERIES = [
    {
        "title": "Totals (last 30 days)",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": [],
        "metrics": ["sessions", "totalUsers", "conversions", "eventCount", "engagedSessions"],
    },
    {
        "title": "Daily trend",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": ["date"],
        "metrics": ["sessions", "conversions", "totalUsers"],
        "order_metric": "date",
    },
    {
        "title": "Cross-domain integrity check - checkout source/medium",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": ["sessionSource", "sessionMedium"],
        "metrics": ["sessions", "totalUsers"],
        "filter": host_equals("checkout.denartny.com"),
    },
    {
        "title": "Full checkout funnel - events by hostname",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": ["hostName", "eventName"],
        "metrics": ["eventCount", "totalUsers"],
        "order_metric": "eventCount",
    },
    {
        "title": "Funnel step - page_view",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": [], "metrics": ["totalUsers", "eventCount"],
        "filter": event_equals("page_view"),
    },
    {
        "title": "Funnel step - begin_checkout",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": [], "metrics": ["totalUsers", "eventCount"],
        "filter": event_equals("begin_checkout"),
    },
    {
        "title": "Funnel step - date_selected",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": [], "metrics": ["totalUsers", "eventCount"],
        "filter": event_equals("date_selected"),
    },
    {
        "title": "Funnel step - form_start",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": [], "metrics": ["totalUsers", "eventCount"],
        "filter": event_equals("form_start"),
    },
    {
        "title": "Funnel step - purchase",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": [], "metrics": ["totalUsers", "eventCount"],
        "filter": event_equals("purchase"),
    },
    {
        "title": "Drop-off signal - checkout_abandoned",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": [], "metrics": ["totalUsers", "eventCount"],
        "filter": event_equals("checkout_abandoned"),
    },
    {
        "title": "Traffic by source/medium",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": ["sessionSource", "sessionMedium"],
        "metrics": ["sessions", "totalUsers", "conversions", "engagementRate"],
    },
    {
        "title": "IG paid - per-campaign performance",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": ["sessionCampaignName"],
        "metrics": ["sessions", "totalUsers", "conversions", "engagementRate", "averageSessionDuration"],
        "filter": ig_paid_filter,
    },
    {
        "title": "IG paid - funnel events by campaign",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": ["sessionCampaignName", "eventName"],
        "metrics": ["eventCount", "totalUsers"],
        "filter": ig_paid_filter,
    },
    {
        "title": "Landing page performance",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": ["landingPage"],
        "metrics": ["sessions", "conversions", "engagementRate", "averageSessionDuration"],
    },
    {
        "title": "Entry landing page - begin_checkout",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": ["landingPage"],
        "metrics": ["sessions", "eventCount"],
        "filter": event_equals("begin_checkout"),
    },
    {
        "title": "Entry landing page - purchase",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": ["landingPage"],
        "metrics": ["sessions", "eventCount"],
        "filter": event_equals("purchase"),
    },
    {
        "title": "Device category - begin_checkout vs purchase",
        "start_date": "30daysAgo", "end_date": "today",
        "dimensions": ["deviceCategory", "eventName"],
        "metrics": ["eventCount", "totalUsers"],
        "order_metric": "eventCount",
    },
]


def run_query(client, q):
    dimensions = [Dimension(name=d) for d in q["dimensions"]]
    metrics = [Metric(name=m) for m in q["metrics"]]
    order_metric = q.get("order_metric") or (q["metrics"][0] if q["metrics"] else None)
    order_bys = (
        [OrderBy(metric=OrderBy.MetricOrderBy(metric_name=order_metric), desc=True)]
        if order_metric and order_metric in q["metrics"]
        else []
    )
    req = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        date_ranges=[DateRange(start_date=q["start_date"], end_date=q["end_date"])],
        dimensions=dimensions,
        metrics=metrics,
        dimension_filter=q.get("filter"),
        order_bys=order_bys,
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
