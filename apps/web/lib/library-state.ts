import type { IdeaStatus, IdeaStatusEvent, LibraryItem } from "./api";

export function reconcileLibraryStatus(
  items: LibraryItem[],
  ideaId: string,
  status: IdeaStatus,
  event: IdeaStatusEvent,
  activeFilter: IdeaStatus | "all",
) {
  if (activeFilter !== "all" && activeFilter !== status) {
    return items.filter((item) => item.idea.id !== ideaId);
  }
  return items.map((item) =>
    item.idea.id === ideaId
      ? {
          ...item,
          saved: { ...item.saved, currentStatus: status },
          status: event,
        }
      : item,
  );
}
