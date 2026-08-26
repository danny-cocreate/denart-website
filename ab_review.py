"""
A/B experiment review script for denartny.com.

Reads experiments.json from the project root, pulls GA4 data for the active
experiment segmented by ab_variant custom dimension, runs a two-proportion
z-test, and prints a plain-text summary with a recommendation.

Usage (from project root):
    export GOOGLE_APPLICATION_CREDENTIALS=~/Desktop/denart-analytics-key.json
    python3 ab_review.py > ab_review_output.csv

The CSV output contains raw GA4 tables. The summary block at the end of stdout
is the human-readable result.

IMPORTANT: The GA4 custom dimension 'ab_variant' must be registered in GA4
Admin -> Custom Definitions before this script can query it. Scope: Event,
Parameter: ab_variant.

Customized for scheduled review run:
EXPERIMENT_ID = "exp-001"
START_DATE = "2026-04-22"
TARGET_METRIC = "begin_checkout"
"""

import csv
import json
import math
import sys
from datetime import date, datetime
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
EXPERIMENTS_FILE = "experiments.json"

# ---------------------------------------------------------------------------
# Load active experiment config
# ---------------------------------------------------------------------------

def load_experiment():
    with open(EXPERIMENTS_FILE) as f:
        config = json.load(f)
    exp = config.get("active_experiment")
    if not exp:
        print("No active experiment found in experiments.json.", file=sys.stderr)
        sys.exit(0)
    return exp


# ---------------------------------------------------------------------------
# Filter helpers (from ga4_pull.py pattern)
# ---------------------------------------------------------------------------

def event_equals(event_name):
    return FilterExpression(
        filter=Filter(
            field_name="eventName",
            string_filter=Filter.StringFilter(value=event_name),
        )
    )


def variant_equals(v):
    """Filter to a specific ab_variant value (A or B)."""
    return FilterExpression(
        filter=Filter(
            field_name="customEvent:ab_variant",
            string_filter=Filter.StringFilter(value=v),
        )
    )


# ---------------------------------------------------------------------------
# GA4 query runner
# ---------------------------------------------------------------------------

def run_query(client, q):
    dimensions = [Dimension(name=d) for d in q["dimensions"]]
    metrics = [Metric(name=m) for m in q["metrics"]]
    order_metric = q.get("order_metric") or (q["metrics"][0] if q["metrics"] else None)
    order_bys = (
        [OrderBy(metric=OrderBy.MetricOrderBy(metric_name=order_metric), desc=True)]
        if order_metric
        else []
    )
    req = RunReportRequest(
        property=f"properties/{PROPERTY_ID}",
        date_ranges=[DateRange(start_date=q["start_date"], end_date=q["end_date"])],
        dimensions=dimensions,
        metrics=metrics,
        dimension_filter=q.get("filter"),
        order_bys=order_bys,
        limit=q.get("limit", 500),
    )
    return client.run_report(req)


# ---------------------------------------------------------------------------
# Statistical significance -- two-proportion z-test
# ---------------------------------------------------------------------------

def two_prop_ztest(n_a, x_a, n_b, x_b):
    """
    Returns (z_stat, p_value) for H0: p_A == p_B (two-sided).
    n_a, n_b: total users per variant
    x_a, x_b: users who converted per variant
    """
    if n_a == 0 or n_b == 0:
        return None, None
    p_a = x_a / n_a
    p_b = x_b / n_b
    p_pool = (x_a + x_b) / (n_a + n_b)
    se = math.sqrt(p_pool * (1 - p_pool) * (1 / n_a + 1 / n_b))
    if se == 0:
        return None, None
    z = (p_b - p_a) / se
    # Two-sided p-value using normal approximation
    # P(|Z| > |z|) = 2 * (1 - Phi(|z|))
    p_value = 2 * (1 - _norm_cdf(abs(z)))
    return z, p_value


def _norm_cdf(x):
    """Approximation of the standard normal CDF (no scipy dependency)."""
    # Abramowitz & Stegun approximation 26.2.17
    t = 1 / (1 + 0.2316419 * abs(x))
    poly = t * (0.319381530
                + t * (-0.356563782
                       + t * (1.781477937
                              + t * (-1.821255978
                                     + t * 1.330274429))))
    approx = 1 - (1 / math.sqrt(2 * math.pi)) * math.exp(-x * x / 2) * poly
    return approx if x >= 0 else 1 - approx


