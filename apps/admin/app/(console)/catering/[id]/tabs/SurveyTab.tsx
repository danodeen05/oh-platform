"use client";
import { Card } from "@/components/ui/Card";
import { ErrorCard } from "@/components/ui/ErrorCard";
import { SkeletonList } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { api, ApiError } from "@/lib/api";
import { areaTone, surveyTone, type SurveyStats } from "@/lib/catering";
import { shortDate } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

const TONE_BAR = { good: "bg-oh-olive", pending: "bg-oh-gold", alert: "bg-oh-ember" } as const;

export default function SurveyTab({ eventId }: { eventId: string }) {
  const res = useResource(`catering-survey:${eventId}`, async (signal) => {
    try {
      return await api<SurveyStats>(`/admin/catering/events/${eventId}/survey`, { signal });
    } catch (e) {
      // No survey started yet is a genuinely empty state, not a failure to report.
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  });

  if (res.error) return <ErrorCard message="Couldn't load the survey." onRetry={res.reload} />;
  if (res.loading) return <SkeletonList rows={3} />;

  const survey = res.data;
  if (!survey) return <Card><p className="text-[15px] text-oh-stone/70">No survey data available yet.</p></Card>;

  const responses = survey.responses || [];
  const areas = survey.areaAverages || { food: 0, speed: 0, experience: 0, recommend: 0 };
  const responseCount = survey.responseCount ?? responses.length;
  const score = survey.overallScore ?? 0;
  const areaData = [
    { label: "Food", value: areas.food ?? 0 },
    { label: "Speed", value: areas.speed ?? 0 },
    { label: "Experience", value: areas.experience ?? 0 },
    { label: "Recommend", value: areas.recommend ?? 0 },
  ];
  const minArea = areaData.length ? Math.min(...areaData.map((a) => a.value)) : 0;
  const comments = responses.filter((r) => r.comment);

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatTile label="Overall score" value={`${score.toFixed(1)} / 5`} hint={`${responseCount} response${responseCount !== 1 ? "s" : ""}`} tone={surveyTone(score)} />
        {areaData.map((a) => (
          <StatTile key={a.label} label={a.label} value={`${a.value.toFixed(1)} / 5`} tone={areaTone(a.value, a.value === minArea)} />
        ))}
      </div>

      <Card title="Area averages">
        <div className="space-y-3">
          {areaData.map((a) => (
            <div key={a.label}>
              <div className="mb-1 flex justify-between text-sm text-oh-stone"><span>{a.label}</span><span className="tabular-nums">{a.value.toFixed(1)}/5</span></div>
              <div className="h-2 w-full rounded-full bg-oh-stone/15">
                <div className={`h-full rounded-full ${TONE_BAR[areaTone(a.value, a.value === minArea)] ?? "bg-oh-olive"}`} style={{ width: `${Math.min(100, (a.value / 5) * 100)}%` }} /> {/* style-ok: bar width from score */}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {survey.aiSummary && (
        <Card title="AI summary"><p className="text-[15px] leading-relaxed text-oh-charcoal">{survey.aiSummary}</p></Card>
      )}

      <Card title={`Comments (${comments.length})`} padded={false}>
        {comments.length === 0 ? (
          <p className="px-4 py-4 text-[15px] text-oh-stone/70">No written comments yet.</p>
        ) : (
          comments.map((r) => (
            <div key={r.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[15px] font-semibold text-oh-charcoal">{r.guestName || "Anonymous"}</span>
                <span className="text-sm tabular-nums text-oh-stone/60">{shortDate(r.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-oh-stone/80">{r.comment}</p>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
