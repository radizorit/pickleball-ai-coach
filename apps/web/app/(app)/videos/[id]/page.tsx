import { VideoDetailClient } from "./video-detail-client";

export default async function VideoDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <VideoDetailClient videoId={id} />;
}
