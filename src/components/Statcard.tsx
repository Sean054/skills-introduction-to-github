type StatCardProps = {
  label: string;
  value: number;
  tone: "total" | "service" | "detail" | "ready";
};

export default function StatCard({ label, value, tone }: StatCardProps) {
  return (
    <article className={`stat-card ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}