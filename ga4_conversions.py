"""GA4 conversion pull for denartny.com (property 517108548)."""
import csv
import sys

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    OrderBy,
    RunReportRequest,
)

PROPERTY_ID = "517108548"
DATE_RANGE = DateRange(start_date="30daysAgo", end_date="today")


def run_report(client, dimensions, metrics, order_metric="conversions"):
    req = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        date_ranges=[DATE_RANGE],
        dimensions=[Dimension(name=d) for d in dimensions],
        metrics=[Metric(name=m) for m in metrics],
        order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name=order_metric), desc=True)],
        limit=250,
    )
    return client.run_report(req)


def write_section(writer, title, resp, dimension_headers, metric_headers):
    writer.writerow([])
    writer.writerow([f"== {title} =="])
    writer.writerow(dimension_headers + metric_headers)
    for row in resp.rows:
        writer.writerow([dv.value for dv in row.dimension_values] + [mv.value for mv in row.metric_values])


def main():
    client = BetaAnalyticsDataClient()
    writer = csv.writer(sys.stdout)

    totals = run_report(client, dimensions=[], metrics=["sessions", "totalUsers", "conversions", "eventCount"])
    writer.writerow(["== Totals (last 30 days) =="])
    writer.writerow(["sessions", "totalUsers", "conversions", "eventCount"])
    for row in totals.rows:
        writer.writerow([mv.value for mv in row.metric_values])

    by_event = run_report(client, dimensions=["eventName"], metrics=["eventCount", "conversions", "totalUsers"])
    write_section(writer, "Conversions by event", by_event, ["eventName"], ["eventCount", "conversions", "totalUsers"])

    by_source = run_report(client, dimensions=["sessionSource", "sessionMedium"], metrics=["sessions", "conversions", "totalUsers"])
    write_section(writer, "Conversions by source / medium", by_source, ["source", "medium"], ["sessions", "conversions", "totalUsers"])

    by_landing = run_report(client, dimensions=["landingPage"], metrics=["sessions", "conversions", "totalUsers"])
    write_section(writer, "Conversions by landing page", by_landing, ["landingPage"], ["sessions", "conversions", "totalUsers"])


if __name__ == "__main__":
    main()
