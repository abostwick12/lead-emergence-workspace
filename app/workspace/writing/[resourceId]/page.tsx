import { WritingResourcePage } from "@/components/writing/writing-resource";
export default async function Page({ params }: { params: Promise<{ resourceId: string }> }) {
  const { resourceId } = await params;
  return <WritingResourcePage resourceId={resourceId} />;
}
