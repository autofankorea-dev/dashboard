import { notFound } from "next/navigation";
import { FieldPreview } from "./field-preview";
import { fieldPreviewSnapshot } from "./fixture";

export default function MotorBarsPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return <FieldPreview initial={fieldPreviewSnapshot(0)} />;
}
