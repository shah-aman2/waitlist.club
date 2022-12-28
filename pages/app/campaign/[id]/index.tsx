import TextareaAutosize from "react-textarea-autosize";
import toast from "react-hot-toast";
import useSWR, { mutate } from "swr";
import { useDebounce } from "use-debounce";
import { useRouter } from "next/router";
import { useState, useEffect, useCallback } from "react";

import Layout from "@/components/app/Layout";
import Loader from "@/components/app/Loader";
import LoadingDots from "@/components/app/loading-dots";
import { fetcher } from "@/lib/fetcher";
import { HttpMethod, WithAppCampaign } from "@/types";

import type { ChangeEvent } from "react";
import { CampaignType } from "@prisma/client"; 
import type { WithSitePost } from "@/types";
import { PrismaClient } from "@prisma/client";
import { ca } from "date-fns/locale";

interface CampaignData {
  campaignLastDate : Date;
  maxNumber: number;
  name: string;
  campaignType: CampaignType;
}

const CONTENT_PLACEHOLDER = `Write some content. Markdown supported:

# A H1 header

## A H2 header

Fun fact: You embed tweets by pasting the tweet URL in a new line:

https://twitter.com/nextjs/status/1468044361082580995

Paragraphs are separated by a blank line.

2nd paragraph. *Italic*, and **bold**. Itemized lists look like:

  * this one
  * that one
  * the other one

Ordered lists look like:

  1. first item
  2. second item
  3. third item

> Block quotes are written like so.
>
> They can span multiple paragraphs,
> if you like.

            `;

