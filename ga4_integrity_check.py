"""GA4 cross-domain integrity check for denartny.com <-> checkout.denartny.com."""
import csv
import sys

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Filter,
    FilterExpression,
    Metric,
    OrderBy,
    RunReportRequest,
)

PROPERTY_ID = "517108548"


def host_filter(hostname):
    return FilterExpression(
        filter=Filter(
            field_name="hostName",
            string_filter=Filter.StringFilter(value=hostname),
        )
    )


QUERIES = [
    {
        "title": "Sessions by hostname",
        "dimensions": ["hostName"],
        "metrics": ["sessions", "totalUsers"],
        "filter": None,
    },
    {
        "title": "Source/medium for checkout.denartny.com sessions",
        "dimensions": ["sessionSource", "sessionMedium"],
        "metrics": ["sessions", "totalUsers"],
        "filter": host_filter("checkout.denartny.com"),
    },
    {
        "title": "Event firing locations (hostname x event)",
        "dimensions": ["hostName", "eventName"],
        "metrics": ["eventCount", "totalUsers"],
        "filter": None,
    },
]


def main():
    client = BetaAnalyticsDataClient()
    writer = csv.writer(sys.stdout)
    for q in QUERIES:
        writer.writerow([])
        writer.writerow([f"== {q['title']} =="])
        writer.writerow(q["dimensions"] + q["metrics"])
        req = RunReportRequest(
            property=f"properties/{PROPERTY_ID}",
            date_ranges=[DateRange(start_date="30daysAgo", end_date="today")],
            dimensions=[Dimension(name=d) for d in q["dimensions"]],
            metrics=[Metric(name=m) for m in q["metrics"]],
            dimension_filter=q["filter"],
            order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name=q["metrics"][0]), desc=True)],
            limit=250,
        )
        resp = client.run_report(req)
        for row in resp.rows:
            writer.writerow(
                [dv.value for dv in row.dimension_values]
                + [mv.value for mv in row.metric_values]
            )


if __name__ == "__main__":
    main()
