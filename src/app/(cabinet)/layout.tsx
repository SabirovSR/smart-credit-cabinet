import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/session";
import { CabinetShell } from "@/components/cabinet-shell";
export const dynamic = "force-dynamic";
export default async function CabinetLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  let user;
  try {
    user = await currentUser(
      new Request("http://internal", { headers: { cookie: jar.toString() } }),
    );
  } catch {
    redirect("/login");
  }
  return (
    <CabinetShell companyName={user.company.legalName} inn={user.company.inn}>
      {children}
    </CabinetShell>
  );
}
