import cuid from "cuid";
import { NextApiRequest, NextApiResponse } from "next";
import { unstable_getServerSession } from "next-auth/next";
import { authOptions } from "pages/api/auth/[...nextauth]";
import prisma from "@/lib/prisma";

import type { Application } from ".prisma/client";
import type { Session } from "next-auth";
import { placeholderBlurhash } from "../util";

/**
 * Get Site
 *
 * Fetches & returns either a single or all sites available depending on
 * whether a `siteId` query parameter is provided. If not all sites are
 * returned
 *
 * @param req - Next.js API Request
 * @param res - Next.js API Response
 * @param session - NextAuth.js session
 */
export async function getApp(
  req: NextApiRequest,
  res: NextApiResponse,
  session: Session
): Promise<void | NextApiResponse<Array<Application> | (Application | null)>> {
  const { appId } = req.query;

  if (Array.isArray(appId))
    return res
      .status(400)
      .end("Bad request. siteId parameter cannot be an array.");

  if (!session.user.id)
    return res.status(500).end("Server failed to get session user ID");

  try {
    if (appId) {
      const settings = await prisma.application.findFirst({
        where: {
          id: appId,
          user: {
            id: session.user.id,
          },
        },
      });

      return res.status(200).json(settings);
    }

    const apps = await prisma.application.findMany({
      where: {
        user: {
          id: session.user.id,
        },
      },
    });

    return res.status(200).json(apps);
  } catch (error) {
    console.error(error);
    return res.status(500).end(error);
  }
}

/**
 * Create Site
 *
 * Creates a new site from a set of provided query parameters.
 * These include:
 *  - name
 *  - description
 *  - subdomain
 *  - userId
 *
 * Once created, the sites new `siteId` will be returned.
 *
 * @param req - Next.js API Request
 * @param res - Next.js API Response
 */
export async function createApp(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void | NextApiResponse<{
  siteId: string;
}>> {
  const { name, subdomain, description, userId } = req.body;

  const sub = subdomain.replace(/[^a-zA-Z0-9/-]+/g, "");

  try {
    const response = await prisma.application.create({
      data: {
        name: name,
        description: description,
        subdomain: sub.length > 0 ? sub : cuid(),
        logo: "/logo.png",
        image: `/placeholder.png`,
        imageBlurhash: placeholderBlurhash,
        user: {
          connect: {
            id: userId,
          },
        },
      },
    });

    return res.status(201).json({
      siteId: response.id,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).end(error);
  }
}

/**
 * Delete Site
 *
 * Deletes a site from the database using a provided `siteId` query
 * parameter.
 *
 * @param req - Next.js API Request
 * @param res - Next.js API Response
 */
export async function deleteApp(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void | NextApiResponse> {
  const session = await unstable_getServerSession(req, res, authOptions);
  if (!session?.user.id) return res.status(401).end("Unauthorized");
  const { appId } = req.query;

  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "Missing or misconfigured site ID" });
  }

  const app = await prisma.application.findFirst({
    where: {
      id: appId,
      user: {
        id: session.user.id,
      },
    },
  });
  if (!app) return res.status(404).end("Site not found");

  if (Array.isArray(appId))
    return res
      .status(400)
      .end("Bad request. siteId parameter cannot be an array.");

  try {
    await prisma.$transaction([
      prisma.post.deleteMany({
        where: {
          app: {
            id: appId,
          },
        },
      }),
      prisma.application.delete({
        where: {
          id: appId,
        },
      }),
    ]);

    return res.status(200).end();
  } catch (error) {
    console.error(error);
    return res.status(500).end(error);
  }
}

/**
 * Update site
 *
 * Updates a site & all of its data using a collection of provided
 * query parameters. These include the following:
 *  - id
 *  - currentSubdomain
 *  - name
 *  - description
 *  - image
 *  - imageBlurhash
 *
 * @param req - Next.js API Request
 * @param res - Next.js API Response
 */
export async function updateApp(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void | NextApiResponse<Application>> {
  const session = await unstable_getServerSession(req, res, authOptions);
  if (!session?.user.id) return res.status(401).end("Unauthorized");

  const { id, currentSubdomain, name, description, image, imageBlurhash } =
    req.body;

  if (!id || typeof id !== "string") {
    return res.status(400).json({ error: "Missing or misconfigured site ID" });
  }

  const site = await prisma.application.findFirst({
    where: {
      id,
      user: {
        id: session.user.id,
      },
    },
  });
  if (!site) return res.status(404).end("Site not found");

  const sub = req.body.subdomain.replace(/[^a-zA-Z0-9/-]+/g, "");
  const subdomain = sub.length > 0 ? sub : currentSubdomain;

  try {
    const response = await prisma.application.update({
      where: {
        id: id,
      },
      data: {
        name,
        description,
        subdomain,
        image,
        imageBlurhash,
      },
    });

    return res.status(200).json(response);
  } catch (error) {
    console.error(error);
    return res.status(500).end(error);
  }
}
