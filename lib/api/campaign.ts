import prisma from "@/lib/prisma";

import { NextApiRequest, NextApiResponse } from "next";
import { unstable_getServerSession } from "next-auth/next";
import { authOptions } from "pages/api/auth/[...nextauth]";
import type { Campaign, Application , CampaignType} from ".prisma/client";
import type { Session } from "next-auth";
import { revalidate } from "@/lib/revalidate";
import { getBlurDataURL, placeholderBlurhash } from "@/lib/util";

import type { WithSitePost } from "@/types";

interface AllCampaign {
  campaigns: Array<Campaign>;
  app: Application | null;
}

/**
 * Get Post
 *
 * Fetches & returns either a single or all posts available depending on
 * whether a `postId` query parameter is provided. If not all posts are
 * returned in descending order.
 *
 * @param req - Next.js API Request
 * @param res - Next.js API Response
 */
export async function getCampaign(
  req: NextApiRequest,
  res: NextApiResponse,
  session: Session
): Promise<void | NextApiResponse<AllCampaign | (WithSitePost | null)>> {
  const { campaignId, appId, published } = req.query;

  if (
    Array.isArray(campaignId) ||
    Array.isArray(appId) ||
    Array.isArray(published) ||
    !session.user.id
  )
    return res.status(400).end("Bad request. Query parameters are not valid.");

  try {
    if (campaignId) {
      const post = await prisma.campaign.findFirst({
        where: {
          id: campaignId,
          app: {
            user: {
              id: session.user.id,
            },
          },
        },
        include: {
          app: true,
        },
      });

      return res.status(200).json(post);
    }

    const app = await prisma.application.findFirst({
      where: {
        id: campaignId,
        user: {
          id: session.user.id,
        },
      },
    });

    const campaigns = !app
      ? []
      : await prisma.post.findMany({
          where: {
            app: {
              id: appId,
            },
            published: JSON.parse(published || "true"),
          },
          orderBy: {
            createdAt: "desc",
          },
        });

    return res.status(200).json({
      campaigns,
      app,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).end(error);
  }
}

/**
 * Create campaign
 *
 * Creates a new post from a provided `siteId` query parameter.
 *
 * Once created, the sites new `postId` will be returned.
 *
 * @param req - Next.js API Request
 * @param res - Next.js API Response
 */
export async function createCampaign(
  req: NextApiRequest,
  res: NextApiResponse,
  session: Session
): Promise<void | NextApiResponse<{
    campaignId: string;
}>> {
  const { appId } = req.query;

  if (!appId || typeof appId !== "string" || !session?.user?.id) {
    return res
      .status(400)
      .json({ error: "Missing or misconfigured app ID or session ID" });
  }

  const app = await prisma.application.findFirst({
    where: {
      id: appId,
      user: {
        id: session.user.id,
      },
    },
  });
  if (!app) return res.status(404).end("app not found");

  try {

    const {name,campaignType} = req.body;
    const response = await prisma.campaign.create({
      data: {
          name,
          campaignType,
        app: {
          connect: {
            id: appId,
          },
        },
      },
    });

    return res.status(201).json({
      campaignId: response.id,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).end(error);
  }
}

/**
 * Delete Post
 *
 * Deletes a post from the database using a provided `postId` query
 * parameter.
 *
 * @param req - Next.js API Request
 * @param res - Next.js API Response
 */
export async function deleteCampaign(
  req: NextApiRequest,
  res: NextApiResponse,
  session: Session
): Promise<void | NextApiResponse> {
  const { campaignId } = req.query;

  if (!campaignId || typeof campaignId !== "string" || !session?.user?.id) {
    return res
      .status(400)
      .json({ error: "Missing or misconfigured site ID or session ID" });
  }

  const app = await prisma.application.findFirst({
    where: {
      campaign: {
        some: {
          id: campaignId,
        },
      },
      user: {
        id: session.user.id,
      },
    },
  });
  if (!app) return res.status(404).end("Site not found");

  try {
    const response = await prisma.campaign.delete({
      where: {
        id: campaignId,
      },
      include: {
        app: {
          select: { subdomain: true, customDomain: true },
        },
      },
    });
    if (response?.app?.subdomain) {
      // revalidate for subdomain
      await revalidate(
        `https://${response.app?.subdomain}.vercel.pub`, // hostname to be revalidated
        response.app.subdomain, // siteId
        response.name, // slugname for the post
      );
    }
    if (response?.app?.customDomain)
      // revalidate for custom domain
      await revalidate(
        `https://${response.app.customDomain}`, // hostname to be revalidated
        response.app.customDomain, // siteId
        response.name// slugname for the post
      );

    return res.status(200).end();
  } catch (error) {
    console.error(error);
    return res.status(500).end(error);
  }
}

/**
 * Update Post
 *
 * Updates a post & all of its data using a collection of provided
 * query parameters. These include the following:
 *  - id
 *  - title
 *  - description
 *  - content
 *  - slug
 *  - image
 *  - imageBlurhash
 *  - published
 *
 * @param req - Next.js API Request
 * @param res - Next.js API Response
 */
export async function updateCampaign(
  req: NextApiRequest,
  res: NextApiResponse,
  session: Session
): Promise<void | NextApiResponse<Campaign>> {
  const {
    id,
    name,
    maxNumber ,
    campaignLastDate ,
    campaignType,
    isActive,
    subdomain,
    customDomain
    
    
  } = req.body;

  if (!id || typeof id !== "string" || !session?.user?.id) {
    return res
      .status(400)
      .json({ error: "Missing or misconfigured site ID or session ID" });
  }

  const app = await prisma.application.findFirst({
    where: {
      campaign: {
        some: {
          id,
        },
      },
      user: {
        id: session.user.id,
      },
    },
  });
  if (!app) return res.status(404).end("Site not found");

  try {
    const campaign = await prisma.campaign.update({
      where: {
        id: id,
      },
      data: {
        name,
        campaignType,
        maxNumber,
        campaignLastDate,
        isActive,
        
      },
    });
    if (subdomain) {
      // revalidate for subdomain
      await revalidate(
        `https://${subdomain}.vercel.pub`, // hostname to be revalidated
        subdomain, // siteId
        name // slugname for the post
      );
    }
    if (customDomain)
      // revalidate for custom domain
      await revalidate(
        `https://${customDomain}`, // hostname to be revalidated
        customDomain, // siteId
        name // slugname for the post
      );

    return res.status(200).json(campaign);
  } catch (error) {
    console.error(error);
    return res.status(500).end(error);
  }
}
