"use server";

import { revalidateTag } from "next/cache";

export async function refreshTeamsCache(teamIds: number[]) {
  revalidateTag("skills", "max");
  revalidateTag("skills-world", "max");
  for (const id of teamIds) {
    revalidateTag(`team:${id}`, "max");
    revalidateTag(`team:${id}:awards`, "max");
    revalidateTag(`team:${id}:events`, "max");
    revalidateTag(`team:${id}:rankings`, "max");
  }
}
