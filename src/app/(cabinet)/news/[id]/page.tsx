import { News } from "@/components/news";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <News id={id} />;
}
