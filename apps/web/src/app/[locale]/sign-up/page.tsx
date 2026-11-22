import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SignUpForm } from "@/components/SignUpForm";

export default async function SignUpPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">{t("signUpTitle")}</h1>
      <SignUpForm />
      <p className="text-sm">
        {t("haveAccount")}{" "}
        <Link href="/sign-in" className="text-[var(--color-cta)] underline">
          {t("submitSignIn")}
        </Link>
      </p>
    </div>
  );
}