import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { threatCategoryLabels } from "./lib/threats";
import { THREAT_CATEGORIES, type DashboardData, type PeriodStats, type ThreatCategory } from "./types";

type PeriodMode = "daily" | "weekly" | "monthly";
type ChartRange = "recent" | "year" | "all";
type ChartPoint = PeriodStats & Record<ThreatCategory, number> & { chartLabel: string };

const categoryColors: Record<ThreatCategory, string> = {
  "attack-drone": "#86a7ff",
  "jet-drone": "#9be2c3",
  banderol: "#f6c46d",
  "cruise-missile": "#db88bd",
  "ballistic-missile": "#f07c72",
};

function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("monthly");
  const [chartRange, setChartRange] = useState<ChartRange>("year");

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/kyiv-threats-dashboard.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Trusseldata er ikke generert ennå.");
        }

        return response.json() as Promise<DashboardData>;
      })
      .then(setData)
      .catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : "Kunne ikke laste trusseldata.");
      });
  }, []);

  if (error) {
    return <main className="shell error-card">{error}</main>;
  }

  if (!data) {
    return <main className="shell loading">Laster Kyiv-trusselrapporter...</main>;
  }

  const periods = data[periodMode];
  const chartPeriods = getChartPeriods(periods, periodMode, chartRange);
  const chartData: ChartPoint[] = chartPeriods.map((period) => ({
    ...period,
    ...period.categories,
    chartLabel: formatChartLabel(period, periodMode),
  }));
  const rangeOptions: Array<[ChartRange, string]> = periodMode === "daily" ? [["recent", "Siste 30 dager"], ["year", "Siste år"]] : [["recent", "Nylig"], ["year", "Siste år"], ["all", "Hele serien"]];

  return (
    <main className="shell">
      <header className="masthead">
        <p className="eyebrow">Kildebasert historikk</p>
        <h1>Trusselrapporter mot Kyiv by</h1>
        <p className="lede">Offisielt rapporterte trusler som eksplisitt var i eller på vei mot Kyiv. Tallene er trusselepisoder, ikke bekreftede våpenmengder.</p>
        <div className="metadata">
          <span>Datadekning fra {formatDate(data.metadata.coverageStart)}</span>
          <span>{data.metadata.collectionComplete ? "Historisk innsamling fullført" : "Historisk innsamling pågår"}</span>
          {data.metadata.latestSourceAt ? <span>Siste kildepost: {formatDateTime(data.metadata.latestSourceAt)} Kyiv-tid</span> : null}
        </div>
      </header>

      <section className="controls" aria-label="Diagramvalg">
        <SegmentedControl label="Periode" value={periodMode} options={[["daily", "Dag"], ["weekly", "Uke"], ["monthly", "Måned"]]} onChange={(value) => {
          setPeriodMode(value);
          if (value === "daily" && chartRange === "all") {
            setChartRange("year");
          }
        }} />
        <SegmentedControl label="Tidsrom" value={chartRange} options={rangeOptions} onChange={setChartRange} />
      </section>

      <section className="summary-grid" aria-label="Nøkkeltall">
        <SummaryCard label="Trusselepisoder" value={formatCount(data.metadata.totalEpisodes)} detail="Sammenslåtte meldinger av samme type innen to timer." />
        <SummaryCard label="Kildeobservasjoner" value={formatCount(data.metadata.totalObservations)} detail="Meldinger som oppfyller Kyiv by-regelen." />
        <SummaryCard label="Kildeposter" value={formatCount(data.metadata.totalSourcePosts)} detail="Lagret med lenke til originalmelding." />
      </section>

      <section className="panel chart-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Fordeling</p>
            <h2>Rapporterte trusselepisoder</h2>
          </div>
          <span>{chartData.length} perioder</span>
        </div>
        <ThreatChart data={chartData} />
        <div className="legend" aria-label="Trusseltyper">
          {THREAT_CATEGORIES.map((category) => (
            <span key={category}><i style={{ background: categoryColors[category] }} />{threatCategoryLabels[category]}</span>
          ))}
        </div>
      </section>

      <section className="panel sources-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Etterprøvbart</p>
            <h2>Siste trusselepisoder</h2>
          </div>
          <span>Hver rad har kildeposter</span>
        </div>
        {data.recentEpisodes.length > 0 ? (
          <div className="episode-list">
            {data.recentEpisodes.map((episode) => (
              <article className="episode" key={episode.id}>
                <div>
                  <span className="type-dot" style={{ background: categoryColors[episode.category] }} />
                  <strong>{threatCategoryLabels[episode.category]}</strong>
                  <p>{formatDateTime(episode.startedAt)}{episode.endedAt !== episode.startedAt ? ` til ${formatDateTime(episode.endedAt)}` : ""} Kyiv-tid</p>
                </div>
                <div className="episode-sources">
                  {episode.sourcePosts.slice(0, 3).map((sourcePost) => <a href={sourcePost.url} target="_blank" rel="noreferrer" key={sourcePost.id}>Kilde #{sourcePost.id}</a>)}
                  {episode.sourcePosts.length > 3 ? <span>+{episode.sourcePosts.length - 3} poster</span> : null}
                </div>
              </article>
            ))}
          </div>
        ) : <p className="empty-state">Ingen Kyiv by-observasjoner er samlet inn ennå.</p>}
      </section>

      <footer>
        <p>Ikke bruk denne siden som varslingskanal. Følg alltid offisielle luftalarmer og myndighetenes råd.</p>
        <p>Kilde: <a href={data.metadata.sourceUrl} target="_blank" rel="noreferrer">Ukrainian Air Force på Telegram</a>. «Kyiv oblast» uten eksplisitt retning mot byen er utelatt.</p>
      </footer>
    </main>
  );
}

function ThreatChart({ data }: { data: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <BarChart data={data} margin={{ top: 18, right: 10, bottom: 8, left: -10 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#353844" />
        <XAxis dataKey="chartLabel" tick={{ fill: "#b5b7c4", fontSize: 12 }} tickLine={false} axisLine={false} minTickGap={20} />
        <YAxis allowDecimals={false} tick={{ fill: "#b5b7c4", fontSize: 12 }} tickLine={false} axisLine={false} width={36} />
        <Tooltip content={<ThreatTooltip />} />
        {THREAT_CATEGORIES.map((category) => <Bar dataKey={category} fill={categoryColors[category]} key={category} stackId="threats" />)}
      </BarChart>
    </ResponsiveContainer>
  );
}

function ThreatTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartPoint }> }) {
  if (!active || !payload?.length) {
    return null;
  }

  const period = payload[0].payload;

  return (
    <div className="tooltip">
      <strong>{formatPeriodLabel(period)}</strong>
      <span className="tooltip-total">{formatCount(period.total)} trusselepisoder</span>
      {THREAT_CATEGORIES.filter((category) => period.categories[category] > 0).map((category) => (
        <span className="tooltip-row" key={category}><i style={{ background: categoryColors[category] }} />{threatCategoryLabels[category]}: {formatCount(period.categories[category])}</span>
      ))}
    </div>
  );
}

