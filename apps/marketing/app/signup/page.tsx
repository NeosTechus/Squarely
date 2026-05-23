import { redirect } from "next/navigation";
import { APP_SIGNUP_URL } from "@/lib/appUrl";

// The marketing site has no auth — send visitors to the real app signup.
export default function Signup() {
  redirect(APP_SIGNUP_URL);
}
