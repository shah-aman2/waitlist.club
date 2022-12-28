import { HttpMethod } from "@/types";

export async function revalidate(
  hostname: string, // hostname to be revalidated
  appId: string, // siteId
  slug: string // slugname for the post
) {
  const urlPaths = [`/_apps/${appId}/${slug}`, `/_apps/${appId}`];

  // refer to https://solutions-on-demand-isr.vercel.app/ for more info on bulk/batch revalidate
  try {
    await Promise.all(
      urlPaths.map((urlPath) =>
        fetch(`${hostname}/api/revalidate`, {
          method: HttpMethod.POST,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            urlPath,
          }),
        })
      )
    );
  } catch (err) {
    console.error(err);
  }
}
