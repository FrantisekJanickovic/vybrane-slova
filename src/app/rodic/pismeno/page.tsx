import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import LetterConfig from "./letter";

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <LetterConfig />
    </Suspense>
  );
}
