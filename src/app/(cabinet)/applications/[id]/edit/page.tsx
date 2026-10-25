import { ApplicationForm } from "@/components/application-form";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ApplicationForm id={id} />;
}