function SegmentedControl<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: Array<[T, string]>; onChange: (value: T) => void }) {
  return <fieldset><legend>{label}</legend><div className="segmented">{options.map(([optionValue, optionLabel]) => <button className={value === optionValue ? "active" : undefined} type="button" key={optionValue} onClick={() => onChange(optionValue)}>{optionLabel}</button>)}</div></fieldset>;
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="summary-card"><span>{label}</span><strong>{value}</strong><p>{detail}</p></article>;
}

function getChartPeriods(periods: PeriodStats[], mode: PeriodMode, range: ChartRange): PeriodStats[] {
  if (range === "all") {
    return periods;
  }

  const count = range === "year" ? (mode === "daily" ? 365 : mode === "weekly" ? 53 : 12) : mode === "daily" ? 30 : 12;
  return periods.slice(-count);
}

function formatChartLabel(period: PeriodStats, mode: PeriodMode): string {
  if (mode === "daily") return formatDate(period.start, { day: "numeric", month: "short" });
  if (mode === "weekly") return period.id.replace("-W", " u");
  return formatDate(period.start, { month: "short", year: "2-digit" });
}

function formatPeriodLabel(period: PeriodStats): string {
  return `${formatDate(period.start)} til ${formatDate(period.end)}`;
}

function formatDate(value: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }): string {
  return new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Kyiv", ...options }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("nb-NO", { timeZone: "Europe/Kyiv", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("nb-NO").format(value);
}

export default App;