def min_sample_size(p_baseline, relative_lift=0.20, alpha=0.05, power=0.80):
    """
    Minimum users per arm needed to detect `relative_lift` from `p_baseline`
    with given alpha and power (two-sided z-test).
    Uses the standard formula: n = (z_alpha/2 + z_beta)^2 * (p1(1-p1) + p2(1-p2)) / (p2-p1)^2
    """
    p2 = p_baseline * (1 + relative_lift)
    z_alpha = 1.96   # alpha = 0.05, two-sided
    z_beta  = 0.842  # power = 0.80
    numerator = (z_alpha + z_beta) ** 2 * (
        p_baseline * (1 - p_baseline) + p2 * (1 - p2)
    )
    denominator = (p2 - p_baseline) ** 2
    if denominator == 0:
        return None
    return math.ceil(numerator / denominator)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    exp = load_experiment()

    experiment_id   = exp["id"]
    start_date      = exp["start_date"]
    target_metric   = exp["target_metric"]
    secondary       = exp.get("secondary_metrics", [])
    min_days        = exp.get("min_days", 14)
    exp_name        = exp.get("name", experiment_id)

    end_date = "today"

    # Days running
    start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
    days_running = (date.today() - start_dt).days

    client = BetaAnalyticsDataClient()
    writer = csv.writer(sys.stdout)

    # ------------------------------------------------------------------
    # Query 1: Users assigned per variant (from ab_variant_assigned event)
    # This is our denominator -- total n per arm.
    # ------------------------------------------------------------------
    writer.writerow([])
    writer.writerow([f"== Experiment: {exp_name} ({experiment_id}) =="])
    writer.writerow([f"== Date range: {start_date} -> today (day {days_running}) =="])

    assignment_query = {
        "title": "Users assigned per variant",
        "start_date": start_date,
        "end_date": end_date,
        "dimensions": ["customEvent:ab_variant"],
        "metrics": ["totalUsers", "eventCount"],
        "filter": event_equals("ab_variant_assigned"),
    }

    writer.writerow([])
    writer.writerow([f"== {assignment_query['title']} =="])
    writer.writerow(["ab_variant", "totalUsers", "eventCount"])

    assignment_resp = run_query(client, assignment_query)
    users_by_variant = {}
    for row in assignment_resp.rows:
        variant = row.dimension_values[0].value
        users   = int(row.metric_values[0].value)
        writer.writerow([variant, users, row.metric_values[1].value])
        users_by_variant[variant] = users

    n_a = users_by_variant.get("A", 0)
    n_b = users_by_variant.get("B", 0)

    # ------------------------------------------------------------------
    # Query 2: Target metric users per variant
    # ------------------------------------------------------------------
    target_query = {
        "title": f"Target metric ({target_metric}) by variant",
        "start_date": start_date,
        "end_date": end_date,
        "dimensions": ["customEvent:ab_variant"],
        "metrics": ["totalUsers", "eventCount"],
        "filter": event_equals(target_metric),
    }

    writer.writerow([])
    writer.writerow([f"== {target_query['title']} =="])
    writer.writerow(["ab_variant", "totalUsers", "eventCount"])

    target_resp = run_query(client, target_query)
    converted_by_variant = {}
    for row in target_resp.rows:
        variant  = row.dimension_values[0].value
        users    = int(row.metric_values[0].value)
        writer.writerow([variant, users, row.metric_values[1].value])
        converted_by_variant[variant] = users

    x_a = converted_by_variant.get("A", 0)
    x_b = converted_by_variant.get("B", 0)

    # ------------------------------------------------------------------
    # Query 3: Secondary metrics per variant (informational)
    # ------------------------------------------------------------------
    for sec_metric in secondary:
        q = {
            "title": f"Secondary metric ({sec_metric}) by variant",
            "start_date": start_date,
            "end_date": end_date,
            "dimensions": ["customEvent:ab_variant"],
            "metrics": ["totalUsers", "eventCount"],
            "filter": event_equals(sec_metric),
        }
        writer.writerow([])
        writer.writerow([f"== {q['title']} =="])
        writer.writerow(["ab_variant", "totalUsers", "eventCount"])
        resp = run_query(client, q)
        for row in resp.rows:
            writer.writerow([
                row.dimension_values[0].value,
                row.metric_values[0].value,
                row.metric_values[1].value,
            ])

    # ------------------------------------------------------------------
    # Statistical analysis
    # ------------------------------------------------------------------
    p_a = (x_a / n_a) if n_a > 0 else 0
    p_b = (x_b / n_b) if n_b > 0 else 0
    lift = ((p_b - p_a) / p_a * 100) if p_a > 0 else 0

    z_stat, p_value = two_prop_ztest(n_a, x_a, n_b, x_b)

    ALPHA = 0.05
    significant = p_value is not None and p_value < ALPHA

    # Minimum sample size needed (based on A's baseline rate, 20% relative lift)
    required_per_arm = min_sample_size(p_a) if p_a > 0 else None

    # Estimate days to significance if not there yet
    days_to_sig = None
    if not significant and required_per_arm and days_running > 0:
        current_total = n_a + n_b
        required_total = required_per_arm * 2
        if current_total < required_total:
            daily_rate = current_total / days_running
            if daily_rate > 0:
                days_to_sig = math.ceil((required_total - current_total) / daily_rate)

    # ------------------------------------------------------------------
    # Plain-text summary (written to stdout after the CSV data)
    # ------------------------------------------------------------------
    summary_lines = [
        "",
        "=" * 60,
        f"EXPERIMENT SUMMARY: {exp_name}",
        f"ID: {experiment_id} | Day {days_running} of {min_days}+ planned",
        "=" * 60,
        "",
        f"Variant A (control) -- {exp.get('variant_a_desc', 'Control')}",
        f"  Users assigned:  {n_a:,}",
        f"  {target_metric}: {x_a:,} ({p_a:.1%})",
        "",
        f"Variant B (test)   -- {exp.get('variant_b_desc', 'Variant B')}",
        f"  Users assigned:  {n_b:,}",
        f"  {target_metric}: {x_b:,} ({p_b:.1%})",
        "",
        f"Lift (B vs A): {lift:+.1f}%",
    ]

    if p_value is not None:
        summary_lines.append(f"p-value: {p_value:.3f} (threshold: {ALPHA})")
    else:
        summary_lines.append("p-value: insufficient data")

    summary_lines.append("")

    if days_running < min_days:
        summary_lines += [
            f"STATUS: Too early -- only {days_running} of {min_days} planned days have passed.",
            "Recommendation: Keep running. Check back at the next scheduled review.",
        ]
    elif not significant:
        if days_to_sig and days_to_sig > 0:
            summary_lines += [
                "STATUS: Not yet significant.",
                f"At current traffic, significance is ~{days_to_sig} more days away.",
                "Recommendation: Keep running.",
            ]
        elif n_a < 50 or n_b < 50:
            summary_lines += [
                "STATUS: Not significant -- sample too small.",
                "Recommendation: Keep running or consider a bolder variant change.",
            ]
        else:
            summary_lines += [
                "STATUS: Not significant after sufficient run time.",
                "Recommendation: The effect (if any) is too small to detect at this traffic level.",
                "Consider: (a) run longer, (b) try a bolder variant, or (c) pick a higher-volume metric.",
            ]
    else:
        winner = "B" if p_b > p_a else "A"
        summary_lines += [
            f"STATUS: SIGNIFICANT -- p={p_value:.3f} < {ALPHA}",
            f"Winner: Variant {winner} ({'+' if lift >= 0 else ''}{lift:.1f}% on {target_metric})",
            f"Recommendation: Ship variant {winner}.",
        ]

    if required_per_arm:
        summary_lines.append(f"(Required per arm for 80% power, 20% MDE: ~{required_per_arm:,} users)")

    summary_lines.append("=" * 60)

    writer.writerow([])
    for line in summary_lines:
        writer.writerow([line])

    # Also print summary to stderr so it shows in terminal even when stdout is redirected
    for line in summary_lines:
        print(line, file=sys.stderr)


if __name__ == "__main__":
    main()
