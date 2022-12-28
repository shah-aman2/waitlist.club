import type { Campaign, Post, Application } from "@prisma/client";
import type { PropsWithChildren } from "react";

export type WithChildren<T = {}> = T & PropsWithChildren<{}>;

export type WithClassName<T = {}> = T & {
  className?: string;
};

export interface WithSitePost extends Post {
  site: Application | null;
}
export interface WithAppCampaign extends Campaign {
  app: Application | null;
}