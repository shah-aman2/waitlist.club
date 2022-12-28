import type { Application, Campaign, Post, User } from "@prisma/client";

export interface AdjacentPost
  extends Pick<
    Post,
    "createdAt" | "description" | "image" | "imageBlurhash" | "slug" | "title"
  > {}

export interface _AppData extends Application {
  user: User | null;
  posts: Array<Post>;
  campaigns: Array<Campaign>;
}

export interface _SiteSlugData extends Post {
  site: _AppApp | null;
}

interface _AppApp extends Application {
  user: User | null;
}
