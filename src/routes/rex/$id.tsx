import { createFileRoute } from "@tanstack/react-router";
import { RexDynamicFeaturePage } from "@/features/assist/RexDynamicFeaturePage";

export const Route = createFileRoute("/rex/$id")({
  component: DynamicRexFeatureRoute,
});

function DynamicRexFeatureRoute() {
  const { id } = Route.useParams();
  return <RexDynamicFeaturePage id={id} onBack={() => { window.location.assign("/app"); }} />;
}
