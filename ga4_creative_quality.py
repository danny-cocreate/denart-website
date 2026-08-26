"""Compare IG paid CREATIVE QUALITY by campaign over the full retention window.

CTR tells you who tapped. These metrics tell you who actually cared:
userEngagementDuration per user, scroll depth, and 10s+ dwell.
"""
import csv
import sys

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange, Dimension, Filter, FilterExpression, FilterExpressionList,
    Metric, OrderBy, RunReportRequest,
)

PROPERTY_ID = "517108548"
START = "2025-06-01"
END = "today"


def eq(f, v):
    return FilterExpression(filter=Filter(
        field_name=f, string_filter=Filter.StringFilter(value=v)))


def AND(*e):
    return FilterExpression(and_group=FilterExpressionList(expressions=list(e)))


PAID = eq("sessionMedium", "paid")

QUERIES = [
    {
        "title": "A. Paid campaigns - engagement quality (the real ranking)",
        "dimensions": ["sessionCampaignName"],
        "metrics": ["sessions", "totalUsers", "engagedSessions",
                    "userEngagementDuration", "screenPageViews", "conversions"],
        "filter": PAID,
        "order_metric": "sessions",
        "limit": 50,
    },
    {
        "title": "B. Paid campaigns - scroll depth reached (real reading)",
        "dimensions": ["sessionCampaignName"],
        "metrics": ["eventCount", "totalUsers"],
        "filter": AND(PAID, eq("eventName", "scroll")),
        "order_metric": "totalUsers",
        "limit": 50,
    },
    {
        "title": "C. Paid campaigns - 10s+ dwell (user_engagement)",
        "dimensions": ["sessionCampaignName"],
        "metrics": ["eventCount", "totalUsers"],
        "filter": AND(PAID, eq("eventName", "user_engagement")),
        "order_metric": "totalUsers",
        "limit": 50,
    },
    {
        "title": "D. Paid campaigns - begin_checkout (intent)",
        "dimensions": ["sessionCampaignName"],
        "metrics": ["eventCount", "totalUsers"],
        "filter": AND(PAID, eq("eventName", "begin_checkout")),
        "order_metric": "totalUsers",
        "limit": 50,
    },
    {
        "title": "E. Monthly paid trend - sessions vs engagement",
        "dimensions": ["yearMonth", "sessionCampaignName"],
        "metrics": ["sessions", "userEngagementDuration", "totalUsers"],
        "filter": PAID,
        "order_metric": "sessions",
        "limit": 60,
    },
]


def run_query(client, q):
    om = q.get("order_metric")
    obs = [OrderBy(metric=OrderBy.MetricOrderBy(metric_name=om), desc=True)] if om else []
    req = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        date_ranges=[DateRange(start_date=START, end_date=END)],
        dimensions=[Dimension(name=d) for d in q["dimensions"]],
        metrics=[Metric(name=m) for m in q["metrics"]],
        dimension_filter=q.get("filter"),
        order_bys=obs,
        limit=q.get("limit", 50),
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
