import { redirect } from "next/navigation";
import { APP_LOGIN_URL } from "@/lib/appUrl";

// The marketing site has no auth — send visitors to the real app login.
export default function Login() {
  redirect(APP_LOGIN_URL);
}
