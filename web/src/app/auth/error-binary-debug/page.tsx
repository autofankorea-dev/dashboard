import { notFound } from "next/navigation";
import { ErrorBinaryFixture } from "../../../../scripts/fixtures/error-binary-debug";

export const dynamic = "force-dynamic";

export default function ErrorBinaryDebugPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <ErrorBinaryFixture />;
}