export default function Campaign() {
  const router = useRouter();

  // TODO: Undefined check redirects to error
  const { id: campaignId } = router.query;

  const { data: campaign, isValidating } = useSWR<WithAppCampaign>(
    router.isReady && `/api/campaign?campaignId=${campaignId}`,
    fetcher,
    {
      dedupingInterval: 1000,
      onError: () => router.push("/"),
      revalidateOnFocus: false,
    }
  );

  const [savedState, setSavedState] = useState(
    campaign
      ? `Last saved at ${Intl.DateTimeFormat("en", { month: "short" }).format(
          new Date(campaign.updatedAt)
        )} ${Intl.DateTimeFormat("en", { day: "2-digit" }).format(
          new Date(campaign.updatedAt)
        )} ${Intl.DateTimeFormat("en", {
          hour: "numeric",
          minute: "numeric",
        }).format(new Date(campaign.updatedAt))}`
      : "Saving changes..."
  );

  const [data, setData] = useState<CampaignData>({
    maxNumber: 0,
    campaignLastDate : new Date(),
    name:"",
    campaignType:CampaignType.BOTH
  });

  useEffect(() => {
    if (campaign)
      setData({
        maxNumber: campaign.maxNumber ?? 0,
        campaignLastDate: campaign.campaignLastDate ?? new Date(),
        name: campaign.name ?? "",
        campaignType: campaign.campaignType ?? CampaignType.BOTH

      });
  }, [campaign]);

  const [debouncedData] = useDebounce(data, 1000);

  const saveChanges = useCallback(
    async (data: CampaignData) => {
      setSavedState("Saving changes...");

      try {
        const response = await fetch("/api/campaign", {
          method: HttpMethod.PUT,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: campaignId,
            campaignLastDate:data.campaignLastDate,
            maxNumber:data.maxNumber
          }),
        });

        if (response.ok) {
          const responseData = await response.json();
          setSavedState(
            `Last save ${Intl.DateTimeFormat("en", { month: "short" }).format(
              new Date(responseData.updatedAt)
            )} ${Intl.DateTimeFormat("en", { day: "2-digit" }).format(
              new Date(responseData.updatedAt)
            )} at ${Intl.DateTimeFormat("en", {
              hour: "numeric",
              minute: "numeric",
            }).format(new Date(responseData.updatedAt))}`
          );
        } else {
          setSavedState("Failed to save.");
          toast.error("Failed to save");
        }
      } catch (error) {
        console.error(error);
      }
    },
    [campaignId]
  );

  useEffect(() => {
    if (debouncedData.name) saveChanges(debouncedData);
  }, [debouncedData, saveChanges]);

  const [isActive, setActive] = useState(false);
  const [disabled, setDisabled] = useState(true);

  useEffect(() => {
    if (data.name && data.campaignType  && data.campaignLastDate && data.maxNumber && !isActive)
      setDisabled(false);
    else setDisabled(true);
  }, [isActive, data]);

  useEffect(() => {
    function clickedSave(e: KeyboardEvent) {
      let charCode = String.fromCharCode(e.which).toLowerCase();

      if ((e.ctrlKey || e.metaKey) && charCode === "s") {
        e.preventDefault();
        saveChanges(data);
      }
    }

    window.addEventListener("keydown", clickedSave);

    return () => window.removeEventListener("keydown", clickedSave);
  }, [data, saveChanges]);

  async function publish() {
    setActive(true);

    try {
      const response = await fetch(`/api/campaign`, {
        method: HttpMethod.PUT,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: campaignId,
          name: data.name,
          campaignType : data.campaignType,
          isActive: true,
          subdomain: campaign?.app?.subdomain,
          customDomain: campaign?.app?.customDomain,
          slug: data.name.replaceAll(" ","-")
        }),
      });

      if (response.ok) {
        mutate(`/api/campaign?campaignId=${campaignId}`);
        router.push(
          `https://${campaign?.app?.subdomain}.vercel.pub/${campaign?.slug}`
        );
      }
    } catch (error) {
      console.error(error);
    } finally {
      setActive(false);
    }
  }

  if (isValidating)
    return (
      <Layout>
        <Loader />
      </Layout>
    );
    const campaignTypeOptions = [
      { id: CampaignType.MAX_TOTAL, title: 'MAX Total' },
      { id: CampaignType.DATE_VALIDITY, title: 'Date Validity' },
      { id: CampaignType.BOTH, title: 'Both' },
    ]
  return (
    <>
      <Layout siteId={campaign?.app?.id}>
        <div className="max-w-screen-xl mx-auto px-10 sm:px-20 mt-10 mb-16">
          <TextareaAutosize
            name="name"
            onInput={(e: ChangeEvent<HTMLTextAreaElement>) =>
              setData({
                ...data,
                name: (e.target as HTMLTextAreaElement).value,
              })
            }
            className="w-full px-2 py-4 text-gray-800 placeholder-gray-400 mt-6 text-5xl font-cal resize-none border-none focus:outline-none focus:ring-0"
            placeholder="Sample App"
            value={data.name}
          />
          {/* <TextareaAutosize
            name="description"
            onInput={(e: ChangeEvent<HTMLTextAreaElement>) =>
              setData({
                ...data,
                description: (e.target as HTMLTextAreaElement).value,
              })
            }
            className="w-full px-2 py-3 text-gray-800 placeholder-gray-400 text-xl mb-3 resize-none border-none focus:outline-none focus:ring-0"
            placeholder="No description provided. Click to edit."
            value={data.description}
          /> */}

          <div className="relative mb-6">
            <div
              className="absolute inset-0 flex items-center"
              aria-hidden="true"
            >
              <div className="w-full border-t border-gray-300" />
            </div>
          </div>
          {/* <TextareaAutosize
            name="campaignType"
            onInput={(e: ChangeEvent<HTMLTextAreaElement>) =>
              setData({
                ...data,
                content: (e.target as HTMLTextAreaElement).value,
              })
            }
            className="w-full px-2 py-3 text-gray-800 placeholder-gray-400 text-lg mb-5 resize-none border-none focus:outline-none focus:ring-0"
            placeholder={CONTENT_PLACEHOLDER}
            value={data.content}
          /> */}
        </div>
        <footer className="h-20 z-5 fixed bottom-0 inset-x-0 border-solid border-t border-gray-500 bg-white">
          <div className="max-w-screen-xl mx-auto px-10 sm:px-20 h-full flex justify-between items-center">
            <div className="text-sm">
              <strong>
                <p>{campaign?.isActive ? "Active" : "Not Active"}</p>
              </strong>
              <p>{savedState}</p>
            </div>
            <button
              onClick={async () => {
                await publish();
              }}
              title={
                disabled
                  ? "Post must have a title, description, and content to be published."
                  : "Publish"
              }
              disabled={disabled}
              className={`${
                disabled
                  ? "cursor-not-allowed bg-gray-300 border-gray-300"
                  : "bg-black hover:bg-white hover:text-black border-black"
              } mx-2 w-32 h-12 text-lg text-white border-2 focus:outline-none transition-all ease-in-out duration-150`}
            >
              {isActive ? <LoadingDots /> : "Acitivate  →"}
            </button>
          </div>
        </footer>
      </Layout>
    </>
  );
}
