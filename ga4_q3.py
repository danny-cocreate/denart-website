"""Engagement quality + geography by traffic source."""
import csv
import sys

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange, Dimension, Filter, FilterExpression, FilterExpressionList,
    Metric, OrderBy, RunReportRequest,
)

PROPERTY_ID = "517108548"


def eq(f, v):
    return FilterExpression(filter=Filter(
        field_name=f, string_filter=Filter.StringFilter(value=v)))


def AND(*e):
    return FilterExpression(and_group=FilterExpressionList(expressions=list(e)))


IG = AND(eq("sessionSource", "ig"), eq("sessionMedium", "paid"))

QUERIES = [
    {
        "title": "A. scroll-to-90pct by source/medium",
        "dimensions": ["sessionSource", "sessionMedium"],
        "metrics": ["eventCount", "totalUsers"],
        "filter": eq("eventName", "scroll"),
        "order_metric": "totalUsers",
    },
    {
        "title": "B. Engagement quality by source/medium",
        "dimensions": ["sessionSource", "sessionMedium"],
        "metrics": ["sessions", "totalUsers", "engagedSessions",
                    "engagementRate", "averageSessionDuration",
                    "userEngagementDuration", "screenPageViews"],
        "order_metric": "sessions",
    },
    {
        "title": "C. IG paid by city",
        "dimensions": ["city", "region"],
        "metrics": ["sessions", "totalUsers", "engagementRate"],
        "filter": IG,
        "order_metric": "sessions",
        "limit": 25,
    },
    {
        "title": "D. IG paid by country",
        "dimensions": ["country"],
        "metrics": ["sessions", "totalUsers"],
        "filter": IG,
        "order_metric": "sessions",
        "limit": 15,
    },
    {
        "title": "E. All traffic by city (comparison)",
        "dimensions": ["city"],
        "metrics": ["sessions", "totalUsers", "conversions"],
        "order_metric": "sessions",
        "limit": 20,
    },
    {
        "title": "F. user_engagement event by source",
        "dimensions": ["sessionSource", "sessionMedium"],
        "metrics": ["eventCount", "totalUsers"],
        "filter": eq("eventName", "user_engagement"),
        "order_metric": "totalUsers",
    },
    {
        "title": "G. IG paid daily trend",
        "dimensions": ["date"],
        "metrics": ["sessions", "totalUsers", "engagementRate"],
        "filter": IG,
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
