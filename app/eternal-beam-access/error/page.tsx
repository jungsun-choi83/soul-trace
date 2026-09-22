import { EternalBeamAccessError } from "@/components/eternal-beam-access-error";
import { noIndexRobots } from "@/lib/site-url";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "접근 오류",
  robots: noIndexRobots,
};

export default function EternalBeamAccessErrorPage() {
  return <EternalBeamAccessError />;
}
