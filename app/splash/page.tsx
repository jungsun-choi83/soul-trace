import { redirect } from "next/navigation";

export default function SplashRoutePage() {
  redirect("/?splash=1");
}
