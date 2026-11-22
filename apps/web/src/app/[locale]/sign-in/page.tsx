import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { SignInForm } from "@/components/SignInForm";

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth");
  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">{t("signInTitle")}</h1>
      <SignInForm />
      <p className="text-sm">
        {t("needAccount")}{" "}
        <Link href="/sign-up" className="text-[var(--color-cta)] underline">
          {t("submitSignUp")}
        </Link>
      </p>
    </div>
  );
}