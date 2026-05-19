import { VideoReviewClient } from "./video-review-client";

export default async function VideoReviewPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return <VideoReviewClient videoId={id} />;
}
