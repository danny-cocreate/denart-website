"""Does IG traffic tap the header 'Book Session' CTA -> /schedule-a-session ?"""
import csv
import sys

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange, Dimension, Filter, FilterExpression, FilterExpressionList,
    Metric, OrderBy, RunReportRequest,
)

PROPERTY_ID = "517108548"
CONTAINS = Filter.StringFilter.MatchType.CONTAINS


def contains(field, val):
    return FilterExpression(filter=Filter(
        field_name=field,
        string_filter=Filter.StringFilter(value=val, match_type=CONTAINS)))


def eq(field, val):
    return FilterExpression(filter=Filter(
        field_name=field, string_filter=Filter.StringFilter(value=val)))


def AND(*exprs):
    return FilterExpression(and_group=FilterExpressionList(expressions=list(exprs)))

IG = AND(eq("sessionSource", "ig"), eq("sessionMedium", "paid"))

QUERIES = [
    {
        "title": "A. schedule-a-session pageviews by source/medium",
        "dimensions": ["sessionSource", "sessionMedium"],
        "metrics": ["screenPageViews", "totalUsers", "sessions"],
        "filter": contains("pagePath", "schedule-a-session"),
        "order_metric": "screenPageViews",
    },
    {
        "title": "B. schedule-a-session by landing page (where they came from)",
        "dimensions": ["landingPage"],
        "metrics": ["screenPageViews", "totalUsers"],
        "filter": contains("pagePath", "schedule-a-session"),
        "order_metric": "screenPageViews",
    },
    {
        "title": "C. Pages viewed in sessions that LANDED on uv-body-paint-couples",
        "dimensions": ["pagePath"],
        "metrics": ["screenPageViews", "totalUsers"],
        "filter": contains("landingPage", "uv-body-paint-couples"),
        "order_metric": "screenPageViews",
    },
    {
        "title": "D. IG paid - all pages viewed",
        "dimensions": ["pagePath"],
        "metrics": ["screenPageViews", "totalUsers"],
        "filter": IG,
        "order_metric": "screenPageViews",
    },
    {
        "title": "E. form_start by page path + hostname",
        "dimensions": ["hostName", "pagePath"],
        "metrics": ["eventCount", "totalUsers"],
        "filter": eq("eventName", "form_start"),
        "order_metric": "eventCount",
    },
    {
        "title": "F. form_start by source/medium",
        "dimensions": ["sessionSource", "sessionMedium"],
        "metrics": ["eventCount", "totalUsers"],
        "filter": eq("eventName", "form_start"),
        "order_metric": "eventCount",
    },
    {
        "title": "G. click event by page path + source",
        "dimensions": ["pagePath", "sessionSource"],
        "metrics": ["eventCount", "totalUsers"],
        "filter": eq("eventName", "click"),
        "order_metric": "eventCount",
    },
    {
        "title": "H. begin_checkout by source/medium + hostname",
        "dimensions": ["sessionSource", "sessionMedium", "hostName"],
        "metrics": ["eventCount", "totalUsers"],
        "filter": eq("eventName", "begin_checkout"),
        "order_metric": "eventCount",
    },
    {
        "title": "I. IG paid - landing page to page path pairs",
        "dimensions": ["landingPage", "pagePath"],
        "metrics": ["screenPageViews", "totalUsers"],
        "filter": IG,
        "order_metric": "screenPageViews",
        "limit": 40,
    },
]


def run_query(client, q):
    om = q.get("order_metric")
    obs = [OrderBy(metric=OrderBy.MetricOrderBy(metric_name=om), desc=True)] if om else []
    req = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        date_ranges=[DateRange(start_date="30daysAgo", end_date="today")],
        dimensions=[Dimension(name=d) for d in q["dimensions"]],
        metrics=[Metric(name=m) for m in q["metrics"]],
        dimension_filter=q.get("filter"),
        order_bys=obs,
        limit=q.get("limit", 30),
    )
    return client.run_report(req)


def main():
    client = BetaAnalyticsDataClient()
    w = csv.writer(sys.stdout)
    for q in QUERIES:
        w.writerow([])
        w.writerow([f"== {q['title']} =="])
        w.writerow(q["dimensions"] + q["metrics"])
        for row in run_query(client, q).rows:
            w.writerow([d.value for d in row.dimension_values]
                       + [m.value for m in row.metric_values])


if __name__ == "__main__":
    main()
