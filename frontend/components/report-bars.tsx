/** One-series bar chart; hover a bar for its value. The same figures are in the table beside it. */
export function ReportBars({
  title,
  data,
  format,
}: {
  title: string;
  data: { label: string; value: number }[];
  format: (n: number) => string;
}) {
  const max = Math.max(0, ...data.map((d) => d.value));
  return (
    <figure className="report-chart">
      <figcaption>{title}</figcaption>
      <div
        className="report-bars"
        role="img"
        aria-label={`${title}, peak ${format(max)}. Daily figures are in the table below.`}
      >
        {data.map((d) => (
          <span key={d.label} title={`${d.label}: ${format(d.value)}`}>
            <i style={{ height: max ? `${(d.value / max) * 100}%` : 0 }} />
          </span>
        ))}
      </div>
      <div className="report-bars-axis">
        <span>{data[0]?.label}</span>
        <span>Peak {format(max)}</span>
        <span>{data.at(-1)?.label}</span>
      </div>
    </figure>
  );
}
