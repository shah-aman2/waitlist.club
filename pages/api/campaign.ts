import { createCampaign, deleteCampaign, getCampaign, updateCampaign } from "@/lib/api";
import { unstable_getServerSession } from "next-auth/next";

import { authOptions } from "./auth/[...nextauth]";
import { HttpMethod } from "@/types";

import type { NextApiRequest, NextApiResponse } from "next";

export default async function post(req: NextApiRequest, res: NextApiResponse) {
  const session = await unstable_getServerSession(req, res, authOptions);
  if (!session) return res.status(401).end();

  switch (req.method) {
    case HttpMethod.GET:
      return getCampaign(req, res, session);
    case HttpMethod.POST:
      return createCampaign(req, res, session);
    case HttpMethod.DELETE:
      return deleteCampaign(req, res, session);
    case HttpMethod.PUT:
      return updateCampaign(req, res, session);
    default:
      res.setHeader("Allow", [
        HttpMethod.GET,
        HttpMethod.POST,
        HttpMethod.DELETE,
        HttpMethod.PUT,
      ]);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
